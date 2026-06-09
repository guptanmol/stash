import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBoardStore } from '../../store/boardStore';
import type { TextBox as TextBoxType } from '../../types';
import clsx from 'clsx';
import { X } from 'lucide-react';

interface TextBoxProps {
    data: TextBoxType;
}

export const TextBox = ({ data }: TextBoxProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { updateTextBox, removeTextBox, selectTextBox, transform } = useBoardStore();
    const selectedTextBoxId = useBoardStore((state) => state.selectedTextBoxId);
    const isSelected = selectedTextBoxId === data.id;

    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(data.content);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        updateTextBox(data.id, { content });
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setContent(data.content);
            setIsEditing(false);
        }
        // Don't save on Enter for multiline text
    };

    return (
        <motion.div
            ref={ref}
            className={clsx(
                'absolute cursor-move select-none group',
                isSelected && 'ring-2 ring-[#ccff00]/50'
            )}
            style={{
                left: 0,
                top: 0,
                transform: `translate3d(${data.x}px, ${data.y}px, 0)`,
                width: data.width,
                minHeight: data.height,
            }}
            drag
            dragMomentum={false}
            onDragStart={() => selectTextBox(data.id)}
            onDrag={(_, info) => {
                if (!isEditing) {
                    updateTextBox(data.id, {
                        x: data.x + info.delta.x / transform.scale,
                        y: data.y + info.delta.y / transform.scale
                    });
                }
            }}
            onClick={(e) => {
                e.stopPropagation();
                selectTextBox(data.id);
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    removeTextBox(data.id);
                }}
                className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-red-500/80 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                title="Delete text note"
            >
                <X className="w-3.5 h-3.5 text-white" />
            </button>

            <div
                className="w-full h-full p-4 rounded-lg backdrop-blur-md border-2 shadow-lg"
                style={{
                    backgroundColor: `${data.color}20`,
                    borderColor: data.color,
                }}
            >
                {isEditing ? (
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className="w-full h-full bg-transparent text-white resize-none focus:outline-none"
                        style={{ minHeight: '100px' }}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <p className="text-white whitespace-pre-wrap">
                        {data.content || 'Double-click to edit...'}
                    </p>
                )}
            </div>
        </motion.div>
    );
};
