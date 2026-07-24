import { Minus, Plus, Maximize } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import { useContrastTheme } from '../../utils/theme';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const clampScale = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

export const ZoomControls = () => {
    const { transform, setTransform, cards, textBoxes } = useBoardStore();
    const theme = useContrastTheme();

    // Zoom while keeping the center of the viewport fixed on screen.
    const zoomBy = (factor: number) => {
        setTransform((prev) => {
            const newScale = clampScale(prev.scale * factor);
            const ratio = newScale / prev.scale;
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            return {
                scale: newScale,
                x: cx - (cx - prev.x) * ratio,
                y: cy - (cy - prev.y) * ratio,
            };
        });
    };

    const handleZoomIn = () => zoomBy(1.2);
    const handleZoomOut = () => zoomBy(1 / 1.2);

    // Frame all content (cards + text boxes) within the viewport.
    const handleFitToBoard = () => {
        const items = [
            ...cards.map((c) => ({ x: c.x, y: c.y, w: c.width || 300, h: c.height || 400 })),
            ...textBoxes.map((t) => ({ x: t.x, y: t.y, w: t.width || 300, h: t.height || 150 })),
        ];

        if (items.length === 0) {
            setTransform({ x: 0, y: 0, scale: 1 });
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const it of items) {
            minX = Math.min(minX, it.x);
            minY = Math.min(minY, it.y);
            maxX = Math.max(maxX, it.x + it.w);
            maxY = Math.max(maxY, it.y + it.h);
        }

        const boardW = Math.max(1, maxX - minX);
        const boardH = Math.max(1, maxY - minY);
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const pad = 100;

        const scale = clampScale(Math.min((vw - pad * 2) / boardW, (vh - pad * 2) / boardH));
        const x = (vw - boardW * scale) / 2 - minX * scale;
        const y = (vh - boardH * scale) / 2 - minY * scale;

        setTransform({ x, y, scale });
    };

    return (
        <div
            className="absolute bottom-2 right-2 flex flex-col items-center gap-2 backdrop-blur-md border rounded-full p-1 shadow-sm z-50"
            style={{ background: theme.surface, borderColor: theme.border, color: theme.fg }}
        >
            <button onClick={handleZoomIn} className="p-2 hover:bg-white/10 rounded-full opacity-70 hover:opacity-100 transition-colors" title="Zoom in">
                <Plus className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono w-12 text-center opacity-70">
                {Math.round(transform.scale * 100)}%
            </span>
            <button onClick={handleZoomOut} className="p-2 hover:bg-white/10 rounded-full opacity-70 hover:opacity-100 transition-colors" title="Zoom out">
                <Minus className="w-4 h-4" />
            </button>
            <div className="h-px w-4 my-1" style={{ background: theme.border }} />
            <button onClick={handleFitToBoard} className="p-2 hover:bg-white/10 rounded-full opacity-70 hover:opacity-100 transition-colors" title="Fit to content">
                <Maximize className="w-4 h-4" />
            </button>
        </div>
    );
};
