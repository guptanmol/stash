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

export interface CardData {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    description: string;
    link?: string;
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
