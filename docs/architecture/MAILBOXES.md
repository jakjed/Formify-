# Mailboxes — inbound capture vs outbound notifications

Procure Ledger uses **two separate mailbox concepts**. They must not be confused in Admin or integrations.

## 1. Invoice mailbox (inbound capture)

**Purpose:** Receive vendor invoices by email and create capture jobs.

| Field | Where | Notes |
| --- | --- | --- |
| Address | `CaptureMailbox.address` | e.g. `{tenant-slug}-invoices@inbound.procureledger.local` |
| Secret token | `CaptureMailbox.token` | Rotatable; used in ingest URL |
| Ingest API | `POST /api/capture/email/:token` | Multipart attachment + `messageId` (idempotent) |

**Admin:** **Admin → Mailbox → Invoice mailbox (inbound capture)**

**Demo:**

```bash
TOKEN=<mailbox token from Admin>
curl -X POST "http://localhost:3001/api/capture/email/$TOKEN" \
  -F "file=@./sample-invoice.txt" \
  -F "messageId=demo-msg-1" \
  -F "fromAddress=vendor@example.com" \
  -F "subject=Invoice attached"
```

Real SMTP/MX inbound is simulated via this webhook in Phase 1; production connects an email provider (SES, SendGrid Inbound, Microsoft Graph) to the same ingest contract.

## 2. Outbound notifications (approver email)

**Purpose:** From address when Procure Ledger sends **approval and workflow email** to approvers (assignment, reminder, outcome).

| Field | Where | Notes |
| --- | --- | --- |
| From address | `TenantOutboundEmail.fromAddress` | Must be a domain you control / have SPF/DKIM for |
| From name | `TenantOutboundEmail.fromName` | Display name in inbox |
| Reply-To | `TenantOutboundEmail.replyTo` | Optional; defaults to From |
| Enabled | `TenantOutboundEmail.enabled` | When false, only in-app notifications fire |

**Admin:** **Admin → Mailbox → Outbound notifications**

**API:**

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/notifications/outbound-email` | admin |
| PATCH | `/api/notifications/outbound-email` | admin |

Phase 1 stores configuration only. SMTP relay / provider send is wired when email delivery leaves “in-app only” (see [E5_EMAIL_NOTIFY_AUDIT.md](./E5_EMAIL_NOTIFY_AUDIT.md)).

## Summary

| Use case | Direction | Admin section | Model |
| --- | --- | --- | --- |
| Vendor sends invoice PDF | **Inbound** | Invoice mailbox | `CaptureMailbox` |
| Procure Ledger notifies approver | **Outbound** | Outbound notifications | `TenantOutboundEmail` |

In-app notifications (`Notification` table) are independent of both and always available.
