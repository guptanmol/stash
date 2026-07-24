import React, { useRef, useEffect, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import { useBoardStore } from '../../store/boardStore';
import { useContrastTheme } from '../../utils/theme';

export const InfiniteCanvas = ({
    children,
    onCanvasDrop,
    onCanvasClick,
    onMouseDown,
    onMouseMove,
    onMouseUp
}: {
    children?: React.ReactNode;
    onCanvasDrop?: (e: { x: number; y: number; files: FileList }) => void;
    onCanvasClick?: (e: React.MouseEvent, canvasX: number, canvasY: number) => void;
    onMouseDown?: (e: React.MouseEvent, canvasX: number, canvasY: number) => void;
    onMouseMove?: (e: React.MouseEvent, canvasX: number, canvasY: number) => void;
    onMouseUp?: (e: React.MouseEvent, canvasX: number, canvasY: number) => void;
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { transform, setTransform, cards, backgroundColor } = useBoardStore();
    const theme = useContrastTheme();

    // Selection rectangle state
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (onCanvasDrop && e.dataTransfer.files.length > 0) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                const x = (e.clientX - rect.left - transform.x) / transform.scale;
                const y = (e.clientY - rect.top - transform.y) / transform.scale;
                onCanvasDrop({ x, y, files: e.dataTransfer.files });
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    useGesture(
        {
            onDrag: ({ delta: [dx, dy], event }) => {
                // Only pan if middle mouse button is pressed (button 1 or buttons 4)
                if ((event as MouseEvent).buttons === 4) {
                    setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
                }
            },
            onWheel: ({ delta: [dx, dy], ctrlKey, metaKey, event }) => {
                if (ctrlKey || metaKey) {
                    // Zoom
                    const zoomFactor = -dy * 0.01;
                    const newScale = Math.max(0.1, Math.min(5, transform.scale * (1 + zoomFactor)));

                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                        const mouseX = (event as unknown as WheelEvent).clientX - rect.left;
                        const mouseY = (event as unknown as WheelEvent).clientY - rect.top;

                        const scaleRatio = newScale / transform.scale;
                        const newX = mouseX - (mouseX - transform.x) * scaleRatio;
                        const newY = mouseY - (mouseY - transform.y) * scaleRatio;

                        setTransform({ x: newX, y: newY, scale: newScale });
                    }
                } else {
                    // Pan
                    setTransform((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
                }
            },
        },
        {
            target: containerRef,
            eventOptions: { passive: false },
            drag: {
                from: () => [transform.x, transform.y],
                filterTaps: true,
            },
        }
    );

    // Prevent native browser zoom gestures
    useEffect(() => {
        const preventDefault = (e: Event) => e.preventDefault();
        document.addEventListener('gesturestart', preventDefault);
        document.addEventListener('gesturechange', preventDefault);
        return () => {
            document.removeEventListener('gesturestart', preventDefault);
            document.removeEventListener('gesturechange', preventDefault);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-hidden relative touch-none select-none cursor-crosshair"
            style={{ backgroundColor }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onMouseDown={(e) => {
                // Only start selection if clicking on the background (not on a child element)
                if (e.target === containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const canvasX = (e.clientX - rect.left - transform.x) / transform.scale;
                    const canvasY = (e.clientY - rect.top - transform.y) / transform.scale;

                    if (onMouseDown) {
                        onMouseDown(e, canvasX, canvasY);
                    }

                    // Only do default selection if not handled by parent (or if we want both?)
                    // For now, let's assume if onMouseDown is provided, it might handle it.
                    // But actually, we want default selection to happen unless we are in a tool mode.
                    // Since we don't know tool mode here, we'll let parent handle it.
                    // If parent doesn't prevent default or stop propagation, maybe we continue?
                    // But for simplicity, let's just run both and let parent decide via state.

                    setIsSelecting(true);
                    setSelectionStart({ x: canvasX, y: canvasY });
                    setSelectionEnd({ x: canvasX, y: canvasY });
                }
            }}
            onMouseMove={(e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                    const canvasX = (e.clientX - rect.left - transform.x) / transform.scale;
                    const canvasY = (e.clientY - rect.top - transform.y) / transform.scale;

                    if (onMouseMove) {
                        onMouseMove(e, canvasX, canvasY);
                    }

                    if (isSelecting && selectionStart) {
                        setSelectionEnd({ x: canvasX, y: canvasY });
                    }
                }
            }}
            onMouseUp={(e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                    const canvasX = (e.clientX - rect.left - transform.x) / transform.scale;
                    const canvasY = (e.clientY - rect.top - transform.y) / transform.scale;

                    if (onMouseUp) {
                        onMouseUp(e, canvasX, canvasY);
                    }
                }

                if (isSelecting && selectionStart && selectionEnd) {
                    // Calculate selection bounds
                    const minX = Math.min(selectionStart.x, selectionEnd.x);
                    const maxX = Math.max(selectionStart.x, selectionEnd.x);
                    const minY = Math.min(selectionStart.y, selectionEnd.y);
                    const maxY = Math.max(selectionStart.y, selectionEnd.y);

                    const withinBounds = (cx: number, cy: number) =>
                        cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;

                    // Cards and text boxes whose center falls inside the rectangle.
                    const state = useBoardStore.getState();
                    const selectedCards = cards.filter(card =>
                        withinBounds(card.x + (card.width || 300) / 2, card.y + (card.height || 400) / 2)
                    );
                    const selectedTextBoxes = state.textBoxes.filter(tb =>
                        withinBounds(tb.x + (tb.width || 300) / 2, tb.y + (tb.height || 60) / 2)
                    );

                    if (selectedCards.length > 0 || selectedTextBoxes.length > 0) {
                        state.setSelection(selectedCards.map(c => c.id), selectedTextBoxes.map(t => t.id));
                    } else {
                        state.clearSelection();
                    }

                    setIsSelecting(false);
                    setSelectionStart(null);
                    setSelectionEnd(null);
                }
            }}
            onClick={(e) => {
                if (onCanvasClick && e.target === containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const canvasX = (e.clientX - rect.left - transform.x) / transform.scale;
                    const canvasY = (e.clientY - rect.top - transform.y) / transform.scale;
                    onCanvasClick(e, canvasX, canvasY);
                }
            }}
        >
            {/* Grid Background */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: `
            linear-gradient(to right, ${theme.grid} 1px, transparent 1px),
            linear-gradient(to bottom, ${theme.grid} 1px, transparent 1px)
          `,
                    backgroundSize: `${40 * transform.scale}px ${40 * transform.scale}px`,
                    backgroundPosition: `${transform.x}px ${transform.y}px`,
                }}
            />

            {/* Content Layer */}
            <div
                className="absolute top-0 left-0 w-0 h-0 overflow-visible"
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    transformOrigin: '0 0',
                }}
            >
                {children}
            </div>

            {/* Selection Rectangle */}
            {isSelecting && selectionStart && selectionEnd && (
                <div
                    className="absolute pointer-events-none border-2 border-dashed border-[#ccff00] bg-[#ccff00]/10"
                    style={{
                        left: `${Math.min(selectionStart.x, selectionEnd.x) * transform.scale + transform.x}px`,
                        top: `${Math.min(selectionStart.y, selectionEnd.y) * transform.scale + transform.y}px`,
                        width: `${Math.abs(selectionEnd.x - selectionStart.x) * transform.scale}px`,
                        height: `${Math.abs(selectionEnd.y - selectionStart.y) * transform.scale}px`,
                    }}
                />
            )}
        </div>
    );
};
