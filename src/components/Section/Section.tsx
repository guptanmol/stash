import { useRef, useState, useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import type { SectionData } from '../../types';
import { useBoardStore } from '../../store/boardStore';

interface SectionProps {
    data: SectionData;
}

export const Section = ({ data }: SectionProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const { updateSection, removeSection, transform } = useBoardStore();
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(data.title);
    const inputRef = useRef<HTMLInputElement>(null);

    const scale = transform.scale;

    useGesture({
        onDrag: ({ movement: [dx, dy], first, memo }) => {
            let [initialX, initialY] = memo || [data.x, data.y];
            if (first) {
                initialX = data.x;
                initialY = data.y;
            }

            updateSection(data.id, {
                x: initialX + dx / scale,
                y: initialY + dy / scale
            });

            return [initialX, initialY];
        },
    }, {
        target: ref,
        drag: {
            from: () => [data.x, data.y],
            filterTaps: true,
        }
    });

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
        if (e.key === 'Enter') {
            handleSave();
        }
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
                borderColor: `${data.color}40`, // 25% opacity
                backgroundColor: `${data.color}05`, // Very subtle background
                transform: `translate3d(${data.x}px, ${data.y}px, 0)`,
                zIndex: -1 // Behind cards
            }}
        >
            {/* Section Header/Handle */}
            <div
                className="absolute -top-10 left-0 px-4 py-1.5 rounded-full cursor-grab active:cursor-grabbing flex items-center gap-2 group/header"
                style={{ backgroundColor: data.color }}
            >
                {isEditing ? (
                    <input
                        ref={inputRef}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className="bg-transparent border-none outline-none text-black font-bold text-sm min-w-[100px]"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span
                        className="text-black font-bold text-sm select-none"
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
                    className="opacity-0 group-hover/header:opacity-100 transition-opacity text-black/50 hover:text-black"
                    onClick={(e) => {
                        e.stopPropagation();
                        removeSection(data.id);
                    }}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </motion.div>
    );
};
