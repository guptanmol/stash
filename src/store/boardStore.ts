import { create } from 'zustand';
import type { CardData, SectionData, TextBox, Connection } from '../types';

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
    selectedCardIds: string[];
    selectedTextBoxId: string | null;
    backgroundColor: string;
    searchQuery: string;

    setTransform: (transform: Transform | ((prev: Transform) => Transform)) => void;
    updateTransform: (partial: Partial<Transform>) => void;
    setBackgroundColor: (color: string) => void;
    setSearchQuery: (query: string) => void;

    addCard: (card: CardData) => void;
    updateCard: (id: string, partial: Partial<CardData>) => void;
    removeCard: (id: string) => void;
    selectCard: (id: string, multiSelect?: boolean) => void;
    selectCards: (ids: string[]) => void;
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

    loadBoard: () => Promise<void>;
}

import { saveCard, deleteCard, saveBoardState, loadCards, loadBoardState, saveTextBox, deleteTextBox, loadTextBoxes, saveConnection, deleteConnection, loadConnections } from '../utils/persistence';

export const useBoardStore = create<BoardState>((set) => {
    const store = {
        transform: { x: 0, y: 0, scale: 1 },
        cards: [],
        sections: [],
        textBoxes: [],
        connections: [],
        selectedCardIds: [],
        selectedTextBoxId: null,
        backgroundColor: '#303030',
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
                    };
                } else {
                    // Single select
                    return {
                        selectedCardIds: [id],
                        selectedTextBoxId: null,
                    };
                }
            });
        },
        selectCards: (ids: string[]) => set({ selectedCardIds: ids, selectedTextBoxId: null }),
        clearSelection: () => set({ selectedCardIds: [], selectedTextBoxId: null }),

        addSection: (section: SectionData) => set((state) => ({ sections: [...state.sections, section] })),
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

        loadBoard: async () => {
            const [cards, boardState, textBoxes, connections] = await Promise.all([
                loadCards(),
                loadBoardState(),
                loadTextBoxes(),
                loadConnections()
            ]);

            if (boardState) {
                set({
                    transform: boardState.transform,
                    sections: boardState.sections,
                    backgroundColor: boardState.backgroundColor || '#303030'
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
        }
    };

    return store;
});
