# P4-E0 — NetSuite connector

## Scope

First **named ERP pack** beyond Demo ERP:

- Registry: `netsuite` → `available`
- Connect **mock** (returns `ns_…` token once) or **live** (requires consumer key/secret; optional TBA token id/secret — stored as hash only)
- Sync stub-pushes approved invoices as vendor-bill CSV artifacts + `sync_netsuite` job
- Marks invoices `exportedAt` when previously null

**Out of scope:** live SuiteTalk/REST HTTP calls (P4-E1), QBO (P4-E2).

## APIs

| Method | Path |
|---|---|
| POST | `/api/integration/connections/netsuite/connect` |
| POST | `/api/integration/connections/netsuite/disconnect` |
| POST | `/api/integration/connections/netsuite/sync` |

## UI

Integration Center → Connect NetSuite form + Run sync / Disconnect when connected.

## Next

P4-E1 SuiteTalk runtime ✅ · P4-E2 QuickBooks Online
