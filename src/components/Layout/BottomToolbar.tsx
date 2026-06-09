import { Square, Workflow, Type, Palette } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

type ToolMode = 'none' | 'connection' | 'textbox' | 'section';

export const BottomToolbar = () => {
    const {
        selectedCardIds,
        selectedTextBoxId,
        addSection,
        addTextBox,
        addConnection,
        updateCard,
        updateTextBox,
    } = useBoardStore();

    const [toolMode, setToolMode] = useState<ToolMode>('none');
    const [connectionStart, setConnectionStart] = useState<string | null>(null);
    const [selectedColor, setSelectedColor] = useState('#ccff00');

    const handleSectionMode = () => {
        if (toolMode === 'section') {
            setToolMode('none');
        } else {
            setToolMode('section');
        }
    };

    const handleConnectionMode = () => {
        if (toolMode === 'connection') {
            setToolMode('none');
            setConnectionStart(null);
        } else {
            setToolMode('connection');
            setConnectionStart(null);
        }
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
        (window as any).whiteboardConnectionStart = connectionStart;
        (window as any).whiteboardSetConnectionStart = setConnectionStart;
        (window as any).whiteboardAddConnection = (fromId: string, toId: string) => {
            addConnection({
                id: uuidv4(),
                fromCardId: fromId,
                toCardId: toId,
                color: selectedColor,
            });
            setConnectionStart(null);
            setToolMode('none');
        };
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg z-50">
            {/* Create Section */}
            <button
                onClick={handleSectionMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${toolMode === 'section'
                    ? 'bg-[#ccff00]/20 text-[#ccff00]'
                    : 'hover:bg-white/20 text-foreground/70 hover:text-foreground'
                    }`}
                title="Draw Section (Click and drag)"
            >
                <Square className="w-5 h-5" />
                <span className="text-sm font-medium">Section</span>
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-foreground/10" />

            {/* Draw Connecting Nodes */}
            <button
                onClick={handleConnectionMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${toolMode === 'connection'
                    ? 'bg-[#ccff00]/20 text-[#ccff00]'
                    : 'hover:bg-white/20 text-foreground/70 hover:text-foreground'
                    }`}
                title="Draw Connecting Nodes (Click two cards)"
            >
                <Workflow className="w-5 h-5" />
                <span className="text-sm font-medium">Connect</span>
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-foreground/10" />

            {/* Insert Text Box */}
            <button
                onClick={handleTextBoxMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${toolMode === 'textbox'
                    ? 'bg-[#ccff00]/20 text-[#ccff00]'
                    : 'hover:bg-white/20 text-foreground/70 hover:text-foreground'
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
                    <div className="w-px h-6 bg-foreground/10" />

                    <div className="flex items-center gap-2 px-4 py-2">
                        <Palette className="w-5 h-5 text-foreground/70" />
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
