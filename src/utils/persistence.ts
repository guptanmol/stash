import { openDB, type DBSchema } from 'idb';
import type { CardData, SectionData, TextBox, Connection } from '../types';

interface WhiteboardDB extends DBSchema {
    cards: {
        key: string;
        value: CardData & { mediaBlob?: Blob; voiceMemoBlobs?: Record<string, Blob> };
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
}

const DB_NAME = 'whiteboard-db';
const DB_VERSION = 1;

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
        },
    });
};

export const saveCard = async (card: CardData) => {
    const db = await initDB();
    let mediaBlob: Blob | undefined;
    const voiceMemoBlobs: Record<string, Blob> = {};

    // If it's a blob URL, we need to fetch the blob to store it
    if (card.mediaUrl && card.mediaUrl.startsWith('blob:')) {
        try {
            const response = await fetch(card.mediaUrl);
            mediaBlob = await response.blob();
        } catch (error) {
            console.error('Failed to fetch blob for saving:', error);
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

    await db.put('cards', { ...card, mediaBlob, voiceMemoBlobs });
};

export const deleteCard = async (id: string) => {
    const db = await initDB();
    await db.delete('cards', id);
};

export const loadCards = async (): Promise<CardData[]> => {
    const db = await initDB();
    const cards = await db.getAll('cards');

    return cards.map((card) => {
        let mediaUrl = card.mediaUrl;
        if (card.mediaBlob) {
            mediaUrl = URL.createObjectURL(card.mediaBlob);
        }
        
        let voiceMemos = card.voiceMemos || [];
        if (card.voiceMemoBlobs) {
            voiceMemos = voiceMemos.map(memo => {
                if (card.voiceMemoBlobs![memo.id]) {
                    return { ...memo, url: URL.createObjectURL(card.voiceMemoBlobs![memo.id]) };
                }
                return memo;
            });
        }

        const { mediaBlob, voiceMemoBlobs, ...rest } = card;
        return { ...rest, mediaUrl, voiceMemos };
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
        backgroundColor: backgroundColor || '#303030'
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


