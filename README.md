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

## Hive Order Bridge (Chrome Extension)

The `chrome-extension/` folder contains an unpacked Chrome Manifest V3 extension for transferring exactly one filtered order row from the user's authenticated `hive.carrybee.com/orders` tab to InboundIQ in the same browser. It only captures when the URL has a valid `consignmentId` and exactly one matching order row is visible. It extracts only the 16 approved values in the six documented sections, stores them in that browser's Chrome extension local storage, and never uploads the snapshot to the Worker backend. Entering a supported consignment ID in the CRM automatically requests the matching saved snapshot; **Pull from Hive** is available as a manual retry.

To install for development/testing:

1. In Chrome, open `chrome://extensions` and turn on **Developer mode**.
2. Choose **Load unpacked** and select this repository's `chrome-extension` folder.
3. Sign in to Hive as usual and open the matching order at `https://hive.carrybee.com/orders`.
4. Keep the Hive search filtered to one consignment. When exactly one matching result row is visible, the extension captures it automatically; the button can be used to retry.
5. In the CRM in the same Chrome profile, enter that consignment ID. The CRM automatically loads the stored matching snapshot; **Pull from Hive** is available as a manual retry.

The extension supports `F`, `E`, or `R` followed by 10 alphanumeric characters (for example `F1123B48SNR`) and legacy `CB` IDs. It extracts only the six approved groups: consignment times, business name/ID/owner number, receiver name/number/address, attempt/status, pickup/current/LMH hubs, and parcel/COD amounts. It rejects pages with zero or multiple visible order rows. Hive's authenticated DOM isn't available in this repository, so verify the extraction against a real order before relying on it. The extension never bypasses Hive authentication and cannot access an order the signed-in user cannot see. Reload the extension from `chrome://extensions` after code changes.

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
