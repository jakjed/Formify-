# E10 — User invites, password reset, lockout

## Scope

- Tokenized user invites (S02 / S50) — admin invites without setting a password
- Password reset request + confirm (S03)
- Login lockout after 5 failed attempts (15 minutes)
- User `status`: `invited` | `active` | `locked`

## Models

- `UserInvite` — hashed token, expiry, accept timestamp
- `PasswordResetToken` — hashed token, expiry, used timestamp
- `User.passwordHash` nullable for pending invites
- `User.failedLoginCount`, `User.lockedUntil`

## API

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/users/invite` | admin session | Returns `inviteToken` + `acceptPath` (dev/local until email) |
| GET | `/api/auth/invite/:token` | public | Preview invite |
| POST | `/api/auth/invite/accept` | public | `{ token, password }` → session |
| POST | `/api/auth/password-reset/request` | public | Always `{ ok: true }`; may include `resetPath` in local |
| GET | `/api/auth/password-reset/:token` | public | Preview reset |
| POST | `/api/auth/password-reset/confirm` | public | Sets password, clears sessions |

## UI

- `/invite/:token` — accept invite
- `/reset`, `/reset/:token` — password reset
- Admin → Users: Invite form + status display
- Login: “Forgot password” link

## Policy

- Invite TTL: 7 days
- Reset TTL: 1 hour
- Lockout: 5 failures → 15 minutes
- Reset request does not reveal whether the email exists (enumeration-safe)
