export interface FontMatch {
    name: string;
    category: string;
    confidence: 'high' | 'medium' | 'low';
    googleFontSlug: string;
}

export interface VoiceMemo {
    id: string;
    url: string;
    duration: number;
    timestamp: number;
}

export interface DesignAnnotation {
    id: string;
    x: number; // percentage (0-100)
    y: number; // percentage (0-100)
    label: string;
    value: string;
    type?: 'spacing' | 'dimension' | 'typography' | 'color';
}

export interface MediaItem {
    id: string;
    url: string;
    type: 'image' | 'video';
    colors?: string[];
    fonts?: FontMatch[];
}

export interface CardData {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    description: string;
    link?: string;
    /** All media on the card. The single `mediaUrl`/`mediaType`/`colors`/`fonts`
     *  below mirror the active item for backward compatibility. */
    media?: MediaItem[];
    activeMediaIndex?: number;
    mediaUrl: string;
    mediaType?: 'image' | 'video';
    voiceMemos: VoiceMemo[];
    tags: { id: string; label: string; x: number; y: number }[];
    sectionId?: string;
    color?: string;
    colors?: string[];
    fonts?: FontMatch[];
    designAnnotations?: DesignAnnotation[];
}

export interface SectionData {
    id: string;
    title: string;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TextBox {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    content: string;
    color: string;
}

export interface Connection {
    id: string;
    fromCardId: string;
    toCardId: string;
    color: string;
}

export type ConnectorSide = 'top' | 'right' | 'bottom' | 'left';

/**
 * An orthogonal connector that starts from one side of a text box and ends
 * either at a free canvas point or pinned to a card (annotation). When pinned,
 * the endpoint is stored as a canvas-space offset from the card origin so it
 * follows the card as it moves.
 */
export interface Connector {
    id: string;
    fromTextBoxId: string;
    fromSide: ConnectorSide;
    color: string;
    toCardId?: string;
    toMediaId?: string; // the specific media item annotated (visible only when it's active)
    toDX?: number; // offset from card origin (canvas units) when pinned
    toDY?: number;
    toX?: number;  // free canvas point when not pinned
    toY?: number;
}
