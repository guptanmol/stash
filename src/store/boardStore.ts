import { create } from 'zustand';
import type { CardData, SectionData, TextBox, Connection, Connector, ConnectorSide, MediaItem } from '../types';
import { getMedia } from '../utils/media';

interface Transform {
    x: number;
    y: number;
    scale: number;
}

interface BoardState {
    transform: Transform;
    cards: CardData[];
    sections: SectionData[];
    textBoxes: TextBox[];
    connections: Connection[];
    connectors: Connector[];
    connectorDraft: { fromTextBoxId: string; fromSide: ConnectorSide; x: number; y: number } | null;
    selectedCardIds: string[];
    selectedTextBoxId: string | null;
    selectedTextBoxIds: string[];
    backgroundColor: string;
    searchQuery: string;

    setTransform: (transform: Transform | ((prev: Transform) => Transform)) => void;
    updateTransform: (partial: Partial<Transform>) => void;
    setBackgroundColor: (color: string) => void;
    setSearchQuery: (query: string) => void;

    addCard: (card: CardData) => void;
    updateCard: (id: string, partial: Partial<CardData>) => void;
    removeCard: (id: string) => void;
    addMediaToCard: (cardId: string, item: MediaItem) => void;
    setActiveMedia: (cardId: string, index: number) => void;
    updateMediaItem: (cardId: string, mediaId: string, partial: Partial<MediaItem>) => void;
    selectCard: (id: string, multiSelect?: boolean) => void;
    selectCards: (ids: string[]) => void;
    setSelection: (cardIds: string[], textBoxIds: string[]) => void;
    clearSelection: () => void;

    addSection: (section: SectionData) => void;
    updateSection: (id: string, partial: Partial<SectionData>) => void;
    removeSection: (id: string) => void;
    addTextBox: (textBox: TextBox) => void;
    updateTextBox: (id: string, partial: Partial<TextBox>) => void;
    removeTextBox: (id: string) => void;
    selectTextBox: (id: string | null) => void;

    addConnection: (connection: Connection) => void;
    removeConnection: (id: string) => void;

    addConnector: (connector: Connector) => void;
    removeConnector: (id: string) => void;
    startConnector: (fromTextBoxId: string, fromSide: ConnectorSide, x: number, y: number) => void;
    updateConnectorDraft: (x: number, y: number) => void;
    cancelConnectorDraft: () => void;

    loadBoard: () => Promise<void>;
}

import { saveCard, deleteCard, saveBoardState, loadCards, loadBoardState, saveTextBox, deleteTextBox, loadTextBoxes, saveConnection, deleteConnection, loadConnections, saveConnector, deleteConnector, loadConnectors } from '../utils/persistence';

export const useBoardStore = create<BoardState>((set) => {
    const store = {
        transform: { x: 0, y: 0, scale: 1 },
        cards: [],
        sections: [],
        textBoxes: [],
        connections: [],
        connectors: [],
        connectorDraft: null,
        selectedCardIds: [],
        selectedTextBoxId: null,
        selectedTextBoxIds: [],
        backgroundColor: '#0d0d0d',
        searchQuery: '',

        setTransform: (updater: any) => {
            set((state) => {
                const newTransform = typeof updater === 'function' ? updater(state.transform) : updater;
                saveBoardState(newTransform, state.sections, state.backgroundColor); // Auto-save transform
                return { transform: newTransform };
            });
        },
        updateTransform: (partial: Partial<Transform>) => {
            set((state) => {
                const newTransform = { ...state.transform, ...partial };
                saveBoardState(newTransform, state.sections, state.backgroundColor); // Auto-save transform
                return { transform: newTransform };
            });
        },
        setBackgroundColor: (color: string) => {
            set((state) => {
                saveBoardState(state.transform, state.sections, color);
                return { backgroundColor: color };
            });
        },
        setSearchQuery: (query: string) => set({ searchQuery: query }),

        addCard: (card: CardData) => {
            set((state) => ({ cards: [...state.cards, card] }));
            saveCard(card); // Auto-save new card
        },
        updateCard: (id: string, partial: Partial<CardData>) => {
            set((state) => {
                const updatedCards = state.cards.map((c) => {
                    if (c.id === id) {
                        const updated = { ...c, ...partial };
                        saveCard(updated); // Auto-save updated card
                        return updated;
                    }
                    return c;
                });
                return { cards: updatedCards };
            });
        },
        removeCard: (id: string) => {
            set((state) => ({ cards: state.cards.filter((c) => c.id !== id) }));
            deleteCard(id); // Auto-delete card
        },
        addMediaToCard: (cardId: string, item: MediaItem) => {
            set((state) => {
                const cards = state.cards.map((c) => {
                    if (c.id !== cardId) return c;
                    const media = [...getMedia(c), item];
                    const activeMediaIndex = media.length - 1;
                    const updated: CardData = {
                        ...c, media, activeMediaIndex,
                        mediaUrl: item.url, mediaType: item.type, colors: item.colors, fonts: item.fonts,
                    };
                    saveCard(updated);
                    return updated;
                });
                return { cards };
            });
        },
        setActiveMedia: (cardId: string, index: number) => {
            set((state) => {
                const cards = state.cards.map((c) => {
                    if (c.id !== cardId) return c;
                    const media = getMedia(c);
                    const i = Math.min(Math.max(0, index), media.length - 1);
                    const it = media[i];
                    if (!it) return c;
                    // Persist the normalized media array so legacy cards get one too.
                    const updated: CardData = {
                        ...c, media, activeMediaIndex: i,
                        mediaUrl: it.url, mediaType: it.type, colors: it.colors, fonts: it.fonts,
                    };
                    saveCard(updated);
                    return updated;
                });
                return { cards };
            });
        },
        updateMediaItem: (cardId: string, mediaId: string, partial: Partial<MediaItem>) => {
            set((state) => {
                const cards = state.cards.map((c) => {
                    if (c.id !== cardId) return c;
                    const media = getMedia(c).map((m) => (m.id === mediaId ? { ...m, ...partial } : m));
                    const i = Math.min(Math.max(0, c.activeMediaIndex ?? 0), media.length - 1);
                    const active = media[i];
                    const updated: CardData = {
                        ...c, media,
                        // keep the mirror fields in sync when the active item changed
                        colors: active?.colors, fonts: active?.fonts,
                    };
                    saveCard(updated);
                    return updated;
                });
                return { cards };
            });
        },
        selectCard: (id: string, multiSelect = false) => {
            set((state) => {
                if (multiSelect) {
                    // Toggle card in selection
                    const isSelected = state.selectedCardIds.includes(id);
                    return {
                        selectedCardIds: isSelected
                            ? state.selectedCardIds.filter(cardId => cardId !== id)
                            : [...state.selectedCardIds, id],
                        selectedTextBoxId: null,
                        selectedTextBoxIds: [],
                    };
                } else {
                    // Single select
                    return {
                        selectedCardIds: [id],
                        selectedTextBoxId: null,
                        selectedTextBoxIds: [],
                    };
                }
            });
        },
        selectCards: (ids: string[]) => set({ selectedCardIds: ids, selectedTextBoxId: null, selectedTextBoxIds: [] }),
        setSelection: (cardIds: string[], textBoxIds: string[]) =>
            set({ selectedCardIds: cardIds, selectedTextBoxIds: textBoxIds, selectedTextBoxId: null }),
        clearSelection: () => set({ selectedCardIds: [], selectedTextBoxId: null, selectedTextBoxIds: [] }),

        addSection: (section: SectionData) =>
            set((state) => {
                const updatedSections = [...state.sections, section];
                // Capture any cards the new section is drawn over.
                const updatedCards = state.cards.map((card) => {
                    const cx = card.x + (card.width || 300) / 2;
                    const cy = card.y + (card.height || 400) / 2;
                    const inside =
                        cx >= section.x && cx <= section.x + section.width &&
                        cy >= section.y && cy <= section.y + section.height;
                    if (inside && card.sectionId !== section.id) {
                        const updated = { ...card, sectionId: section.id };
                        saveCard(updated);
                        return updated;
                    }
                    return card;
                });
                saveBoardState(state.transform, updatedSections, state.backgroundColor); // Persist new section immediately
                return { sections: updatedSections, cards: updatedCards };
            }),
        updateSection: (id: string, partial: Partial<SectionData>) =>
            set((state) => {
                const section = state.sections.find((s) => s.id === id);
                if (!section) return {};

                // Calculate delta if position changed
                let dx = 0;
                let dy = 0;
                if (partial.x !== undefined && partial.y !== undefined) {
                    dx = partial.x - section.x;
                    dy = partial.y - section.y;
                }

                // Update cards if moved
                let updatedCards = state.cards;
                if (dx !== 0 || dy !== 0) {
                    updatedCards = state.cards.map((card) => {
                        if (card.sectionId === id) {
                            const updated = { ...card, x: card.x + dx, y: card.y + dy };
                            saveCard(updated);
                            return updated;
                        }
                        return card;
                    });
                }

                const updatedSections = state.sections.map((s) => (s.id === id ? { ...s, ...partial } : s));

                // Capture any card the section now covers (drawn/resized/moved over it).
                const ns = { ...section, ...partial };
                updatedCards = updatedCards.map((card) => {
                    if (card.sectionId === id) return card;
                    const cx = card.x + (card.width || 300) / 2;
                    const cy = card.y + (card.height || 400) / 2;
                    const inside =
                        cx >= ns.x && cx <= ns.x + ns.width &&
                        cy >= ns.y && cy <= ns.y + ns.height;
                    if (inside) {
                        const updated = { ...card, sectionId: id };
                        saveCard(updated);
                        return updated;
                    }
                    return card;
                });

                saveBoardState(state.transform, updatedSections, state.backgroundColor);

                return {
                    sections: updatedSections,
                    cards: updatedCards,
                };
            }),

        removeSection: (id: string) =>
            set((state) => {
                // Ungroup cards
                const updatedCards = state.cards.map((card) => {
                    if (card.sectionId === id) {
                        const updated = { ...card, sectionId: undefined };
                        saveCard(updated);
                        return updated;
                    }
                    return card;
                });

                const updatedSections = state.sections.filter((s) => s.id !== id);
                saveBoardState(state.transform, updatedSections, state.backgroundColor);

                return {
                    sections: updatedSections,
                    cards: updatedCards,
                };
            }),

        addTextBox: (textBox: TextBox) => {
            set((state) => ({ textBoxes: [...state.textBoxes, textBox] }));
            saveTextBox(textBox);
        },
        updateTextBox: (id: string, partial: Partial<TextBox>) => {
            set((state) => {
                const updatedTextBoxes = state.textBoxes.map((tb) => {
                    if (tb.id === id) {
                        const updated = { ...tb, ...partial };
                        saveTextBox(updated);
                        return updated;
                    }
                    return tb;
                });
                return { textBoxes: updatedTextBoxes };
            });
        },
        removeTextBox: (id: string) => {
            set((state) => ({ textBoxes: state.textBoxes.filter((tb) => tb.id !== id) }));
            deleteTextBox(id);
        },
        selectTextBox: (id: string | null) => set({ selectedTextBoxId: id, selectedCardIds: [] }),

        addConnection: (connection: Connection) => {
            set((state) => ({ connections: [...state.connections, connection] }));
            saveConnection(connection);
        },
        removeConnection: (id: string) => {
            set((state) => ({ connections: state.connections.filter((c) => c.id !== id) }));
            deleteConnection(id);
        },

        addConnector: (connector: Connector) => {
            set((state) => ({ connectors: [...state.connectors, connector], connectorDraft: null }));
            saveConnector(connector);
        },
        removeConnector: (id: string) => {
            set((state) => ({ connectors: state.connectors.filter((c) => c.id !== id) }));
            deleteConnector(id);
        },
        startConnector: (fromTextBoxId: string, fromSide: ConnectorSide, x: number, y: number) =>
            set({ connectorDraft: { fromTextBoxId, fromSide, x, y } }),
        updateConnectorDraft: (x: number, y: number) =>
            set((state) => (state.connectorDraft ? { connectorDraft: { ...state.connectorDraft, x, y } } : {})),
        cancelConnectorDraft: () => set({ connectorDraft: null }),

        loadBoard: async () => {
            const [cards, boardState, textBoxes, connections, connectors] = await Promise.all([
                loadCards(),
                loadBoardState(),
                loadTextBoxes(),
                loadConnections(),
                loadConnectors()
            ]);

            if (boardState) {
                set({
                    transform: boardState.transform,
                    sections: boardState.sections,
                    backgroundColor: boardState.backgroundColor || '#0d0d0d'
                });
            }

            if (cards.length > 0) {
                set({ cards });
            }
            if (textBoxes && textBoxes.length > 0) {
                set({ textBoxes });
            }
            if (connections && connections.length > 0) {
                set({ connections });
            }
            if (connectors && connectors.length > 0) {
                set({ connectors });
            }
        }
    };

    return store;
});
