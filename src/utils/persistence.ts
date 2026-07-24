import { openDB, type DBSchema } from 'idb';
import type { CardData, SectionData, TextBox, Connection, Connector, MediaItem } from '../types';
import { getMedia } from './media';

interface WhiteboardDB extends DBSchema {
    cards: {
        key: string;
        value: CardData & { mediaBlob?: Blob; mediaBlobs?: Record<string, Blob>; voiceMemoBlobs?: Record<string, Blob> };
    };
    boardState: {
        key: string;
        value: {
            id: string;
            transform: { x: number; y: number; scale: number };
            sections: SectionData[];
            backgroundColor?: string;
        };
    };
    textBoxes: {
        key: string;
        value: TextBox;
    };
    connections: {
        key: string;
        value: Connection;
    };
    connectors: {
        key: string;
        value: Connector;
    };
}

const DB_NAME = 'whiteboard-db';
const DB_VERSION = 2;

export const initDB = async () => {
    return openDB<WhiteboardDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('cards')) {
                db.createObjectStore('cards', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('boardState')) {
                db.createObjectStore('boardState', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('textBoxes')) {
                db.createObjectStore('textBoxes', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('connections')) {
                db.createObjectStore('connections', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('connectors')) {
                db.createObjectStore('connectors', { keyPath: 'id' });
            }
        },
    });
};

export const saveConnector = async (connector: Connector) => {
    const db = await initDB();
    await db.put('connectors', connector);
};

export const deleteConnector = async (id: string) => {
    const db = await initDB();
    await db.delete('connectors', id);
};

export const loadConnectors = async (): Promise<Connector[]> => {
    const db = await initDB();
    return db.getAll('connectors');
};

export const saveCard = async (card: CardData) => {
    const db = await initDB();
    const voiceMemoBlobs: Record<string, Blob> = {};
    const mediaBlobs: Record<string, Blob> = {};

    // Persist every media item's blob; keep remote URLs as-is.
    const items = getMedia(card);
    const mediaMeta: MediaItem[] = [];
    for (const it of items) {
        if (it.url && it.url.startsWith('blob:')) {
            try {
                mediaBlobs[it.id] = await (await fetch(it.url)).blob();
                mediaMeta.push({ ...it, url: '' }); // rebuilt from the blob on load
            } catch (error) {
                console.error('Failed to fetch media blob for saving:', error);
                mediaMeta.push({ ...it, url: '' });
            }
        } else {
            mediaMeta.push(it);
        }
    }

    if (card.voiceMemos) {
        for (const memo of card.voiceMemos) {
            if (memo.url && memo.url.startsWith('blob:')) {
                try {
                    const response = await fetch(memo.url);
                    voiceMemoBlobs[memo.id] = await response.blob();
                } catch (error) {
                    console.error('Failed to fetch voice memo blob for saving:', error);
                }
            }
        }
    }

    const activeIdx = Math.min(Math.max(0, card.activeMediaIndex ?? 0), Math.max(0, mediaMeta.length - 1));
    await db.put('cards', {
        ...card,
        media: mediaMeta,
        activeMediaIndex: activeIdx,
        mediaBlobs,
        voiceMemoBlobs,
    });
};

export const deleteCard = async (id: string) => {
    const db = await initDB();
    await db.delete('cards', id);
};

export const loadCards = async (): Promise<CardData[]> => {
    const db = await initDB();
    const cards = await db.getAll('cards');

    return cards.map((card) => {
        const blobs = card.mediaBlobs || {};
        // Rebuild media URLs from stored blobs (or keep remote URLs).
        let media: MediaItem[] = (card.media || []).map((it) => ({
            ...it,
            url: it.url && !it.url.startsWith('blob:')
                ? it.url
                : (blobs[it.id] ? URL.createObjectURL(blobs[it.id]) : (it.url || '')),
        }));
        // Back-compat for cards saved before multi-media (single mediaBlob / remote mediaUrl).
        if (!media.length) {
            if (card.mediaBlob) {
                media = [{ id: `${card.id}-legacy`, url: URL.createObjectURL(card.mediaBlob), type: card.mediaType || 'image', colors: card.colors, fonts: card.fonts }];
            } else if (card.mediaUrl) {
                media = [{ id: `${card.id}-legacy`, url: card.mediaUrl, type: card.mediaType || 'image', colors: card.colors, fonts: card.fonts }];
            }
        }

        const activeIdx = Math.min(Math.max(0, card.activeMediaIndex ?? 0), Math.max(0, media.length - 1));
        const active = media[activeIdx];

        let voiceMemos = card.voiceMemos || [];
        if (card.voiceMemoBlobs) {
            voiceMemos = voiceMemos.map(memo => {
                if (card.voiceMemoBlobs![memo.id]) {
                    return { ...memo, url: URL.createObjectURL(card.voiceMemoBlobs![memo.id]) };
                }
                return memo;
            });
        }

        const { mediaBlob, mediaBlobs, voiceMemoBlobs, ...rest } = card;
        return {
            ...rest,
            media,
            activeMediaIndex: activeIdx,
            mediaUrl: active?.url || '',
            mediaType: active?.type || rest.mediaType,
            colors: active?.colors ?? rest.colors,
            fonts: active?.fonts ?? rest.fonts,
            voiceMemos,
        };
    });
};

export const saveBoardState = async (
    transform: { x: number; y: number; scale: number },
    sections: SectionData[],
    backgroundColor?: string
) => {
    const db = await initDB();
    await db.put('boardState', {
        id: 'current',
        transform,
        sections,
        backgroundColor: backgroundColor || '#0d0d0d'
    });
};

export const loadBoardState = async () => {
    const db = await initDB();
    return db.get('boardState', 'current');
};

export const saveTextBox = async (textBox: TextBox) => {
    const db = await initDB();
    await db.put('textBoxes', textBox);
};

export const deleteTextBox = async (id: string) => {
    const db = await initDB();
    await db.delete('textBoxes', id);
};

export const loadTextBoxes = async (): Promise<TextBox[]> => {
    const db = await initDB();
    return db.getAll('textBoxes');
};

export const saveConnection = async (connection: Connection) => {
    const db = await initDB();
    await db.put('connections', connection);
};

export const deleteConnection = async (id: string) => {
    const db = await initDB();
    await db.delete('connections', id);
};

export const loadConnections = async (): Promise<Connection[]> => {
    const db = await initDB();
    return db.getAll('connections');
};


