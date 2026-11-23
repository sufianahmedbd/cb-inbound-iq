# Carrybee InboundIQ (`cb-inbound-iq`)

> **Smart Answers for Every Delivery** — Unified Inbound Contact Center CRM, Dual-Track Escalation Router, Executive BI & Role Governance Platform (PRD v3.2).

## Live Architecture

- **Frontend SPA**: Vite 6 + TypeScript (`src/`), preserving the exact MP025 palette (`Light | Soft | Dark`), centered sub-navigation, 12-hour AM/PM clock & timestamps, `localStorage` call draft auto-save, Global Tracker Submission Preview Modal (`Sheet / Row View` + `Raw API JSON`), and UTF-8 BOM (`\uFEFF`) CSV exports.
- **Edge Backend**: Cloudflare Workers + Hono (`worker/index.ts`) with Web Crypto JWT Google Sheets API v4 client (`worker/sheets.ts`), Stakeholder Apps Script webhook receiver (`/api/webhooks/stakeholder-sheet`), Async Outbox processor (`/api/outbox/process`), Audited CSV Export Guardrail (`/api/exports/audit`), and 3 Cron Triggers (`* * * * *`, `*/2 * * * *`, `*/15 * * * *`).
- **Database, Auth & Realtime**: Live Supabase project `cb-inbound-iq` (`https://cvgrryozzonwfnwpjxuf.supabase.co`, `ap-southeast-1`) with:
  - Zero-friction pre-provisioned Auth (`disable_signup = true`, `email_confirm = true`, 8-hour shift JWT).
  - Strict 5-Role PostgreSQL Row-Level Security (`Agent`, `Call PIC`, `Supervisor`, `Management`, `Admin`).
  - Deployed Edge Function `admin-manage-user` for in-CRM team member creation, role updates, email edits, password resets, and instant deactivation.
  - Seeded Taxonomy v4 (49 reasons), 64 Root Causes (`RC-01..RC-64`), 70 Global Categories, 32 Hubs, 8-Sheet Registry, 5-Col KAM Directory, Churn Weights, Call Logs, and Tickets.

## Local Development

```bash
npm install

# Run Cloudflare Worker API (:8787) + Vite Frontend (:5173)
npx wrangler dev --port 8787
npm run dev
```

## Deploy to Cloudflare Workers

1. Authenticate Wrangler and set server-side secrets (never committed to Git):
   ```bash
   npx wrangler login
   npx wrangler secret put CRM_SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
   npx wrangler secret put SHEETS_WEBHOOK_HMAC_SECRET
   ```
2. Build static assets and deploy Worker + Cron Triggers:
   ```bash
   npm run deploy
   ```

## Push to GitHub (`sufianahmedbd/cb-inbound-iq`)

```bash
git remote -v   # origin -> https://github.com/sufianahmedbd/cb-inbound-iq.git
git push -u origin main
```

## Pre-Provisioned Launch Roster (Supabase Auth)

| Role | User Name | Login ID (Email) | Assigned Team |
|---|---|---|---|
| Management | `Muktadir` | `golam.muktadir@carrybee.com` | Executive BI |
| Supervisor | `Sazzad.Haider` | `sazzad.haider@carrybee.com` | Inbound Desk A |
| Call PIC | `Mahmud.Hasan` | `mahmud.hasan@carrybee.com` | Inbound Desk A |
| Agent | `Rakib.Chowdhury` | `rakib.c@carrybee.com` | Inbound Desk A |
| Agent | `Foysal.Hossain` | `foysal.tamim@carrybee.com` | Inbound Desk A |
| Agent | `Touhidur.Rahman` | `touhidur.rahman@carrybee.com` | Inbound Desk A |
| Agent | `Ankon.Das` | `ankon.das@carrybee.com` | Inbound Desk A |
| Agent | `Samim.Mia` | `samim.mia@carrybee.com` | Inbound Desk A |
| Admin | `Sufian Official` | `sufian.ahmed@carrybee.com` | System Admin |
| Admin | `Sufi Unofficial` | `sufi26bd@gmail.com` | System Admin |
