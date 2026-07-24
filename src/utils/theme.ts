/**
 * Derives a contrast-aware UI theme from the board's background color so that
 * every chrome element (toolbars, grid, controls, sections) stays visible on
 * any background — white, black, or a saturated bright color.
 */
import { useMemo } from 'react';
import { useBoardStore } from '../store/boardStore';

/** WCAG relative luminance (0 = black, 1 = white) of a hex color. */
export function luminance(hex: string): number {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0');
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export interface ContrastTheme {
    /** Is the background dark? (chrome should then be light, and vice-versa) */
    isDark: boolean;
    fg: string;          // primary text / icon color
    fgSubtle: string;    // secondary text
    fgFaint: string;     // hints / placeholders
    surface: string;     // glass panel background for toolbars/controls
    surfaceHover: string;
    border: string;      // panel + card border
    grid: string;        // canvas grid line color
    /** A high-contrast accent that reads on this background (near-black or near-white). */
    accentOn: string;
}

export function contrastTheme(bg: string): ContrastTheme {
    const isDark = luminance(bg) < 0.42;
    return isDark
        ? {
            isDark: true,
            fg: 'rgba(255,255,255,0.92)',
            fgSubtle: 'rgba(255,255,255,0.60)',
            fgFaint: 'rgba(255,255,255,0.35)',
            surface: 'rgba(255,255,255,0.10)',
            surfaceHover: 'rgba(255,255,255,0.20)',
            border: 'rgba(255,255,255,0.16)',
            grid: 'rgba(255,255,255,0.08)',
            accentOn: 'rgba(255,255,255,0.95)',
        }
        : {
            isDark: false,
            fg: 'rgba(0,0,0,0.85)',
            fgSubtle: 'rgba(0,0,0,0.55)',
            fgFaint: 'rgba(0,0,0,0.35)',
            surface: 'rgba(255,255,255,0.55)',
            surfaceHover: 'rgba(255,255,255,0.80)',
            border: 'rgba(0,0,0,0.14)',
            grid: 'rgba(0,0,0,0.10)',
            accentOn: 'rgba(0,0,0,0.9)',
        };
}

/** React hook: the current contrast theme derived from the board background. */
export function useContrastTheme(): ContrastTheme {
    const bg = useBoardStore((s) => s.backgroundColor);
    return useMemo(() => contrastTheme(bg), [bg]);
}

/**
 * Given an arbitrary element color (e.g. a section's chosen color), return a
 * version that stays visible against the background — if the color is too close
 * in luminance to the bg, fall back to the theme's high-contrast accent.
 */
export function ensureVisible(color: string, bg: string): string {
    try {
        const diff = Math.abs(luminance(color) - luminance(bg));
        if (diff < 0.12) return contrastTheme(bg).accentOn;
        return color;
    } catch {
        return color;
    }
}

/**
 * Hex version of {@link ensureVisible}: returns the color unchanged if it has
 * enough contrast with the background, otherwise a plain black (bright bg) or
 * white (dark bg) hex so it composes with `${color}66`-style opacity suffixes.
 */
export function ensureVisibleHex(color: string, bg: string): string {
    try {
        const diff = Math.abs(luminance(color) - luminance(bg));
        if (diff >= 0.15) return color;
        return luminance(bg) > 0.5 ? '#000000' : '#ffffff';
    } catch {
        return color;
    }
}

/** Black or white — whichever is readable on top of the given color. */
export function readableText(color: string): string {
    try {
        return luminance(color) > 0.5 ? '#000000' : '#ffffff';
    } catch {
        return '#000000';
    }
}
