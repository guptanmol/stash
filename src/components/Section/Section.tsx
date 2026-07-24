import { useRef, useState, useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import type { SectionData } from '../../types';
import { useBoardStore } from '../../store/boardStore';
import { ensureVisibleHex, readableText } from '../../utils/theme';

interface SectionProps {
    data: SectionData;
}

export const Section = ({ data }: SectionProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const resizeRef = useRef<HTMLDivElement>(null);
    const { updateSection, removeSection, transform, backgroundColor } = useBoardStore();
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(data.title);
    const inputRef = useRef<HTMLInputElement>(null);

    const scale = transform.scale;
    // Keep the section outline visible even if its color matches the background
    // (falls back to black on a bright bg / white on a dark bg), and pick a pill
    // text color that reads on top of that.
    const color = ensureVisibleHex(data.color, backgroundColor);
    const pillText = readableText(color);

    // Move — ignore drags that start on the resize handle.
    useGesture({
        onDrag: ({ movement: [dx, dy], first, memo, event }) => {
            if (first && (event.target as HTMLElement)?.closest?.('[data-section-resize]')) {
                return { skip: true };
            }
            if (memo?.skip) return memo;
            let [initialX, initialY] = memo || [data.x, data.y];
            if (first) {
                initialX = data.x;
                initialY = data.y;
            }
            updateSection(data.id, { x: initialX + dx / scale, y: initialY + dy / scale });
            return [initialX, initialY];
        },
    }, {
        target: ref,
        drag: { filterTaps: true },
    });

    // Resize from the bottom-right corner (native listeners so the move-gesture stays out of it).
    useEffect(() => {
        const el = resizeRef.current;
        if (!el) return;
        const onDown = (e: PointerEvent) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX, startY = e.clientY;
            const startW = data.width, startH = data.height;
            const onMove = (ev: PointerEvent) => {
                const dw = (ev.clientX - startX) / (transform.scale || 1);
                const dh = (ev.clientY - startY) / (transform.scale || 1);
                updateSection(data.id, {
                    width: Math.max(120, startW + dw),
                    height: Math.max(120, startH + dh),
                });
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        };
        el.addEventListener('pointerdown', onDown);
        return () => el.removeEventListener('pointerdown', onDown);
    }, [data.id, data.width, data.height, transform.scale, updateSection]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        if (title.trim()) {
            updateSection(data.id, { title: title.trim() });
        } else {
            setTitle(data.title);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setIsEditing(false);
            setTitle(data.title);
        }
    };

    return (
        <motion.div
            ref={ref}
            className="absolute border-2 rounded-3xl pointer-events-auto group"
            style={{
                left: 0,
                top: 0,
                width: data.width,
                height: data.height,
                borderColor: `${color}66`,
                backgroundColor: `${color}0d`,
                transform: `translate3d(${data.x}px, ${data.y}px, 0)`,
                zIndex: -1, // Behind cards
            }}
        >
            {/* Section Header/Handle */}
            <div
                className="absolute -top-10 left-0 px-4 py-1.5 rounded-full cursor-grab active:cursor-grabbing flex items-center gap-2 group/header"
                style={{ backgroundColor: color }}
            >
                {/* Color dot — change the section color */}
                <input
                    type="color"
                    value={data.color}
                    onChange={(e) => updateSection(data.id, { color: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Section color"
                    className="w-4 h-4 shrink-0 cursor-pointer"
                    style={{ boxShadow: `0 0 0 1.5px ${pillText}55` }}
                />

                {isEditing ? (
                    <input
                        ref={inputRef}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className="bg-transparent border-none outline-none font-bold text-sm min-w-[100px]"
                        style={{ color: pillText }}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span
                        className="font-bold text-sm select-none"
                        style={{ color: pillText }}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                        }}
                    >
                        {data.title}
                    </span>
                )}

                {/* Delete Button */}
                <button
                    className="opacity-0 group-hover/header:opacity-100 transition-opacity"
                    style={{ color: pillText }}
                    onClick={(e) => {
                        e.stopPropagation();
                        removeSection(data.id);
                    }}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Resize handle (bottom-right) */}
            <div
                ref={resizeRef}
                data-section-resize
                title="Drag to resize"
                className="absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-nwse-resize touch-none"
            >
                <div
                    className="w-4 h-4 rounded-md flex items-center justify-center"
                    style={{ background: color }}
                >
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke={pillText} strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M9 3 L3 9 M9 6.5 L6.5 9" />
                    </svg>
                </div>
            </div>
        </motion.div>
    );
};
