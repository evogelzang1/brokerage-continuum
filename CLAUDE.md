# Brokerage Continuum — Listing Marketing Tool

## What This Is
Standalone web app for generating listing marketing timelines and client email templates at each phase of a CRE listing lifecycle. Built for Matthews REIS agents.

## Tech Stack
- React 18 + Vite 6
- Single component: `src/BrokerageContinuum.jsx` (695 lines)
- CSS Modules: `src/BrokerageContinuum.module.css`
- No backend, no database — pure client-side

## Architecture
- `src/main.jsx` — Entry point, renders BrokerageContinuum
- `src/BrokerageContinuum.jsx` — All logic: timeline graphic, 5 email generators, form inputs
- Timeline phases: Pre-Market, Early Marketing, Mid-Marketing, High Demand/DOM, Closing
- Email generators are pure functions — take form fields, return formatted text

## Key Patterns
- Form state managed via single `useState` hook (`fields`)
- `DEFAULTS` object defines all initial values
- `dangerouslySetInnerHTML` used for email preview with escape-then-render pattern — **fragile, flagged for refactor**
- Timeline export renders to canvas for PNG download

## UI Conventions
- Dark theme using CSS variables (matches Centurion aesthetic)
- `--bg: #0d1117`, `--bg-card: #161b22`, `--accent: #4493f8`
- Font: Inter, -apple-system, sans-serif
- Border radius: 10px cards, 6px buttons/inputs

## Deployment
- Vercel: `vercel.json` with SPA rewrite rule
- GitHub: `evogelzang1/brokerage-continuum`

## Commands
- `npm run dev` — Dev server
- `npm run build` — Production build to `dist/`

## Known Issues
- No data persistence (form data lost on refresh) — localStorage planned
- `dangerouslySetInnerHTML` in email preview needs refactor to JSX rendering
- Copy Agent Link uses `window.location.origin` — needs Vercel URL after deployment
