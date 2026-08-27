# E5 — Email capture, notifications, audit

## Scope

- Per-tenant **capture mailbox** (`address` + secret `token`) for **inbound invoice** email — see [MAILBOXES.md](./MAILBOXES.md)
- Per-tenant **outbound notification email** (`TenantOutboundEmail`) for approver/workflow **From** address — config in Admin → Mailbox
- Public `POST /api/capture/email/:token` — multipart attachment + `messageId` (idempotent)
- In-app **notifications** for capture, approval assignment, approve/reject
- Append-only **audit events** for upload, email ingest, submit, approve/reject, mailbox rotate
- Admin UI: mailbox settings, email ingest log, notifications, audit trail

## API

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/capture/mailbox` | yes | Creates mailbox if missing |
| POST | `/api/capture/mailbox/rotate` | yes | New token |
| GET | `/api/capture/email-ingests` | yes | Recent inbound rows |
| POST | `/api/capture/email/:token` | **public** | `file` + optional `messageId`, `fromAddress`, `subject` |
| GET | `/api/notifications/outbound-email` | yes (admin) | Outbound From address |
| PATCH | `/api/notifications/outbound-email` | yes (admin) | Configure outbound email |
| GET | `/api/notifications` | yes | `?unreadOnly=true` |
| POST | `/api/notifications/read-all` | yes | |
| POST | `/api/notifications/:id/read` | yes | |
| GET | `/api/audit/events` | yes | `?limit=` |

## Email ingest demo

```bash
TOKEN=<mailbox token from Admin>
curl -X POST "http://localhost:3001/api/capture/email/$TOKEN" \
  -F "file=@./sample-invoice.txt" \
  -F "messageId=demo-msg-1" \
  -F "fromAddress=vendor@example.com" \
  -F "subject=Invoice attached"
# repeat with same messageId → duplicate: true
```

## Notes

- Real SMTP/inbound MX is out of scope; the webhook simulates provider → Aptora
- OCR still uses stub/Textract providers from E4
- Audit is append-only; no update/delete APIs
