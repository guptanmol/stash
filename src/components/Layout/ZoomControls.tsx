import { Minus, Plus, Maximize } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';

export const ZoomControls = () => {
    const { transform, setTransform } = useBoardStore();

    const handleZoomIn = () => {
        setTransform(prev => ({ ...prev, scale: Math.min(5, prev.scale * 1.2) }));
    };

    const handleZoomOut = () => {
        setTransform(prev => ({ ...prev, scale: Math.max(0.1, prev.scale / 1.2) }));
    };

    const handleFitToBoard = () => {
        setTransform({ x: 0, y: 0, scale: 1 });
    };

    return (
        <div className="absolute bottom-2 right-2 flex flex-col items-center gap-2 bg-white/80 backdrop-blur-md border border-border rounded-full p-1 shadow-sm z-50">
            <button onClick={handleZoomIn} className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono w-12 text-center text-muted-foreground">
                {Math.round(transform.scale * 100)}%
            </span>
            <button onClick={handleZoomOut} className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors">
                <Minus className="w-4 h-4" />
            </button>
            <div className="h-px w-4 bg-border my-1" />
            <button onClick={handleFitToBoard} className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors" title="Fit to Board">
                <Maximize className="w-4 h-4" />
            </button>
        </div>
    );
};
