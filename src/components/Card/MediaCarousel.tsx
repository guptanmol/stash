import { useState } from 'react';
import { clsx } from 'clsx';
import type { MediaItem } from '../../types';

interface Props {
    media: MediaItem[];
    activeIndex: number;
    onSelect: (index: number) => void;
}

// macOS-Dock-style magnification: the hovered item is largest and its
// neighbours scale down with distance, so the whole strip "swells" around the
// cursor. Sizes are in px; items past the falloff stay small dots.
const FALLOFF = [54, 36, 22, 14];
const REST = 9;
const REST_ACTIVE = 12;
const PAD = 8;              // container padding
const THUMB_RADIUS = 10;    // inner (thumbnail) corner radius
// Concentric container radius: R = r + padding.
const CONTAINER_RADIUS = THUMB_RADIUS + PAD;
const THUMB_THRESHOLD = 16; // at/above this size, render the actual image

export const MediaCarousel = ({ media, activeIndex, onSelect }: Props) => {
    const [hovered, setHovered] = useState<number | null>(null);

    const sizeFor = (i: number) => {
        if (hovered === null) return i === activeIndex ? REST_ACTIVE : REST;
        const d = Math.abs(i - hovered);
        return d < FALLOFF.length ? FALLOFF[d] : REST;
    };

    return (
        <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-end gap-2 bg-black/45 backdrop-blur-md border border-white/10 shadow-lg"
            style={{ padding: PAD, borderRadius: CONTAINER_RADIUS }}
            onMouseLeave={() => setHovered(null)}
            onClick={(e) => e.stopPropagation()}
        >
            {media.map((m, i) => {
                const size = sizeFor(i);
                const isThumb = size >= THUMB_THRESHOLD;
                const isActive = i === activeIndex;
                return (
                    <button
                        key={m.id}
                        onMouseEnter={() => setHovered(i)}
                        onClick={(e) => { e.stopPropagation(); onSelect(i); }}
                        title={`Image ${i + 1}`}
                        className="shrink-0 flex items-end justify-center transition-all duration-150 ease-out"
                        style={{ width: size, height: size }}
                    >
                        {isThumb ? (
                            <div
                                className="w-full h-full overflow-hidden transition-all duration-150"
                                style={{
                                    borderRadius: THUMB_RADIUS,
                                    boxShadow: isActive
                                        ? '0 0 0 2px #fff'
                                        : '0 0 0 1.5px rgba(255,255,255,0.5)',
                                }}
                            >
                                {m.type === 'video'
                                    ? <video src={m.url} className="w-full h-full object-cover" muted />
                                    : <img src={m.url} className="w-full h-full object-cover" alt="" />}
                            </div>
                        ) : (
                            <div
                                className={clsx('rounded-full transition-all duration-150', isActive ? 'bg-white' : 'bg-white/50')}
                                style={{ width: size, height: size }}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
};
