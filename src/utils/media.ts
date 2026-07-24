import type { CardData, MediaItem, Connector } from '../types';

/** All media items on a card, synthesizing a single item from the legacy
 *  `mediaUrl`/`mediaType` fields when `media` isn't populated. */
export function getMedia(card: CardData): MediaItem[] {
    if (card.media && card.media.length) return card.media;
    if (card.mediaUrl) {
        return [{
            id: `${card.id}-legacy`,
            url: card.mediaUrl,
            type: card.mediaType || 'image',
            colors: card.colors,
            fonts: card.fonts,
        }];
    }
    return [];
}

/** Clamped index of the active media item. */
export function activeIndex(card: CardData): number {
    const m = getMedia(card);
    if (!m.length) return 0;
    return Math.min(Math.max(0, card.activeMediaIndex ?? 0), m.length - 1);
}

/** The active media item, or null for a card with no media. */
export function activeMedia(card: CardData): MediaItem | null {
    const m = getMedia(card);
    return m.length ? m[activeIndex(card)] : null;
}

/** The id of the active media item, or null. */
export function activeMediaId(card: CardData): string | null {
    return activeMedia(card)?.id ?? null;
}

/**
 * Whether a connector should be shown right now. A connector pinned to a
 * specific image is only active when that image is the card's live one.
 */
export function isConnectorActive(c: Connector, cards: CardData[]): boolean {
    if (!c.toCardId) return true;             // free-floating endpoint
    const card = cards.find((cc) => cc.id === c.toCardId);
    if (!card) return false;                  // target card gone
    if (!c.toMediaId) return true;            // legacy connector, not media-specific
    if (getMedia(card).length <= 1) return true; // single-media card, always visible
    return activeMediaId(card) === c.toMediaId;
}
