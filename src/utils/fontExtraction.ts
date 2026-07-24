export interface FontMatch {
    name: string;
    category: string;
    confidence: 'high' | 'medium' | 'low';
    googleFontSlug: string; // for linking to fonts.google.com
}

const SYSTEM_PROMPT = `You are a typography expert. Identify the fonts / typefaces used in any visible text in this image.

Respond with ONLY a JSON array. Each element:
{"name": string, "category": "serif" | "sans-serif" | "monospace" | "display" | "script" | "handwriting", "confidence": "high" | "medium" | "low", "google_font": boolean}

Rules:
- If ANY text is visible, always return at least the primary font — never an empty array just because you're unsure.
- If you can't name the exact typeface, give your closest well-known match and set "confidence" to "low".
- "google_font": true only if it is on Google Fonts (system fonts such as SF Pro, Segoe UI, Helvetica, Arial are false).
- Return at most 5, most prominent first.
- Return [] ONLY when the image genuinely contains no text at all.

Example: [{"name":"Inter","category":"sans-serif","confidence":"high","google_font":true}]`;

// A 1x1 white pixel PNG in base64 — used for vision capability validation
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

// Models known to support multimodal (vision) input — ordered by preference
const VISION_MODEL_PREFERENCES = [
    'models/gemini-2.5-flash-preview-04-17',
    'models/gemini-2.5-flash',
    'models/gemini-2.0-flash',
    'models/gemini-2.0-flash-exp',
    'models/gemini-1.5-flash',
    'models/gemini-1.5-flash-latest',
    'models/gemini-1.5-flash-8b',
    'models/gemini-1.5-pro',
    'models/gemini-1.5-pro-latest',
    'models/gemini-pro-vision',
];

async function imageUrlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const actualMimeType = result.substring(5, result.indexOf(';')) || blob.type || 'image/jpeg';
            const base64 = result.split(',')[1];
            resolve({ base64, mimeType: actualMimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function canvasToBase64(canvas: HTMLCanvasElement): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                resolve({ base64: '', mimeType: 'image/jpeg' });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve({ base64, mimeType: 'image/jpeg' });
            };
            reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.85);
    });
}

async function callGeminiVision(base64: string, mimeType: string, apiKey: string, modelId: string): Promise<FontMatch[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${apiKey}`;

    // Per Google docs: image FIRST, then the text instruction, with role: "user"
    const body = {
        contents: [{
            role: 'user',
            parts: [
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64,
                    }
                },
                { text: SYSTEM_PROMPT },
            ]
        }],
        generationConfig: {
            temperature: 0,
            // Generous budget so "thinking" models (e.g. gemini-2.5-flash) don't
            // spend the whole allowance on reasoning and return empty output.
            maxOutputTokens: 2048,
            // Force pure JSON so we never have to scrape prose/markdown.
            responseMimeType: 'application/json',
        }
    };

    console.log(`[FontExtraction] Calling ${modelId} | mimeType=${mimeType} | base64 length=${base64.length}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];

    // Log full candidate to help debug
    console.log('[FontExtraction] Full candidate:', JSON.stringify(candidate, null, 2));

    const finishReason = candidate?.finishReason;
    if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
        throw new Error(`Gemini blocked response: finishReason=${finishReason}`);
    }

    // Join every text part (a thinking model may split its output).
    const text: string = (candidate?.content?.parts || [])
        .map((p: any) => p?.text)
        .filter(Boolean)
        .join('\n') || '';
    console.log('[FontExtraction] Raw Gemini response text:', text, '| finishReason:', finishReason);

    const tryParse = (s: string): any => { try { return JSON.parse(s); } catch { return null; } };

    // With responseMimeType=application/json the whole body is JSON; fall back to
    // scraping a [...] or {...} block for older models that ignore it.
    let parsed: any = tryParse(text.trim());
    if (parsed == null) {
        const m = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
        if (m) parsed = tryParse(m[0]);
    }

    // Normalize to an array of font entries (handles bare arrays and { fonts: [...] } wrappers).
    const parsedArray: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.fonts)
            ? parsed.fonts
            : (parsed && typeof parsed === 'object' ? (Object.values(parsed).find(Array.isArray) as any[] | undefined) || [] : []);

    if (!parsedArray.length && !text.trim()) {
        console.warn('[FontExtraction] Empty model output (finishReason=%s)', finishReason);
    }

    try {
        // Common non-Google (system/foundry) fonts we should NOT link to Google Fonts.
        const NON_GOOGLE = new Set([
            'arial', 'helvetica', 'helvetica neue', 'times', 'times new roman', 'georgia',
            'courier', 'courier new', 'verdana', 'tahoma', 'calibri', 'cambria', 'segoe ui',
            'sf pro', 'sf pro text', 'sf pro display', 'san francisco', 'system-ui', 'system ui',
            'gill sans', 'futura', 'avenir', 'myriad', 'gotham', 'proxima nova', 'trajan',
        ]);

        const guessCategory = (name: string): string => {
            const n = name.toLowerCase();
            if (n.includes('mono') || n.includes('code') || n.includes('courier')) return 'monospace';
            if (n.includes('serif') || n.includes('georgia') || n.includes('times') ||
                n.includes('garamond') || n.includes('playfair') || n.includes('merriweather')) return 'serif';
            if (n.includes('script') || n.includes('cursive') || n.includes('brush') || n.includes('hand')) return 'script';
            if (n.includes('display') || n.includes('black') || n.includes('condensed')) return 'display';
            return 'sans-serif';
        };

        // Any font we believe is on Google Fonts gets a specimen link generated
        // directly from its name (Google Fonts URLs are just the name, spaces → +).
        const slugFor = (name: string, isGoogle: boolean): string => {
            if (!isGoogle) return '';
            if (NON_GOOGLE.has(name.toLowerCase())) return '';
            return name.trim().replace(/\s+/g, '+');
        };

        // Accept a bare string, or an object under any of the common key names.
        const nameOf = (item: any): string => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') {
                const v = item.name ?? item.font ?? item.fontName ?? item.typeface ?? item.family ?? item.fontFamily;
                return typeof v === 'string' ? v.trim() : '';
            }
            return '';
        };

        const results: FontMatch[] = [];
        for (const item of parsedArray) {
            const name = nameOf(item);
            if (!name) continue;
            const obj = (item && typeof item === 'object') ? item : {};
            const category = obj.category || guessCategory(name);
            const confidence = (['high', 'medium', 'low'].includes(obj.confidence) ? obj.confidence : 'medium') as FontMatch['confidence'];
            const isGoogle = typeof obj.google_font === 'boolean'
                ? obj.google_font
                : !NON_GOOGLE.has(name.toLowerCase());
            results.push({ name, category, confidence, googleFontSlug: slugFor(name, isGoogle) });
        }
        return results;
    } catch (e) {
        console.error('[FontExtraction] JSON parse error:', e);
        return [];
    }
}

export async function extractFontsFromImageUrl(url: string, apiKey: string, modelId: string): Promise<FontMatch[]> {
    try {
        const { base64, mimeType } = await imageUrlToBase64(url);
        if (!base64) return [];
        return await callGeminiVision(base64, mimeType, apiKey, modelId);
    } catch (err: any) {
        console.error('[FontExtraction] Image extraction error:', err);
        return [{ name: `Error: ${err.message}`, category: 'error', confidence: 'low', googleFontSlug: '' }];
    }
}

export async function extractFontsFromVideoFrame(videoEl: HTMLVideoElement, apiKey: string, modelId: string): Promise<FontMatch[]> {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(videoEl.videoWidth, 1280);
        canvas.height = Math.round(canvas.width * (videoEl.videoHeight / videoEl.videoWidth));
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const { base64, mimeType } = await canvasToBase64(canvas);
        if (!base64) return [];
        return await callGeminiVision(base64, mimeType, apiKey, modelId);
    } catch (err: any) {
        console.error('[FontExtraction] Video frame extraction error:', err);
        return [{ name: `Error: ${err.message}`, category: 'error', confidence: 'low', googleFontSlug: '' }];
    }
}

export async function autodiscoverModel(apiKey: string): Promise<{ ok: boolean; error?: string; modelId?: string }> {
    try {
        const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const modelsResp = await fetch(modelsUrl);
        if (!modelsResp.ok) {
            const err = await modelsResp.json().catch(() => ({}));
            return { ok: false, error: err?.error?.message || `HTTP ${modelsResp.status}` };
        }

        const modelsData = await modelsResp.json();
        const availableModels: string[] = modelsData.models?.map((m: any) => m.name) || [];

        console.log('[FontExtraction] Available models for this key:', availableModels);

        // Pick the first vision-capable model from our preference list
        let chosenModel = '';
        for (const pref of VISION_MODEL_PREFERENCES) {
            if (availableModels.includes(pref)) {
                chosenModel = pref;
                break;
            }
        }

        // Last resort: any model containing 'flash' or 'vision' that supports generateContent
        if (!chosenModel) {
            const fallback = modelsData.models?.find((m: any) =>
                m.supportedGenerationMethods?.includes('generateContent') &&
                (m.name.includes('flash') || m.name.includes('vision'))
            );
            chosenModel = fallback?.name ?? '';
        }

        if (!chosenModel) {
            return {
                ok: false,
                error: 'No vision-capable model found. Please ensure Gemini 1.5+ is enabled in your Google AI Studio project.'
            };
        }

        console.log('[FontExtraction] Validating vision capability with model:', chosenModel);

        // Validate with an actual image (tiny 1×1 PNG) — NOT a text-only call.
        // This guarantees the saved model can actually process images.
        const visionUrl = `https://generativelanguage.googleapis.com/v1beta/${chosenModel}:generateContent?key=${apiKey}`;
        const visionBody = {
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'image/png', data: TINY_PNG } },
                    { text: 'Say OK' },
                ]
            }]
        };
        const visionResp = await fetch(visionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(visionBody),
        });

        if (visionResp.ok) {
            console.log('[FontExtraction] Vision validation PASSED:', chosenModel);
            return { ok: true, modelId: chosenModel };
        } else {
            const err = await visionResp.json().catch(() => ({}));
            return { ok: false, error: err?.error?.message || `Vision test failed for ${chosenModel}` };
        }
    } catch (e: any) {
        return { ok: false, error: e.message || 'Network error' };
    }
}
