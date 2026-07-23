import { useState } from 'react';
import { useBoardStore } from '../../store/boardStore';
import type { Connection as ConnectionType } from '../../types';

interface ConnectionLineProps {
    data: ConnectionType;
}

export const ConnectionLine = ({ data }: ConnectionLineProps) => {
    const cards = useBoardStore((state) => state.cards);
    const removeConnection = useBoardStore((state) => state.removeConnection);
    const [hovered, setHovered] = useState(false);

    const fromCard = cards.find((c) => c.id === data.fromCardId);
    const toCard = cards.find((c) => c.id === data.toCardId);

    if (!fromCard || !toCard) return null;

    // Center points of the cards
    const fromX = fromCard.x + 150;
    const fromY = fromCard.y + 200;
    const centerToX = toCard.x + 150;
    const centerToY = toCard.y + 200;

    // Pull the line's end back from the target's center so the arrowhead is
    // visible near the card edge instead of hidden underneath the card.
    const dx = centerToX - fromX;
    const dy = centerToY - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    const pull = Math.min(150, dist * 0.4);
    const toX = centerToX - (dx / dist) * pull;
    const toY = centerToY - (dy / dist) * pull;

    // Control points for a horizontal-ease bezier
    const cdx = toX - fromX;
    const controlX1 = fromX + cdx * 0.5;
    const controlY1 = fromY;
    const controlX2 = fromX + cdx * 0.5;
    const controlY2 = toY;

    const path = `M ${fromX} ${fromY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${toX} ${toY}`;

    // Midpoint of the curve (t=0.5) — with these symmetric controls it reduces
    // to the average of the endpoints, which is where we place the delete button.
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;

    return (
        <svg
            className="absolute top-0 left-0"
            style={{ width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
        >
            <defs>
                <marker
                    id={`arrowhead-${data.id}`}
                    markerWidth="10"
                    markerHeight="10"
                    refX="8"
                    refY="3"
                    orient="auto"
                >
                    <polygon points="0 0, 10 3, 0 6" fill={data.color} />
                </marker>
            </defs>

            {/* Visible line with arrowhead */}
            <path
                d={path}
                stroke={data.color}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                markerEnd={`url(#arrowhead-${data.id})`}
                opacity={hovered ? 1 : 0.8}
            />

            {/* Invisible wide hit-area for hover / click */}
            <path
                d={path}
                stroke="transparent"
                strokeWidth="22"
                fill="none"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            />

            {/* Delete button at the midpoint, revealed on hover */}
            {hovered && (
                <g
                    transform={`translate(${midX}, ${midY})`}
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    onClick={(e) => {
                        e.stopPropagation();
                        removeConnection(data.id);
                    }}
                >
                    <circle r="11" fill="#ef4444" stroke="white" strokeWidth="1.5" />
                    <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </g>
            )}
        </svg>
    );
};
