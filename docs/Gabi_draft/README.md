# Ledgerline — Procure-to-Pay

Front-end-only prototype of a Procure-to-Pay / AP tool. Plain HTML/CSS/JS,
no build step, no backend — all data is in-memory mock data and resets on
every page reload.

## Structure

- `index.html` — page shell, loads `css/styles.css` and the `js/*` scripts in order.
- `css/styles.css` — all styling.
- `js/utils.js` — formatting/date helpers.
- `js/data.js` — mock master data (entities, vendors, contracts, PRs, POs, invoices, payments, budget).
- `js/notifications.js` — notification computation (expiring contracts, invoices due).
- `js/state.js` — router state, navigation, nav menu definition.
- `js/render-core.js` — top-level `render()`, topbar, route dispatch.
- `js/views/*.js` — one file per page (dashboard, contracts, vendors, purchase requests, invoices, payments, budget, reporting, setup).
- `js/drawer.js` / `js/modal.js` — the slide-over drawer and modal dialog renderers.
- `js/charts.js` — Chart.js wiring, run after every render.
- `js/main.js` — kicks off the initial `render()` call.

The scripts are loaded as plain (non-module) `<script src>` tags, in
dependency order, so they all share one global scope — exactly like the
original single-file version. This means inline `onclick="..."` handlers
in the render functions keep working without any extra wiring.

## Running it locally

No install needed. Any static file server works, since the app has no
build step:

```bash
python -m http.server 5173
```

Then open `http://localhost:5173/`.

Opening `index.html` directly via `file://` also works in most browsers,
since all script/style references are relative and same-origin.

## History

The original Claude-Chat-authored version was a single ~2,800-line HTML
file (`ledgerline-ap-tool_12.html`, still in git history at the initial
commit) — it was split into the structure above so it's easier to extend
file-by-file in Claude Code. No behavior was changed in the split.
