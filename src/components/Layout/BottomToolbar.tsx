import { Square, Type, Palette } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useContrastTheme } from '../../utils/theme';

type ToolMode = 'none' | 'textbox' | 'section';

export const BottomToolbar = () => {
    const {
        selectedCardIds,
        selectedTextBoxId,
        addSection,
        addTextBox,
        updateCard,
        updateTextBox,
    } = useBoardStore();
    const theme = useContrastTheme();

    const [toolMode, setToolMode] = useState<ToolMode>('none');
    const [selectedColor, setSelectedColor] = useState('#ccff00');

    const handleSectionMode = () => {
        const state = useBoardStore.getState();
        const selCards = state.cards.filter((c) => state.selectedCardIds.includes(c.id));
        const selTbs = state.textBoxes.filter((t) => state.selectedTextBoxIds.includes(t.id));

        // If there's an active selection, wrap it in a section immediately.
        if (selCards.length || selTbs.length) {
            const t = state.transform;
            const toCanvas = (cx: number, cy: number) => ({ x: (cx - t.x) / t.scale, y: (cy - t.y) / t.scale });
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const acc = (x1: number, y1: number, x2: number, y2: number) => {
                minX = Math.min(minX, x1); minY = Math.min(minY, y1);
                maxX = Math.max(maxX, x2); maxY = Math.max(maxY, y2);
            };
            // Measure cards from the DOM (their rendered height varies); text boxes
            // have an accurate synced height in the store.
            selCards.forEach((c) => {
                const el = document.querySelector(`[data-card-id="${c.id}"]`);
                if (el) {
                    const r = el.getBoundingClientRect();
                    const a = toCanvas(r.left, r.top); const b = toCanvas(r.right, r.bottom);
                    acc(a.x, a.y, b.x, b.y);
                } else {
                    acc(c.x, c.y, c.x + (c.width || 300), c.y + (c.height || 400));
                }
            });
            selTbs.forEach((tb) => acc(tb.x, tb.y, tb.x + (tb.width || 300), tb.y + (tb.height || 60)));

            const pad = 44;
            (window as any).whiteboardAddSection?.(minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2);
            state.clearSelection();
            setToolMode('none');
            return;
        }

        setToolMode(toolMode === 'section' ? 'none' : 'section');
    };

    const handleTextBoxMode = () => {
        if (toolMode === 'textbox') {
            setToolMode('none');
        } else {
            setToolMode('textbox');
        }
    };

    const handleColorChange = (color: string) => {
        setSelectedColor(color);
        // Apply to all selected cards
        if (selectedCardIds.length > 0) {
            selectedCardIds.forEach(cardId => {
                updateCard(cardId, { color });
            });
        } else if (selectedTextBoxId) {
            updateTextBox(selectedTextBoxId, { color });
        }
    };

    // Expose tool mode and handlers to parent via window (for App.tsx to use)
    if (typeof window !== 'undefined') {
        (window as any).whiteboardToolMode = toolMode;
        (window as any).whiteboardAddTextBox = (x: number, y: number) => {
            addTextBox({
                id: uuidv4(),
                x,
                y,
                width: 300,
                height: 150,
                content: 'New text box',
                color: selectedColor,
            });
            setToolMode('none');
        };
        (window as any).whiteboardAddSection = (x: number, y: number, width: number, height: number) => {
            const sectionCount = useBoardStore.getState().sections.length + 1;
            addSection({
                id: uuidv4(),
                title: `Section ${sectionCount}`,
                color: selectedColor,
                x,
                y,
                width,
                height
            });
            setToolMode('none');
        };
    }

    return (
        <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 rounded-full backdrop-blur-xl border shadow-lg z-50"
            style={{ background: theme.surface, borderColor: theme.border, color: theme.fg }}
        >
            {/* Create Section */}
            <button
                onClick={handleSectionMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${toolMode === 'section'
                    ? 'bg-[#ccff00]/20 text-[#ccff00]'
                    : 'hover:bg-white/10 opacity-70 hover:opacity-100'
                    }`}
                title="Draw Section (Click and drag)"
            >
                <Square className="w-5 h-5" />
                <span className="text-sm font-medium">Section</span>
            </button>

            {/* Divider */}
            <div className="w-px h-6" style={{ background: theme.border }} />

            {/* Insert Text Box */}
            <button
                onClick={handleTextBoxMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${toolMode === 'textbox'
                    ? 'bg-[#ccff00]/20 text-[#ccff00]'
                    : 'hover:bg-white/10 opacity-70 hover:opacity-100'
                    }`}
                title="Insert Text Box (Click canvas)"
            >
                <Type className="w-5 h-5" />
                <span className="text-sm font-medium">Text</span>
            </button>

            {/* Color Picker - Only show when element is selected */}
            {(selectedCardIds.length > 0 || selectedTextBoxId) && (
                <>
                    {/* Divider */}
                    <div className="w-px h-6" style={{ background: theme.border }} />

                    <div className="flex items-center gap-2 px-4 py-2">
                        <Palette className="w-5 h-5 opacity-70" />
                        <input
                            type="color"
                            value={selectedColor}
                            onChange={(e) => handleColorChange(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                            title="Change Color"
                        />
                    </div>
                </>
            )}
        </div>
    );
};
