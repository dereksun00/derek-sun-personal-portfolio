# DEREK OS v1.0

Retro arcade portfolio — Vite + React 18 + TypeScript + react-three-fiber.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build → dist/
```

Deploys to Vercel as a static site (`vercel.json`).

## Screenshots

Drop project screenshots into `public/projects/<id>/01.png` … `03.png`
(see `public/projects/README.md`). Frames show animated CRT static until
the real image exists; hovering "tunes in" the screenshot.

## Smoke test

`node smoke.mjs` drives the full screen flow in headless Chrome
(requires `npm i --no-save playwright-core` and the dev server running).

## Easter egg

↑ ↑ ↓ ↓ ← → ← → B A — DEBUG MODE (wireframes, FPS counter, dev console).
