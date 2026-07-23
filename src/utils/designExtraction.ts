import type { DesignAnnotation } from '../types';
import { v4 as uuidv4 } from 'uuid';

const SYSTEM_PROMPT = `Act as an expert UI/UX designer. Analyze this design image.

Identify up to 10 key design measurements, such as padding, margins, dimensions, gap spacing, or typography sizing. Identify the *type* of design (logo, landing page, UI component) and extract relevant, contextual measurements.

For each measurement, provide the exact x and y coordinates (as percentages from 0 to 100, where 0,0 is top-left) indicating exactly where a dot should be placed on the image to annotate this measurement. Place the dot exactly at the center of the gap or element being measured.

Provide a short label (e.g., "Icon spacing", "Card padding") and the estimated value (e.g., "24px", "16px").

Return ONLY a JSON array of objects with the following keys: "x" (number), "y" (number), "label" (string), "value" (string), "type" (string: 'spacing' | 'dimension' | 'typography' | 'color').

Example:
[
  {"x": 50, "y": 20, "label": "Spacing between icon and text", "value": "24px", "type": "spacing"}
]

If there are no measurements to extract, return: []`;

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

export async function extractDesignAnnotations(url: string, apiKey: string, modelId: string): Promise<DesignAnnotation[]> {
    try {
        const { base64, mimeType } = await imageUrlToBase64(url);
        if (!base64) return [];

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${apiKey}`;

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
                temperature: 0.1,
            }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const candidate = data?.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text ?? '[]';

        const match = text.match(/\[[\s\S]*\]/);
        if (!match) {
            return [];
        }

        const parsed = JSON.parse(match[0]);
        if (!Array.isArray(parsed)) return [];

        return parsed.map((item: any) => ({
            id: uuidv4(),
            x: Number(item.x) || 50,
            y: Number(item.y) || 50,
            label: String(item.label || 'Measurement'),
            value: String(item.value || ''),
            type: item.type || 'dimension'
        }));
    } catch (err) {
        console.error('[DesignExtraction] Error extracting annotations:', err);
        return [];
    }
}
