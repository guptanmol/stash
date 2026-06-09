export interface FontMatch {
    name: string;
    category: string;
    confidence: 'high' | 'medium' | 'low';
    googleFontSlug: string; // for linking to fonts.google.com
}

const SYSTEM_PROMPT = `Identify every font or typeface visible in this image.

Return ONLY a JSON array of font names — no markdown, no explanation, no extra text.
Example: ["Inter", "Playfair Display", "Roboto Mono"]
If there is no text at all, return: []`;

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
            maxOutputTokens: 512,
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

    const text = candidate?.content?.parts?.[0]?.text ?? '[]';
    console.log('[FontExtraction] Raw Gemini response text:', text);

    // Extract everything between outermost [ … ] to handle any conversational wrapper text
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
        console.warn('[FontExtraction] No JSON array found in response');
        return [];
    }

    try {
        const parsed = JSON.parse(match[0]);
        if (!Array.isArray(parsed)) return [];

        // Normalise: accept both simple strings ["Inter"] AND objects [{name:"Inter",...}]
        // Gemini may use either format depending on how it interprets the prompt.
        const GOOGLE_FONT_SLUGS: Record<string, string> = {
            'inter': 'inter', 'roboto': 'roboto', 'open sans': 'open-sans',
            'lato': 'lato', 'montserrat': 'montserrat', 'playfair display': 'playfair-display',
            'playfair': 'playfair-display', 'poppins': 'poppins', 'nunito': 'nunito',
            'raleway': 'raleway', 'oswald': 'oswald', 'merriweather': 'merriweather',
            'source sans': 'source-sans-3', 'pt sans': 'pt-sans', 'ubuntu': 'ubuntu',
            'noto sans': 'noto-sans', 'fira code': 'fira-code', 'jetbrains mono': 'jetbrains-mono',
            'georgia': '', 'arial': '', 'helvetica': '', 'times new roman': '',
            'sf pro': '', 'system-ui': '', 'roboto mono': 'roboto-mono',
        };

        const guessCategory = (name: string): string => {
            const n = name.toLowerCase();
            if (n.includes('mono') || n.includes('code') || n.includes('courier')) return 'monospace';
            if (n.includes('serif') || n.includes('georgia') || n.includes('times') || 
                n.includes('garamond') || n.includes('playfair') || n.includes('merriweather')) return 'serif';
            if (n.includes('script') || n.includes('cursive') || n.includes('brush')) return 'script';
            if (n.includes('display') || n.includes('black') || n.includes('condensed')) return 'display';
            return 'sans-serif';
        };

        const results: FontMatch[] = [];
        for (const item of parsed) {
            if (typeof item === 'string' && item.trim()) {
                // Simple string format: ["Inter", "Playfair Display"]
                const name = item.trim();
                const slug = GOOGLE_FONT_SLUGS[name.toLowerCase()] ?? '';
                results.push({
                    name,
                    category: guessCategory(name),
                    confidence: 'medium',
                    googleFontSlug: slug,
                });
            } else if (item && typeof item === 'object' && typeof item.name === 'string') {
                // Object format: [{name:"Inter", category?:..., confidence?:..., googleFontSlug?:...}]
                const name = item.name.trim();
                const slug = item.googleFontSlug ?? GOOGLE_FONT_SLUGS[name.toLowerCase()] ?? '';
                results.push({
                    name,
                    category: item.category || guessCategory(name),
                    confidence: item.confidence || 'medium',
                    googleFontSlug: slug,
                });
            }
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
