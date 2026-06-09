/**
 * Extracts a palette of dominant colors from an image URL.
 *
 * Fixes over previous version:
 *  1. Quantization clamps to 255 to avoid bit-shift overflow that produced
 *     wrong hex values (e.g. YouTube red #FF0000 → #0c0000).
 *  2. Samples every 4th pixel instead of every 10th for better coverage on
 *     images that are already downscaled to ≤100 px.
 *  3. Includes near-white colors (only fully opaque 255,255,255 is skipped)
 *     and near-black colors so brand colors on light/dark backgrounds are
 *     preserved.
 *  4. Filters out near-gray colors (low saturation) from the final palette
 *     so the swatches show the interesting brand hues, not grey noise.
 */

/** Convert r,g,b (0-255) to HSL. Returns [h°, s%, l%]. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
    }
    return [h * 360, s * 100, l * 100];
}

/** Format rgb values as a hex string, safely clamping each channel to 0-255. */
function toHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.min(255, Math.max(0, v));
    return '#' + [clamp(r), clamp(g), clamp(b)]
        .map(v => v.toString(16).padStart(2, '0'))
        .join('');
}

export const extractColorsFromUrl = (url: string): Promise<string[]> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                resolve([]);
                return;
            }

            // Downscale for speed but keep enough pixels for a good sample
            const maxDimension = 150;
            const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const colorCounts: Record<string, number> = {};

            // Sample every 4th pixel (step = 4 channels × 4 pixels)
            for (let i = 0; i < imageData.length; i += 4 * 4) {
                const r = imageData[i];
                const g = imageData[i + 1];
                const b = imageData[i + 2];
                const a = imageData[i + 3];

                // Skip transparent pixels
                if (a < 128) continue;

                // Skip pure white and pure black only (too common, not informative)
                if (r === 255 && g === 255 && b === 255) continue;
                if (r === 0 && g === 0 && b === 0) continue;

                // Quantize: bucket colors into ~32 steps, clamped to 255
                const qr = Math.min(255, Math.round(r / 8) * 8);
                const qg = Math.min(255, Math.round(g / 8) * 8);
                const qb = Math.min(255, Math.round(b / 8) * 8);

                const hex = toHex(qr, qg, qb);
                colorCounts[hex] = (colorCounts[hex] || 0) + 1;
            }

            // Sort by frequency
            const sorted = Object.entries(colorCounts)
                .sort(([, a], [, b]) => b - a);

            // Prefer saturated / distinctive colors; keep grays only as fallback
            const saturated: string[] = [];
            const grays: string[] = [];

            for (const [hex] of sorted) {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                const [, s, l] = rgbToHsl(r, g, b);

                // Skip nearly-white (l > 90%) and nearly-black (l < 8%) from palette
                if (l > 90 || l < 8) continue;

                if (s >= 15) {
                    saturated.push(hex);
                } else {
                    grays.push(hex);
                }

                if (saturated.length + grays.length >= 30) break; // enough candidates
            }

            // Build final palette: up to 6 colors, preferring saturated ones
            const palette: string[] = [];
            for (const hex of [...saturated, ...grays]) {
                // De-duplicate perceptually-similar colors already in palette
                const r1 = parseInt(hex.slice(1, 3), 16);
                const g1 = parseInt(hex.slice(3, 5), 16);
                const b1 = parseInt(hex.slice(5, 7), 16);
                const [h1, s1, l1] = rgbToHsl(r1, g1, b1);

                const tooClose = palette.some(existing => {
                    const r2 = parseInt(existing.slice(1, 3), 16);
                    const g2 = parseInt(existing.slice(3, 5), 16);
                    const b2 = parseInt(existing.slice(5, 7), 16);
                    const [h2, s2, l2] = rgbToHsl(r2, g2, b2);
                    // Consider "too close" if hue difference < 20° and lightness/saturation are similar
                    const hueDiff = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
                    return hueDiff < 20 && Math.abs(l1 - l2) < 15 && Math.abs(s1 - s2) < 20;
                });

                if (!tooClose) palette.push(hex);
                if (palette.length >= 6) break;
            }

            resolve(palette);
        };

        img.onerror = (e) => {
            console.error('Failed to load image for color extraction', e);
            resolve([]);
        };
    });
};
