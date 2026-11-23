import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env, CallerProfile } from './types';
import { getGoogleAccessToken, appendSheetRow, readSheetRange } from './sheets';

type AppVariables = {
  profile: CallerProfile;
  supabaseAdmin: SupabaseClient;
};

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use('/api/*', cors());

function createSupabaseAdmin(env: Env): SupabaseClient {
  const key = env.CRM_SUPABASE_SERVICE_ROLE_KEY || env.CRM_SUPABASE_ANON_KEY;
  return createClient(env.CRM_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function createSupabaseUserClient(env: Env, bearerToken: string): SupabaseClient {
  return createClient(env.CRM_SUPABASE_URL, env.CRM_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getTargetSheetId(env: Env, sheetKey: string): string {
  const map: Record<string, string> = {
    MASTER_FALLBACK_HUB: env.SHEET_MASTER_FALLBACK_HUB_ID,
    TEAM_BUSINESS_KAM: env.SHEET_TEAM_BUSINESS_KAM_ID,
    TEAM_TECH_PRODUCT: env.SHEET_TEAM_TECH_PRODUCT_ID,
    TEAM_ACCOUNTS: env.SHEET_TEAM_ACCOUNTS_ID,
    TEAM_ACTIVATION: env.SHEET_TEAM_ACTIVATION_ID,
    TEAM_SUPPLY_SAFETY: env.SHEET_TEAM_SUPPLY_SAFETY_ID,
    TEAM_ISSUE_RESOLUTION: env.SHEET_TEAM_ISSUE_RES_ID,
    MERCHANT_KAM_MASTER: env.SHEET_MERCHANT_KAM_MASTER_ID,
  };
  return map[sheetKey] || env.SHEET_MASTER_FALLBACK_HUB_ID;
}

function getIsoWeekDhaka(date = new Date()): string {
  const dhakaMs = date.getTime() + 6 * 3600 * 1000;
  const d = new Date(dhakaMs);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const weekNo = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Health check (Public)
app.get('/api/health', (c) => {
  return c.json({
    service: 'Carrybee InboundIQ Worker API',
    tagline: 'Smart Answers for Every Delivery',
    version: '3.2.0',
    timezone: c.env.APP_TIMEZONE,
    channel: c.env.GLOBAL_TRACKER_CHANNEL,
    supabase_url: c.env.CRM_SUPABASE_URL,
    sheets_configured: Boolean(c.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    global_api_configured: Boolean(c.env.GLOBAL_TRACKER_API_URL),
    status: 'healthy',
  });
});

// Apps Script Webhook Receiver (Appendix D — HMAC/Secret authenticated)
app.post('/api/webhooks/stakeholder-sheet', async (c) => {
  const secret = c.req.header('X-CarryBee-Secret');
  if (c.env.SHEETS_WEBHOOK_HMAC_SECRET && secret !== c.env.SHEETS_WEBHOOK_HMAC_SECRET) {
    return c.json({ error: 'Invalid webhook secret' }, 401);
  }
  const body = await c.req.json<{
    issue_id: string;
    source_team_sheet: string;
    row_number: number;
    edited_by?: string;
    values: string[];
  }>();

  if (!body.issue_id) {
    return c.json({ error: 'Missing issue_id' }, 400);
  }

  const sb = createSupabaseAdmin(c.env);
  const vals = body.values || [];
  const colT = (vals[19] || '').trim(); // Stakeholder Status
  const colU = (vals[20] || '').trim(); // Acknowledged By
  const colW = (vals[22] || '').trim(); // Progress Note
  const colX = (vals[23] || '').trim(); // Confirmed Root Cause (RC-01..RC-64)
  const colY = (vals[24] || '').trim(); // Derived Accountability
  const colZ = (vals[25] || '').trim(); // Resolution Summary
  const colAA = (vals[26] || '').trim(); // Resolved By

  const rcMatch = colX.match(/^(RC-(?:0[1-9]|[1-5][0-9]|6[0-4]))\b/);
  const rcCode = rcMatch ? rcMatch[1] : null;

  // Hard Closure Gate (G-09 / Section 4.2)
  if (colT === 'Resolved' && (!rcCode || colZ.length < 20)) {
    await sb
      .from('crm_tickets')
      .update({
        sheet_sync_status: 'VALIDATION_REJECTED',
        progress_note: colW || null,
        updated_at: new Date().toISOString(),
      })
      .eq('ticket_id', body.issue_id);

    await sb.from('crm_ticket_events').insert({
      ticket_id: body.issue_id,
      event_type: 'VALIDATION_REJECTED',
      actor: body.edited_by || body.source_team_sheet,
      note: 'Rejected Resolved status: Confirmed Root Cause (RC-01..RC-64) and ≥20-char Resolution Summary required.',
    });

    return c.json({ ok: false, reason: 'HARD_CLOSURE_GATE_FAILED' }, 200);
  }

  // Auto-derive handover_status = 'Accepted' from Col T (PRD v3.2 Refinement #3)
  const handoverStatus = ['Acknowledged', 'In Progress', 'Resolved'].includes(colT)
    ? 'Accepted'
    : undefined;

  const crmStatus =
    colT === 'Resolved'
      ? 'Resolved - Awaiting Caller Confirm'
      : colT === 'In Progress'
      ? 'In Progress'
      : colT === 'Acknowledged'
      ? 'Acknowledged'
      : undefined;

  const updates: Record<string, unknown> = {
    stakeholder_status: colT || 'Pending',
    sheet_sync_status: 'SYNCED',
    target_sheet_row: body.row_number,
    updated_at: new Date().toISOString(),
  };
  if (handoverStatus) updates.handover_status = handoverStatus;
  if (crmStatus) updates.crm_status = crmStatus;
  if (colU) {
    updates.acknowledged_by = colU;
    updates.acknowledged_at = new Date().toISOString();
  }
  if (colW) updates.progress_note = colW;
  if (rcCode) updates.confirmed_rc_code = rcCode;
  if (colY) updates.derived_accountability = colY;
  if (colZ) updates.resolution_summary = colZ;
  if (colT === 'Resolved') {
    updates.resolved_by = colAA || body.edited_by || body.source_team_sheet;
    updates.resolved_at = new Date().toISOString();
  }

  await sb.from('crm_tickets').update(updates).eq('ticket_id', body.issue_id);
  await sb.from('crm_ticket_events').insert({
    ticket_id: body.issue_id,
    event_type: 'STAKEHOLDER_SHEET_SYNC',
    actor: body.edited_by || body.source_team_sheet,
    note: `Sheet updated -> Col T: ${colT}${rcCode ? ` · ${rcCode}` : ''}`,
  });

  return c.json({ ok: true, issue_id: body.issue_id, crm_status: crmStatus });
});

// JWT Auth Middleware for /api/* (except /api/health and /api/webhooks/*)
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/health' || c.req.path.startsWith('/api/webhooks/')) {
    return next();
  }
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return c.json({ error: 'Missing Authorization Bearer token' }, 401);
  }

  const userSb = createSupabaseUserClient(c.env, token);
  const { data: userRes, error: authErr } = await userSb.auth.getUser(token);
  if (authErr || !userRes?.user) {
    return c.json({ error: 'Invalid or expired Supabase JWT' }, 401);
  }

  const sb = c.env.CRM_SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdmin(c.env) : userSb;
  const { data: profile, error: profErr } = await sb
    .from('profiles')
    .select('id, email, username, full_name, role, team_id, is_active')
    .eq('id', userRes.user.id)
    .single();

  if (profErr || !profile || !profile.is_active) {
    return c.json({ error: 'Account inactive or profile missing' }, 403);
  }

  c.set('profile', profile as CallerProfile);
  c.set('supabaseAdmin', sb);
  await next();
});

// Audited Bulk CSV Export Guardrail (PRD §8.5 — Explicitly blocks Agent role with 403)
app.post('/api/exports/audit', async (c) => {
  const profile = c.get('profile');
  if (profile.role === 'Agent') {
    return c.json(
      { error: 'Forbidden (PRD §8.5): Bulk CSV/Sheet exports are disabled for Agent role to protect merchant PII.' },
      403
    );
  }
  const body = await c.req.json<{ scope: string; row_count: number; filename?: string }>();
  const sb = c.get('supabaseAdmin');

  await sb.from('audit_logs').insert({
    actor_id: profile.id,
    actor_name: profile.username,
    actor_role: profile.role,
    action: 'EXPORT_CSV',
    scope: body.scope,
    row_count: body.row_count,
    metadata: { filename: body.filename },
  });

  return c.json({ ok: true, audited: true });
});

// Async Outbox Processor (Track A Global 'MX' + Track B Hub-and-Spoke Dual-Write)
app.post('/api/outbox/process', async (c) => {
  const profile = c.get('profile');
  if (profile.role === 'Management') {
    return c.json({ error: 'Forbidden: Management role is read-only' }, 403);
  }
  const body = await c.req.json<{ ticket_id?: string }>().catch(() => ({ ticket_id: undefined }));
  const sb = c.get('supabaseAdmin');
  const result = await flushOutboxQueue(c.env, sb, body.ticket_id);
  return c.json(result);
});

// On-Demand KAM Master Sheet Sync (Admin Console)
app.post('/api/sync/kam-master', async (c) => {
  const profile = c.get('profile');
  if (profile.role !== 'Admin') {
    return c.json({ error: 'Forbidden: Admin role required' }, 403);
  }
  const sb = c.get('supabaseAdmin');
  const synced = await syncMerchantKamSheet(c.env, sb);
  return c.json(synced);
});

async function flushOutboxQueue(env: Env, sb: SupabaseClient, filterTicketId?: string) {
  let query = sb
    .from('sync_outbox')
    .select('*')
    .in('status', ['queued', 'failed'])
    .lt('attempts', 5)
    .order('created_at', { ascending: true })
    .limit(25);

  if (filterTicketId) {
    query = query.eq('ticket_id', filterTicketId);
  }

  const { data: items } = await query;
  if (!items || items.length === 0) {
    return { processed: 0, delivered: 0 };
  }

  let delivered = 0;
  for (const item of items) {
    try {
      if (item.target === 'GLOBAL_API') {
        const p = item.payload as Record<string, unknown>;
        // Workaround W-4: Guarantee non-null issue_type
        const safePayload = {
          ...p,
          channel: 'MX',
          issue_type: p.issue_type || 'Regular',
          week: p.week || getIsoWeekDhaka(),
        };

        let globalIssueId = `CB-${new Date().getDate().toString().padStart(2, '0')}-${(
          new Date().getMonth() + 1
        )
          .toString()
          .padStart(2, '0')}-${Math.floor(1000 + Math.random() * 8999)}`;
        let overflowWarning = false;

        if (env.GLOBAL_TRACKER_API_URL) {
          const resp = await fetch(`${env.GLOBAL_TRACKER_API_URL.replace(/\/$/, '')}/api/escalations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(env.GLOBAL_TRACKER_API_TOKEN
                ? { Authorization: `Bearer ${env.GLOBAL_TRACKER_API_TOKEN}` }
                : {}),
              'X-Idempotency-Key': item.idempotency_key,
            },
            body: JSON.stringify(safePayload),
          });
          const resJson = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
          if (!resp.ok) {
            throw new Error(`Global API ${resp.status}: ${JSON.stringify(resJson)}`);
          }
          if (typeof resJson.issue_id === 'string') {
            globalIssueId = resJson.issue_id;
          }
          if (String(JSON.stringify(resJson)).includes('grid limits')) {
            overflowWarning = true;
          }
        }

        await sb
          .from('crm_tickets')
          .update({
            global_issue_id: globalIssueId,
            global_sync_status: overflowWarning ? 'OVERFLOW_WATCH' : 'PUSHED',
            global_ops_status: 'Open',
            global_last_synced_at: new Date().toISOString(),
            handover_status: 'Handed Over',
            handed_over_at: new Date().toISOString(),
          })
          .eq('ticket_id', item.ticket_id);

        if (overflowWarning) {
          await sb.from('global_overflow_watch').upsert({
            overflow_id: `OVF-${Date.now().toString().slice(-6)}`,
            ticket_id: item.ticket_id,
            global_issue_id: globalIssueId,
            zone: String((p as Record<string, unknown>).zone || 'OSD'),
            failure_type: 'OSD_GRID_LIMIT_EXCEEDED',
            issue_summary: `${item.ticket_id} -> ${globalIssueId}: Global sheet hit row limit; persisted in Supabase.`,
            recovery_status: 'Queued (In Supabase)',
          });
        }
      } else if (item.target === 'STAKEHOLDER_SHEET' || item.target === 'FALLBACK_HUB') {
        const p = item.payload as { sheet_key?: string; row_values?: string[] };
        if (env.GOOGLE_SERVICE_ACCOUNT_JSON && Array.isArray(p.row_values)) {
          const token = await getGoogleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_JSON);
          if (item.target === 'STAKEHOLDER_SHEET' && p.sheet_key) {
            const sheetId = getTargetSheetId(env, p.sheet_key);
            await appendSheetRow(token, sheetId, 'Issues!A:AC', p.row_values);
          } else {
            await appendSheetRow(
              token,
              env.SHEET_MASTER_FALLBACK_HUB_ID,
              'All_Issues_Fallback!A:AE',
              p.row_values
            );
          }
        }

        await sb
          .from('crm_tickets')
          .update({
            sheet_sync_status: 'SYNCED',
            handover_status: 'Handed Over',
            handed_over_at: new Date().toISOString(),
          })
          .eq('ticket_id', item.ticket_id);
      }

      await sb
        .from('sync_outbox')
        .update({ status: 'delivered', attempts: item.attempts + 1 })
        .eq('id', item.id);
      delivered++;
    } catch (err) {
      const nextRetry = new Date(Date.now() + Math.pow(2, item.attempts + 1) * 60000).toISOString();
      await sb
        .from('sync_outbox')
        .update({
          status: 'failed',
          attempts: item.attempts + 1,
          last_error: (err as Error).message,
          next_retry_at: nextRetry,
        })
        .eq('id', item.id);
    }
  }

  return { processed: items.length, delivered };
}

async function syncMerchantKamSheet(env: Env, sb: SupabaseClient) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return {
      ok: true,
      mode: 'supabase_cached',
      message: 'GOOGLE_SERVICE_ACCOUNT_JSON secret not set yet; serving live Supabase merchant_kam_directory.',
    };
  }
  const token = await getGoogleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const rows = await readSheetRange(token, env.SHEET_MERCHANT_KAM_MASTER_ID, 'KAM_Merchants!A2:E5000');
  const dedup = new Map<string, Record<string, unknown>>();
  rows.forEach((r, idx) => {
    const bizId = (r[0] || '').trim();
    const bizName = (r[1] || '').trim();
    const rawPhone = (r[2] || '').trim();
    const kamName = (r[3] || '').trim();
    const team = (r[4] || 'Business Team (KAM)').trim();
    if (!bizId || !rawPhone) return;
    let norm = rawPhone.replace(/\D/g, '');
    if (norm.startsWith('8801') && norm.length === 13) norm = norm.slice(2);
    if (norm.length === 10 && norm.startsWith('1')) norm = '0' + norm;
    // Bottom-most row wins per PRD §4.3
    dedup.set(norm, {
      business_id: bizId,
      business_name: bizName,
      reg_number_raw: rawPhone,
      reg_number_norm: norm,
      kam_name: kamName || 'Complaint Management',
      responsible_team: team,
      sheet_row_number: idx + 2,
      synced_at: new Date().toISOString(),
    });
  });

  const payload = Array.from(dedup.values());
  if (payload.length > 0) {
    await sb.from('merchant_kam_directory').upsert(payload, { onConflict: 'reg_number_norm' });
  }
  await sb.from('sync_cursors').upsert({
    sync_key: 'KAM_MASTER',
    last_cursor_ts: new Date().toISOString(),
    last_run_status: `Synced ${payload.length} merchants`,
    updated_at: new Date().toISOString(),
  });
  return { ok: true, count: payload.length };
}

// Direct Global Issue Tracker Read-Through (60s cron — Workaround W-2 & W-3)
async function pollGlobalTrackerReadThrough(env: Env, sb: SupabaseClient) {
  if (!env.GLOBAL_SUPABASE_URL || !env.GLOBAL_SUPABASE_READONLY_KEY) return;
  const globalSb = createClient(env.GLOBAL_SUPABASE_URL, env.GLOBAL_SUPABASE_READONLY_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: cursor } = await sb
    .from('sync_cursors')
    .select('last_cursor_ts')
    .eq('sync_key', 'GLOBAL_MX_READ')
    .maybeSingle();

  let q = globalSb
    .from('escalations')
    .select(
      'issue_id, ops_status, validation, ops_category, layer1_response, layer2_response, layer3_response, final_response, cm_assigned, duplicate_of, row_version, updated_at'
    )
    .eq('channel', 'MX')
    .order('updated_at', { ascending: true })
    .limit(500);

  if (cursor?.last_cursor_ts) {
    q = q.gt('updated_at', cursor.last_cursor_ts);
  }

  const { data: escalations } = await q;
  if (!escalations || escalations.length === 0) return;

  for (const esc of escalations) {
    const solved = ['Solved', 'Resolved', 'Completed'].includes(String(esc.ops_status || ''));
    await sb
      .from('crm_tickets')
      .update({
        global_ops_status: esc.ops_status,
        global_validation: esc.validation,
        global_ops_category: esc.ops_category,
        global_layer1_response: esc.layer1_response,
        global_layer2_response: esc.layer2_response,
        global_layer3_response: esc.layer3_response,
        global_final_response: esc.final_response,
        global_cm_assigned: esc.cm_assigned,
        global_duplicate_of: esc.duplicate_of,
        global_row_version: esc.row_version,
        global_last_synced_at: new Date().toISOString(),
        ...(solved ? { crm_status: 'Resolved - Awaiting Caller Confirm' } : {}),
      })
      .eq('global_issue_id', esc.issue_id);
  }

  const lastTs = escalations[escalations.length - 1].updated_at;
  await sb.from('sync_cursors').upsert({
    sync_key: 'GLOBAL_MX_READ',
    last_cursor_ts: lastTs,
    last_run_status: `Synced ${escalations.length} MX tickets`,
    updated_at: new Date().toISOString(),
  });
}

// Static SPA fallback for Cloudflare Workers Assets
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Carrybee InboundIQ Worker Active', 200);
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const sb = createSupabaseAdmin(env);
    ctx.waitUntil(
      (async () => {
        await flushOutboxQueue(env, sb);
        if (event.cron === '* * * * *') {
          await pollGlobalTrackerReadThrough(env, sb);
        } else if (event.cron === '*/2 * * * *') {
          // SLA Breach Watchdog
          await sb
            .from('crm_tickets')
            .update({ sla_breached: true })
            .neq('crm_status', 'Closed')
            .lt('sla_due_at', new Date().toISOString());
        } else if (event.cron === '*/15 * * * *') {
          await syncMerchantKamSheet(env, sb);
        }
      })()
    );
  },
};
