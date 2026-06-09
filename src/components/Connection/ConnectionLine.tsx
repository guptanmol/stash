import { useBoardStore } from '../../store/boardStore';
import type { Connection as ConnectionType } from '../../types';

interface ConnectionLineProps {
    data: ConnectionType;
}

export const ConnectionLine = ({ data }: ConnectionLineProps) => {
    const cards = useBoardStore((state) => state.cards);

    const fromCard = cards.find((c) => c.id === data.fromCardId);
    const toCard = cards.find((c) => c.id === data.toCardId);

    if (!fromCard || !toCard) return null;

    // Calculate center points of cards
    const fromX = fromCard.x + 150; // Approximate center (cards are ~300px wide)
    const fromY = fromCard.y + 200; // Approximate center
    const toX = toCard.x + 150;
    const toY = toCard.y + 200;

    // Calculate control points for bezier curve
    const dx = toX - fromX;
    const controlX1 = fromX + dx * 0.5;
    const controlY1 = fromY;
    const controlX2 = fromX + dx * 0.5;
    const controlY2 = toY;

    const path = `M ${fromX} ${fromY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${toX} ${toY}`;



    return (
        <svg
            className="absolute top-0 left-0 pointer-events-none"
            style={{
                width: '100%',
                height: '100%',
                overflow: 'visible',
            }}
        >
            <path
                d={path}
                stroke={data.color}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                opacity="0.8"
            />
            {/* Arrow head */}
            <defs>
                <marker
                    id={`arrowhead-${data.id}`}
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                >
                    <polygon points="0 0, 10 3, 0 6" fill={data.color} />
                </marker>
            </defs>
            <path
                d={path}
                stroke={data.color}
                strokeWidth="3"
                fill="none"
                markerEnd={`url(#arrowhead-${data.id})`}
                opacity="0"
            />
        </svg>
    );
};
