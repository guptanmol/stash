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

- **Connections.** The old card-to-card "Connect" tool was removed; in its place, text notes can now draw **right-angle connectors** onto any image as annotations (drag from a note's edge dot). Still worth exploring later: an AI relationship layer that auto-suggests related cards and semantic clusters. The dormant `connections` store/`ConnectionLine` remain as a starting point for that.
- **Font detection — local, no-key path.** Font detection is currently optional and runs via a free Gemini key. A future no-key option could run a small vision model in the browser (Transformers.js / WebGPU) for on-device category detection, at the cost of a large one-time model download.
- **Measurement tool ("Design DNA") — rebuild with better AI.** The ruler overlay that asked Gemini to place padding/spacing/size callouts on an image was **removed in this version** — the model's coordinates weren't accurate enough to be trustworthy. Revisit with a stronger vision model (or a dedicated layout-detection model) that can return reliable, pixel-accurate measurements. The `extractDesignAnnotations` util and `designAnnotations` field are left in place (dormant) as a starting point.
