/**
 * Extracts a representative palette from an image URL using median-cut
 * clustering (the same family of algorithm as Color Thief), rather than
 * counting quantized colour buckets.
 *
 * Why median-cut: bucket-frequency counting scatters smooth gradients across
 * dozens of near-identical bins, so no single colour dominates and whole
 * regions (e.g. a warm sunrise band) get dropped. Median-cut recursively
 * splits the full set of sampled pixels into population-balanced boxes and
 * averages each, so every visually significant region contributes a swatch.
 *
 * Ranking uses population with a mild saturation boost, so the palette stays
 * representative of the image while still surfacing vivid brand hues over
 * muddy neutrals.
 */

type RGB = [number, number, number];

/** Convert r,g,b (0-255) to HSL saturation & lightness (percent). */
function satLight(r: number, g: number, b: number): { s: number; l: number } {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { s: 0, l: l * 100 };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    return { s: s * 100, l: l * 100 };
}

function toHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
    return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Recursively median-cut a pixel list into 2^depth boxes; returns each box's
 *  average colour and how many pixels it represents. */
function medianCut(pixels: RGB[], depth: number): { color: RGB; count: number }[] {
    if (pixels.length === 0) return [];
    if (depth === 0) {
        let r = 0, g = 0, b = 0;
        for (const p of pixels) { r += p[0]; g += p[1]; b += p[2]; }
        const n = pixels.length;
        return [{ color: [r / n, g / n, b / n], count: n }];
    }

    // Channel with the greatest spread → the axis we split on.
    const min: RGB = [255, 255, 255];
    const max: RGB = [0, 0, 0];
    for (const p of pixels) {
        for (let c = 0; c < 3; c++) {
            if (p[c] < min[c]) min[c] = p[c];
            if (p[c] > max[c]) max[c] = p[c];
        }
    }
    const ranges = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const channel = ranges.indexOf(Math.max(...ranges));

    pixels.sort((a, b) => a[channel] - b[channel]);
    const mid = pixels.length >> 1;
    return [
        ...medianCut(pixels.slice(0, mid), depth - 1),
        ...medianCut(pixels.slice(mid), depth - 1),
    ];
}

export const extractColorsFromUrl = (url: string): Promise<string[]> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve([]); return; }

            // Downscale for speed while keeping enough pixels for a good sample.
            const maxDimension = 160;
            const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            let data: Uint8ClampedArray;
            try {
                data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            } catch {
                // Tainted canvas (cross-origin without CORS) — can't read pixels.
                resolve([]);
                return;
            }

            // Collect pixels, skipping transparent and pure black/white extremes
            // (huge flat backgrounds otherwise swamp the whole palette).
            const pixels: RGB[] = [];
            for (let i = 0; i < data.length; i += 4 * 2) { // every 2nd pixel
                const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                if (a < 125) continue;
                if (r > 252 && g > 252 && b > 252) continue;
                if (r < 4 && g < 4 && b < 4) continue;
                pixels.push([r, g, b]);
            }

            if (pixels.length === 0) { resolve([]); return; }

            // Up to 2^4 = 16 candidate clusters.
            const boxes = medianCut(pixels, 4);

            // Rank by population, boosted mildly by saturation so vivid brand
            // colours beat muddy neutrals of similar frequency.
            const scored = boxes.map(({ color, count }) => {
                const { s } = satLight(color[0], color[1], color[2]);
                return { color, score: count * (1 + (s / 100) * 1.5) };
            }).sort((a, b) => b.score - a.score);

            // Greedily pick distinct colours (perceptual-ish RGB distance).
            const chosen: RGB[] = [];
            const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
            for (const { color } of scored) {
                if (chosen.every(c => dist(c, color) > 30)) chosen.push(color);
                if (chosen.length >= 6) break;
            }

            resolve(chosen.map(c => toHex(c[0], c[1], c[2])));
        };

        img.onerror = (e) => {
            console.error('Failed to load image for color extraction', e);
            resolve([]);
        };
    });
};
