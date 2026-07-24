import { useState } from 'react';
import { useBoardStore } from '../../store/boardStore';
import type { Connector, ConnectorSide, TextBox } from '../../types';
import { isConnectorActive } from '../../utils/media';

interface Pt { x: number; y: number; }

// The connectors live in one big SVG whose viewport actually contains the canvas
// coordinates (a 0×0 svg with overflow:visible hit-tests but does NOT paint
// reliably). We offset a large square viewport and translate a <g> back so the
// child geometry can use raw canvas coordinates.
const OFFSET = 50000;

/** Anchor point (canvas coords) on a given side of a text box. */
function anchorOf(tb: TextBox, side: ConnectorSide): Pt {
    switch (side) {
        case 'top': return { x: tb.x + tb.width / 2, y: tb.y };
        case 'right': return { x: tb.x + tb.width, y: tb.y + tb.height / 2 };
        case 'bottom': return { x: tb.x + tb.width / 2, y: tb.y + tb.height };
        case 'left': return { x: tb.x, y: tb.y + tb.height / 2 };
    }
}

interface Rect { x: number; y: number; w: number; h: number; }

/**
 * Orthogonal route (90° segments only) from a text-box side to an endpoint that
 * first steps clear of the box, then routes around it if the endpoint sits
 * "behind" the exit side — so a connector never overlaps its own note.
 */
function route(s: Pt, side: ConnectorSide, box: Rect, e: Pt): { d: string; elbow: Pt } {
    const S = 26;   // stub — how far to step out before turning
    const CL = 16;  // clearance kept around the box when routing around it

    let stub: Pt;
    switch (side) {
        case 'left': stub = { x: box.x - S, y: s.y }; break;
        case 'right': stub = { x: box.x + box.w + S, y: s.y }; break;
        case 'top': stub = { x: s.x, y: box.y - S }; break;
        case 'bottom': stub = { x: s.x, y: box.y + box.h + S }; break;
    }

    const horizontal = side === 'left' || side === 'right';
    const behind =
        (side === 'left' && e.x > box.x - CL) ||
        (side === 'right' && e.x < box.x + box.w + CL) ||
        (side === 'top' && e.y > box.y - CL) ||
        (side === 'bottom' && e.y < box.y + box.h + CL);

    const pts: Pt[] = [s, stub];
    if (!behind) {
        if (horizontal) pts.push({ x: e.x, y: stub.y });
        else pts.push({ x: stub.x, y: e.y });
        pts.push(e);
    } else if (horizontal) {
        const lane = e.y < box.y + box.h / 2 ? box.y - CL : box.y + box.h + CL;
        pts.push({ x: stub.x, y: lane }, { x: e.x, y: lane }, e);
    } else {
        const lane = e.x < box.x + box.w / 2 ? box.x - CL : box.x + box.w + CL;
        pts.push({ x: lane, y: stub.y }, { x: lane, y: e.y }, e);
    }

    const elbow = pts[Math.max(1, Math.floor(pts.length / 2))];
    const d = 'M ' + pts.map((p) => `${p.x} ${p.y}`).join(' L ');
    return { d, elbow };
}

const ConnectorItem = ({ data }: { data: Connector }) => {
    const textBoxes = useBoardStore((s) => s.textBoxes);
    const cards = useBoardStore((s) => s.cards);
    const removeConnector = useBoardStore((s) => s.removeConnector);
    const [hovered, setHovered] = useState(false);

    const tb = textBoxes.find((t) => t.id === data.fromTextBoxId);
    if (!tb) return null;

    // Only show a connector when the image it annotates is the card's live one.
    if (!isConnectorActive(data, cards)) return null;

    const s = anchorOf(tb, data.fromSide);

    let e: Pt;
    if (data.toCardId) {
        const card = cards.find((c) => c.id === data.toCardId);
        if (!card) return null; // annotated card was deleted
        e = { x: card.x + (data.toDX ?? 0), y: card.y + (data.toDY ?? 0) };
    } else {
        e = { x: data.toX ?? s.x, y: data.toY ?? s.y };
    }

    const box: Rect = { x: tb.x, y: tb.y, w: tb.width, h: tb.height };
    const { d: path, elbow } = route(s, data.fromSide, box, e);

    return (
        <g>
            {/* Dark halo so the line reads on any background (dark board or a bright image) */}
            <path d={path} stroke="rgba(0,0,0,0.55)" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {/* Visible orthogonal line */}
            <path d={path} stroke={data.color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={hovered ? 1 : 0.9} />
            {/* Start node (on the text box) */}
            <circle cx={s.x} cy={s.y} r={4.5} fill={data.color} stroke="#000" strokeOpacity={0.4} strokeWidth={1} />
            {/* Endpoint node (the annotation point) */}
            <circle cx={e.x} cy={e.y} r={6} fill={data.color} stroke="#000" strokeOpacity={0.4} strokeWidth={1.5} />

            {/* Invisible wide hit area for hover/click */}
            <path
                d={path}
                stroke="transparent"
                strokeWidth={18}
                fill="none"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            />

            {hovered && (
                <g
                    transform={`translate(${elbow.x}, ${elbow.y})`}
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    onClick={(ev) => { ev.stopPropagation(); removeConnector(data.id); }}
                >
                    <circle r={10} fill="#ef4444" stroke="white" strokeWidth={1.5} />
                    <line x1={-3.5} y1={-3.5} x2={3.5} y2={3.5} stroke="white" strokeWidth={2} strokeLinecap="round" />
                    <line x1={3.5} y1={-3.5} x2={-3.5} y2={3.5} stroke="white" strokeWidth={2} strokeLinecap="round" />
                </g>
            )}
        </g>
    );
};

/** Live preview while dragging out a new connector. */
const DraftConnector = () => {
    const draft = useBoardStore((s) => s.connectorDraft);
    const textBoxes = useBoardStore((s) => s.textBoxes);
    if (!draft) return null;
    const tb = textBoxes.find((t) => t.id === draft.fromTextBoxId);
    if (!tb) return null;
    const s = anchorOf(tb, draft.fromSide);
    const e = { x: draft.x, y: draft.y };
    const box: Rect = { x: tb.x, y: tb.y, w: tb.width, h: tb.height };
    const { d: path } = route(s, draft.fromSide, box, e);
    const color = tb.color || '#ccff00';
    return (
        <g>
            <path d={path} stroke="rgba(0,0,0,0.5)" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={path} stroke={color} strokeWidth={3} fill="none" strokeDasharray="7 5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={s.x} cy={s.y} r={4.5} fill={color} />
            <circle cx={e.x} cy={e.y} r={6} fill={color} stroke="#000" strokeOpacity={0.4} strokeWidth={1.5} />
        </g>
    );
};

export const ConnectorLayer = () => {
    const connectors = useBoardStore((s) => s.connectors);
    return (
        <svg
            style={{
                position: 'absolute',
                left: -OFFSET,
                top: -OFFSET,
                width: OFFSET * 2,
                height: OFFSET * 2,
                overflow: 'visible',
                pointerEvents: 'none',
                zIndex: 40,
            }}
        >
            {/* Translate back so children can use raw canvas coordinates */}
            <g transform={`translate(${OFFSET}, ${OFFSET})`}>
                {connectors.map((c) => <ConnectorItem key={c.id} data={c} />)}
                <DraftConnector />
            </g>
        </svg>
    );
};
