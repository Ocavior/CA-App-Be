# CA App API

**Base URL:** `https://ca-app.ocvrs.in/api/v1`

Frontend config: `API_BASE_URL=https://ca-app.ocvrs.in/api/v1`

## Authentication

1. `POST /auth/login` with `{ "identifier": "<username or email>", "password": "..." }`.
   Optional: `device_id`, `device_token`, `device_name`.
2. The response is `{ "success": true, "data": { "user": {...}, "token": "<JWT>" }, "message": "Login successful" }`.
3. Send `Authorization: Bearer <JWT>` on every route marked Token below. Tokens last 7 days.

Errors look like `{ "success": false, "message": "..." }`. A missing token returns 401, and an invalid or expired one returns 403.

## Auth and admin users

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Register a user |
| POST | `/auth/login` | Public | Log in |
| POST | `/auth/create` | Token | Create a user |
| PUT | `/auth/update-user` | Token | Update a user |
| DELETE | `/auth` | Token | Delete own account |
| DELETE | `/auth/delete-user` | Token | Delete a user |
| GET | `/adminUsers` | Token | List admin users with counts |
| POST | `/auth/reset-password-request` | Public | Request a password reset (known bug: does not work) |
| POST | `/auth/verify-reset-token` | Public | Verify a reset token (known bug: does not work) |
| POST | `/auth/reset-password` | Public | Reset a password (known bug: does not work) |
| POST | `/auth/google/callback` | Public | Google OAuth callback |
| POST | `/auth/social/google` | Public | Google sign-in |

`PUT /auth/change-password` is registered but returns 404 (known bug).

## CA submissions

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/ca/submissions` | Token | List. Query: `page`, `limit` (max 100), `sortBy`, `sortOrder`, `name`, `mobile`, `email`, `state`, `city`, `services`, `source`, `startDate`, `endDate`, `employer` |
| POST | `/ca/submissions` | Token | Create |
| GET | `/ca/submissions/:id` | Token | Get one |
| PUT | `/ca/submissions/:id` | Token | Update |
| DELETE | `/ca/submissions/:id` | Token | Delete |
| DELETE | `/ca/submissions/bulk` | Token | Delete many. Body: `{ "ids": [...] }` |
| PATCH | `/ca/submissions/:id/active` | Public | Set or toggle active. Body: `{ "isActive": true }` |
| GET | `/ca/search` | Token | Search. Query: `q`, `state`, `city`, `services`, `startDate`, `endDate`, `isActive`, `employerAvailable`, `page`, `limit` |
| GET | `/ca/by-service/:serviceKey` | Token | CAs offering a service. Query: `page`, `limit`, `state`, `city` |
| GET | `/ca/stats` | Token | Overall statistics |
| GET | `/ca/stats/services` | Token | Per-service statistics |
| POST | `/ca/validate-contacts` | Token | Body: `{ "ids": [...], "validationType": "email" or "whatsapp" }` |
| POST | `/ca/import` | Token | Import a CSV or Excel file (multipart, field `file`) |
| POST | `/ca/import/preview` | Token | Dry run of an import, writes nothing |
| POST | `/ca/import/confirm` | Token | Commit a previewed import (send the same file) |
| GET | `/ca/master-services` | Public | Active services and sub-services |
| GET | `/ca/health` | Public | Health check |

## Services

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/ca/services` | Token | List all, including inactive |
| POST | `/ca/services` | Token | Create |
| GET | `/ca/services/:id` | Token | Get one |
| PUT | `/ca/services/:id` | Token | Update (alias cannot change) |
| DELETE | `/ca/services/:id` | Token | Delete |
| PATCH | `/ca/services/:id/active` | Token | Set or toggle active |
| POST | `/ca/services/:id/sub-services` | Token | Add a sub-service |
| PUT | `/ca/services/:id/sub-services/:subServiceId` | Token | Update a sub-service |
| DELETE | `/ca/services/:id/sub-services/:subServiceId` | Token | Delete a sub-service |
| PATCH | `/ca/services/:id/sub-services/:subServiceId/active` | Token | Set or toggle active |

## WhatsApp templates

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/whatsapp/templates` | Token | List |
| POST | `/whatsapp/templates` | Token | Create (known bug: always fails validation) |
| GET | `/whatsapp/templates/:id` | Token | Get one |
| PUT | `/whatsapp/templates/:id` | Token | Update (known bug: returns 200 and changes nothing) |
| DELETE | `/whatsapp/templates/:id` | Token | Delete |
| PATCH | `/whatsapp/templates/:id/toggle` | Token | Toggle active |

## Messaging and conversations

These call the separate WhatsApp and email services.

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/messages/send` | Token | Send one WhatsApp message |
| POST | `/messages/sendTemplate` | Token | Send one WhatsApp template |
| POST | `/messages/sendBulkTemplate` | Token | Send a template in bulk |
| POST | `/notifications/whatsapp/bulk` | Token | Send WhatsApp messages in bulk |
| POST | `/notifications/email/bulk` | Token | Send email in bulk (needs email settings on the server) |
| GET | `/emailLogs` | Token | Email logs |
| GET | `/conversations` | Token | List conversations |
| GET | `/conversations/search` | Token | Search conversations. Query: `q` |
| GET | `/conversations/:userId/messages` | Token | Messages for a user. Query: `limit` |
| GET | `/conversations/:userId/history` | Token | Known bug: returns 500 |
