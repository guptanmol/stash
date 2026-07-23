/** Audio helpers for voice memos. */

/**
 * Get the duration (in seconds) of an audio blob URL.
 *
 * MediaRecorder-produced WebM often reports `Infinity` for duration until the
 * element is forced to seek to the end, so we handle that case explicitly.
 */
export function getAudioDuration(url: string): Promise<number> {
    return new Promise((resolve) => {
        const audio = new Audio();
        audio.preload = 'metadata';

        const cleanup = () => {
            audio.onloadedmetadata = null;
            audio.ontimeupdate = null;
            audio.onerror = null;
        };

        audio.onloadedmetadata = () => {
            if (audio.duration === Infinity || isNaN(audio.duration)) {
                // Force the browser to compute the real duration by seeking far ahead.
                audio.ontimeupdate = () => {
                    audio.ontimeupdate = null;
                    const d = audio.duration;
                    cleanup();
                    resolve(isFinite(d) ? d : 0);
                };
                audio.currentTime = 1e101;
            } else {
                const d = audio.duration;
                cleanup();
                resolve(isFinite(d) ? d : 0);
            }
        };

        audio.onerror = () => {
            cleanup();
            resolve(0);
        };

        audio.src = url;
    });
}

/** Format a duration in seconds as `m:ss` (e.g. 83 → "1:23"). */
export function formatDuration(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return '0:00';
    const total = Math.round(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
