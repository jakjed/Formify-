# Procure Ledger design system (in-app)

## Principles

1. **Brand ≠ status** — teal/brand is identity; statuses use semantic tones.
2. **Affordances visible** — inputs have borders; focus ring always present.
3. **Hierarchy over chrome** — primary work first; secondary panels collapse.
4. **Motion = feedback** — hover lift, press, focus — not decorative blobs alone.

## Status tones

| Tone | Use |
|---|---|
| `success` | approved, paid, healthy OCR |
| `warning` | needs_review, in_approval, aging 24–48h, mid OCR |
| `danger` | exception, aging 48h+, low OCR |
| `info` | capturing / extracting |
| `neutral` | exported, void, idle |

Helpers: `apps/web/src/shared/ui/status.ts` + `<StatusBadge>` / `<InvoiceStatusBadge>`.

## Primitives (CSS)

- `.btn` / `.btn--primary` / `.btn--ghost` / `.btn--danger` / `.btn--danger-ghost`
- `.field` + `.field__control` (shared input chrome)
- `.status-badge status-badge--{tone}`
- `.dropzone` for capture upload

Tokens live in `@aptora/ui/tokens/ledger-light.css`.
