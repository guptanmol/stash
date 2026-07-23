import { useEffect, useState } from 'react';
import { InfiniteCanvas } from './components/Canvas/InfiniteCanvas';
import { FloatingDock } from './components/Layout/FloatingDock';
import { BottomToolbar } from './components/Layout/BottomToolbar';
import { ZoomControls } from './components/Layout/ZoomControls';
import { useBoardStore } from './store/boardStore';
import { GlassCard } from './components/Card/GlassCard';
import { TextBox } from './components/TextBox/TextBox';
import { Section } from './components/Section/Section';
import { ConnectionLine } from './components/Connection/ConnectionLine';
import { v4 as uuidv4 } from 'uuid';

import { usePreventZoom } from './hooks/usePreventZoom';
import { extractColorsFromUrl } from './utils/colorExtraction';
import { OnboardingOverlay } from './components/Onboarding/OnboardingOverlay';

function App() {
  const { cards, textBoxes, connections, sections, addCard, removeCard, selectedCardIds, clearSelection, transform, selectedTextBoxId, removeTextBox } = useBoardStore();
  usePreventZoom();

  const [sectionStart, setSectionStart] = useState<{ x: number; y: number } | null>(null);
  const [sectionCurrent, setSectionCurrent] = useState<{ x: number; y: number } | null>(null);

  // Delete key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (selectedCardIds.length === 0 && !selectedTextBoxId) return;

      // Only delete if not typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      e.preventDefault();
      if (selectedCardIds.length > 0) {
        selectedCardIds.forEach(cardId => removeCard(cardId));
      }
      if (selectedTextBoxId) {
        removeTextBox(selectedTextBoxId);
      }
      clearSelection();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCardIds, removeCard, clearSelection, selectedTextBoxId, removeTextBox]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      // Process items sequentially to handle async operations correctly
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
          const file = item.getAsFile();
          if (file) {
            const url = URL.createObjectURL(file);
            const isVideo = item.type.startsWith('video/');

            let colors: string[] = [];
            if (!isVideo) {
              try {
                colors = await extractColorsFromUrl(url);
              } catch (error) {
                console.error("Failed to extract colors from pasted image", error);
              }
            }

            // Calculate center of viewport in canvas coordinates
            const viewportCenterX = window.innerWidth / 2;
            const viewportCenterY = window.innerHeight / 2;

            // Transform to canvas space: (screen - pan) / scale
            const canvasX = (viewportCenterX - transform.x) / transform.scale;
            const canvasY = (viewportCenterY - transform.y) / transform.scale;

            // Center the card (width=300, height=400)
            const cardX = canvasX - 150; // 300/2
            const cardY = canvasY - 200; // 400/2

            const cardId = uuidv4();
            addCard({
              id: cardId,
              x: cardX + (Math.random() - 0.5) * 40, // Add slight random offset for stacking
              y: cardY + (Math.random() - 0.5) * 40,
              width: 300,
              height: 400,
              title: isVideo ? "Pasted Video" : "Pasted Image",
              description: "",
              mediaUrl: url,
              mediaType: isVideo ? 'video' : 'image',
              voiceMemos: [],
              tags: [],
              colors: colors
            });
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addCard, transform]);

  useEffect(() => {
    const init = async () => {
      await useBoardStore.getState().loadBoard();

      // Only add sample card if store is still empty after loading
      if (useBoardStore.getState().cards.length === 0) {
        addCard({
          id: uuidv4(),
          x: 400,
          y: 300,
          width: 300,
          height: 400,
          title: "Inspiration",
          description: "Cool design pattern for the new landing page. Love the use of negative space.",
          mediaUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop",
          voiceMemos: [],
          link: "https://dribbble.com",
          tags: [
            { id: "1", label: "Crop", x: -120, y: -80 },
            { id: "2", label: "Inpaint", x: -140, y: 20 },
            { id: "3", label: "Outpaint", x: -80, y: -30 },
            { id: "4", label: "Upscale", x: -100, y: 80 },
            { id: "5", label: "Mask Extractor", x: -40, y: 50 },
            { id: "6", label: "Invert", x: -20, y: -60 },
            { id: "7", label: "Painter", x: 140, y: -80 },
            { id: "8", label: "Channels", x: 120, y: -30 },
            { id: "9", label: "Image Describer", x: 80, y: 10 },
            { id: "10", label: "Relight", x: 140, y: 50 },
            { id: "11", label: "Z Depth Extractor", x: 60, y: 80 },
          ]
        });
      }
    };

    init();
  }, []); // Run once on mount

  const handleCanvasDrop = async ({ x, y, files }: { x: number; y: number; files: FileList }) => {
    // Process files sequentially
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        const isVideo = file.type.startsWith('video/');

        let colors: string[] = [];
        if (!isVideo) {
          try {
            colors = await extractColorsFromUrl(url);
          } catch (error) {
            console.error("Failed to extract colors from dropped image", error);
          }
        }

        const cardId = uuidv4();
        addCard({
          id: cardId,
          x: x + index * 20,
          y: y + index * 20,
          width: 300,
          height: 400,
          title: isVideo ? "Dropped Video" : "Dropped Image",
          description: "",
          mediaUrl: url,
          mediaType: isVideo ? 'video' : 'image',
          voiceMemos: [],
          tags: [],
          colors: colors
        });
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent, canvasX: number, canvasY: number) => {
    // Check if we're in a tool mode
    const toolMode = (window as any).whiteboardToolMode;

    if (toolMode === 'textbox') {
      // Add text box at click position
      (window as any).whiteboardAddTextBox?.(canvasX, canvasY);
      e.stopPropagation();
    }
  };

  const handleMouseDown = (_e: React.MouseEvent, canvasX: number, canvasY: number) => {
    const toolMode = (window as any).whiteboardToolMode;
    if (toolMode === 'section') {
      setSectionStart({ x: canvasX, y: canvasY });
      setSectionCurrent({ x: canvasX, y: canvasY });
    }
  };

  const handleMouseMove = (_e: React.MouseEvent, canvasX: number, canvasY: number) => {
    if (sectionStart) {
      setSectionCurrent({ x: canvasX, y: canvasY });
    }
  };

  const handleMouseUp = () => {
    if (sectionStart && sectionCurrent) {
      const minX = Math.min(sectionStart.x, sectionCurrent.x);
      const maxX = Math.max(sectionStart.x, sectionCurrent.x);
      const minY = Math.min(sectionStart.y, sectionCurrent.y);
      const maxY = Math.max(sectionStart.y, sectionCurrent.y);
      const width = maxX - minX;
      const height = maxY - minY;

      if (width > 10 && height > 10) { // Minimum size
        (window as any).whiteboardAddSection?.(minX, minY, width, height);
      }

      setSectionStart(null);
      setSectionCurrent(null);
    }
  };

  return (
    <div className="w-full h-screen bg-background text-foreground overflow-hidden relative">
      <InfiniteCanvas
        onCanvasDrop={handleCanvasDrop}
        onCanvasClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Render sections first (behind cards) */}
        {sections?.map(section => (
          <Section key={section.id} data={section} />
        ))}

        {/* Render connections first (behind cards) */}
        {connections.map(connection => (
          <ConnectionLine key={connection.id} data={connection} />
        ))}

        {/* Render cards */}
        {cards.map(card => (
          <GlassCard key={card.id} data={card} />
        ))}

        {/* Render text boxes */}
        {textBoxes.map(textBox => (
          <TextBox key={textBox.id} data={textBox} />
        ))}

        {/* Preview Section */}
        {sectionStart && sectionCurrent && (
          <div
            className="absolute border-2 border-[#ccff00] bg-[#ccff00]/10 rounded-3xl pointer-events-none"
            style={{
              left: Math.min(sectionStart.x, sectionCurrent.x),
              top: Math.min(sectionStart.y, sectionCurrent.y),
              width: Math.abs(sectionCurrent.x - sectionStart.x),
              height: Math.abs(sectionCurrent.y - sectionStart.y),
            }}
          />
        )}
      </InfiniteCanvas>

      <FloatingDock />
      <BottomToolbar />
      <ZoomControls />
      <OnboardingOverlay />
    </div>
  )
}

export default App
