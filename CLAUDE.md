# Brokerage Continuum — CRE Lifecycle Toolkit

## What This Is
Standalone web app of agent-facing tools covering the CRE listing lifecycle: underwriting, marketing timelines, client emails, listing checklists, offer comparison, closing coordination, and commission calculation. Built for Matthews REIS agents.

## Tech Stack
- React 18 + Vite 6
- CSS Modules per tool (e.g. `MarketingTimeline.module.css`); shared styles in `tools/shared.module.css`
- Light/dark theming via `data-theme` on `<html>` (persisted to localStorage)
- No backend, no database — pure client-side

## Architecture
- `src/main.jsx` — Entry point
- `src/App.jsx` — Sidebar + tool router; manages `data-theme` toggle
- `src/tools/` — One file per tool:
  - `Underwriting.jsx` — Wraps the three sub-tools below
  - `tools/underwriting/ExchangeAnalysis.jsx` — 1031 exchange model
  - `tools/underwriting/FlipModel.jsx` — Flip-model UW
  - `tools/underwriting/ReturnOnCost.jsx` — ROC / development UW
  - `tools/underwriting/SimplePreview.jsx` — Quick-look preview
  - `MarketingTimeline.jsx` — Phase-driven marketing timeline (Sale + Sale&Lease templates)
  - `EmailGenerators.jsx` — 5 client emails with contentEditable rich-text editor
  - `ListingChecklist.jsx` — Editable pre-listing checklist with due dates
  - `OfferComparison.jsx` — Side-by-side offer matrix with copy-to-clipboard summary
  - `ClosingCoordinator.jsx` — Closing-day coordination tracker
  - `CommissionCalculator.jsx` — Commission split calculator
  - `CurrencyInput.jsx` — Shared formatted dollar input
- `src/lib/pdfExport.js` — Shared `window.open` + `document.write` PDF export (deprecated APIs — see Known Issues)

## Key Patterns
- Each tool owns its own `useState` and persistence (currently in-memory only)
- `MarketingTimeline` and `ListingChecklist` derive due dates from `listDate` + offsets using `setDate(getDate() + offset)` (DST-safe)
- `EmailGenerators` uses a contentEditable div + `document.execCommand('bold' | 'italic' | 'underline')` for rich-text formatting (deprecated API — flagged)
- Brand string "Matthews Real Estate Investment Services" is hardcoded in 4+ places — extract to `lib/brand.js` next time it changes

## UI Conventions
- Dark/light theming via CSS variables in `index.css`, switched via `data-theme="light"|"dark"` on `<html>`
- Font: Inter (body), Playfair Display (titles) — **currently loaded from Google Fonts CDN (referrer leak risk for an agent-facing tool — see Known Issues)**
- Border radius: 10px cards, 6px buttons/inputs

## Deployment
- Vercel: `vercel.json` with SPA rewrite rule
- GitHub: `evogelzang1/brokerage-continuum` (PUBLIC repo)

## Commands
- `npm run dev` — Dev server
- `npm run build` — Production build to `dist/`

## Known Issues (per 2026-04-25 audit)
- No README at repo root — needs purpose + install/build/deploy notes
- Google Fonts loaded from CDN — every page load leaks a referrer to Google (URL the agent is on). Self-host with `@fontsource/inter` + `@fontsource/playfair-display`, or drop the link and use the system stack
- `document.execCommand` (in `EmailGenerators.jsx`) is deprecated by WHATWG — track for future migration to Tiptap or `Selection`/`Range` wrappers
- `pdfExport.js` uses `window.open` + `document.write` (both deprecated) and auto-fires `print()` after 300 ms — switch to a hidden iframe pattern, fire `print()` on iframe `onload`
- `EMPTY_REPL` in `ExchangeAnalysis.jsx` is mutable — `Object.freeze` it or convert to a factory
- `OfferComparison.jsx:44` has an empty catch with a comment promising a "select-all fallback" that was never implemented
- Verify `.vercel/project.json` and `dist/` are NOT git-tracked (`.gitignore` lists them, but they may pre-date the entry — `git ls-files .vercel/ dist/`)
- No data persistence — form data lost on refresh. localStorage layer planned
