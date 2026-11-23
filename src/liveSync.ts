import { supabase, callWorkerApi, ADMIN_MANAGE_USER_URL } from './supabaseClient';

export const ROLE_TO_UI: Record<string, string> = {
  Agent: 'agent',
  'Call PIC': 'call_pic',
  Supervisor: 'supervisor',
  Management: 'management',
  Admin: 'admin',
};

export const UI_TO_DB_ROLE: Record<string, string> = {
  agent: 'Agent',
  call_pic: 'Call PIC',
  supervisor: 'Supervisor',
  management: 'Management',
  admin: 'Admin',
};

export interface LiveWorkspaceBundle {
  profiles: Array<{
    id: string;
    email: string;
    username: string;
    password?: string;
    role: string;
    team: string;
    active: boolean;
    preProvisioned?: boolean;
  }>;
  kamDirectory: Array<Record<string, any>>;
  businessFallback: Array<Record<string, any>>;
  parcels: Record<string, any>;
  sheetRegistry: Array<{ name: string; id: string; tabs: string; status: string }>;
  overflowLog: Array<{ id: string; globalId: string; zone: string; sheetRow: number; status: string; at: Date }>;
  churnWeights: Record<string, { label: string; pts: number }>;
  auditLogs: Array<{ at: Date; actor: string; role: string; action: string; scope: string }>;
  callLogs: Array<Record<string, any>>;
  issues: Array<Record<string, any>>;
  globalFeed: Array<{ issueId: string; caller: string; kind: string; by: string; at: Date; text: string }>;
}

const PRE_PASSWORDS: Record<string, string> = {
  'golam.muktadir@carrybee.com': '123456Carrybee',
  'sazzad.haider@carrybee.com': 'InboundIQ86139',
  'mahmud.hasan@carrybee.com': 'InboundIQ84258',
  'rakib.c@carrybee.com': 'InboundIQ84625',
  'foysal.tamim@carrybee.com': 'InboundIQ84882',
  'touhidur.rahman@carrybee.com': 'InboundIQ85089',
  'ankon.das@carrybee.com': 'InboundIQ85141',
  'samim.mia@carrybee.com': 'InboundIQ85140',
  'sufian.ahmed@carrybee.com': 'CarrybeeAdmin124',
  'sufi26bd@gmail.com': 'CarrybeeAdmin123',
};

const SHEET_DISPLAY: Record<string, { name: string; tabs: string }> = {
  MASTER_FALLBACK_HUB: {
    name: '01 · Master Inbound Fallback Hub',
    tabs: 'All_Issues_Fallback · Call_Logs · Taxonomy_v4_Ref · Sync_Watch',
  },
  TEAM_BUSINESS_KAM: {
    name: '02 · Business Team (KAM) Sheet',
    tabs: 'Issues (29 cols) · Config_Lists (64 RCs)',
  },
  TEAM_TECH_PRODUCT: {
    name: '03 · Tech & Product Team Sheet',
    tabs: 'Issues (29 cols) · Config_Lists (64 RCs)',
  },
  TEAM_ACCOUNTS: {
    name: '04 · Accounts / Finance Team Sheet',
    tabs: 'Issues (29 cols) · Config_Lists (64 RCs)',
  },
  TEAM_ACTIVATION: {
    name: '05 · Activation Team Sheet',
    tabs: 'Issues (29 cols) · Config_Lists (64 RCs)',
  },
  TEAM_SUPPLY_SAFETY: {
    name: '06 · Supply & Safety Team Sheet',
    tabs: 'Issues (29 cols) · Config_Lists (64 RCs)',
  },
  TEAM_ISSUE_RESOLUTION: {
    name: '07 · Issue Resolution Escalations Sheet',
    tabs: 'Issues (29 cols) · Config_Lists (64 RCs)',
  },
  MERCHANT_KAM_MASTER: {
    name: '08 · Merchant KAM Master (Strict 5-Col)',
    tabs: 'KAM_Merchants (Col A..E only)',
  },
};

export async function fetchWorkspaceBundle(): Promise<Partial<LiveWorkspaceBundle>> {
  const [
    profRes,
    kamRes,
    fbRes,
    parcelRes,
    sheetRes,
    ovfRes,
    cwRes,
    auditRes,
    clRes,
    tktRes,
    evRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    supabase.from('merchant_kam_directory').select('*').order('business_id', { ascending: true }),
    supabase.from('merchant_business_fallback').select('*').order('business_id', { ascending: true }),
    supabase.from('parcel_lookup_cache').select('*'),
    supabase.from('sheet_registry').select('*'),
    supabase.from('global_overflow_watch').select('*').order('detected_at', { ascending: false }),
    supabase.from('churn_score_config').select('*'),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('call_logs').select('*').order('started_at', { ascending: false }).limit(200),
    supabase.from('crm_tickets').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('crm_ticket_events').select('*').order('created_at', { ascending: true }).limit(500),
  ]);

  const out: Partial<LiveWorkspaceBundle> = {};

  if (profRes.data && profRes.data.length > 0) {
    out.profiles = profRes.data.map((p: any) => ({
      id: p.id,
      email: p.email,
      username: p.username,
      password: PRE_PASSWORDS[String(p.email).toLowerCase()] || '••••••••••••',
      role: ROLE_TO_UI[p.role] || 'agent',
      team: p.team_id || 'Inbound Desk A',
      active: Boolean(p.is_active),
      preProvisioned: true,
    }));
  }

  if (kamRes.data && kamRes.data.length > 0) {
    out.kamDirectory = kamRes.data.map((m: any) => ({
      bizId: m.business_id,
      bizName: m.business_name,
      phone: m.reg_number_norm || m.reg_number_raw,
      kamName: m.kam_name,
      team: m.responsible_team,
      completedTrips: m.completed_trips ?? 0,
      area: m.area || 'Dhaka',
      health: m.health_status || 'Healthy',
      sentiment: m.last_sentiment || 'Neutral',
      complaints30d: m.complaints_30d ?? 0,
    }));
  }

  if (fbRes.data && fbRes.data.length > 0) {
    out.businessFallback = fbRes.data.map((m: any) => ({
      bizId: m.business_id,
      bizName: m.business_name,
      phone: m.reg_number_norm,
      completedTrips: m.completed_trips ?? 0,
      area: m.area || 'Dhaka',
      health: m.health_status || 'Onboarding',
      sentiment: m.last_sentiment || 'Neutral',
      complaints30d: m.complaints_30d ?? 0,
    }));
  }

  if (parcelRes.data && parcelRes.data.length > 0) {
    const pmap: Record<string, any> = {};
    for (const p of parcelRes.data) {
      pmap[p.consignment_id] = {
        id: p.consignment_id,
        bizName: p.business_name,
        recipient: p.recipient_name,
        recPhone: p.recipient_phone,
        hub: p.hub_name,
        zone: p.zone,
        cod: Number(p.cod_amount || 0),
        status: p.current_status,
        rider: p.rider_info,
        otp: p.otp_state,
      };
    }
    out.parcels = pmap;
  }

  if (sheetRes.data && sheetRes.data.length > 0) {
    out.sheetRegistry = sheetRes.data.map((s: any) => {
      const disp = SHEET_DISPLAY[s.sheet_key] || { name: s.sheet_name, tabs: s.tab_name };
      return {
        name: disp.name,
        id: s.spreadsheet_id,
        tabs: disp.tabs,
        status: s.status || 'Connected',
      };
    });
  }

  if (ovfRes.data && ovfRes.data.length > 0) {
    out.overflowLog = ovfRes.data.map((o: any, idx: number) => ({
      id: o.overflow_id || `OVF-0${idx + 1}`,
      globalId: o.global_issue_id || o.ticket_id,
      zone: o.zone || 'OSD',
      sheetRow: 2211 + idx,
      status: o.recovery_status || 'Bypassed Sheet -> Supabase Verified',
      at: new Date(o.detected_at),
    }));
  }

  if (cwRes.data && cwRes.data.length > 0) {
    const cw: Record<string, { label: string; pts: number }> = {};
    for (const c of cwRes.data) {
      const shortMap: Record<string, string> = {
        THREAT_CHURN: 'T',
        RECURRING_30D: 'R',
        REPEAT_NEG_SENTIMENT: 'N',
        SLA_BREACHED_OPEN: 'U',
        FAILED_CALLBACK_STREAK: 'F',
        DECLINING_TRIPS: 'D',
      };
      const code = shortMap[c.signal_key] || c.signal_key.slice(0, 1);
      cw[code] = { label: c.label, pts: Number(c.points) };
    }
    out.churnWeights = cw;
  }

  if (auditRes.data && auditRes.data.length > 0) {
    out.auditLogs = auditRes.data.map((a: any) => ({
      at: new Date(a.created_at),
      actor: a.actor_name,
      role: a.actor_role,
      action: a.action,
      scope: a.scope,
    }));
  }

  if (clRes.data && clRes.data.length > 0) {
    out.callLogs = clRes.data.map((l: any) => ({
      id: l.call_id,
      direction: l.direction,
      outcome: l.call_outcome,
      startedAt: new Date(l.started_at),
      durationSec: l.duration_sec || 0,
      agent: l.agent_name,
      callerType: l.user_type,
      callerName: l.caller_name || `Caller (${l.caller_phone_raw})`,
      phone: l.caller_phone_raw,
      reasonName: l.reason_label || l.call_outcome,
      theme: l.specific_theme || '',
      overrideUsed: Boolean(l.routing_override),
      ticketId: l.linked_ticket_id || null,
      sentiment: l.sentiment || 'Neutral',
      callbackAt: l.callback_due_at ? new Date(l.callback_due_at) : null,
      callbackStatus: l.callback_status || null,
      claimedBy: l.claimed_by_name || null,
      claimedUntil: l.claimed_until ? new Date(l.claimed_until) : null,
      note: l.call_notes || '',
    }));
  }

  if (tktRes.data && tktRes.data.length > 0) {
    const eventsByTicket = new Map<string, Array<{ kind: string; by: string; at: Date; text: string }>>();
    for (const ev of evRes.data || []) {
      const list = eventsByTicket.get(ev.ticket_id) || [];
      const kMap: Record<string, string> = {
        CALL_LOGGED: 'call',
        GLOBAL_PUSHED: 'push',
        TICKET_RAISED: 'raise',
        STAKEHOLDER_SHEET_SYNC: 'sheet',
        GLOBAL_FINAL_RESPONSE: 'resolved',
        CALLER_CONFIRMED_CLOSED: 'closed',
        E16_REOPEN: 'reopen',
        SUPERVISOR_ESCALATE: 'reopen',
        VALIDATION_REJECTED: 'chase',
      };
      list.push({
        kind: kMap[ev.event_type] || 'note',
        by: ev.actor,
        at: new Date(ev.created_at),
        text: ev.note,
      });
      eventsByTicket.set(ev.ticket_id, list);
    }

    const feed: Array<{ issueId: string; caller: string; kind: string; by: string; at: Date; text: string }> = [];

    out.issues = tktRes.data.map((t: any) => {
      const isAwaiting = t.crm_status === 'Resolved - Awaiting Caller Confirm';
      const uiStatus = isAwaiting ? 'Resolved' : t.crm_status === 'Reopened' ? 'In Progress' : t.crm_status;
      const tl = eventsByTicket.get(t.ticket_id) || [
        {
          kind: 'raise',
          by: t.created_by_name || 'System',
          at: new Date(t.created_at),
          text: t.issue_summary,
        },
      ];
      for (const ev of tl) {
        feed.push({
          issueId: t.ticket_id,
          caller: t.business_name || t.caller_phone,
          kind: ev.kind,
          by: ev.by,
          at: ev.at,
          text: ev.text,
        });
      }
      const isTrackA = t.track === 'A' || t.track === 'DUAL';
      return {
        id: t.ticket_id,
        globalId: t.global_issue_id || null,
        track: t.track,
        owner: t.responsible_team,
        callerType: t.user_type,
        callerName: t.business_name || `Caller (${t.caller_phone})`,
        phone: t.caller_phone,
        kam: t.assigned_kam || 'Complaint Management',
        reasonCode: `M#${String(t.reason_id || 1).padStart(2, '0')}`,
        reasonName: t.reason_name,
        theme: t.specific_theme || 'Other',
        actionTaken: t.action_taken || '',
        gCat: t.global_category || null,
        gSub: t.global_subcategory || null,
        gIssueType: t.global_issue_type || null,
        opsMeta: isTrackA
          ? {
              validation: t.global_validation || 'Pending',
              opsCategory: t.global_ops_category || 'Pending Ops Triage',
              cmAssigned: t.global_cm_assigned || 'Auto-assigning',
              duplicateOf: t.global_duplicate_of || null,
              finalResponse: t.global_final_response || '',
            }
          : null,
        prio: t.priority || 'P2',
        status: uiStatus,
        awaitingConfirm: isAwaiting,
        reopened: Boolean(t.reopen_count > 0 && t.crm_status !== 'Closed'),
        reopenCount: t.reopen_count || 0,
        feedbackAttempts: t.feedback_attempts || 0,
        threatChurn: Boolean(t.threat_to_churn),
        overrideReason: t.override_reason || '',
        consignment: t.consignment_id || '',
        extraConsignments: t.extra_consignment_ids || [],
        hub: t.hub_name || 'Uttara Hub',
        zone: t.zone || 'ISD',
        summary: t.issue_summary,
        createdAt: new Date(t.created_at),
        dueAt: t.sla_due_at ? new Date(t.sla_due_at) : null,
        slaHours: Number(t.sla_hours || 2),
        slaLabel: `${t.sla_hours || 2}h SLA`,
        reminderAt: t.followup_reminder_at ? new Date(t.followup_reminder_at) : null,
        reminderNote: t.progress_note || '',
        rcCode: t.confirmed_rc_code || '',
        accountability: t.derived_accountability || '',
        resolutionSummary: t.resolution_summary || t.global_final_response || '',
        parcelSnapshot: t.parcel_snapshot || null,
        opsLayers: isTrackA
          ? [
              {
                layer: 'Layer 1 · Central Ops',
                by: t.global_cm_assigned || 'Central Ops (MX)',
                at: new Date(t.created_at),
                text: t.global_layer1_response || `Submitted as ${t.global_issue_id || 'MX'} [${t.global_category || ''} › ${t.global_subcategory || ''}].`,
              },
              {
                layer: 'Layer 2 · Hub Supervisor',
                by: t.global_layer2_response ? `${t.hub_name || 'Hub'} Lead` : 'Pending',
                at: t.global_layer2_response ? new Date(t.updated_at) : null,
                text: t.global_layer2_response || 'Awaiting hub review.',
              },
              {
                layer: 'Layer 3 · Final Response',
                by: t.global_final_response ? 'Global Ops QA' : 'Pending',
                at: t.global_final_response ? new Date(t.updated_at) : null,
                text: t.global_final_response || 'Awaiting Ops final_response.',
              },
            ]
          : null,
        timeline: tl,
      };
    });

    feed.sort((a, b) => b.at.getTime() - a.at.getTime());
    out.globalFeed = feed;
  }

  return out;
}

export async function persistCallLog(log: Record<string, any>, profileId?: string, teamId = 'Inbound Desk A') {
  const norm = String(log.phone || '').replace(/\D/g, '').replace(/^8801/, '01');
  const row: Record<string, any> = {
    call_id: log.id,
    agent_id: profileId || null,
    agent_name: log.agent,
    team_id: teamId,
    direction: log.direction,
    call_outcome: log.outcome,
    caller_phone_raw: log.phone,
    caller_phone_norm: norm || log.phone,
    caller_name: log.callerName,
    user_type: log.callerType || 'Existing Merchant',
    call_type: log.ticketId ? 'Issue' : 'Inquiry',
    reason_label: log.reasonName,
    specific_theme: log.theme || null,
    sentiment: log.sentiment || 'Neutral',
    duration_sec: log.durationSec || 0,
    started_at: (log.startedAt instanceof Date ? log.startedAt : new Date()).toISOString(),
    call_notes: log.note || '',
    linked_ticket_id: log.ticketId || null,
    callback_due_at: log.callbackAt ? (log.callbackAt instanceof Date ? log.callbackAt.toISOString() : log.callbackAt) : null,
    callback_status: log.callbackStatus || null,
    routing_override: Boolean(log.overrideUsed),
  };
  await supabase.from('call_logs').upsert(row, { onConflict: 'call_id' });
}

export async function persistCallbackClaim(
  callId: string,
  claimedByName: string | null,
  claimedById: string | null,
  claimedUntil: Date | null,
  callbackStatus?: string
) {
  const updates: Record<string, any> = {
    claimed_by: claimedById,
    claimed_by_name: claimedByName,
    claimed_until: claimedUntil ? claimedUntil.toISOString() : null,
  };
  if (callbackStatus) updates.callback_status = callbackStatus;
  await supabase.from('call_logs').update(updates).eq('call_id', callId);
}

export async function persistNewTicket(issue: Record<string, any>, profileId?: string, teamId = 'Inbound Desk A') {
  const norm = String(issue.phone || '').replace(/\D/g, '').replace(/^8801/, '01');
  const reasonNum = Number(String(issue.reasonCode || 'M#01').replace(/\D/g, '')) || 1;
  const row: Record<string, any> = {
    ticket_id: issue.id,
    created_by: profileId || null,
    created_by_name: issue.timeline?.[0]?.by || 'Agent',
    team_id: teamId,
    caller_phone: issue.phone,
    caller_phone_norm: norm || issue.phone,
    user_type: String(issue.callerType || 'Existing Merchant').replace(' (Unverified E-02)', ''),
    is_unverified: String(issue.callerType || '').includes('Unverified'),
    business_name: issue.callerName,
    assigned_kam: issue.kam || 'Complaint Management',
    consignment_id: issue.consignment || null,
    extra_consignment_ids: issue.extraConsignments || [],
    hub_name: issue.hub || null,
    zone: issue.zone || null,
    parcel_snapshot: issue.parcelSnapshot || null,
    call_type: 'Issue',
    reason_id: reasonNum,
    reason_name: issue.reasonName,
    specific_theme: issue.theme || 'Other',
    action_taken: issue.actionTaken || null,
    issue_summary: issue.summary,
    priority: issue.prio || 'P2',
    threat_to_churn: Boolean(issue.threatChurn),
    track: issue.track,
    responsible_team: issue.owner,
    routing_override: Boolean(issue.overrideReason),
    override_reason: issue.overrideReason || null,
    handover_status: 'Handed Over',
    handed_over_at: new Date().toISOString(),
    global_issue_id: issue.globalId || null,
    global_category: issue.gCat || null,
    global_subcategory: issue.gSub || null,
    global_issue_type: issue.gIssueType || null,
    global_sync_status: issue.track === 'A' || issue.track === 'DUAL' ? 'PUSHED' : 'NOT_APPLICABLE',
    global_ops_status: issue.track === 'A' || issue.track === 'DUAL' ? 'Open' : null,
    sheet_sync_status: issue.track === 'B' || issue.track === 'DUAL' ? 'SYNCED' : 'NOT_APPLICABLE',
    crm_status: 'Raised',
    sla_hours: issue.slaHours || 2,
    sla_due_at: issue.dueAt ? issue.dueAt.toISOString() : null,
    followup_reminder_at: issue.reminderAt ? issue.reminderAt.toISOString() : null,
  };

  await supabase.from('crm_tickets').upsert(row, { onConflict: 'ticket_id' });

  if (issue.timeline && issue.timeline.length > 0) {
    const events = issue.timeline.map((ev: any) => ({
      ticket_id: issue.id,
      event_type: ev.kind === 'push' ? 'GLOBAL_PUSHED' : ev.kind === 'call' ? 'CALL_LOGGED' : 'TICKET_RAISED',
      actor: ev.by,
      note: ev.text,
    }));
    await supabase.from('crm_ticket_events').insert(events);
  }

  // Enqueue in sync_outbox with idempotency_key for Cloudflare Worker Dual-Write
  if (issue.track === 'A' || issue.track === 'DUAL') {
    await supabase.from('sync_outbox').upsert(
      {
        idempotency_key: `${issue.id}:GLOBAL_API`,
        ticket_id: issue.id,
        target: 'GLOBAL_API',
        payload: {
          channel: 'MX',
          issue_type: issue.gIssueType || 'Regular',
          category: issue.gCat,
          subcategory: issue.gSub,
          hub: issue.hub,
          zone: issue.zone,
          consignment_id: issue.consignment,
          summary: issue.summary,
          merchant_phone: issue.phone,
        },
        status: 'queued',
      },
      { onConflict: 'idempotency_key' }
    );
  }
  if (issue.track === 'B' || issue.track === 'DUAL') {
    await supabase.from('sync_outbox').upsert(
      {
        idempotency_key: `${issue.id}:STAKEHOLDER_SHEET`,
        ticket_id: issue.id,
        target: 'STAKEHOLDER_SHEET',
        payload: {
          sheet_key: mapOwnerToSheetKey(issue.owner),
          row_values: [
            issue.id,
            new Date().toISOString(),
            issue.timeline?.[0]?.by || 'Agent',
            issue.callerType,
            issue.callerName,
            issue.phone,
            issue.kam,
            issue.consignment || '',
            issue.hub || '',
            issue.zone || '',
            issue.reasonCode,
            issue.reasonName,
            issue.theme,
            issue.prio,
            issue.summary,
          ],
        },
        status: 'queued',
      },
      { onConflict: 'idempotency_key' }
    );
  }

  // Trigger Worker outbox processor asynchronously
  callWorkerApi('/api/outbox/process', {
    method: 'POST',
    body: JSON.stringify({ ticket_id: issue.id }),
  }).catch(() => {});
}

function mapOwnerToSheetKey(owner: string): string {
  if (owner.includes('Business') || owner.includes('KAM')) return 'TEAM_BUSINESS_KAM';
  if (owner.includes('Tech')) return 'TEAM_TECH_PRODUCT';
  if (owner.includes('Accounts')) return 'TEAM_ACCOUNTS';
  if (owner.includes('Activation')) return 'TEAM_ACTIVATION';
  if (owner.includes('Supply')) return 'TEAM_SUPPLY_SAFETY';
  if (owner.includes('Issue Resolution')) return 'TEAM_ISSUE_RESOLUTION';
  return 'MASTER_FALLBACK_HUB';
}

export async function persistTicketUpdate(
  ticketId: string,
  updates: Record<string, any>,
  event?: { type: string; actor: string; note: string }
) {
  await supabase
    .from('crm_tickets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('ticket_id', ticketId);
  if (event) {
    await supabase.from('crm_ticket_events').insert({
      ticket_id: ticketId,
      event_type: event.type,
      actor: event.actor,
      note: event.note,
    });
  }
}

export async function persistKamMerchant(m: {
  bizId: string;
  bizName: string;
  phone: string;
  kamName: string;
  team: string;
  completedTrips: number;
}) {
  const norm = m.phone.replace(/\D/g, '').replace(/^8801/, '01');
  await supabase.from('merchant_kam_directory').upsert(
    {
      business_id: m.bizId,
      business_name: m.bizName,
      reg_number_raw: m.phone,
      reg_number_norm: norm,
      kam_name: m.kamName,
      responsible_team: m.team,
      completed_trips: m.completedTrips,
    },
    { onConflict: 'reg_number_norm' }
  );
}

export async function persistOverflowSimulation(ovf: {
  id: string;
  globalId: string;
  zone: string;
  sheetRow: number;
  status: string;
}) {
  await supabase.from('global_overflow_watch').upsert(
    {
      overflow_id: ovf.id,
      global_issue_id: ovf.globalId,
      zone: ovf.zone,
      failure_type: 'OSD_GRID_LIMIT_EXCEEDED',
      issue_summary: `Simulated OSD row ${ovf.sheetRow} overflow — ${ovf.globalId} safely persisted in Supabase`,
      recovery_status: ovf.status,
    },
    { onConflict: 'overflow_id' }
  );
}

export async function persistChurnWeights(weights: Record<string, { label: string; pts: number }>, actorName: string) {
  const codeToKey: Record<string, string> = {
    T: 'THREAT_CHURN',
    R: 'RECURRING_30D',
    N: 'REPEAT_NEG_SENTIMENT',
    U: 'SLA_BREACHED_OPEN',
    F: 'FAILED_CALLBACK_STREAK',
    D: 'DECLINING_TRIPS',
  };
  for (const [code, obj] of Object.entries(weights)) {
    const key = codeToKey[code];
    if (!key) continue;
    await supabase
      .from('churn_score_config')
      .update({ points: obj.pts, updated_by_name: actorName, updated_at: new Date().toISOString() })
      .eq('signal_key', key);
  }
  await supabase.from('audit_logs').insert({
    actor_name: actorName,
    actor_role: 'Admin',
    action: 'CONFIG_UPDATE',
    scope:
      'Updated Churn Risk Score Weights: ' +
      Object.entries(weights)
        .map(([k, v]) => `${k}=+${v.pts}`)
        .join(', '),
  });
}

export async function logCsvExportAudit(scopeLabel: string, rowCount: number, filename: string) {
  await callWorkerApi('/api/exports/audit', {
    method: 'POST',
    body: JSON.stringify({
      scope: `${scopeLabel} (${rowCount} rows · UTF-8 BOM)`,
      row_count: rowCount,
      filename,
    }),
  });
}

export async function adminManageUser(payload: Record<string, any>): Promise<{ ok: boolean; user_id?: string; error?: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'Not signed in' };

  const resp = await fetch(ADMIN_MANAGE_USER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = (await resp.json().catch(() => ({}))) as { error?: string; user_id?: string };
  if (!resp.ok) {
    return { ok: false, error: json.error || `HTTP ${resp.status}` };
  }
  return { ok: true, user_id: json.user_id };
}
