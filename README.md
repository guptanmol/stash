# Stash

An infinite-canvas design scrapbook. Drop or paste images and videos onto the board and Stash turns each into a card, then automatically:

- **extracts a color palette** from every image
- **detects typefaces** with Gemini Vision (bring your own API key) and links them to Google Fonts
- **annotates design measurements** on demand — the "Design DNA" ruler overlays padding/spacing/size callouts
- lets you group cards into **sections**, add **text notes**, and attach **voice memos** on why you saved something

Everything persists locally in your browser (IndexedDB) — no account, no server.

## Develop

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The app deploys to GitHub Pages on every push to `main` (see `.github/workflows/deploy.yml`).

## Roadmap / deferred

- **Connections — rebuild with better AI.** The manual "Connect" tool (drawing lines between cards) was **removed in this version** because it wasn't useful enough to keep. Rebuild it later as a proper relationship layer powered by stronger AI models — e.g. auto-suggesting related cards, semantic clustering of the board, and AI-generated labels for each connection — instead of hand-drawn lines. The underlying `connections` store, `ConnectionLine` renderer, and `addConnection`/`removeConnection` actions are left in place (dormant) as a starting point.
