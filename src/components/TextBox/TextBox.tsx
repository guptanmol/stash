import { useRef, useState, useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useBoardStore } from '../../store/boardStore';
import type { TextBox as TextBoxType, ConnectorSide } from '../../types';
import { activeMediaId, isConnectorActive } from '../../utils/media';
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
    const selectedTextBoxIds = useBoardStore((state) => state.selectedTextBoxIds);
    const connectors = useBoardStore((state) => state.connectors);
    const cards = useBoardStore((state) => state.cards);
    const isSelected = selectedTextBoxId === data.id || selectedTextBoxIds.includes(data.id);
    const scale = transform.scale;

    // A note that annotates specific image(s) is hidden unless at least one of
    // those images is currently live on its card.
    const myConnectors = connectors.filter((c) => c.fromTextBoxId === data.id);
    const hidden = myConnectors.length > 0 && !myConnectors.some((c) => isConnectorActive(c, cards));

    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(data.content);

    // Keep the stored height in sync with the note's actual rendered height so
    // the connector anchors (and the anchor dots) line up with the visible box.
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const sync = () => {
            const h = el.offsetHeight;
            const cur = useBoardStore.getState().textBoxes.find((t) => t.id === data.id)?.height ?? 0;
            if (h > 0 && Math.abs(h - cur) > 1) updateTextBox(data.id, { height: h });
        };
        sync();
        const ro = new ResizeObserver(sync);
        ro.observe(el);
        return () => ro.disconnect();
    }, [data.id, updateTextBox]);

    // Canvas-space anchor point for a given side of this note.
    const anchor = (side: ConnectorSide) => {
        switch (side) {
            case 'top': return { x: data.x + data.width / 2, y: data.y };
            case 'right': return { x: data.x + data.width, y: data.y + data.height / 2 };
            case 'bottom': return { x: data.x + data.width / 2, y: data.y + data.height };
            case 'left': return { x: data.x, y: data.y + data.height / 2 };
        }
    };

    // Drag out a connector. Listeners are attached synchronously here (not via an
    // effect) so no part of the drag is missed between pointerdown and the next render.
    const beginConnector = (e: React.PointerEvent, side: ConnectorSide) => {
        e.stopPropagation();
        e.preventDefault();
        const a = anchor(side);
        const store = useBoardStore.getState();
        store.startConnector(data.id, side, a.x, a.y);

        const toCanvas = (cx: number, cy: number) => {
            const t = useBoardStore.getState().transform;
            return { x: (cx - t.x) / t.scale, y: (cy - t.y) / t.scale };
        };
        const onMove = (ev: PointerEvent) => {
            const p = toCanvas(ev.clientX, ev.clientY);
            useBoardStore.getState().updateConnectorDraft(p.x, p.y);
        };
        const onUp = (ev: PointerEvent) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            const st = useBoardStore.getState();
            if (!st.connectorDraft) return;
            const p = toCanvas(ev.clientX, ev.clientY);
            // Ignore a near-zero drag (treat as a mis-click).
            if (Math.hypot(p.x - a.x, p.y - a.y) < 10) { st.cancelConnectorDraft(); return; }

            const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
            const cardEl = el?.closest?.('[data-card-id]') as HTMLElement | null;
            const color = data.color || '#ccff00'; // match the note's color
            if (cardEl) {
                const cardId = cardEl.getAttribute('data-card-id')!;
                const card = useBoardStore.getState().cards.find((c) => c.id === cardId);
                if (card) {
                    st.addConnector({
                        id: uuidv4(), fromTextBoxId: data.id, fromSide: side, color,
                        toCardId: cardId,
                        toMediaId: activeMediaId(card) ?? undefined, // pin to the image that's live now
                        toDX: p.x - card.x, toDY: p.y - card.y,
                    });
                    return;
                }
            }
            st.addConnector({ id: uuidv4(), fromTextBoxId: data.id, fromSide: side, color, toX: p.x, toY: p.y });
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    // Drag to move — same gesture model as cards/sections (no double-transform jump).
    // Disabled while editing, and ignored when the drag begins on a connector dot.
    useGesture(
        {
            onDrag: ({ movement: [dx, dy], first, memo, event }) => {
                if (first && (event.target as HTMLElement)?.closest?.('[data-connector-dot]')) {
                    return { skip: true };
                }
                if (memo?.skip) return memo;
                if (isEditing) return memo;
                let [initialX, initialY] = memo || [data.x, data.y];
                if (first) {
                    initialX = data.x;
                    initialY = data.y;
                }
                updateTextBox(data.id, { x: initialX + dx / scale, y: initialY + dy / scale });
                return [initialX, initialY];
            },
        },
        {
            target: ref,
            eventOptions: { passive: false },
            drag: { filterTaps: true },
        }
    );

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
        // Enter inserts a newline (multi-line sticky note); blur/Escape commit.
    };

    // Hidden when it only annotates images that aren't currently active.
    if (hidden) return null;

    return (
        <motion.div
            ref={ref}
            className={clsx(
                'absolute group select-none touch-none',
                isEditing ? 'cursor-text' : 'cursor-grab active:cursor-grabbing'
            )}
            style={{
                left: 0,
                top: 0,
                transform: `translate3d(${data.x}px, ${data.y}px, 0)`,
                width: data.width,
                // Height hugs the content so the anchor dots sit on the real edges.
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
            {/* Delete */}
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

            {/* Glass sticky note — matches the cards' look: dark glass, subtle border,
                soft shadow, and the same 2rem corner radius. The note color is only a
                faint tint, not a hard border. */}
            <div
                className={clsx(
                    'w-full p-4 rounded-[2rem] backdrop-blur-md transition-shadow duration-300',
                    isSelected ? 'ring-2 ring-[#ccff00]/40' : ''
                )}
                style={{
                    minHeight: 52,
                    background: `linear-gradient(145deg, ${data.color}1f, rgba(0,0,0,0.34))`,
                    border: '1px solid rgba(255,255,255,0.10)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
                }}
            >
                {isEditing ? (
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-transparent text-white resize-none focus:outline-none placeholder:text-white/30"
                        style={{ minHeight: '80px' }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                    />
                ) : (
                    <p className="text-white/90 whitespace-pre-wrap leading-relaxed">
                        {data.content || 'Double-click to edit…'}
                    </p>
                )}
            </div>

            {/* Connector anchor dots — drag one out to draw a 90° connector / annotation */}
            {(['top', 'right', 'bottom', 'left'] as ConnectorSide[]).map((side) => {
                const pos: React.CSSProperties =
                    side === 'top' ? { top: 0, left: '50%', transform: 'translate(-50%,-50%)' } :
                    side === 'right' ? { top: '50%', right: 0, transform: 'translate(50%,-50%)' } :
                    side === 'bottom' ? { bottom: 0, left: '50%', transform: 'translate(-50%,50%)' } :
                    { top: '50%', left: 0, transform: 'translate(-50%,-50%)' };
                return (
                    <div
                        key={side}
                        data-connector-dot
                        onPointerDown={(e) => beginConnector(e, side)}
                        title="Drag to create a connector"
                        className="absolute w-3 h-3 rounded-full bg-[#ccff00] border-2 border-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair touch-none z-20"
                        style={pos}
                    />
                );
            })}
        </motion.div>
    );
};
