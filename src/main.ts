// @ts-nocheck
import './styles.css';
import { supabase } from './supabaseClient';
import {
  ROLE_TO_UI,
  UI_TO_DB_ROLE,
  fetchWorkspaceBundle,
  persistCallLog,
  persistCallbackClaim,
  persistNewTicket,
  persistTicketUpdate,
  persistKamMerchant,
  persistOverflowSimulation,
  persistChurnWeights,
  logCsvExportAudit,
  adminManageUser,
} from './liveSync';

(function() {
  'use strict';
  /* ========================================================================
     12-HOUR AM/PM TIME ENGINE (STRICTLY AM/PM EVERYWHERE)
     ======================================================================== */
  const pad = n => String(n).padStart(2, '0');
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const BASE_NOW = new Date();
  const nowDyn = () => new Date();

  function fmtTimeAMPM(d) {
    let h = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${pad(d.getMinutes())} ${ap}`;
  }

  function fmtStamp(d) {
    const n = nowDyn();
    const a = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((a - b) / 86400000);
    const day = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff === -1 ? 'Tomorrow' : `${MON[d.getMonth()]} ${d.getDate()}`;
    return `${day}, ${fmtTimeAMPM(d)}`;
  }

  function fmtHourShort(h24) {
    const ap = h24 >= 12 ? 'PM' : 'AM';
    return `${h24 % 12 || 12}${ap === 'AM' ? 'a' : 'p'}`;
  }

  function fmtDur(hours) {
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
    if (hours < 48) return `${(Math.round(hours * 10) / 10)}h`;
    return `${Math.round(hours / 24)}d`;
  }

  function mmss(secs) { return `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const minsAgo = m => new Date(BASE_NOW.getTime() - m * 60000);
  const minsAhead = m => new Date(BASE_NOW.getTime() + m * 60000);

  /* ========================================================================
     MINIMALIST MONOCHROME SVG ICON LIBRARY (ZERO COLORFUL EMOJIS)
     ======================================================================== */
  const ICONS = {
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'phone-in': '<polyline points="16 2 16 8 22 8"/><line x1="22" y1="2" x2="16" y2="8"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'phone-out': '<polyline points="22 8 22 2 16 2"/><line x1="16" y1="8" x2="22" y2="2"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'phone-off': '<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.4 19.4 0 0 1-3.33-2.67"/><path d="M6.05 6.05a19.5 19.5 0 0 0-3.93-1.87A2 2 0 0 0 2.12 4.18"/><line x1="2" y1="2" x2="22" y2="22"/>',
    headset: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    chart: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    table: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/>',
    compass: '<circle cx="12" cy="12" r="9"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    globe: '<circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    'volume-x': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    scale: '<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7l-2.5 6a3.5 3.5 0 0 0 5 0L5 7z"/><path d="M19 7l-2.5 6a3.5 3.5 0 0 0 5 0L19 7z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    flask: '<path d="M9 3h6"/><path d="M10 3v6.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3"/>',
    hex: '<path d="M12 2.5L20 7v10l-8 4.5L4 17V7l8-4.5z"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
  };
  const ic = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.hex}</svg>`;

  /* ========================================================================
     5 ROLE DEFINITIONS, CENTERED SUB-TABS & EXPLICIT RBAC SCOPE
     (Agent, Call PIC [Person In Charge], Supervisor, Management, Admin)
     ======================================================================== */
  const canActAsAgent = r => r === 'agent' || r === 'call_pic';
  const canActAsSupervisor = r => r === 'supervisor' || r === 'call_pic';
  const ROLE_DISPLAY = { agent: 'Agent', call_pic: 'Call PIC', supervisor: 'Supervisor', management: 'Management', admin: 'Admin' };

  const ROLES = {
    agent: {
      label: 'Agent Workspace',
      persona: 'Rakib.Chowdhury · Inbound Executive',
      scope: 'Own Records · Exports Blocked',
      canExport: false,
      desc: 'Own leads, call logging, follow-ups, claimed callbacks & personal activity history',
      tabs: [
        { id: 'desk', icon: 'phone', label: 'Call Desk' },
        { id: 'followups', icon: 'clipboard', label: 'Follow-Ups & Callbacks', badge: 'follow' },
        { id: 'calllogs', icon: 'file', label: 'Call Logs (Incl. Log-Only)', badge: 'logs' },
        { id: 'stream', icon: 'clock', label: 'Activity Stream', badge: 'rem' }
      ]
    },
    call_pic: {
      label: 'Call PIC (Person In Charge)',
      persona: 'Mahmud.Hasan · Call PIC (Agent + Supervisor)',
      scope: 'Agent + Team Supervisor · Audited Export',
      canExport: true,
      desc: 'Dual Agent Call Desk + Supervisor Floor Command, SLA rescues, callback locks & QA audit',
      tabs: [
        { id: 'desk', icon: 'phone', label: 'Call Desk' },
        { id: 'sup_floor', icon: 'shield', label: 'Floor Command & SLA Watch' },
        { id: 'followups', icon: 'clipboard', label: 'All Team Issues', badge: 'follow' },
        { id: 'calllogs', icon: 'search', label: 'Full Call Log & QA Audit', badge: 'logs' },
        { id: 'stream', icon: 'clock', label: 'Log-Only Live Desk Activity', badge: 'rem' }
      ]
    },
    supervisor: {
      label: 'Supervisor Floor Command',
      persona: 'Sazzad.Haider · Shift Supervisor',
      scope: 'Team Scope · Audited Export',
      canExport: true,
      desc: 'Team SLA watch, escalations, callback locks, QA audit & log-only live desk activity',
      tabs: [
        { id: 'sup_floor', icon: 'shield', label: 'Floor Command & SLA Watch' },
        { id: 'followups', icon: 'clipboard', label: 'All Team Issues', badge: 'open' },
        { id: 'calllogs', icon: 'search', label: 'Full Call Log & QA Audit', badge: 'logs' },
        { id: 'stream', icon: 'clock', label: 'Log-Only Live Desk Activity', badge: 'rem' }
      ]
    },
    management: {
      label: 'Management Intelligence',
      persona: 'Muktadir · Executive BI',
      scope: 'Org Read-Only BI · Audited Export',
      canExport: true,
      desc: 'Organization-wide read-only BI, merchant health, churn watch & audited reports',
      tabs: [
        { id: 'mgmt_bi', icon: 'chart', label: 'Executive Business Intelligence' },
        { id: 'mgmt_health', icon: 'heart', label: 'Merchant Health & Churn Watch' },
        { id: 'mgmt_team', icon: 'award', label: 'Team Queues & Heatmap' }
      ]
    },
    admin: {
      label: 'Admin & Sync Console',
      persona: 'InboundIQ System Admin',
      scope: 'Full Config & RBAC Governance',
      canExport: true,
      desc: 'User/role management, 5-col KAM Master, 8-Sheet Registry, Taxonomy & Churn Config',
      tabs: [
        { id: 'admin_kam', icon: 'users', label: 'Merchant KAM Master (5-Col)' },
        { id: 'admin_sheets', icon: 'table', label: '8-Sheet Registry & Overflow' },
        { id: 'admin_rules', icon: 'compass', label: 'Taxonomy v4 & Role Access' }
      ]
    }
  };

  /* ========================================================================
     PRE-PROVISIONED TEAM CREDENTIALS & IN-CRM USER DIRECTORY (PRD §8.6)
     ======================================================================== */
  const USERS_STORAGE_KEY = 'carrybee_inboundiq_users_v33';
  const SESSION_STORAGE_KEY = 'carrybee_inboundiq_session_v33';
  const DEFAULT_USERS = [
    { id: 'USR-01', email: 'golam.muktadir@carrybee.com', username: 'Muktadir', password: '123456Carrybee', role: 'management', team: 'Executive BI', active: true, preProvisioned: true },
    { id: 'USR-02', email: 'sazzad.haider@carrybee.com', username: 'Sazzad.Haider', password: 'InboundIQ86139', role: 'supervisor', team: 'Inbound Desk A', active: true, preProvisioned: true },
    { id: 'USR-03', email: 'mahmud.hasan@carrybee.com', username: 'Mahmud.Hasan', password: 'InboundIQ84258', role: 'call_pic', team: 'Inbound Desk A', active: true, preProvisioned: true },
    { id: 'USR-04', email: 'rakib.c@carrybee.com', username: 'Rakib.Chowdhury', password: 'InboundIQ84625', role: 'agent', team: 'Inbound Desk A', active: true, preProvisioned: true },
    { id: 'USR-05', email: 'foysal.tamim@carrybee.com', username: 'Foysal.Hossain', password: 'InboundIQ84882', role: 'agent', team: 'Inbound Desk A', active: true, preProvisioned: true },
    { id: 'USR-06', email: 'touhidur.rahman@carrybee.com', username: 'Touhidur.Rahman', password: 'InboundIQ85089', role: 'agent', team: 'Inbound Desk A', active: true, preProvisioned: true },
    { id: 'USR-07', email: 'ankon.das@carrybee.com', username: 'Ankon.Das', password: 'InboundIQ85141', role: 'agent', team: 'Inbound Desk A', active: true, preProvisioned: true },
    { id: 'USR-08', email: 'samim.mia@carrybee.com', username: 'Samim.Mia', password: 'InboundIQ85140', role: 'agent', team: 'Inbound Desk A', active: true, preProvisioned: true },
    { id: 'USR-09', email: 'sufian.ahmed@carrybee.com', username: 'Sufian Official', password: 'CarrybeeAdmin124', role: 'admin', team: 'System Admin', active: true, preProvisioned: true },
    { id: 'USR-10', email: 'sufi26bd@gmail.com', username: 'Sufi Unofficial', password: 'CarrybeeAdmin123', role: 'admin', team: 'System Admin', active: true, preProvisioned: true }
  ];

  function loadUsers() {
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length >= 1) return parsed;
      }
    } catch (e) {}
    return DEFAULT_USERS.map(u => ({ ...u }));
  }

  function saveUsers() {
    try { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(USERS)); } catch (e) {}
  }

  let USERS = loadUsers();
  let CURRENT_USER = null;
  let CURRENT_AGENT = 'Mahmud.Hasan';
  let REVEALED_PASS_IDS = new Set();

  /* ========================================================================
     MASTER DATA — TAXONOMY v4, PARCELS, KAM MASTER, CALL LOGS, ISSUES
     ======================================================================== */
  const STEPS = ['Raised', 'Acknowledged', 'In Progress', 'Resolved', 'Closed'];
  const HUBS = ['Uttara Hub', 'Mirpur-10 Hub', 'Dhanmondi Hub', 'Banani Hub', 'Agrabad Hub', 'Bogura Sadar Hub', 'Sylhet Central Hub', 'Dhaka Central Hub'];
  const ZONES = ['ISD', 'OSD', 'CTG'];

  const OUTCOMES = [
    { id: 'connected', label: 'Successfully Connected', short: 'Connected', sub: 'Spoke & completed interaction', pill: 'good', fast: false },
    { id: 'dropped', label: 'Call Dropped After Answer', short: 'Dropped', sub: 'Disconnected — quick save & next', pill: 'live', fast: true },
    { id: 'callback', label: 'Callback Requested', short: 'Callback Req', sub: 'Preferred AM/PM callback queue', pill: 'warn', fast: true },
    { id: 'outgoing', label: 'Outgoing Call', short: 'Outgoing', sub: 'Callback / proactive outreach', pill: 'purple', fast: false },
    { id: 'no_answer', label: 'No Answer / Unreachable', short: 'No Answer', sub: 'Not connected — 1-click log', pill: 'mute', fast: true }
  ];

  const TEAMS = [
    { key: 'Global Ops (Track A)', short: 'Global Ops', color: 'var(--t-global)', track: 'A', slaDesc: 'Global Zone SLA (1–10d)' },
    { key: 'Business Team (KAM)', short: 'KAM Team', color: 'var(--t-kam)', track: 'B', slaDesc: '30m (Fri 2h 30m)' },
    { key: 'Tech & Product', short: 'Tech & Product', color: 'var(--t-tech)', track: 'B', slaDesc: '2 hours' },
    { key: 'Accounts', short: 'Accounts', color: 'var(--t-acc)', track: 'B', slaDesc: '2h (Fri 4h)' },
    { key: 'Activation', short: 'Activation', color: 'var(--t-act)', track: 'B', slaDesc: 'Next working day 6:00 PM' },
    { key: 'Supply & Safety', short: 'Supply & Safety', color: 'var(--t-sup)', track: 'B', slaDesc: 'Next working day (Safety Immediate)' },
    { key: 'Issue Resolution', short: 'Issue Resolution', color: 'var(--t-ir)', track: 'B', slaDesc: 'Same-day (6:00 PM)' }
  ];
  const teamColor = k => (TEAMS.find(t => t.key === k) || {}).color || 'var(--ink-4)';

  // Exact 64 Official Root Causes (RC-01..RC-64) across 12 Categories → 5 Exact Accountability Buckets
  const ROOT_CAUSES = [
    { code: 'RC-01', cat: 'Pickup Operations', label: 'Rider shortage in pickup zone', bucket: 'Carrybee - Internal' },
    { code: 'RC-02', cat: 'Pickup Operations', label: 'Pickup not attempted by rider', bucket: 'Carrybee - Internal' },
    { code: 'RC-03', cat: 'Pickup Operations', label: 'Pickup slot missed / rider late', bucket: 'Carrybee - Internal' },
    { code: 'RC-04', cat: 'Pickup Operations', label: 'Pickup request not created or not assigned', bucket: 'Carrybee - Internal' },
    { code: 'RC-05', cat: 'Pickup Operations', label: 'Rider refused parcel (size, weight, COD or area)', bucket: 'Carrybee - Internal' },
    { code: 'RC-06', cat: 'Delivery Operations (Last Mile)', label: 'False attempt / false hold note by rider', bucket: 'Carrybee - Internal' },
    { code: 'RC-07', cat: 'Delivery Operations (Last Mile)', label: 'Delivery not attempted (rider shortage or workload)', bucket: 'Carrybee - Internal' },
    { code: 'RC-08', cat: 'Delivery Operations (Last Mile)', label: 'Rider unreachable (phone off or not answering)', bucket: 'Carrybee - Internal' },
    { code: 'RC-09', cat: 'Delivery Operations (Last Mile)', label: 'Rider misbehaviour / unprofessional conduct', bucket: 'Carrybee - Internal' },
    { code: 'RC-10', cat: 'Delivery Operations (Last Mile)', label: 'Rider collected extra or wrong COD', bucket: 'Carrybee - Internal' },
    { code: 'RC-11', cat: 'Delivery Operations (Last Mile)', label: 'Closed-box / POD process not followed', bucket: 'Carrybee - Internal' },
    { code: 'RC-12', cat: 'Delivery Operations (Last Mile)', label: 'Parcel returned without informing merchant', bucket: 'Carrybee - Internal' },
    { code: 'RC-13', cat: 'Delivery Operations (Last Mile)', label: 'Remote or hard-to-reach area', bucket: 'Carrybee - Internal' },
    { code: 'RC-14', cat: 'Hub & Processing', label: 'Processing delay at hub', bucket: 'Carrybee - Internal' },
    { code: 'RC-15', cat: 'Hub & Processing', label: 'Wrong sorting / routing / tag', bucket: 'Carrybee - Internal' },
    { code: 'RC-16', cat: 'Hub & Processing', label: 'Parcel not scanned or status not updated', bucket: 'Carrybee - Internal' },
    { code: 'RC-17', cat: 'Hub & Processing', label: 'Parcel misplaced or lost at hub', bucket: 'Carrybee - Internal' },
    { code: 'RC-18', cat: 'Hub & Processing', label: 'Mishandling / poor handling (damage)', bucket: 'Carrybee - Internal' },
    { code: 'RC-19', cat: 'Hub & Processing', label: 'Hub payment / cash not submitted', bucket: 'Carrybee - Internal' },
    { code: 'RC-20', cat: 'Hub & Processing', label: 'Return not created or not dispatched', bucket: 'Carrybee - Internal' },
    { code: 'RC-21', cat: 'Hub & Processing', label: 'Peak-season backlog', bucket: 'Carrybee - Internal' },
    { code: 'RC-22', cat: 'Finance & Billing', label: 'Invoice not generated', bucket: 'Carrybee - Internal' },
    { code: 'RC-23', cat: 'Finance & Billing', label: 'Payment cycle delay (not yet due)', bucket: 'Carrybee - Internal' },
    { code: 'RC-24', cat: 'Finance & Billing', label: 'Payout failed or on hold', bucket: 'Carrybee - Internal' },
    { code: 'RC-25', cat: 'Finance & Billing', label: 'Charge or weight miscalculated', bucket: 'Carrybee - Internal' },
    { code: 'RC-26', cat: 'Finance & Billing', label: 'COD amount mismatch recorded', bucket: 'Carrybee - Internal' },
    { code: 'RC-27', cat: 'Finance & Billing', label: 'Compensation process pending', bucket: 'Carrybee - Internal' },
    { code: 'RC-28', cat: 'Merchant-side', label: 'Wrong or incomplete order info entered (address, phone, COD, weight)', bucket: 'Merchant' },
    { code: 'RC-29', cat: 'Merchant-side', label: 'Poor packaging by merchant', bucket: 'Merchant' },
    { code: 'RC-30', cat: 'Merchant-side', label: 'Parcel not ready / not handed over at pickup', bucket: 'Merchant' },
    { code: 'RC-31', cat: 'Merchant-side', label: 'Defective or wrong product sent', bucket: 'Merchant' },
    { code: 'RC-32', cat: 'Merchant-side', label: 'Merchant unreachable / store closed', bucket: 'Merchant' },
    { code: 'RC-33', cat: 'Merchant-side', label: 'Merchant unaware of process or policy', bucket: 'Merchant' },
    { code: 'RC-34', cat: 'Merchant-side', label: 'Wrong bank / MFS details provided', bucket: 'Merchant' },
    { code: 'RC-35', cat: 'Customer-side', label: 'Customer unreachable / phone off', bucket: 'Customer' },
    { code: 'RC-36', cat: 'Customer-side', label: 'Customer not available / asked to reschedule', bucket: 'Customer' },
    { code: 'RC-37', cat: 'Customer-side', label: 'Customer refused or changed mind', bucket: 'Customer' },
    { code: 'RC-38', cat: 'Customer-side', label: 'Customer gave wrong address or location', bucket: 'Customer' },
    { code: 'RC-39', cat: 'Customer-side', label: 'Customer misconduct (forced check, threat)', bucket: 'Customer' },
    { code: 'RC-40', cat: 'Technology / System', label: 'Panel or app bug / downtime', bucket: 'Carrybee - Internal' },
    { code: 'RC-41', cat: 'Technology / System', label: 'Status sync or tracking error', bucket: 'Carrybee - Internal' },
    { code: 'RC-42', cat: 'Technology / System', label: 'OTP or login failure', bucket: 'Carrybee - Internal' },
    { code: 'RC-43', cat: 'Technology / System', label: 'Entry / return ID creation error', bucket: 'Carrybee - Internal' },
    { code: 'RC-44', cat: 'Technology / System', label: 'Integration or API failure', bucket: 'Carrybee - Internal' },
    { code: 'RC-45', cat: 'Technology / System', label: 'Duplicate or data error', bucket: 'Carrybee - Internal' },
    { code: 'RC-46', cat: 'KAM / Support', label: 'KAM not reachable or not responsive', bucket: 'Carrybee - Internal' },
    { code: 'RC-47', cat: 'KAM / Support', label: 'Callback or follow-up missed', bucket: 'Carrybee - Internal' },
    { code: 'RC-48', cat: 'KAM / Support', label: 'Slow resolution (internal SLA breached)', bucket: 'Carrybee - Internal' },
    { code: 'RC-49', cat: 'KAM / Support', label: 'KAM change without handover', bucket: 'Carrybee - Internal' },
    { code: 'RC-50', cat: 'KAM / Support', label: 'Wrong information given by agent or staff', bucket: 'Carrybee - Internal' },
    { code: 'RC-51', cat: 'KAM / Support', label: 'Escalation not raised', bucket: 'Carrybee - Internal' },
    { code: 'RC-52', cat: 'Process / Policy', label: 'Policy or SLA not communicated to merchant', bucket: 'Carrybee - Internal' },
    { code: 'RC-53', cat: 'Process / Policy', label: 'Process gap - no owner defined', bucket: 'Carrybee - Internal' },
    { code: 'RC-54', cat: 'Process / Policy', label: 'Rate or charge policy unclear', bucket: 'Carrybee - Internal' },
    { code: 'RC-55', cat: 'Process / Policy', label: 'Service not available in area (coverage limit)', bucket: 'Carrybee - Internal' },
    { code: 'RC-56', cat: 'Sales & Onboarding', label: 'Onboarding follow-up not done', bucket: 'Carrybee - Internal' },
    { code: 'RC-57', cat: 'Sales & Onboarding', label: 'Account approval or activation delayed', bucket: 'Carrybee - Internal' },
    { code: 'RC-58', cat: 'Sales & Onboarding', label: 'Documents incomplete', bucket: 'Carrybee - Internal' },
    { code: 'RC-59', cat: 'External', label: 'Weather / road / strike (hartal)', bucket: 'External' },
    { code: 'RC-60', cat: 'External', label: 'Force majeure / act of God', bucket: 'External' },
    { code: 'RC-61', cat: 'External', label: 'Theft / robbery / hijack', bucket: 'External' },
    { code: 'RC-62', cat: 'Not Determined', label: 'Under investigation (confirm at closure)', bucket: 'To be determined' },
    { code: 'RC-63', cat: 'Not Determined', label: 'Not applicable - information-only call', bucket: 'To be determined' },
    { code: 'RC-64', cat: 'Not Determined', label: 'Unknown after investigation', bucket: 'To be determined' }
  ];

  // Verbatim Global Issue Tracker Catalog (6_Global_Ref / category_master) with exact ISD/OSD/CTG SLA days
  const GLOBAL_CATALOG = {
    'Execution Request': [
      { sub: 'Order Cancellation Request', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Hold Request', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Price Updatation Request', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Customer Address Update', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Customer Contact Update', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Partial delivery request - special instruction', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Payment Info Update', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Profile Info Update', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Profile Password Update', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Store Approval', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Store Info Update', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Uninformed Info change', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Agent details missing/wrong number', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } }
    ],
    'Pickup': [
      { sub: 'Pickup Request', type: 'Regular', sla: { ISD: 2, OSD: 3, CTG: 3 } },
      { sub: 'Pickup Not Attempted By Agent', type: 'Regular', sla: { ISD: 1, OSD: 2, CTG: 2 } },
      { sub: 'Pickup Timing Issue', type: 'Regular', sla: { ISD: 2, OSD: 3, CTG: 3 } },
      { sub: 'Rider Shortage', type: 'Regular', sla: { ISD: 3, OSD: 5, CTG: 5 } },
      { sub: 'Pickup Request - On-Demand', type: 'Regular', sla: { ISD: 1, OSD: 10, CTG: 10 } }
    ],
    'Panel Status': [
      { sub: "Agent/Hub Didn't Update Status Timely", type: 'Regular', sla: { ISD: 2, OSD: 2, CTG: 2 } },
      { sub: 'Wrong Status', type: 'Regular', sla: { ISD: 3, OSD: 3, CTG: 3 } },
      { sub: 'Technical Error', type: 'Regular', sla: { ISD: 2, OSD: 5, CTG: 5 } }
    ],
    'Delivery Delay': [
      { sub: 'Processing Delay', type: 'Regular', sla: { ISD: 3, OSD: 5, CTG: 5 } },
      { sub: 'Rider Shortage', type: 'Regular', sla: { ISD: 3, OSD: 5, CTG: 5 } },
      { sub: 'Remote Area', type: 'Regular', sla: { ISD: 3, OSD: 5, CTG: 5 } },
      { sub: 'Urgent Delivery', type: 'Urgent', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Delivery Not Attempted By Agent', type: 'Regular', sla: { ISD: 2, OSD: 3, CTG: 3 } },
      { sub: 'False Hold Note', type: 'Regular', sla: { ISD: 2, OSD: 3, CTG: 3 } },
      { sub: 'Rescheduled By Customer/Customer Unreachable', type: 'Regular', sla: { ISD: 2, OSD: 3, CTG: 3 } },
      { sub: 'Delivery Delay - On-Demand', type: 'Regular', sla: { ISD: 1, OSD: 10, CTG: 10 } }
    ],
    'Complain Why Return': [
      { sub: 'False Return Note', type: 'Regular', sla: { ISD: 2, OSD: 3, CTG: 3 } },
      { sub: 'Improper Delivery Attempt', type: 'Regular', sla: { ISD: 2, OSD: 3, CTG: 3 } },
      { sub: 'Merchant Not Informed Before Returning', type: 'Regular', sla: { ISD: 2, OSD: 3, CTG: 3 } },
      { sub: 'Reprocess Request by Merchant', type: 'Regular', sla: { ISD: 2, OSD: 3, CTG: 3 } }
    ],
    'Unprofessionalism': [
      { sub: 'Misbehavior By DA', type: 'Critical', sla: { ISD: 2, OSD: 3, CTG: 3 } },
      { sub: 'Misbehavior By PA', type: 'Critical', sla: { ISD: 2, OSD: 3, CTG: 3 } },
      { sub: 'Misbehavior By Employee', type: 'Critical', sla: { ISD: 2, OSD: 3, CTG: 3 } }
    ],
    'Charge Extra/Wrong COD': [
      { sub: 'Extra Charge Demanded', type: 'Critical', sla: { ISD: 2, OSD: 2, CTG: 2 } },
      { sub: 'Wrong COD Collection', type: 'Critical', sla: { ISD: 2, OSD: 2, CTG: 2 } },
      { sub: 'Miscalculation Of Delivery/Return Charge', type: 'Critical', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Miscalculation Of Weight Charge', type: 'Critical', sla: { ISD: 1, OSD: 1, CTG: 1 } },
      { sub: 'Miscalculation Of COD Charge', type: 'Critical', sla: { ISD: 1, OSD: 1, CTG: 1 } }
    ],
    'Damage': [
      { sub: 'Mishandling', type: 'Critical', sla: { ISD: 5, OSD: 7, CTG: 7 } },
      { sub: 'Liquid Leakage', type: 'Critical', sla: { ISD: 2, OSD: 2, CTG: 2 } },
      { sub: 'Poor Packaging', type: 'Critical', sla: { ISD: 5, OSD: 5, CTG: 5 } },
      { sub: 'Not Processed Under Fragile Category', type: 'Critical', sla: { ISD: 3, OSD: 5, CTG: 5 } }
    ],
    'Lost': [
      { sub: 'Parcel Lost By OPS', type: 'Critical', sla: { ISD: 5, OSD: 7, CTG: 7 } },
      { sub: 'Trackless', type: 'Critical', sla: { ISD: 5, OSD: 7, CTG: 7 } },
      { sub: 'Hijacking/Robbery', type: 'Critical', sla: { ISD: 7, OSD: 10, CTG: 10 } },
      { sub: 'Partial Missing', type: 'Critical', sla: { ISD: 5, OSD: 7, CTG: 7 } },
      { sub: 'Empty Package/Empty Packet/Empty Box', type: 'Critical', sla: { ISD: 5, OSD: 7, CTG: 7 } }
    ],
    'No Entry/Cancelled': [
      { sub: 'No Entry', type: 'Critical', sla: { ISD: 5, OSD: 5, CTG: 5 } },
      { sub: 'Double Entry', type: 'Critical', sla: { ISD: 5, OSD: 5, CTG: 5 } },
      { sub: 'Info Mismatch', type: 'Critical', sla: { ISD: 5, OSD: 5, CTG: 5 } }
    ],
    'Wrong Routing': [
      { sub: 'Wrong Routing By Processing Team', type: 'Critical', sla: { ISD: 2, OSD: 5, CTG: 5 } },
      { sub: 'Incomplete/ Wrong Info Input On Panel', type: 'Critical', sla: { ISD: 2, OSD: 5, CTG: 5 } },
      { sub: 'Wrong POD Attached', type: 'Critical', sla: { ISD: 2, OSD: 5, CTG: 5 } }
    ],
    'Wrong tag/Parcel swapped': [
      { sub: 'Wrong Tag By LMH', type: 'Critical', sla: { ISD: 3, OSD: 5, CTG: 5 } },
      { sub: 'Wrong Tag By FMH', type: 'Critical', sla: { ISD: 3, OSD: 5, CTG: 5 } },
      { sub: 'Wrong Tag By Processing Team', type: 'Critical', sla: { ISD: 3, OSD: 5, CTG: 5 } }
    ],
    'Breach of CLOSEBOX': [
      { sub: 'POD Not Followed By Agent', type: 'Critical', sla: { ISD: 2, OSD: 3, CTG: 3 } },
      { sub: 'Forcefully Checked By Customer', type: 'Critical', sla: { ISD: 2, OSD: 3, CTG: 3 } }
    ],
    'Payment Issue': [
      { sub: 'Invoice Generated But Payment Not Disbursed', type: 'Regular', sla: { ISD: 3, OSD: 3, CTG: 3 } },
      { sub: 'Invoice Not Generated', type: 'Regular', sla: { ISD: 3, OSD: 3, CTG: 3 } },
      { sub: 'Hub Payment Not Submitted', type: 'Regular', sla: { ISD: 2, OSD: 3, CTG: 3 } },
      { sub: 'Cash Lost By OPS', type: 'Regular', sla: { ISD: 3, OSD: 5, CTG: 5 } }
    ],
    'Return Delay': [
      { sub: 'Processing Delay', type: 'Regular', sla: { ISD: 3, OSD: 5, CTG: 5 } },
      { sub: 'Return ID Not Created', type: 'Regular', sla: { ISD: 3, OSD: 3, CTG: 3 } },
      { sub: 'Merchant Unreachable/Store Closed', type: 'Regular', sla: { ISD: 2, OSD: 3, CTG: 3 } }
    ]
  };

  function getGlobalSubMeta(cat, sub) {
    const arr = GLOBAL_CATALOG[cat] || [];
    return arr.find(x => x.sub === sub) || arr[0] || { sub: sub || 'General', type: 'Regular', sla: { ISD: 2, OSD: 3, CTG: 3 } };
  }

  // Authoritative Taxonomy v4 Contact Reasons (exact 4 Call Types: Issue, Request, Inquiry, None)
  // Exact 1-to-1 and 1-to-Many Global Category > Sub-Category mappings + cascading Themes & Action Taken
  const TAXONOMY = [
    { id: 'M22', code: 'M#22', name: 'Cancel / Hold Request', users: ['Existing Merchant','New Merchant'], callType: 'Request', track: 'A', owner: 'Global Ops (Track A)', prio: 'P1', slaKind: 'global', parcelReq: true, gCat: 'Execution Request', gSubs: ['Order Cancellation Request','Hold Request'], themes: ['Cancel parcel before delivery','Hold parcel at hub','Customer cancelled order','Other'], actions: ['Raised Execution Request (Cancel/Hold)','Confirmed merchant consent & pushed MX'] },
    { id: 'M23', code: 'M#23', name: 'Address / Contact Correction', users: ['Existing Merchant','New Merchant','Customer'], callType: 'Request', track: 'A', owner: 'Global Ops (Track A)', prio: 'P1', slaKind: 'global', parcelReq: true, gCat: 'Execution Request', gSubs: ['Customer Address Update','Customer Contact Update'], themes: ['Customer address correction','Customer phone number typo','Area / zone changed','Other'], actions: ['Read back corrected info & pushed MX','Updated delivery contact via Execution Request'] },
    { id: 'M24', code: 'M#24', name: 'COD / Weight / Price Correction', users: ['Existing Merchant','New Merchant'], callType: 'Request', track: 'A', owner: 'Global Ops (Track A)', prio: 'P1', slaKind: 'global', parcelReq: true, gCat: 'Execution Request', gSubs: ['Price Updatation Request'], themes: ['COD amount correction','Parcel weight correction','Invoice price update','Other'], actions: ['Verified merchant ID & pushed Price Updatation','Logged corrected COD in Execution Request'] },
    { id: 'M25', code: 'M#25', name: 'Order Details Update (Partial Delivery / Special Instruction)', users: ['Existing Merchant'], callType: 'Request', track: 'A', owner: 'Global Ops (Track A)', prio: 'P2', slaKind: 'global', parcelReq: true, gCat: 'Execution Request', gSubs: ['Partial delivery request - special instruction'], themes: ['Allow partial delivery','Special delivery instruction','Open-box permission','Other'], actions: ['Pushed special instruction to Global MX','Confirmed partial delivery rules with merchant'] },
    { id: 'M05', code: 'M#05', name: 'Delivery Delay (Stuck at Hub / Overdue)', users: ['Existing Merchant','New Merchant','Customer'], callType: 'Issue', track: 'A', owner: 'Global Ops (Track A)', prio: 'P2', slaKind: 'global', parcelReq: true, gCat: 'Delivery Delay', gSubs: ['Processing Delay','Rider Shortage','Remote Area'], themes: ['Stuck at hub >48h','Delivery late (ISD/OSD)','Rider shortage delay','Other'], actions: ['Raised Global Delivery Delay ticket','Checked hub scan & shared revised ETA'] },
    { id: 'M06', code: 'M#06', name: 'Urgent Delivery Request', users: ['Existing Merchant'], callType: 'Request', track: 'A', owner: 'Global Ops (Track A)', prio: 'P1', slaKind: 'global', parcelReq: true, gCat: 'Delivery Delay', gSubs: ['Urgent Delivery'], themes: ['Same-day urgent delivery needed','VIP customer deadline','Other'], actions: ['Flagged Urgent Delivery in Global MX','Confirmed feasibility & shared reference'] },
    { id: 'M04', code: 'M#04', name: 'Parcel Status Not Updated / Wrong Status', users: ['Existing Merchant','Customer'], callType: 'Issue', track: 'A', owner: 'Global Ops (Track A)', prio: 'P1', slaKind: 'global', parcelReq: true, gCat: 'Panel Status', gSubs: ["Agent/Hub Didn't Update Status Timely",'Wrong Status'], themes: ['Marked delivered — not received','No scan update for days','Wrong status on panel','Other'], actions: ['Raised Panel Status ticket in Global MX','Verified scan discrepancy & escalated hub'] },
    { id: 'M08', code: 'M#08', name: 'Fake / Missed Delivery Attempt (False Note)', users: ['Existing Merchant','Customer'], callType: 'Issue', track: 'A', owner: 'Global Ops (Track A)', prio: 'P2', slaKind: 'global', parcelReq: true, gCat: 'Complain Why Return', gSubs: ['False Return Note','Improper Delivery Attempt'], themes: ['Rider did not call customer','False hold / return note','Customer waited all day','Other'], actions: ['Raised Complain Why Return in Global MX','Requested re-attempt with rider audit'] },
    { id: 'M01', code: 'M#01', name: 'Pickup Request (New / Scheduled)', users: ['Existing Merchant','New Merchant'], callType: 'Request', track: 'A', owner: 'Global Ops (Track A)', prio: 'P3', slaKind: 'global', parcelReq: false, gCat: 'Pickup', gSubs: ['Pickup Request','Pickup Request - On-Demand'], themes: ['Scheduled daily pickup','First pickup for new merchant','Bulk pickup van needed','Other'], actions: ['Created pickup request in Global MX','Confirmed pickup slot with merchant'] },
    { id: 'M02', code: 'M#02', name: 'Pickup Missed / Delayed / Not Attempted', users: ['Existing Merchant','New Merchant'], callType: 'Issue', track: 'A', owner: 'Global Ops (Track A)', prio: 'P2', slaKind: 'global', parcelReq: false, gCat: 'Pickup', gSubs: ['Pickup Not Attempted By Agent','Pickup Timing Issue','Rider Shortage'], themes: ['Pickup agent did not arrive','Late pickup after cutoff','Rider refused pickup','Other'], actions: ['Raised Pickup Issue in Global MX','Rebooked pickup & notified merchant'] },
    { id: 'M10', code: 'M#10', name: 'Rider Unreachable (Phone Off / Not Answering)', users: ['Existing Merchant','Customer'], callType: 'Issue', track: 'A', owner: 'Global Ops (Track A)', prio: 'P2', slaKind: 'global', parcelReq: true, gCat: 'Execution Request', gSubs: ['Agent details missing/wrong number'], themes: ['Rider phone switched off','Rider not answering call','Wrong rider number shown','Other'], actions: ['Pushed Agent details update to Global MX','Requested hub to assign reachable rider'] },
    { id: 'M13', code: 'M#13', name: 'Missing / Damaged Item (Damage / Leakage)', users: ['Existing Merchant','Customer'], callType: 'Issue', track: 'A', owner: 'Global Ops (Track A)', prio: 'P1', slaKind: 'global', parcelReq: true, gCat: 'Damage', gSubs: ['Mishandling','Liquid Leakage','Poor Packaging'], themes: ['Product broken / crushed','Liquid leakage in transit','Item missing from parcel','Other'], actions: ['Raised Damage ticket & started claim','Collected photo evidence & pushed MX'] },
    { id: 'M14', code: 'M#14', name: 'Lost Parcel / Compensation Sought', users: ['Existing Merchant'], callType: 'Issue', track: 'A', owner: 'Global Ops (Track A)', prio: 'P1', slaKind: 'global', parcelReq: true, gCat: 'Lost', gSubs: ['Parcel Lost By OPS','Trackless'], themes: ['Parcel trackless >72h','Confirmed lost at hub','Compensation claim requested','Other'], actions: ['Raised Lost Parcel investigation in MX','Initiated compensation review timeline'] },
    { id: 'M18', code: 'M#18', name: 'Breach of CLOSEBOX / POD Not Followed', users: ['Existing Merchant','Customer'], callType: 'Issue', track: 'A', owner: 'Global Ops (Track A)', prio: 'P1', slaKind: 'global', parcelReq: true, gCat: 'Breach of CLOSEBOX', gSubs: ['POD Not Followed By Agent'], themes: ['OTP bypassed on delivery','Closed-box opened without permission','Other'], actions: ['Escalated Breach of CLOSEBOX to Global MX','Flagged rider for POD compliance audit'] },
    { id: 'M26', code: 'M#26', name: 'Payment Not Received / Delayed / Short (Payout)', users: ['Existing Merchant'], callType: 'Issue', track: 'A', owner: 'Global Ops (Track A)', prio: 'P2', slaKind: 'global', parcelReq: false, gCat: 'Payment Issue', gSubs: ['Invoice Generated But Payment Not Disbursed','Invoice Not Generated'], themes: ['Invoice generated — no bank credit','Invoice not generated yet','Short payout amount','Other'], actions: ['Raised Payment Issue in Global MX','Checked payout cycle & shared UTR ETA'] },
    { id: 'M28', code: 'M#28', name: 'Charge Dispute (Delivery / Return / Weight Charge)', users: ['Existing Merchant'], callType: 'Issue', track: 'A', owner: 'Global Ops (Track A)', prio: 'P2', slaKind: 'global', parcelReq: true, gCat: 'Charge Extra/Wrong COD', gSubs: ['Miscalculation Of Delivery/Return Charge','Miscalculation Of Weight Charge'], themes: ['Overcharged weight slab','Wrong delivery/return fee','Rate differs from agreement','Other'], actions: ['Raised Charge Dispute in Global MX','Logged invoice & parcel ID for recalculation'] },
    { id: 'M30', code: 'M#30', name: 'Payment Method / Bank / MFS Change', users: ['Existing Merchant'], callType: 'Request', track: 'A', owner: 'Global Ops (Track A)', prio: 'P2', slaKind: 'global', parcelReq: false, gCat: 'Execution Request', gSubs: ['Payment Info Update'], themes: ['Change bank account','Update bKash / Nagad MFS','Payment hold verification','Other'], actions: ['Verified merchant identity & pushed MX','Submitted Payment Info Update request'] },
    { id: 'M32', code: 'M#32', name: 'Account Access / OTP / Password Reset', users: ['Existing Merchant','New Merchant'], callType: 'Request', track: 'A', owner: 'Global Ops (Track A)', prio: 'P2', slaKind: 'global', parcelReq: false, gCat: 'Execution Request', gSubs: ['Profile Password Update'], themes: ['OTP not received','Password reset needed','Merchant account locked','Other'], actions: ['Pushed Profile Password Update to MX','Verified registered mobile & guided login'] },
    { id: 'M36', code: 'M#36', name: 'Store Approval / Registration Assistance (E-05)', users: ['New Merchant','Potential Merchant'], callType: 'Request', track: 'A', owner: 'Global Ops (Track A)', prio: 'P2', slaKind: 'global', parcelReq: false, gCat: 'Execution Request', gSubs: ['Store Approval'], themes: ['Store approval pending >24h','New store KYC submission','Store info update needed','Other'], actions: ['Pushed Store Approval to Global MX','Checked KYC docs & flagged Activation if incomplete'], edge: 'E-05' },
    { id: 'M29', code: 'M#29', name: 'Payment When / How / Statement Inquiry (E-06)', users: ['Existing Merchant','New Merchant'], callType: 'Inquiry', track: 'B', owner: 'Accounts', prio: 'P3', slaKind: 'hours', sla: 2, friBuf: true, parcelReq: false, themes: ['When will payout arrive?','Need weekly statement / invoice','BEFTN / MFS cycle question','Other'], actions: ['Shared payout cycle on call','Logged Accounts Sheet follow-up (2h SLA)'] },
    { id: 'M31', code: 'M#31', name: 'System / App Bug (Portal, Bulk CSV, API — E-07)', users: ['Existing Merchant','New Merchant','Delivery Agent'], callType: 'Issue', track: 'B', owner: 'Tech & Product', prio: 'P2', slaKind: 'hours', sla: 2, friBuf: false, parcelReq: false, themes: ['Bulk CSV Bangla/UTF-8 error','Merchant portal login/500 error','API webhook failing','Tracking link broken','Other'], actions: ['Routed to Tech & Product Sheet (2h SLA)','Captured error screenshot & gave workaround'], edge: 'E-07' },
    { id: 'M33', code: 'M#33', name: 'Merchant Seeking KAM / Wants KAM Contact or Change', users: ['Existing Merchant','New Merchant'], callType: 'Request', track: 'B', owner: 'Business Team (KAM)', prio: 'P2', slaKind: 'hours', sla: 0.5, friBuf: true, parcelReq: false, themes: ['Wants KAM callback','Custom rate slab request','Requesting KAM change','Nobody contacted me','Other'], actions: ['Routed to Business Team (KAM) · 30m SLA','Promised KAM callback & gave reference'] },
    { id: 'M34', code: 'M#34', name: 'Complaint Against KAM (Unresponsive / Wrong Info)', users: ['Existing Merchant','New Merchant'], callType: 'Issue', track: 'B', owner: 'Business Team (KAM)', prio: 'P1', slaKind: 'hours', sla: 0.5, friBuf: true, parcelReq: false, themes: ['KAM not responding','Wrong rate/info given by KAM','No handover after KAM change','Other'], actions: ['Escalated to KAM Lead via Business Sheet (30m SLA)','Flagged urgent callback for merchant'] },
    { id: 'M37', code: 'M#37', name: 'New Merchant Onboarding / Activation / KYC Help', users: ['New Merchant','Potential Merchant'], callType: 'Request', track: 'B', owner: 'Activation', prio: 'P3', slaKind: 'next_wd_6pm', parcelReq: false, themes: ['How to create first parcel','KYC document verification','Onboarding training call','Other'], actions: ['Guided on call & routed to Activation Sheet','Scheduled onboarding call (Next WD 6:00 PM)'] },
    { id: 'M38', code: 'M#38', name: 'Potential Merchant Joining Lead (Pricing / Coverage)', users: ['Potential Merchant'], callType: 'Inquiry', track: 'B', owner: 'Activation', prio: 'P3', slaKind: 'next_wd_6pm', parcelReq: false, themes: ['Wants to join CarryBee','Bulk pricing / coverage query','Sales callback requested','Other'], actions: ['Qualified lead & routed to Activation Sheet','Shared ISD/OSD rate card & booked callback'] },
    { id: 'M42', code: 'M#42', name: 'Delivery Agent Payment / Deduction Dispute (E-10)', users: ['Delivery Agent'], callType: 'Issue', track: 'B', owner: 'Supply & Safety', prio: 'P2', slaKind: 'next_wd_6pm', parcelReq: false, themes: ['Commission delayed','Wrong COD deduction','Hub cash mismatch','Other'], actions: ['Logged DA ID & Disputed Amount in Supply Sheet','Routed to Supply & Finance reconciliation'], edge: 'E-10' },
    { id: 'M44', code: 'M#44', name: 'Safety / Security Incident (Robbery, Threat, Accident — E-09)', users: ['Delivery Agent','Existing Merchant','Customer'], callType: 'Issue', track: 'DUAL', owner: 'Supply & Safety', prio: 'P1', slaKind: 'immediate', parcelReq: false, gCat: 'Lost', gSubs: ['Hijacking/Robbery'], themes: ['Parcel snatched / robbery','Physical threat / assault','Road accident during delivery','Other'], actions: ['Immediate Security escalation (Supply Sheet G-09)','Triggered E-09 Dual-Push (Global Lost › Hijacking/Robbery)'], edge: 'E-09' },
    { id: 'M35', code: 'M#35', name: 'Follow-Up on Open Ticket / SLA Escalation (E-11)', users: ['Existing Merchant','New Merchant','Customer'], callType: 'Inquiry', track: 'B', owner: 'Issue Resolution', prio: 'P1', slaKind: 'same_day_6pm', parcelReq: false, themes: ['Chasing unresolved ticket','SLA breached — needs urgent fix','Threatening churn over repeat issue','Other'], actions: ['Linked existing ticket (E-11) or escalated to Issue Resolution','Notified Shift Supervisor for same-day closure'] },
    { id: 'M47', code: 'M#47', name: 'Merchant-Side Wrong/Defective Product — Redirect (E-08)', users: ['Customer'], callType: 'Inquiry', track: 'NONE', owner: 'Log Only — Redirect to Merchant', prio: 'P4', slaKind: 'none', parcelReq: false, themes: ['Wrong item / size inside sealed box','Defective product refund from merchant','Other'], actions: ['Explained CarryBee courier role & gave merchant contact','Logged Redirect to Merchant (G-13 · Zero Ops push)'], edge: 'E-08' },
    { id: 'M03', code: 'M#03', name: 'Parcel / Order Status & Rate Inquiry (FCR)', users: ['Existing Merchant','New Merchant','Potential Merchant','Customer','Delivery Agent'], callType: 'Inquiry', track: 'NONE', owner: 'Log Only — Resolved on Call', prio: 'P4', slaKind: 'none', parcelReq: false, themes: ['Where is my parcel? (Status OK)','Rate card / coverage area inquiry','Holiday / cutoff hours inquiry','Other'], actions: ['Resolved directly on call (FCR)','Shared live tracking / rate card — no ticket needed'] },
    { id: 'M49', code: 'M#49', name: 'Non-Service / Silent / Wrong Vertical / Abandoned (E-13)', users: ['Existing Merchant','New Merchant','Potential Merchant','Customer','Delivery Agent'], callType: 'None', track: 'NONE', owner: 'Log Only — No Ticket (None)', prio: 'P4', slaKind: 'none', parcelReq: false, themes: ['Silent / blank line','Wrong vertical (Food/Ride)','Wrong number / abandoned','Other'], actions: ['Transferred / closed with None (E-13)','Saved as Log-Only — zero ticket created'], edge: 'E-13' }
  ];

  // Live-Editable STRICT 5-Col Merchant KAM Master (Spreadsheet: 1PEVhZtbunfZB7qAvC6N1NQ5pSMZYQOsDYOjHXgfb2vg)
  // Plus completedTrips (E-04: >0 = Existing Merchant, 0 = New Merchant) & Management Health BI metadata
  const KAM_DIRECTORY = [
    { bizId: 'CB-M-1042', bizName: 'Dhaka Fashion House', phone: '01711223344', kamName: 'Tanvir Ahmed', team: 'Enterprise KAM', completedTrips: 420, area: 'Mirpur 10', health: 'Watch', sentiment: 'Concerned', complaints30d: 4 },
    { bizId: 'CB-M-1088', bizName: 'Aarong Craft Studio', phone: '01812334455', kamName: 'Sadia Afrin', team: 'Enterprise KAM', completedTrips: 310, area: 'Uttara Sec 7', health: 'Healthy', sentiment: 'Positive', complaints30d: 1 },
    { bizId: 'CB-M-1120', bizName: 'Chattogram Tech Mart', phone: '01614778899', kamName: 'Farhan Kabir', team: 'Regional KAM (CTG)', completedTrips: 265, area: 'Agrabad, CTG', health: 'Churn Risk', sentiment: 'Dissatisfied', complaints30d: 6 },
    { bizId: 'CB-M-1195', bizName: 'Sylhet Tea & Organics', phone: '01915667788', kamName: 'Nabil Hasan', team: 'Growth KAM', completedTrips: 0, area: 'Zindabazar', health: 'Watch', sentiment: 'Neutral', complaints30d: 2 },
    { bizId: 'CB-M-1275', bizName: 'Urban Gadgets Dhaka', phone: '01788445566', kamName: 'Tanvir Ahmed', team: 'Enterprise KAM', completedTrips: 240, area: 'Banani', health: 'Churn Risk', sentiment: 'Dissatisfied', complaints30d: 5 }
  ];

  // Global business_master Fallback (Merchants NOT in KAM Master -> Complaint Management fallback, never blocks logging!)
  const BUSINESS_FALLBACK = [
    { bizId: 'CB-M-1240', bizName: 'KnitWear Express BD', phone: '01722889900', completedTrips: 92, area: 'Dhanmondi 27', health: 'Healthy', sentiment: 'Positive', complaints30d: 1 },
    { bizId: 'CB-M-1291', bizName: 'Bongo Fresh Mart', phone: '01755990011', completedTrips: 0, area: 'Mohammadpur', health: 'Healthy', sentiment: 'Neutral', complaints30d: 0 }
  ];

  const KNOWN_PEOPLE = {
    '01555112233': { role: 'Delivery Agent', name: 'Rakibul Islam (DA-409)', daId: 'DA-409', hub: 'Mirpur-10 Hub', area: 'Dhaka North' },
    '01311998877': { role: 'Customer', name: 'Mahmuda Akter', hub: 'Uttara Hub', area: 'Uttara Sector 11' }
  };

  // Simulated CarryBee Chrome Extension Parcel Master
  const PARCEL_MASTER = {
    'CB2611004512': {
      id: 'CB2611004512', status: 'On Hold at Hub', hub: 'Uttara Hub', zone: 'ISD',
      rider: 'Mehedi Hasan', riderPhone: '01755-441122', merchant: 'Dhaka Fashion House',
      cod: 1850, dest: 'Uttara Sector 11', lastScan: minsAgo(3100),
      scans: [
        { at: minsAgo(4200), text: 'Picked up from Dhaka Fashion House' },
        { at: minsAgo(3600), text: 'Received at Dhaka Central Sorting Hub' },
        { at: minsAgo(3100), text: 'On hold at Uttara Hub — address verification pending' }
      ]
    },
    'CB2611007890': {
      id: 'CB2611007890', status: 'Delivered', hub: 'Agrabad Hub', zone: 'CTG',
      rider: 'Sohel Rana', riderPhone: '01819-772233', merchant: 'Chattogram Tech Mart',
      cod: 3200, dest: 'GEC Circle, CTG', lastScan: minsAgo(480),
      scans: [
        { at: minsAgo(1500), text: 'Received at Agrabad Hub (CTG)' },
        { at: minsAgo(720), text: 'Out for delivery with Sohel Rana' },
        { at: minsAgo(480), text: 'Marked Delivered — OTP bypassed by rider' }
      ]
    },
    'CB2611009911': {
      id: 'CB2611009911', status: 'Delivery Attempted', hub: 'Bogura Sadar Hub', zone: 'OSD',
      rider: 'Jamal Uddin', riderPhone: '01731-889911', merchant: 'KnitWear Express BD',
      cod: 950, dest: 'Satmatha, Bogura', lastScan: minsAgo(195),
      scans: [
        { at: minsAgo(1200), text: 'In transit to Bogura Sadar Hub (OSD)' },
        { at: minsAgo(620), text: 'Out for delivery with Jamal Uddin' },
        { at: minsAgo(195), text: 'Delivery attempted: Customer unreachable' }
      ]
    }
  };

  const NEXT_PARCEL_STEP = {
    'On Hold at Hub': 'Out for Delivery',
    'Delivery Attempted': 'Out for Delivery',
    'In Transit': 'Received at Delivery Hub',
    'Out for Delivery': 'Delivered'
  };

  const SHEET_REGISTRY = [
    { name: 'Master Stakeholder Fallback Hub', id: '1JE5xO8tDoyw9VP8iVQtItqp_NIS5bbNq_2_9jGNXbLQ', tabs: 'All_Issues_Fallback, Team_Summary, Global_Overflow_Watch', status: 'Synced · 11:28 AM' },
    { name: 'Business Team (KAM) Issues', id: '1f_nY7jq8OVAOnbMTt4fm8jxMshpt7tIkPliNtUJmVX4', tabs: 'Issues, _Dropdowns, _Instructions', status: 'Synced · 11:29 AM' },
    { name: 'Tech & Product Issues', id: '1j2N739pVRgF4bI58hODJVPava0dPXwLdHJT8JkM42IY', tabs: 'Issues, _Dropdowns, _Instructions', status: 'Synced · 11:29 AM' },
    { name: 'Accounts Issues', id: '1hxJH5oiclcNe2KywwrF2EpZFjWVbjFRszPc63iZqzcc', tabs: 'Issues, _Dropdowns, _Instructions', status: 'Synced · 11:27 AM' },
    { name: 'Activation Issues', id: '1ivLXZ9Ph7wiyC-pMiptaX9lqwvbfutOoO0TS0HqQisU', tabs: 'Issues, _Dropdowns, _Instructions', status: 'Synced · 11:26 AM' },
    { name: 'Supply & Safety Issues', id: '1XBHcL8WyBmqoselx3_WU9lmpaVpJCpnHyiJ-sbZOK7Y', tabs: 'Issues, _Dropdowns, _Instructions', status: 'Synced · 11:29 AM' },
    { name: 'Issue Resolution Escalations', id: '12OvnVgG0geVfZtys6RuVxslpxvc8k6VBnIJcf9c7zYI', tabs: 'Issues, _Dropdowns, _Instructions', status: 'Synced · 11:28 AM' },
    { name: 'Merchant KAM Master (5-Col)', id: '1PEVhZtbunfZB7qAvC6N1NQ5pSMZYQOsDYOjHXgfb2vg', tabs: 'KAM_Merchants, _Instructions', status: 'Live Read · 11:30 AM' }
  ];

  const OVERFLOW_LOG = [
    { id: 'OVF-01', globalId: 'CB-21-11-0419', zone: 'OSD', sheetRow: 2211, status: 'Bypassed Sheet -> Supabase Verified', at: minsAgo(82) },
    { id: 'OVF-02', globalId: 'CB-21-11-0422', zone: 'OSD', sheetRow: 2212, status: 'Bypassed Sheet -> Supabase Verified', at: minsAgo(41) }
  ];

  // Call Interaction Ledger (Ticketed + Non-Ticketed / Log-Only + Callbacks + Dropped + Outgoing + No Answer)
  const CALL_LOGS = [
    {
      id: 'CL-2041', direction: 'Incoming', outcome: 'callback', startedAt: minsAgo(14), durationSec: 52,
      agent: 'Nusrat Jahan', callerType: 'Existing Merchant', callerName: 'Urban Gadgets Dhaka', phone: '01788445566',
      reasonName: 'Callback Requested · COD & Return Review', theme: 'Other', overrideUsed: false, ticketId: null, sentiment: 'Concerned',
      callbackAt: minsAhead(20), callbackStatus: 'Pending',
      note: 'Merchant busy packing morning batch — requested callback at 11:50 AM to discuss COD invoice & delayed returns.'
    },
    {
      id: 'CL-2040', direction: 'Incoming', outcome: 'dropped', startedAt: minsAgo(26), durationSec: 19,
      agent: 'Nusrat Jahan', callerType: 'Existing Merchant', callerName: 'Dhaka Fashion House', phone: '01711223344',
      reasonName: 'Call Dropped After Answer', theme: '', overrideUsed: false, ticketId: null, sentiment: 'Neutral',
      callbackAt: minsAgo(5), callbackStatus: 'Overdue',
      note: 'Answered via IP phone; line disconnected after 19s while checking pickup van ETA. Auto-queued for callback.'
    },
    {
      id: 'CL-2039', direction: 'Incoming', outcome: 'connected', startedAt: minsAgo(42), durationSec: 138,
      agent: 'Rafiul Islam', callerType: 'Customer', callerName: 'Mahmuda Akter', phone: '01311998877',
      reasonName: 'M#47 · Wrong Product in Sealed Box (E-08 Redirect)', theme: 'Wrong item / size inside sealed box', overrideUsed: false, ticketId: null, sentiment: 'Neutral',
      callbackAt: null, callbackStatus: null,
      note: 'Log Only (Not Ticketed · E-08 Redirect to Merchant): Parcel arrived sealed intact; wrong shirt size packed. Guided customer to contact merchant directly.'
    },
    {
      id: 'CL-2038', direction: 'Outgoing', outcome: 'no_answer', startedAt: minsAgo(58), durationSec: 0,
      agent: 'Tamanna Akter', callerType: 'Existing Merchant', callerName: 'Aarong Craft Studio', phone: '01812334455',
      reasonName: 'Feedback Call Attempt 1/3 (SAMPLE-007)', theme: '', overrideUsed: false, ticketId: 'SAMPLE-007', sentiment: 'Neutral',
      callbackAt: minsAhead(40), callbackStatus: 'Pending',
      note: 'Outgoing feedback call attempt 1/3 for INV-8841 BEFTN credit confirmation — phone rang with no answer. Rescheduled for 12:10 PM.'
    },
    {
      id: 'CL-2037', direction: 'Incoming', outcome: 'connected', startedAt: minsAgo(75), durationSec: 94,
      agent: 'Nusrat Jahan', callerType: 'Potential Merchant', callerName: 'Bongo Organics (New Lead)', phone: '01744556677',
      reasonName: 'M#03 · Rate Card & Cutoff Inquiry (FCR)', theme: 'Rate card / coverage area inquiry', overrideUsed: false, ticketId: null, sentiment: 'Positive',
      callbackAt: null, callbackStatus: null,
      note: 'Log Only (Not Ticketed · FCR): Shared Tk 60 ISD / Tk 110 OSD pricing and 4:00 PM same-day pickup cutoff.'
    },
    {
      id: 'CL-2036', direction: 'Outgoing', outcome: 'outgoing', startedAt: minsAgo(95), durationSec: 165,
      agent: 'Rafiul Islam', callerType: 'Existing Merchant', callerName: 'KnitWear Express BD', phone: '01722889900',
      reasonName: 'Proactive 7-Day Onboarding Check-In', theme: 'Where is my parcel? (Status OK)', overrideUsed: false, ticketId: null, sentiment: 'Positive',
      callbackAt: null, callbackStatus: null,
      note: 'Log Only (Not Ticketed · Outgoing): Merchant happy with first 92 completed trips; portal label printing working smoothly.'
    },
    {
      id: 'CL-2035', direction: 'Incoming', outcome: 'connected', startedAt: minsAgo(140), durationSec: 204,
      agent: 'Nusrat Jahan', callerType: 'Existing Merchant', callerName: 'Chattogram Tech Mart', phone: '01614778899',
      reasonName: 'M#35 · Follow-Up / Chronic Unresolved (E-16)', theme: 'Threatening churn over repeat issue', overrideUsed: false, ticketId: 'SAMPLE-008', sentiment: 'Dissatisfied',
      callbackAt: null, callbackStatus: null,
      note: 'Feedback call failed — customer & neighbor deny receiving CB2611007890. Auto-reopened SAMPLE-008 (E-16).'
    },
    {
      id: 'CL-2034', direction: 'Incoming', outcome: 'connected', startedAt: minsAgo(260), durationSec: 134,
      agent: 'Nusrat Jahan', callerType: 'Existing Merchant', callerName: 'Dhaka Fashion House', phone: '01711223344',
      reasonName: 'M#05 · Delivery Delay (Stuck at Hub)', theme: 'Stuck at hub >48h', overrideUsed: false, ticketId: 'INB-901', sentiment: 'Concerned',
      callbackAt: null, callbackStatus: null,
      note: 'Raised Track A Global Ops ticket INB-901 (CB-21-11-0419) for CB2611004512 stuck 51h at Uttara Hub.'
    }
  ];

  // Ticketed Issues (Track A Global MX + Track B Stakeholder Sheets) — with exact Global Ops metadata & v4 SLAs
  const ISSUES = [
    {
      id: 'INB-901', globalId: 'CB-21-11-0419', track: 'A', owner: 'Global Ops (Track A)',
      callerType: 'Existing Merchant', callerName: 'Dhaka Fashion House', phone: '01711223344', kam: 'Tanvir Ahmed',
      reasonCode: 'M#05', reasonName: 'Delivery Delay (Stuck at Hub / Overdue)', theme: 'Stuck at hub >48h', actionTaken: 'Raised Global Delivery Delay ticket',
      gCat: 'Delivery Delay', gSub: 'Processing Delay', gIssueType: 'Regular',
      opsMeta: { validation: 'Valid', opsCategory: 'Hub Processing Backlog', cmAssigned: 'CM-Imran (North)', duplicateOf: null, finalResponse: '' },
      prio: 'P1', status: 'In Progress', threatChurn: false,
      consignment: 'CB2611004512', extraConsignments: [], hub: 'Uttara Hub', zone: 'OSD',
      summary: 'High-value COD parcel stuck at hub for 51 hours. Customer threatens cancellation; merchant needs same-day re-attempt.',
      createdAt: minsAgo(260), slaHours: 120, slaLabel: '5d OSD Global SLA', reminderAt: minsAhead(25), reminderNote: 'Confirm Layer 3 final_response before calling merchant',
      reopenCount: 0, feedbackAttempts: 0, rcCode: '', accountability: '', resolutionSummary: '',
      parcelSnapshot: JSON.parse(JSON.stringify(PARCEL_MASTER['CB2611004512'])),
      opsLayers: [
        { layer: 'Layer 1 · Central Ops', by: 'Ops Desk (MX)', at: minsAgo(220), text: 'OSD row 2211 overflow bypassed cleanly; tracked directly in Supabase MX.' },
        { layer: 'Layer 2 · Hub Supervisor', by: 'Imran Hossain (Uttara)', at: minsAgo(115), text: 'Parcel located in Sector-11 cage. Assigned to Rider Mehedi Hasan.' },
        { layer: 'Layer 3 · Final Response', by: 'Pending', at: null, text: 'Awaiting rider out-for-delivery scan confirmation.' }
      ],
      timeline: [
        { kind: 'call', by: 'Nusrat Jahan', at: minsAgo(260), text: 'Incoming IP phone call (02:14). Logged 51h delay on CB2611004512.' },
        { kind: 'push', by: 'System (Track A)', at: minsAgo(259), text: 'Pushed to Global Tracker (channel="MX") as CB-21-11-0419 [Delivery Delay › Processing Delay].' },
        { kind: 'ops', by: 'Imran Hossain (Layer 2)', at: minsAgo(115), text: 'Parcel located in Sector-11 cage; assigned to Rider Mehedi Hasan.' },
        { kind: 'reminder', by: 'Nusrat Jahan', at: minsAgo(45), text: 'Reminder scheduled for 11:55 AM to verify dispatch scan.' }
      ]
    },
    {
      id: 'SAMPLE-008', globalId: null, track: 'B', owner: 'Issue Resolution',
      callerType: 'Existing Merchant', callerName: 'Chattogram Tech Mart', phone: '01614778899', kam: 'Farhan Kabir',
      reasonCode: 'M#35', reasonName: 'Follow-Up on Open Ticket / SLA Escalation (E-11)', theme: 'Threatening churn over repeat issue', actionTaken: 'Escalated to Issue Resolution (Same-Day)',
      prio: 'P1', status: 'In Progress', threatChurn: true,
      reopened: true, reopenCount: 1, feedbackAttempts: 1, consignment: 'CB2611007890', extraConsignments: [], hub: 'Agrabad Hub', zone: 'CTG',
      summary: 'Parcel marked delivered without OTP; customer denies receipt. 3rd incident in 7 days — merchant threatening churn.',
      createdAt: minsAgo(690), slaHours: 6, slaLabel: 'Same-day 6:00 PM', reminderAt: minsAgo(15), reminderNote: 'URGENT: Share signed POD or claim approval with merchant + Farhan Kabir',
      rcCode: 'RC-48', accountability: 'Carrybee - Internal', resolutionSummary: '',
      parcelSnapshot: JSON.parse(JSON.stringify(PARCEL_MASTER['CB2611007890'])),
      timeline: [
        { kind: 'call', by: 'Nusrat Jahan', at: minsAgo(690), text: 'Merchant escalated missing OTP proof on CB2611007890.' },
        { kind: 'sheet', by: 'Issue Resolution', at: minsAgo(310), text: 'Marked Resolved — rider stated neighbor received parcel.' },
        { kind: 'reopen', by: 'Nusrat Jahan (E-16)', at: minsAgo(140), text: 'Feedback call failed: neighbor & customer deny receipt. Auto-reopened & escalated to Supervisor.' }
      ]
    },
    {
      id: 'SAMPLE-007', globalId: null, track: 'B', owner: 'Accounts',
      callerType: 'Existing Merchant', callerName: 'Aarong Craft Studio', phone: '01812334455', kam: 'Sadia Afrin',
      reasonCode: 'M#29', reasonName: 'Payment When / How / Statement Inquiry (E-06)', theme: 'When will payout arrive?', actionTaken: 'Logged Accounts Sheet follow-up (2h SLA)',
      prio: 'P2', status: 'Resolved', awaitingConfirm: true, threatChurn: false,
      consignment: '', extraConsignments: [], hub: 'Uttara Hub', zone: 'ISD',
      summary: 'Invoice #INV-8841 (Tk 48,200) expected yesterday; merchant requested BEFTN credit confirmation and UTR reference.',
      createdAt: minsAgo(150), slaHours: 2, slaLabel: '2h Accounts SLA', reminderAt: minsAhead(40), reminderNote: 'Retry outgoing feedback call (Attempt 1/3: No Answer)',
      reopenCount: 0, feedbackAttempts: 1, rcCode: 'RC-24', accountability: 'Carrybee - Internal',
      resolutionSummary: 'BEFTN batch #409 cleared at 9:45 AM; UTR #BF992817 shared in Accounts Sheet.',
      timeline: [
        { kind: 'call', by: 'Rafiul Islam', at: minsAgo(150), text: 'Merchant called about Tk 48,200 settlement on INV-8841.' },
        { kind: 'sheet', by: 'Accounts Team', at: minsAgo(75), text: 'Marked Resolved (Hard Gate OK · RC-24 -> Carrybee - Internal): BEFTN cleared at 9:45 AM.' },
        { kind: 'chase', by: 'Tamanna Akter', at: minsAgo(58), text: 'Feedback call Attempt 1/3 — Not Reachable. Rescheduled for 12:10 PM.' }
      ]
    },
    {
      id: 'SAMPLE-001', globalId: null, track: 'B', owner: 'Business Team (KAM)',
      callerType: 'Existing Merchant', callerName: 'Dhaka Fashion House', phone: '01711223344', kam: 'Tanvir Ahmed',
      reasonCode: 'M#33', reasonName: 'Merchant Seeking KAM / Wants KAM Contact or Change', theme: 'Custom rate slab request', actionTaken: 'Routed to Business Team (KAM) · 30m SLA',
      prio: 'P2', status: 'Acknowledged', threatChurn: false,
      consignment: '', extraConsignments: [], hub: 'Mirpur-10 Hub', zone: 'ISD',
      summary: 'Merchant scaling to 500+ monthly parcels for winter campaign; requested custom COD slab & dedicated pickup van.',
      createdAt: minsAgo(45), slaHours: 0.5, slaLabel: '30m KAM SLA', reminderAt: minsAhead(30), reminderNote: 'Verify Tanvir Ahmed shared winter rate sheet',
      reopenCount: 0, feedbackAttempts: 0, rcCode: '', accountability: '', resolutionSummary: '',
      timeline: [
        { kind: 'call', by: 'Nusrat Jahan', at: minsAgo(45), text: 'Merchant requested winter volume rate slab.' },
        { kind: 'sheet', by: 'Tanvir Ahmed (KAM)', at: minsAgo(25), text: 'Acknowledged in Business Team Sheet — drafting proposal.' }
      ]
    },
    {
      id: 'SAMPLE-002', globalId: null, track: 'B', owner: 'Tech & Product',
      callerType: 'New Merchant', callerName: 'Sylhet Tea & Organics', phone: '01915667788', kam: 'Nabil Hasan',
      reasonCode: 'M#31', reasonName: 'System / App Bug (Portal, Bulk CSV, API — E-07)', theme: 'Bulk CSV Bangla/UTF-8 error', actionTaken: 'Routed to Tech & Product Sheet (2h SLA)',
      prio: 'P2', status: 'Raised', threatChurn: false,
      consignment: '', extraConsignments: [], hub: 'Sylhet Central Hub', zone: 'OSD',
      summary: 'Bulk CSV upload fails with HTTP 500 whenever Bangla characters appear in recipient address — blocking 60 orders.',
      createdAt: minsAgo(140), slaHours: 2, slaLabel: '2h Tech SLA', reminderAt: minsAhead(20), reminderNote: 'Check Tech Sheet acknowledgement & hotfix ETA',
      reopenCount: 0, feedbackAttempts: 0, rcCode: '', accountability: '', resolutionSummary: '',
      timeline: [
        { kind: 'call', by: 'Tamanna Akter', at: minsAgo(140), text: 'Reported CSV UTF-8 upload error blocking 60 parcel imports.' },
        { kind: 'raise', by: 'System (Track B)', at: minsAgo(139), text: 'Routed to Tech & Product Sheet (G-01 · 2h SLA) + Fallback Hub.' }
      ]
    }
  ];

  // Unified Chronological Activity Stream (Seeded from Issues + Non-Ticketed Call Logs)
  const GLOBAL_FEED = [];
  function seedFeed() {
    GLOBAL_FEED.length = 0;
    ISSUES.forEach(t => t.timeline.forEach(ev => GLOBAL_FEED.push({
      issueId: t.id, caller: t.callerName, kind: ev.kind, by: ev.by, at: ev.at, text: ev.text
    })));
    CALL_LOGS.filter(l => !l.ticketId).forEach(l => GLOBAL_FEED.push({
      issueId: l.id, caller: l.callerName, kind: l.outcome === 'dropped' ? 'chase' : l.outcome === 'callback' ? 'reminder' : 'call',
      by: l.agent, at: l.startedAt, text: `[${l.direction} · ${outcomeMeta(l.outcome).short} · Log Only] ${l.note}`
    }));
    GLOBAL_FEED.sort((a, b) => b.at - a.at);
  }
  function outcomeMeta(id) { return OUTCOMES.find(o => o.id === id) || OUTCOMES[0]; }
  seedFeed();

  const AGENTS = [
    { name: 'Nusrat Jahan', status: 'Online', shift: '9:00 AM – 6:00 PM', qaScore: 95, fcrPct: 44, conversions: 9, avgHandleSec: 126 },
    { name: 'Rafiul Islam', status: 'On Call', shift: '9:00 AM – 6:00 PM', qaScore: 92, fcrPct: 41, conversions: 7, avgHandleSec: 142 },
    { name: 'Tamanna Akter', status: 'Follow-Up', shift: '10:00 AM – 7:00 PM', qaScore: 94, fcrPct: 39, conversions: 8, avgHandleSec: 118 },
    { name: 'Sajid Rahman', status: 'Online', shift: '10:00 AM – 7:00 PM', qaScore: 86, fcrPct: 35, conversions: 5, avgHandleSec: 158 }
  ];

  /* ========================================================================
     APP STATE
     ======================================================================== */
  const STATE = {
    role: 'agent',
    tab: 'desk',
    fridayBuffer: false,
    theme: 'light', // 'light' | 'soft' | 'dark'
    lastSaved: null,
    selectedIssueId: 'INB-901',
    boardFilter: { team: '', q: '', chip: 'all' },
    logFilter: 'all',
    streamFilter: 'all',
    dashPeriod: 'wow',
    benchMode: 'mx', // 'mx' or 'compare' (MX vs KAM benchmark toggle)
    mgmtDefsOpen: false,
    selectedWatchIdx: 0,
    heatMode: 'arrivals', // 'arrivals' | 'missed'
    globalPreviewModal: null, // { mode: 'draft'|'ticket', tab: 'record'|'json', data: ... }
    call: newCallDraft()
  };

  function newCallDraft() {
    return {
      direction: 'Incoming',
      outcome: 'connected',
      phone: '',
      startedAt: null,
      secs: 0,
      callerType: '',
      unverifiedType: false, // E-02
      callType: '',
      reasonId: '',
      theme: '',
      actionTaken: '',
      consignment: '',
      extraConsignments: [], // E-03 multi-parcel
      extraConsDraft: '',
      parcel: null,
      parcelLoading: false,
      note: '',
      sentiment: 'Neutral',
      threatChurn: false, // E-12
      daId: '', // E-10 (M#42)
      disputedAmount: '', // E-10 (M#42)
      prio: 'P2',
      prioEdited: false,
      robberyDualPush: true, // E-09
      merchant: null,
      merchantInKamMaster: false,
      knownPerson: null,
      cbPreset: '30',
      cbCustomTime: '14:30',
      autoQueueDropCb: true,
      linkedCallbackId: null,
      // Editable Track A Global Tracker Payload (with 1-to-1 / 1-to-many Sub-Category + E-14 Override)
      trkHub: '',
      trkZone: '',
      trkGCat: '',
      trkGSub: '',
      trkEdited: { hub: false, zone: false },
      overrideEnabled: false, // E-14
      overrideOwner: '',
      overrideReason: ''
    };
  }

  let timerH = null;

  /* ========================================================================
     CORE HELPERS (EXACT v4 SLA ENGINE + 6:00 PM / FRIDAY +2H BUFFER)
     ======================================================================== */
  function nextWorkingDay6PM(from) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, 18, 0, 0);
    if (d.getDay() === 5) d.setDate(d.getDate() + 1); // Skip Friday -> Saturday 6:00 PM
    return d;
  }

  function sameDay6PM(from) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 18, 0, 0);
    return d <= from ? nextWorkingDay6PM(from) : d;
  }

  function computeDueDateForReason(r, from, zone, gCat, gSub) {
    if (!r) return null;
    if (r.slaKind === 'none') return null;
    if (r.slaKind === 'immediate') return new Date(from.getTime() + 1 * 3600000);
    if (r.slaKind === 'same_day_6pm') return sameDay6PM(from);
    if (r.slaKind === 'next_wd_6pm') return nextWorkingDay6PM(from);
    if (r.slaKind === 'global') {
      const meta = getGlobalSubMeta(gCat || r.gCat, gSub || (r.gSubs && r.gSubs[0]));
      const days = (meta.sla && meta.sla[zone || 'ISD']) || 2;
      return new Date(from.getTime() + days * 24 * 3600000);
    }
    let hrs = r.sla || 2;
    if (STATE.fridayBuffer && r.friBuf) hrs += 2;
    return new Date(from.getTime() + hrs * 3600000);
  }

  function effSlaHours(t) {
    let h = t.slaHours || 2;
    if (STATE.fridayBuffer && (t.owner === 'Business Team (KAM)' || t.owner === 'Accounts')) h += 2;
    return h;
  }

  function slaStatus(t) {
    if (t.status === 'Closed') return { key: 'closed', label: 'Closed', pill: 'good' };
    const due = t.dueAt ? new Date(t.dueAt) : new Date(t.createdAt.getTime() + effSlaHours(t) * 3600000);
    const hrsLeft = (due - nowDyn()) / 3600000;
    if (t.awaitingConfirm || t.status === 'Resolved') return { key: 'confirm', label: 'Confirm w/ caller', pill: 'acc', due };
    if (hrsLeft < 0) return { key: 'over', label: `Overdue ${fmtDur(-hrsLeft)}`, pill: 'bad', due };
    if (hrsLeft < 1.5) return { key: 'soon', label: `Due ${fmtTimeAMPM(due)}`, pill: 'warn', due };
    return { key: 'ok', label: `Due ${fmtStamp(due)}`, pill: 'good', due };
  }

  function needsFollowUp(t) {
    if (t.status === 'Closed') return false;
    if (t.awaitingConfirm || t.status === 'Resolved' || t.reopened || t.threatChurn) return true;
    const sl = slaStatus(t);
    return sl.key === 'over' || sl.key === 'soon' || (t.reminderAt && t.reminderAt <= nowDyn());
  }

  function pendingCallbacks() {
    return CALL_LOGS.filter(l => l.callbackAt && l.callbackStatus && l.callbackStatus !== 'Completed').sort((a, b) => a.callbackAt - b.callbackAt);
  }

  function stepIndex(t) { return t.reopened ? 2 : Math.max(0, STEPS.indexOf(t.status)); }

  function pushEvent(issue, kind, by, text) {
    const at = nowDyn();
    if (issue) issue.timeline.push({ kind, by, at, text });
    GLOBAL_FEED.unshift({ issueId: issue ? issue.id : 'CALL-LOG', caller: issue ? issue.callerName : 'Desk', kind, by, at, text });
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { el.hidden = true; }, 3600);
  }

  /* ========================================================================
     PRD v3.2 PRODUCTION REFINEMENTS:
     1) AUTO-SAVED LOCALSTORAGE DRAFT (NO PHONE NORMALIZATION)
     2) RBAC-GATED UTF-8 BOM CSV EXPORTS + IMMUTABLE AUDIT LOGS
     3) LIVE CHURN WEIGHT RECALCULATION
     ======================================================================== */
  const DRAFT_STORAGE_KEY = 'carrybee_inboundiq_call_draft_v32';
  const AUDIT_LOGS = [
    { at: minsAgo(48), actor: 'Mahmudul Hasan', role: 'Supervisor', action: 'CSV_EXPORT', scope: 'Team Call Logs (21 Nov · 18 rows · UTF-8 BOM)' },
    { at: minsAgo(115), actor: 'InboundIQ System Admin', role: 'Admin', action: 'CONFIG_UPDATE', scope: 'Verified 8-Sheet Registry & Churn Weight defaults' }
  ];

  function saveCallDraftToStorage() {
    try {
      const c = STATE.call;
      const snap = {
        direction: c.direction, outcome: c.outcome, phone: c.phone, callerType: c.callerType,
        callType: c.callType, reasonId: c.reasonId, theme: c.theme, actionTaken: c.actionTaken,
        sentiment: c.sentiment, note: c.note, consignment: c.consignment, savedAt: Date.now()
      };
      if (c.phone || c.note || c.reasonId) localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(snap));
    } catch (e) {}
  }

  function clearCallDraftStorage() {
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch (e) {}
  }

  function restoreCallDraftFromStorage() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || (!d.phone && !d.note && !d.reasonId)) return false;
      Object.assign(STATE.call, {
        direction: d.direction || 'Incoming', outcome: d.outcome || 'connected',
        phone: d.phone || '', callerType: d.callerType || '', callType: d.callType || '',
        reasonId: d.reasonId || '', theme: d.theme || '', actionTaken: d.actionTaken || '',
        sentiment: d.sentiment || 'Neutral', note: d.note || '', consignment: d.consignment || ''
      });
      if (d.phone) lookupPhone(d.phone);
      return true;
    } catch (e) { return false; }
  }

  function computeChurnScore(m) {
    let sum = 0;
    for (const code of m.signals) {
      if (CHURN_WEIGHTS[code]) sum += Number(CHURN_WEIGHTS[code].pts) || 0;
    }
    return Math.min(100, sum);
  }

  function exportCSVWithBOM(filename, headers, rows, scopeLabel) {
    const roleDef = ROLES[STATE.role];
    if (!roleDef || !roleDef.canExport) {
      showToast('Access denied: Agent role cannot bulk-export PII/CRM data (PRD §8.5).');
      return;
    }
    const escCsv = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = [headers.map(escCsv).join(',')].concat(rows.map(r => r.map(escCsv).join(','))).join('\r\n');
    const blob = new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    AUDIT_LOGS.unshift({
      at: nowDyn(), actor: CURRENT_USER ? CURRENT_USER.username : roleDef.persona, role: (CURRENT_USER ? CURRENT_USER.role : STATE.role).toUpperCase(),
      action: 'CSV_EXPORT', scope: `${scopeLabel} (${rows.length} rows · UTF-8 BOM)`
    });
    logCsvExportAudit(scopeLabel, rows.length, filename).catch(() => {});
    showToast(`Audited UTF-8 BOM CSV exported (${rows.length} rows) and persisted to Supabase audit_logs.`);
  }

  /* ========================================================================
     ZERO-FRICTION FIXED LOGIN & SESSION MANAGEMENT (PRD §8.6)
     ======================================================================== */
  const ROLE_BADGE_CLASS = { admin: 'good', management: 'acc', call_pic: 'purple', supervisor: 'warn', agent: 'mute' };

  function renderQuickRoster() {
    const grid = document.getElementById('quickRosterGrid');
    const pill = document.getElementById('rosterCountPill');
    if (!grid) return;
    const activeUsers = USERS.filter(u => u.active);
    if (pill) pill.textContent = `${activeUsers.length} Active`;
    grid.innerHTML = activeUsers.map(u => `
      <button type="button" class="roster-btn" data-quick-uid="${esc(u.id)}">
        <div class="rb-top">
          <span>${esc(u.username)}</span>
          <span class="pill ${ROLE_BADGE_CLASS[u.role] || 'mute'}" style="font-size:10px;padding:1px 6px">${esc(ROLE_DISPLAY[u.role] || u.role)}</span>
        </div>
        <div class="rb-mail">${esc(u.email)}</div>
      </button>
    `).join('');
    grid.querySelectorAll('[data-quick-uid]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const u = USERS.find(x => x.id === btn.dataset.quickUid);
        if (!u) return;
        document.getElementById('loginEmail').value = u.email;
        if (u.password && !u.password.startsWith('••')) {
          document.getElementById('loginPassword').value = u.password;
          await authenticateWithSupabase(u.email, u.password);
        } else {
          document.getElementById('loginPassword').focus();
          showToast(`Selected ${u.email} — enter assigned password to sign in.`);
        }
      });
    });
  }

  function signInUser(user) {
    CURRENT_USER = user;
    CURRENT_AGENT = user.username;
    STATE.role = user.role;
    STATE.tab = ROLES[user.role].tabs[0].id;
    try { sessionStorage.setItem(SESSION_STORAGE_KEY, user.id); } catch (e) {}

    document.getElementById('authError').hidden = true;
    document.getElementById('authScreen').hidden = true;
    document.getElementById('appShell').hidden = false;
    document.getElementById('userChipName').textContent = `${user.username}`;
    document.getElementById('userChip').title = `${user.username} (${user.email}) · Role: ${user.role.toUpperCase()} · Team: ${user.team}`;

    // Strict RBAC enforcement in header: Only Admin can preview other role views; non-Admins are locked to their role
    const rs = document.getElementById('roleSwitcher');
    const lrp = document.getElementById('lockedRolePill');
    if (user.role === 'admin') {
      rs.hidden = false;
      lrp.hidden = true;
      document.querySelectorAll('#roleSwitcher button').forEach(x => x.classList.toggle('active', x.dataset.role === STATE.role));
    } else {
      rs.hidden = true;
      lrp.hidden = false;
      lrp.innerHTML = `${ic('lock', 'sm')} ${esc(ROLES[user.role].label)} · ${esc(user.team)}`;
    }

    if (restoreCallDraftFromStorage() && canActAsAgent(user.role)) {
      setTimeout(() => showToast('Recovered auto-saved call draft from localStorage.'), 350);
    } else {
      showToast(`Signed in as ${user.username} (${ROLE_DISPLAY[user.role] || user.role})`);
    }
    render();
    window.scrollTo(0, 0);
  }

  let realtimeChannel = null;

  async function hydrateFromSupabase() {
    try {
      const bundle = await fetchWorkspaceBundle();
      if (bundle.profiles && bundle.profiles.length > 0) {
        const localPassMap = new Map(USERS.map(u => [u.email.toLowerCase(), u.password]));
        USERS = bundle.profiles.map(p => ({
          ...p,
          password: localPassMap.get(p.email.toLowerCase()) || p.password || '••••••••••••',
        }));
      }
      if (bundle.kamDirectory && bundle.kamDirectory.length > 0) {
        KAM_DIRECTORY.splice(0, KAM_DIRECTORY.length, ...bundle.kamDirectory);
      }
      if (bundle.businessFallback && bundle.businessFallback.length > 0) {
        BUSINESS_FALLBACK.splice(0, BUSINESS_FALLBACK.length, ...bundle.businessFallback);
      }
      if (bundle.parcels && Object.keys(bundle.parcels).length > 0) {
        Object.assign(PARCELS, bundle.parcels);
      }
      if (bundle.sheetRegistry && bundle.sheetRegistry.length > 0) {
        SHEET_REGISTRY.splice(0, SHEET_REGISTRY.length, ...bundle.sheetRegistry);
      }
      if (bundle.overflowLog && bundle.overflowLog.length > 0) {
        OVERFLOW_LOG.splice(0, OVERFLOW_LOG.length, ...bundle.overflowLog);
      }
      if (bundle.churnWeights) {
        Object.entries(bundle.churnWeights).forEach(([k, v]) => {
          if (CHURN_WEIGHTS[k]) CHURN_WEIGHTS[k].pts = v.pts;
        });
        CHURN_WATCHLIST.forEach(m => { m.score = computeChurnScore(m); });
        CHURN_WATCHLIST.sort((a, b) => b.score - a.score);
      }
      if (bundle.auditLogs && bundle.auditLogs.length > 0) {
        AUDIT_LOGS.splice(0, AUDIT_LOGS.length, ...bundle.auditLogs);
      }
      if (bundle.callLogs && bundle.callLogs.length > 0) {
        CALL_LOGS.splice(0, CALL_LOGS.length, ...bundle.callLogs);
      }
      if (bundle.issues && bundle.issues.length > 0) {
        ISSUES.splice(0, ISSUES.length, ...bundle.issues);
        if (!ISSUES.some(x => x.id === STATE.selectedIssueId)) {
          STATE.selectedIssueId = ISSUES[0].id;
        }
      }
      if (bundle.globalFeed && bundle.globalFeed.length > 0) {
        GLOBAL_FEED.splice(0, GLOBAL_FEED.length, ...bundle.globalFeed);
      }
      const pillTxt = document.getElementById('dbLiveText');
      if (pillTxt) pillTxt.textContent = `Supabase Live · ${ISSUES.length} Tickets`;
      if (CURRENT_USER) render();
    } catch (err) {
      console.warn('Supabase sync warning:', err);
    }
  }

  function startRealtimeSubscriptions() {
    if (realtimeChannel) return;
    realtimeChannel = supabase
      .channel('inboundiq-live-v32')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_tickets' }, () => hydrateFromSupabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, () => hydrateFromSupabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_overflow_watch' }, () => hydrateFromSupabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'merchant_kam_directory' }, () => hydrateFromSupabase())
      .subscribe();
  }

  async function authenticateWithSupabase(email, pass) {
    const errEl = document.getElementById('authError');
    const btn = document.getElementById('loginSubmitBtn');
    errEl.hidden = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in to Supabase...'; }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: pass,
      });
      if (error || !data.user) {
        errEl.textContent = error?.message || 'Invalid Login ID or Password. Check your assigned Carrybee credentials or contact Admin.';
        errEl.hidden = false;
        return;
      }
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      if (profErr || !prof) {
        errEl.textContent = 'Profile record missing in Supabase. Contact an InboundIQ Admin.';
        errEl.hidden = false;
        await supabase.auth.signOut();
        return;
      }
      if (!prof.is_active) {
        await supabase.auth.signOut();
        errEl.textContent = `Account "${prof.username}" is currently deactivated. Contact an InboundIQ Admin to reactivate.`;
        errEl.hidden = false;
        return;
      }
      const uiRole = ROLE_TO_UI[prof.role] || 'agent';
      const userObj = {
        id: prof.id,
        email: prof.email,
        username: prof.username,
        password: pass,
        role: uiRole,
        team: prof.team_id || 'Inbound Desk A',
        active: Boolean(prof.is_active),
      };
      await hydrateFromSupabase();
      startRealtimeSubscriptions();
      signInUser(userObj);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In to Carrybee InboundIQ'; }
    }
  }

  async function signOutUser() {
    stopCallTimer();
    CURRENT_USER = null;
    try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch (e) {}
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    await supabase.auth.signOut().catch(() => {});
    document.getElementById('appShell').hidden = true;
    document.getElementById('authScreen').hidden = false;
    document.getElementById('loginPassword').value = '';
    document.getElementById('authError').hidden = true;
    renderQuickRoster();
    showToast('Signed out of Carrybee InboundIQ.');
  }

  document.getElementById('toggleLoginPass').addEventListener('click', () => {
    const inp = document.getElementById('loginPassword');
    const btn = document.getElementById('toggleLoginPass');
    const showing = inp.type === 'text';
    inp.type = showing ? 'password' : 'text';
    btn.textContent = showing ? 'Show' : 'Hide';
  });

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const pass = document.getElementById('loginPassword').value;
    await authenticateWithSupabase(email, pass);
  });

  document.getElementById('signOutBtn').addEventListener('click', signOutUser);

  function startCallTimer() {
    if (STATE.call.startedAt) return;
    STATE.call.startedAt = nowDyn();
    const startMs = Date.now();
    clearInterval(timerH);
    timerH = setInterval(() => {
      if (!STATE.call.startedAt) return;
      STATE.call.secs = Math.floor((Date.now() - startMs) / 1000);
      const el = document.getElementById('callTimer');
      if (el) el.textContent = mmss(STATE.call.secs);
    }, 1000);
  }

  function stopCallTimer() { clearInterval(timerH); timerH = null; }

  /* ========================================================================
     HEADER & ROLE SWITCHING (ADMIN-ONLY MULTI-VIEW INSPECTOR)
     ======================================================================== */
  document.getElementById('roleSwitcher').addEventListener('click', e => {
    const b = e.target.closest('button[data-role]');
    if (!b) return;
    if (CURRENT_USER && CURRENT_USER.role !== 'admin') {
      showToast('Access restricted: only Admin can switch between role workspaces.');
      return;
    }
    STATE.role = b.dataset.role;
    STATE.tab = ROLES[STATE.role].tabs[0].id;
    document.querySelectorAll('#roleSwitcher button').forEach(x => x.classList.toggle('active', x.dataset.role === STATE.role));
    render();
    window.scrollTo(0, 0);
  });

  document.getElementById('friBtn').addEventListener('click', () => {
    STATE.fridayBuffer = !STATE.fridayBuffer;
    const b = document.getElementById('friBtn');
    b.classList.toggle('on', STATE.fridayBuffer);
    document.getElementById('friBtnLbl').textContent = `Fri +2h SLA: ${STATE.fridayBuffer ? 'ON (+2h)' : 'Off'}`;
    showToast(STATE.fridayBuffer ? 'Friday +2h SLA buffer enabled for KAM & Accounts.' : 'Standard weekday SLA active.');
    render();
  });

  document.getElementById('themeSwitcher').addEventListener('click', e => {
    const btn = e.target.closest('button[data-theme-set]');
    if (!btn) return;
    STATE.theme = btn.dataset.themeSet;
    document.documentElement.setAttribute('data-theme', STATE.theme);
    document.querySelectorAll('#themeSwitcher button').forEach(x => x.classList.toggle('active', x.dataset.themeSet === STATE.theme));
    if (STATE.tab === 'mgmt_team') renderMgmtTeam();
  });

  setInterval(() => {
    const cl = document.getElementById('liveClock');
    if (cl) cl.textContent = fmtTimeAMPM(nowDyn());
  }, 1000);

  function renderSubNav() {
    const roleDef = ROLES[STATE.role];
    const openN = ISSUES.filter(t => t.status !== 'Closed').length;
    const cbN = pendingCallbacks().length;
    const notTickN = CALL_LOGS.filter(l => !l.ticketId).length;
    const remN = canActAsSupervisor(STATE.role)
      ? notTickN
      : ISSUES.filter(t => t.status !== 'Closed' && (t.reminderAt || t.awaitingConfirm)).length + cbN;

    const tabsEl = document.getElementById('subTabs');
    tabsEl.innerHTML = roleDef.tabs.map(t => {
      let badge = '';
      if (t.badge === 'follow') badge = `<span class="nbadge">${openN + cbN}</span>`;
      else if (t.badge === 'open') badge = `<span class="nbadge">${openN}</span>`;
      else if (t.badge === 'logs') badge = `<span class="nbadge calm">${CALL_LOGS.length} · ${notTickN} log-only</span>`;
      else if (t.badge === 'rem') badge = `<span class="nbadge calm">${remN}</span>`;
      return `<button data-subtab="${t.id}" class="${STATE.tab === t.id ? 'active' : ''}">${ic(t.icon)} ${t.label}${badge}</button>`;
    }).join('');

    tabsEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      STATE.tab = b.dataset.subtab;
      if (STATE.tab === 'stream' && canActAsSupervisor(STATE.role)) STATE.streamFilter = 'log_only';
      else if (STATE.tab === 'stream' && STATE.role === 'agent' && STATE.streamFilter === 'log_only') STATE.streamFilter = 'all';
      render();
      window.scrollTo(0, 0);
    }));

    document.getElementById('roleContext').innerHTML = `
      <span class="pill acc">${ic('lock', 'sm')} ${esc(roleDef.scope)}</span>
    `;
  }

  function render() {
    document.getElementById('liveClock').textContent = fmtTimeAMPM(nowDyn());
    renderSubNav();
    if (STATE.tab === 'desk') renderCallDesk();
    else if (STATE.tab === 'followups') renderFollowUpBoard();
    else if (STATE.tab === 'calllogs') renderCallLogs();
    else if (STATE.tab === 'stream') renderActivityStream();
    else if (STATE.tab === 'sup_floor') renderSupervisorFloor();
    else if (STATE.tab === 'mgmt_bi') renderMgmtBI();
    else if (STATE.tab === 'mgmt_health') renderMgmtHealth();
    else if (STATE.tab === 'mgmt_team') renderMgmtTeam();
    else if (STATE.tab === 'admin_kam') renderAdminKAM();
    else if (STATE.tab === 'admin_sheets') renderAdminSheets();
    else if (STATE.tab === 'admin_rules') renderAdminRules();
  }

  /* ========================================================================
     AGENT VIEW 1: MANUAL IP PHONE CALL DESK (COMBO OF v1 + v2 + v3)
     ======================================================================== */
  function lookupPhone(rawPhone) {
    const digits = rawPhone.replace(/\D/g, '');
    const c = STATE.call;
    c.phone = rawPhone;
    c.merchant = null;
    c.merchantInKamMaster = false;
    c.knownPerson = null;
    if (digits.length >= 10) {
      startCallTimer();
      const kamMatch = KAM_DIRECTORY.find(x => x.phone.replace(/\D/g, '') === digits);
      const fbMatch = BUSINESS_FALLBACK.find(x => x.phone.replace(/\D/g, '') === digits);
      const p = KNOWN_PEOPLE[digits];
      if (kamMatch) {
        c.merchant = kamMatch;
        c.merchantInKamMaster = true;
        // Edge Case E-04: completed_trips > 0 => Existing Merchant, 0 => New Merchant
        c.callerType = kamMatch.completedTrips > 0 ? 'Existing Merchant' : 'New Merchant';
      } else if (fbMatch) {
        c.merchant = Object.assign({}, fbMatch, { kamName: 'Complaint Management', team: 'Fallback (Not in KAM Master)' });
        c.merchantInKamMaster = false;
        c.callerType = fbMatch.completedTrips > 0 ? 'Existing Merchant' : 'New Merchant';
      } else if (p) {
        c.knownPerson = p;
        c.callerType = p.role;
        if (p.daId && !c.daId) c.daId = p.daId;
      } else if (!c.callerType) {
        c.callerType = 'Potential Merchant';
      }
    }
  }

  function isConsignmentId(value) {
    return /^(?:CB[0-9]{6,12}|[FER][A-Z0-9]{10})$/.test(String(value || '').trim().toUpperCase());
  }

  function pullHiveParcel() {
    const c = STATE.call;
    const requestedId = (c.consignment || '').trim().toUpperCase();
    if (!isConsignmentId(requestedId)) {
      showToast('Enter a valid consignment ID first.');
      return;
    }
    c.parcelLoading = true;
    renderCallDesk(true);
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', receive);
      if (STATE.call.consignment === requestedId) {
        STATE.call.parcelLoading = false;
        renderCallDesk(true);
        showToast('No extension response. Install/enable the InboundIQ browser extension, then capture the order in Hive.');
      }
    }, 2500);
    function receive(event) {
      if (event.source !== window || event.data?.source !== 'inboundiq-extension' || event.data?.type !== 'HIVE_PARCEL_RESULT' || event.data?.requestId !== requestId) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', receive);
      if (STATE.call.consignment !== requestedId) return;
      const snapshot = event.data.payload;
      STATE.call.parcelLoading = false;
      if (!snapshot || snapshot.consignment_id?.toUpperCase() !== requestedId) {
        renderCallDesk(true);
        showToast(snapshot ? `Hive has ${snapshot.consignment_id}, not ${requestedId}. Capture the matching order first.` : 'No Hive order saved in this browser yet.');
        return;
      }
      const amount = Number(String(snapshot.parcel_amount || '').replace(/[^\d.]/g, '')) || 0;
      const currentHub = snapshot.current_hub || '';
      const zone = /chatt?ogram|ctg/i.test(currentHub) ? 'CTG' : /bogura|sylhet/i.test(currentHub) ? 'OSD' : 'ISD';
      STATE.call.parcel = {
        id: requestedId,
        created_ago: snapshot.created_ago || '',
        created_at: snapshot.created_at || '',
        business_name: snapshot.business_name || '',
        business_id: snapshot.business_id || '',
        business_owner_number: snapshot.business_owner_number || '',
        customer_name: snapshot.customer_name || '',
        customer_number: snapshot.customer_number || '',
        customer_address: snapshot.customer_address || '',
        delivery_attempt_count: snapshot.delivery_attempt_count || '',
        current_parcel_status: snapshot.current_parcel_status || '',
        pickup_hub: snapshot.pickup_hub || '',
        current_hub: currentHub,
        lmh_hub: snapshot.lmh_hub || '',
        parcel_amount: snapshot.parcel_amount || '',
        cod_amount: snapshot.cod_amount || '',
        // Internal aliases derive from the approved fields only for existing CRM routing.
        status: snapshot.current_parcel_status || 'Status not shown',
        hub: currentHub || 'Not shown',
        zone,
        merchant: snapshot.business_name || '',
        cod: amount,
        dest: snapshot.customer_address || ''
      };
      if (!c.trkEdited.hub && currentHub) c.trkHub = currentHub;
      if (!c.trkEdited.zone) c.trkZone = zone;
      renderCallDesk(true);
      showToast(`Pulled ${requestedId} from Hive order captured in this browser.`);
    }
    window.addEventListener('message', receive);
    window.postMessage({ source: 'inboundiq-crm', type: 'GET_HIVE_PARCEL', requestId }, location.origin);
  }

  function triggerParcelLookup(rawId) {
    const clean = rawId.trim().toUpperCase();
    const c = STATE.call;
    c.consignment = clean;
    c.parcel = null;
    if (!isConsignmentId(clean)) { c.parcelLoading = false; renderCallDesk(true); return; }
    c.parcelLoading = true;
    renderCallDesk(true);
    setTimeout(() => {
      if (STATE.call.consignment !== clean) return;
      c.parcelLoading = false;
      if (PARCEL_MASTER[clean]) {
        c.parcel = JSON.parse(JSON.stringify(PARCEL_MASTER[clean]));
        if (!c.trkEdited.hub) c.trkHub = c.parcel.hub;
        if (!c.trkEdited.zone) c.trkZone = c.parcel.zone;
        renderCallDesk(true);
        showToast(`Loaded demo parcel ${clean}. Use Pull from Hive for live order details.`);
      } else {
        c.parcel = null;
        renderCallDesk(true);
        showToast(`No demo data for ${clean}. Capture this order in Hive, then choose Pull from Hive.`);
      }
    }, 340);
  }

  function selectedReason() { return TAXONOMY.find(r => r.id === STATE.call.reasonId) || null; }

  function effectiveGlobalPair(c, r) {
    const gCat = c.trkGCat || (r && r.gCat) || 'Execution Request';
    const subs = (GLOBAL_CATALOG[gCat] || []).map(x => x.sub);
    let gSub = c.trkGSub;
    if (!gSub || !subs.includes(gSub)) {
      gSub = (r && r.gCat === gCat && r.gSubs && r.gSubs[0]) ? r.gSubs[0] : (subs[0] || '');
    }
    const meta = getGlobalSubMeta(gCat, gSub);
    return { gCat, gSub, issueType: meta.type || (r && r.callType === 'Request' ? 'Urgent' : 'Regular'), slaByZone: meta.sla || { ISD: 2, OSD: 3, CTG: 3 } };
  }

  function computeRouting() {
    const c = STATE.call;
    if (c.outcome === 'dropped') return { track: 'LOG', owner: 'Call Log (Dropped)', color: 'var(--live)', due: null, slaText: 'Log Only', why: 'Fast-saved to Call Log without blocking agent.' + (c.autoQueueDropCb ? ' Auto-queues +15m callback!' : '') };
    if (c.outcome === 'callback') return { track: 'LOG', owner: 'Callback Follow-Up Queue', color: 'var(--warn)', due: null, slaText: 'Callback Queue', why: 'Logs callback request with preferred AM/PM time and adds directly to Callback Queue.' };
    if (c.outcome === 'no_answer') return { track: 'LOG', owner: 'Call Log (No Answer)', color: 'var(--ink-3)', due: null, slaText: 'Log Only', why: '1-click log of unanswered attempt. Ready immediately for next call.' };
    if (c.callType === 'None') return { track: 'NONE', owner: 'Log Only — No Ticket (Call Type: None)', color: 'var(--ink-3)', due: null, slaText: 'None', why: 'Call Type = None (Silent / Dropped / Wrong Vertical E-13). Saved strictly as Log-Only with zero tickets.' };

    const r = selectedReason();
    if (!r) return null;

    // E-14 Manual Routing Override
    if (c.overrideEnabled && c.overrideOwner) {
      const isGlob = c.overrideOwner === 'Global Ops (Track A)';
      const z = c.trkZone || (c.parcel ? c.parcel.zone : 'ISD');
      const gp = effectiveGlobalPair(c, r);
      const due = isGlob ? new Date(nowDyn().getTime() + (gp.slaByZone[z] || 2) * 86400000) : sameDay6PM(nowDyn());
      return {
        track: isGlob ? 'A' : 'B',
        owner: c.overrideOwner + ' (E-14 Override)',
        rawOwner: c.overrideOwner,
        color: teamColor(c.overrideOwner),
        due,
        slaText: isGlob ? `${gp.slaByZone[z]}d ${z} Global SLA` : (TEAMS.find(t => t.key === c.overrideOwner) || {}).slaDesc || 'Same-day 6:00 PM',
        why: `E-14 Manual Override active (logged to QA audit): redirected from default ${r.owner} → ${c.overrideOwner}.`
      };
    }

    const z = c.trkZone || (c.parcel ? c.parcel.zone : 'ISD');
    const gp = effectiveGlobalPair(c, r);
    const due = computeDueDateForReason(r, nowDyn(), z, gp.gCat, gp.gSub);

    if (r.edge === 'E-09') {
      return {
        track: c.robberyDualPush ? 'DUAL' : 'B',
        owner: c.robberyDualPush ? 'Supply & Safety + Global Ops (MX)' : 'Supply & Safety',
        rawOwner: 'Supply & Safety',
        color: 'var(--t-sup)',
        due,
        slaText: 'Immediate (G-09 Safety)',
        why: c.robberyDualPush ? 'E-09 Dual-Push: writes simultaneously to Supply & Safety Sheet (G-09 Urgent) AND Global Ops (MX · Lost › Hijacking/Robbery).' : 'Non-robbery safety incident routes strictly to Supply & Safety Sheet (G-09 Urgent · Immediate).'
      };
    }
    if (r.track === 'NONE') {
      return {
        track: 'NONE', owner: r.owner, rawOwner: r.owner, color: 'var(--good)', due: null, slaText: 'Log Only',
        why: r.edge === 'E-08'
          ? 'E-08 Guard (G-13): Wrong/defective product inside sealed box is a merchant-side issue. Redirect customer to merchant; logged for Analytics — zero Ops push.'
          : 'Resolved directly on call (FCR). Saved as Non-Ticketed Call Log for engagement & FCR analytics.'
      };
    }
    if (r.track === 'A') {
      const days = gp.slaByZone[z] || 2;
      return {
        track: 'A', owner: 'Global Ops (Track A · MX)', rawOwner: 'Global Ops (Track A)', color: 'var(--t-global)', due,
        slaText: `${days}d ${z} Global SLA`,
        why: `Pushes verbatim to Global Tracker (channel="MX") as [${gp.gCat} › ${gp.gSub}] (${gp.issueType}) with 3-Layer Ops read-through & W-1/W-2 OSD guard.`
      };
    }
    const kamSuffix = r.owner === 'Business Team (KAM)' && c.merchant ? ` · ${c.merchant.kamName}` : '';
    let slaText = (TEAMS.find(t => t.key === r.owner) || {}).slaDesc || 'Same-day 6:00 PM';
    if (r.slaKind === 'hours') {
      const h = r.sla + (STATE.fridayBuffer && r.friBuf ? 2 : 0);
      slaText = h < 1 ? `${Math.round(h * 60)}m SLA` : (h % 1 ? `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m SLA` : `${h}h SLA`);
      if (STATE.fridayBuffer && r.friBuf) slaText += ' (+2h Fri)';
    }
    return {
      track: 'B', owner: r.owner + kamSuffix, rawOwner: r.owner, color: teamColor(r.owner), due, slaText,
      why: `Dual-writes to ${r.owner} Individual Google Sheet (Primary) + Master Stakeholder Fallback Hub (All_Issues_Fallback).`
    };
  }

  function computeCallbackDate(c) {
    if (c.cbPreset === 'custom' && c.cbCustomTime) {
      const [hh, mm] = c.cbCustomTime.split(':').map(Number);
      const n = nowDyn();
      const d = new Date(n.getFullYear(), n.getMonth(), n.getDate(), hh || 14, mm || 30, 0);
      return d < n ? new Date(d.getTime() + 86400000) : d;
    }
    if (c.cbPreset === 'tomorrow10') {
      const n = nowDyn();
      return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 10, 0, 0);
    }
    return minsAhead(Number(c.cbPreset) || 30);
  }

  function parcelDiscrepancyHint(p, note, r) {
    if (!p) return '';
    const hrs = (nowDyn() - new Date(p.lastScan)) / 3600000;
    if (p.status === 'Delivered' && /not receive|didn.?t|no otp|deny|pai ni/i.test((note || '') + ' ' + (r ? r.name : ''))) {
      return 'Discrepancy Alert: System shows Delivered, but caller reports non-receipt. Verify OTP & rider call log.';
    }
    if (!/Delivered/.test(p.status) && hrs > 36) {
      return `Stuck Parcel Alert: No scan for ${Math.round(hrs)}h at ${p.hub}. Priority escalation recommended.`;
    }
    return '';
  }

  /* ========================================================================
     GLOBAL TRACKER SUBMISSION PREVIEW MODAL (WHAT OPS SEES + RAW API JSON)
     ======================================================================== */
  function buildGlobalPayloadFromDraft() {
    const c = STATE.call;
    const r = selectedReason();
    const gp = effectiveGlobalPair(c, r);
    const hub = c.trkHub || (c.parcel ? c.parcel.hub : 'Uttara Hub');
    const zone = c.trkZone || (c.parcel ? c.parcel.zone : 'ISD');
    const due = computeDueDateForReason(r || { slaKind: 'global' }, nowDyn(), zone, gp.gCat, gp.gSub) || minsAhead(1440);
    const allCons = [c.consignment].concat(c.extraConsignments || []).filter(Boolean).join(', ');
    const merchName = c.merchant ? c.merchant.bizName : (c.parcel ? c.parcel.merchant : (c.knownPerson ? c.knownPerson.name : ''));
    const kamName = c.merchant ? c.merchant.kamName : 'Complaint Management';
    return {
      sourceLabel: r ? `${r.code} · ${r.name}` : 'Manual Track A Draft',
      isSubmitted: false,
      record: {
        issue_id: `CB-21-11-${String(430 + ISSUES.length).padStart(4, '0')} (assigned on submit)`,
        channel: 'MX',
        category: gp.gCat,
        sub_category: gp.gSub,
        issue_type: gp.issueType,
        priority_scale: c.prio,
        consignment_id: allCons || null,
        merchant_name: merchName || null,
        merchant_phone: c.phone.trim() || null,
        kam_name: kamName,
        concern_hub: hub,
        zone: zone,
        feedback_due_at: fmtStamp(due),
        feedback_due_iso: due.toISOString(),
        issue_details: (c.note || '').trim() || '(Agent summary pending)',
        requested_by: CURRENT_AGENT,
        override_e14: c.overrideEnabled ? c.overrideReason.trim() : null
      },
      opsTriage: {
        validation: 'Pending Ops Review',
        ops_category: 'Assigned internally by Ops (11 values)',
        cm_assigned: 'Auto-assigned by Zone Hub Lead',
        duplicate_of: null,
        layer1_response: 'Pending submission',
        layer2_response: '—',
        final_response: '—'
      }
    };
  }

  function buildGlobalPayloadFromTicket(t) {
    const due = t.dueAt ? new Date(t.dueAt) : new Date(t.createdAt.getTime() + effSlaHours(t) * 3600000);
    const allCons = [t.consignment].concat(t.extraConsignments || []).filter(Boolean).join(', ');
    const om = t.opsMeta || {};
    return {
      sourceLabel: `${t.reasonCode} · ${t.reasonName}`,
      isSubmitted: true,
      record: {
        issue_id: t.globalId || 'CB-21-11-XXXX',
        channel: 'MX',
        category: t.gCat || 'Delivery Delay',
        sub_category: t.gSub || 'Processing Delay',
        issue_type: t.gIssueType || 'Regular',
        priority_scale: t.prio,
        consignment_id: allCons || null,
        merchant_name: t.callerName,
        merchant_phone: t.phone,
        kam_name: t.kam || 'Complaint Management',
        concern_hub: t.hub,
        zone: t.zone,
        feedback_due_at: fmtStamp(due),
        feedback_due_iso: due.toISOString(),
        issue_details: t.summary,
        requested_by: CURRENT_AGENT,
        override_e14: t.overrideReason || null
      },
      opsTriage: {
        validation: om.validation || 'Valid',
        ops_category: om.opsCategory || 'Hub Processing Backlog',
        cm_assigned: om.cmAssigned || 'CM-Zone Lead',
        duplicate_of: om.duplicateOf || null,
        layer1_response: t.opsLayers && t.opsLayers[0] ? t.opsLayers[0].text : 'Queued',
        layer2_response: t.opsLayers && t.opsLayers[1] ? t.opsLayers[1].text : 'Pending',
        final_response: om.finalResponse || (t.opsLayers && t.opsLayers[2] && t.opsLayers[2].at ? t.opsLayers[2].text : 'Pending Layer 3')
      }
    };
  }

  function openGlobalPreview(mode, ticketObj) {
    STATE.globalPreviewModal = {
      mode,
      tab: 'record',
      payload: mode === 'ticket' ? buildGlobalPayloadFromTicket(ticketObj) : buildGlobalPayloadFromDraft()
    };
    renderGlobalPreviewModal();
  }

  function closeGlobalPreview() {
    STATE.globalPreviewModal = null;
    document.getElementById('modalRoot').innerHTML = '';
  }

  function renderGlobalPreviewModal() {
    const root = document.getElementById('modalRoot');
    const m = STATE.globalPreviewModal;
    if (!m) { root.innerHTML = ''; return; }
    const p = m.payload;
    const r = p.record;
    const o = p.opsTriage;

    const apiJson = {
      endpoint: 'POST /api/escalations (Global Supabase kssypfibhlmoxucabhdu)',
      channel: r.channel,
      category: r.category,
      sub_category: r.sub_category,
      issue_type: r.issue_type,
      priority_scale: r.priority_scale,
      consignment_id: r.consignment_id,
      merchant_name: r.merchant_name,
      merchant_phone: r.merchant_phone,
      kam_name: r.kam_name,
      concern_hub: r.concern_hub,
      zone: r.zone,
      feedback_due_at: r.feedback_due_iso,
      issue_details: r.issue_details,
      requested_by: r.requested_by,
      meta: {
        inbound_crm_reason: p.sourceLabel,
        w4_issue_type_guard: 'VERIFIED_NON_NULL',
        w1_osd_overflow_protection: 'DIRECT_SUPABASE_MX'
      }
    };

    root.innerHTML = `
      <div class="modal-backdrop" id="gPrevBackdrop">
        <div class="modal-box" role="dialog" aria-modal="true" aria-label="Global Issue Tracker Submission Preview">
          <div class="modal-head">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <b style="font-size:15.5px">${ic('globe', 'lg')} Global Issue Tracker — ${p.isSubmitted ? 'Submitted Record' : 'Live Pre-Submission Preview'}</b>
                <span class="pill acc mono">channel = 'MX'</span>
                <span class="pill ${r.issue_type === 'Urgent' ? 'bad' : r.issue_type === 'Critical' ? 'warn' : 'mute'}">${esc(r.issue_type)}</span>
              </div>
              <div class="muted" style="font-size:12px;margin-top:2px">Exact verbatim fields Operations sees in CarryBee Global Issue Tracker (zero schema mismatch).</div>
            </div>
            <button type="button" class="btn sm" id="closeGPrevBtn">${ic('x', 'sm')} Close</button>
          </div>
          <div class="modal-body">
            <div class="g-map-banner">
              <div>
                <div class="eyebrow" style="color:var(--accent)">Inbound CC → Global Tracker Translation</div>
                <div style="margin-top:2px"><b>${esc(p.sourceLabel)}</b>  ${ic('arrow', 'sm')}  Global Category: <span class="pill acc">${esc(r.category)}</span> &nbsp;›&nbsp; Global Sub-Category: <span class="pill purple">${esc(r.sub_category)}</span></div>
              </div>
              <span style="flex:1"></span>
              <div class="seg-ctl" id="gPrevTabCtl">
                <button type="button" data-gtab="record" class="${m.tab === 'record' ? 'on' : ''}" style="min-height:30px;font-size:12px">${ic('table', 'sm')} What Ops Sees</button>
                <button type="button" data-gtab="json" class="${m.tab === 'json' ? 'on' : ''}" style="min-height:30px;font-size:12px">{ } API Payload</button>
              </div>
            </div>

            ${m.tab === 'record' ? `
              <div class="eyebrow" style="margin-bottom:8px">Requester Columns Written by Inbound CRM (public.escalations)</div>
              <div class="g-kv-grid">
                <div class="g-kv-cell"><span>Global Issue ID</span><b class="mono">${esc(r.issue_id)}</b></div>
                <div class="g-kv-cell"><span>Channel &amp; Priority</span><b>${esc(r.channel)} · ${esc(r.priority_scale)} (${esc(r.issue_type)})</b></div>
                <div class="g-kv-cell" style="border-color:var(--accent-border);background:var(--accent-soft)"><span>Global Issue Category (Verbatim)</span><b style="color:var(--accent)">${esc(r.category)}</b></div>
                <div class="g-kv-cell" style="border-color:var(--accent-border);background:var(--accent-soft)"><span>Global Issue Sub-Category (Verbatim)</span><b style="color:var(--purple)">${esc(r.sub_category)}</b></div>
                <div class="g-kv-cell"><span>Consignment ID(s)</span><b class="mono">${esc(r.consignment_id || '— (Merchant-level issue)')}</b></div>
                <div class="g-kv-cell"><span>Merchant &amp; Assigned KAM</span><b>${esc(r.merchant_name || '—')} · <span style="color:var(--purple)">${esc(r.kam_name)}</span></b></div>
                <div class="g-kv-cell"><span>Concern Hub &amp; Zone</span><b>${esc(r.concern_hub)} (${esc(r.zone)})</b></div>
                <div class="g-kv-cell"><span>Global Feedback Due (12h AM/PM)</span><b>${esc(r.feedback_due_at)}</b></div>
              </div>
              <div class="g-kv-cell" style="margin-bottom:14px">
                <span>Issue Details Sent to Operations</span>
                <b style="font-weight:500">${esc(r.issue_details)}</b>
              </div>
              ${r.override_e14 ? `<div class="edge-box" style="margin-bottom:14px"><b>E-14 Override Audit Reason:</b> ${esc(r.override_e14)}</div>` : ''}

              <div class="eyebrow" style="margin-bottom:8px">Operations-Owned Columns (Read Back Every 60s via Direct Supabase Read-Through)</div>
              <div class="g-kv-grid">
                <div class="g-kv-cell"><span>Ops Validation</span><b>${esc(o.validation)}</b></div>
                <div class="g-kv-cell"><span>Ops Internal Category (11 values)</span><b>${esc(o.ops_category)}</b></div>
                <div class="g-kv-cell"><span>CM Assigned</span><b>${esc(o.cm_assigned)}</b></div>
                <div class="g-kv-cell"><span>Duplicate Of</span><b class="mono">${esc(o.duplicate_of || 'None')}</b></div>
              </div>
              <div class="g-kv-cell">
                <span>Latest Layer / Final Response</span>
                <b style="font-weight:500">${esc(o.final_response && o.final_response !== '—' && o.final_response !== 'Pending Layer 3' ? o.final_response : o.layer2_response !== '—' ? o.layer2_response : o.layer1_response)}</b>
              </div>
            ` : `
              <div class="eyebrow" style="margin-bottom:8px">Exact HTTP JSON Sent to Global Issue Tracker (W-4 Non-Null issue_type Guard Verified)</div>
              <pre class="json-pre">${esc(JSON.stringify(apiJson, null, 2))}</pre>
            `}
          </div>
        </div>
      </div>
    `;

    document.getElementById('closeGPrevBtn').addEventListener('click', closeGlobalPreview);
    document.getElementById('gPrevBackdrop').addEventListener('click', e => { if (e.target.id === 'gPrevBackdrop') closeGlobalPreview(); });
    document.querySelectorAll('#gPrevTabCtl button').forEach(b => b.addEventListener('click', () => {
      STATE.globalPreviewModal.tab = b.dataset.gtab;
      renderGlobalPreviewModal();
    }));
  }

  function renderCallDesk(preserveFocus) {
    const activeId = preserveFocus && document.activeElement ? document.activeElement.id : null;
    const selStart = preserveFocus && document.activeElement && typeof document.activeElement.selectionStart === 'number' ? document.activeElement.selectionStart : null;

    const c = STATE.call;
    const digits = c.phone.replace(/\D/g, '');
    const callerTickets = digits.length >= 10 ? ISSUES.filter(t => t.phone.replace(/\D/g, '') === digits) : [];
    const callerCalls = digits.length >= 10 ? CALL_LOGS.filter(l => l.phone.replace(/\D/g, '') === digits).slice(0, 3) : [];
    const r = selectedReason();
    const rt = computeRouting();
    const isFast = c.outcome === 'dropped' || c.outcome === 'callback' || c.outcome === 'no_answer' || c.callType === 'None';
    const quickReasons = TAXONOMY.filter(x => (!c.callerType || x.users.includes(c.callerType)) && (!c.callType || x.callType === c.callType)).slice(0, 6);
    const pHint = parcelDiscrepancyHint(c.parcel, c.note, r);
    const gp = r ? effectiveGlobalPair(c, r) : null;

    // PRD v3.2 Validation Guards:
    // - 1-click fast save for Dropped / Callback / No Answer / Call Type = None
    // - For Ticketed (Track A / B / DUAL): >=30 chars AND not digits-only; Track A also requires chk_consignment_or_merchant
    // - E-10 (M#42): requires DA ID & Disputed Amount
    // - E-14 Override: requires >=15 char override_reason
    const noteClean = (c.note || '').trim();
    const isTicketed = rt && (rt.track === 'A' || rt.track === 'B' || rt.track === 'DUAL');
    const minNoteLen = isTicketed ? 30 : 15;
    const digitsOnlyNote = noteClean.length > 0 && /^\d+$/.test(noteClean.replace(/\s+/g, ''));

    const needs = [];
    if (digits.length < 10) needs.push('caller phone');
    if (!isFast) {
      if (!c.callerType) needs.push('caller type');
      if (!r) needs.push('contact reason');
      if (r && r.parcelReq && !c.consignment && !c.overrideEnabled) needs.push('consignment ID');
      if (rt && (rt.track === 'A' || rt.track === 'DUAL') && !c.consignment && !c.merchant && !(c.parcel && c.parcel.merchant)) {
        needs.push('consignment ID or merchant (chk_consignment_or_merchant)');
      }
      if (r && r.edge === 'E-10' && (!c.daId.trim() || !c.disputedAmount.trim())) {
        needs.push('DA ID & Disputed Amount (E-10)');
      }
      if (c.overrideEnabled && (c.overrideReason || '').trim().length < 15) {
        needs.push('E-14 override reason (15+ chars)');
      }
      if (noteClean.length < minNoteLen) needs.push(`context (${minNoteLen}+ chars)`);
      else if (digitsOnlyNote) needs.push('non-digits context');
    }

    const cbs = pendingCallbacks();

    document.getElementById('app').innerHTML = `
      ${STATE.lastSaved ? `
        <div class="saved-banner">
          <span>${ic('check-circle')} <b>Saved at ${fmtTimeAMPM(nowDyn())}:</b> ${esc(STATE.lastSaved.msg)}</span>
          <span style="flex:1"></span>
          ${STATE.lastSaved.issueId ? `<button class="btn sm pri" id="openSavedBtn">Open Timeline (${esc(STATE.lastSaved.issueId)})</button>` : `<button class="btn sm soft" id="openLogBtn">View in Call Logs</button>`}
          <button class="btn sm" id="dismissSavedBtn">Dismiss</button>
        </div>` : ''}

      <!-- Manual IP Phone Call-Tracking Bar (Zero Direct Phone/IVR Integration) -->
      <div class="ip-callbar">
        <div class="dir-toggle" id="dirToggle">
          <button type="button" data-dir="Incoming" class="${c.direction === 'Incoming' ? 'on-in' : ''}">${ic('phone-in', 'sm')} Incoming</button>
          <button type="button" data-dir="Outgoing" class="${c.direction === 'Outgoing' ? 'on-out' : ''}">${ic('phone-out', 'sm')} Outgoing</button>
        </div>

        <div class="live-ind ${c.startedAt ? 'on' : ''}">
          <span class="live-dot"></span>
          <div>
            <div class="timer" id="callTimer">${mmss(c.secs)}</div>
            <small>${c.startedAt ? `Started ${fmtTimeAMPM(c.startedAt)}` : 'Auto-starts on number entry'}</small>
          </div>
        </div>

        <input type="tel" class="phone-input" id="phoneInput" value="${esc(c.phone)}" placeholder="Enter IP Phone #" autocomplete="off">
        ${!c.startedAt ? `<button type="button" class="btn live sm" id="manualStartBtn">▶ Start Timer</button>` : ''}

        <div class="preset-row">
          <span>Test Caller:</span>
          <button type="button" class="pchip" data-preset="01711223344">KAM Merchant</button>
          <button type="button" class="pchip" data-preset="01722889900">Non-KAM (Fallback)</button>
          <button type="button" class="pchip" data-preset="01915667788">New Merchant (0 trips)</button>
          <button type="button" class="pchip" data-preset="01614778899">Churn / Reopened</button>
          <button type="button" class="pchip" data-preset="01311998877">Customer</button>
          <button type="button" class="pchip" data-preset="01555112233">Delivery Agent</button>
        </div>
      </div>

      ${cbs.length ? `
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 14px;background:var(--warn-soft);border:1px solid var(--warn-border);border-radius:10px;margin-bottom:14px;font-size:12.5px">
          <b style="color:var(--warn)">${ic('calendar')} ${cbs.length} Pending Callback${cbs.length === 1 ? '' : 's'} in Queue:</b>
          ${cbs.slice(0, 3).map(cb => `
            <button type="button" class="btn xs" data-start-cb="${cb.id}">
              ${ic('phone-out', 'sm')} Call ${esc(cb.callerName)} (${cb.callbackAt <= nowDyn() ? 'OVERDUE ' : ''}${fmtTimeAMPM(cb.callbackAt)})
            </button>
          `).join('')}
        </div>
      ` : ''}

      <div class="live-grid">
        <!-- LEFT: Strict 5-Col Merchant KAM Master Lookup + E-04 completed_trips + 7-Day Repeat Guard -->
        <aside class="panel sticky">
          <div class="panel-pad">
            <div class="eyebrow" style="margin-bottom:10px">Caller &amp; 5-Col KAM Master Lookup</div>
            ${c.merchant ? `
              <div class="caller-head">
                <div class="avatar ${c.merchantInKamMaster ? 'kam' : ''}">${esc(c.merchant.bizName[0])}</div>
                <div>
                  <b>${esc(c.merchant.bizName)}</b>
                  <span>${esc(c.merchant.bizId)} · ${esc(c.merchant.area)}</span>
                </div>
              </div>
              <dl class="kv-list">
                <dt>Reg Phone</dt><dd class="mono">${esc(c.merchant.phone)}</dd>
                <dt>KAM Master</dt><dd><span class="pill ${c.merchantInKamMaster ? 'purple' : 'mute'}">${c.merchantInKamMaster ? 'KAM Tier' : 'Fallback (Not in Sheet)'}</span></dd>
                <dt>Assigned KAM</dt><dd><b>${esc(c.merchant.kamName)}</b></dd>
                <dt>Resp. Team</dt><dd>${esc(c.merchant.team)}</dd>
                <dt>Trips (E-04)</dt><dd><b>${c.merchant.completedTrips}</b> → <span class="pill ${c.merchant.completedTrips > 0 ? 'acc' : 'warn'}">${c.merchant.completedTrips > 0 ? 'Existing Merchant' : 'New Merchant'}</span></dd>
                <dt>Health</dt><dd><span class="pill ${c.merchant.health === 'Churn Risk' ? 'bad' : c.merchant.health === 'Watch' ? 'warn' : 'good'}">${esc(c.merchant.health)}</span></dd>
              </dl>
            ` : c.knownPerson ? `
              <div class="caller-head">
                <div class="avatar">${esc(c.knownPerson.name[0])}</div>
                <div><b>${esc(c.knownPerson.name)}</b><span>${esc(c.knownPerson.role)} · ${esc(c.knownPerson.hub)}</span></div>
              </div>
            ` : digits.length >= 10 ? `
              <div class="caller-head">
                <div class="avatar warn">?</div>
                <div><b>Unregistered Number</b><span class="mono">${esc(c.phone)}</span></div>
              </div>
              <p class="muted" style="font-size:12px;margin:8px 0 0">Not in KAM Master or business_master → fallback <b>Complaint Management</b>. Select caller type to log (never blocks).</p>
            ` : `
              <p class="muted" style="font-size:13px;margin:0">Enter a phone number from your IP phone to auto-record the start time, check the strict 5-col Merchant KAM Master (vs Complaint Management fallback), and view 7-day open issues.</p>
            `}

            <div class="sub-sec">
              <div class="eyebrow">7-Day Repeat Guard (E-11)</div>
              ${callerTickets.filter(t => t.status !== 'Closed').length ? callerTickets.filter(t => t.status !== 'Closed').map(t => `
                <div class="mini-ticket repeat-hit">
                  <div class="mini-ticket-top"><b class="mono">${esc(t.id)}</b><span class="pill ${slaStatus(t).pill}">${esc(t.status)}</span></div>
                  <div style="font-weight:600">${esc(t.reasonName)}</div>
                  <div class="muted" style="font-size:11.5px">${esc(t.owner)} · ${fmtStamp(t.createdAt)}</div>
                  <div style="display:flex;gap:6px;margin-top:4px">
                    <button type="button" class="btn xs warn-btn" data-chase-existing="${t.id}">${ic('zap', 'sm')} Link &amp; Chase (E-11)</button>
                    <button type="button" class="btn xs" data-view-existing="${t.id}">Timeline</button>
                  </div>
                </div>
              `).join('') : '<p class="muted" style="font-size:12px;margin:6px 0 0">No active tickets in the last 7 days.</p>'}
            </div>

            ${callerCalls.length ? `
              <div class="sub-sec">
                <div class="eyebrow">Recent Call History</div>
                ${callerCalls.map(l => `
                  <div class="mini-ticket">
                    <div class="mini-ticket-top">
                      <span class="pill ${outcomeMeta(l.outcome).pill}">${esc(outcomeMeta(l.outcome).short)}</span>
                      <span class="muted" style="font-size:11px">${fmtStamp(l.startedAt)}</span>
                    </div>
                    <div style="font-size:12px;color:var(--ink-2)">${esc(l.note.slice(0, 72))}${l.note.length > 72 ? '…' : ''}</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </aside>

        <!-- CENTER: Outcome-Driven 5-Click Taxonomy v4 Entry -->
        <section class="panel">
          <!-- Step 1: 5 Call Outcomes -->
          <div class="fsec">
            <div class="fsec-head">
              <span class="eyebrow">1 · Call Outcome</span>
              <span class="pill mute">${esc(c.direction)} · ${c.startedAt ? fmtTimeAMPM(c.startedAt) : 'Waiting'}</span>
            </div>
            <div class="outcome-grid">
              ${OUTCOMES.map(o => `
                <button type="button" class="outcome-btn ${c.outcome === o.id ? 'on-' + o.id.replace('_','') : ''}" data-outcome="${o.id}">
                  <b>${esc(o.label)}</b>
                  <small>${esc(o.sub)}</small>
                </button>
              `).join('')}
            </div>

            ${c.outcome === 'dropped' ? `
              <div class="fast-outcome-box dropped">
                <b style="color:var(--live)">${ic('phone-off')} Fast Save — Call Dropped After Answer</b>
                <p style="margin:4px 0 9px;font-size:12.5px;color:var(--ink-2)">Skip ticket fields, save immediately, and proceed straight to the next caller.</p>
                <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;cursor:pointer;margin-bottom:8px">
                  <input type="checkbox" id="autoDropCb" ${c.autoQueueDropCb ? 'checked' : ''} style="width:auto;min-height:0">
                  Auto-add to Callback Queue (+15m · ${fmtTimeAMPM(minsAhead(15))})
                </label>
                <input type="text" id="noteInput" value="${esc(c.note)}" placeholder="Optional 1-line note (e.g. Line dropped before consignment ID)">
              </div>
            ` : c.outcome === 'callback' ? `
              <div class="fast-outcome-box">
                <b style="color:var(--warn)">${ic('calendar')} Callback Requested — Auto-Adds to Follow-Up Queue</b>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">
                  ${[['30', '+30m (' + fmtTimeAMPM(minsAhead(30)) + ')'], ['60', '+1h (' + fmtTimeAMPM(minsAhead(60)) + ')'], ['120', '+2h (' + fmtTimeAMPM(minsAhead(120)) + ')'], ['tomorrow10', 'Tomorrow 10:00 AM'], ['custom', 'Custom Time']].map(([k, lbl]) => `
                    <button type="button" class="btn xs ${c.cbPreset === k ? 'pri' : ''}" data-cbpreset="${k}">${lbl}</button>
                  `).join('')}
                </div>
                ${c.cbPreset === 'custom' ? `<label class="field" style="max-width:200px;margin-bottom:8px"><span>Preferred Time</span><input type="time" id="cbCustomTime" value="${esc(c.cbCustomTime)}"></label>` : ''}
                <input type="text" id="noteInput" value="${esc(c.note)}" placeholder="Callback topic (e.g. Discuss weekly COD invoice #INV-8841)">
              </div>
            ` : c.outcome === 'no_answer' ? `
              <div class="fast-outcome-box noans">
                <b>${ic('phone-off')} Fast Save — No Answer / Unreachable</b>
                <p style="margin:4px 0 8px;font-size:12.5px;color:var(--ink-2)">Logs unanswered attempt with AM/PM timestamp (${fmtTimeAMPM(nowDyn())}) in 1 click.</p>
                <input type="text" id="noteInput" value="${esc(c.note)}" placeholder="Optional note (e.g. Switched off / no pickup after 5 rings)">
              </div>
            ` : ''}
          </div>

          ${!(c.outcome === 'dropped' || c.outcome === 'callback' || c.outcome === 'no_answer') ? `
            <!-- Step 2: Caller Type (5 Exact v4 Pills + E-02 Unverified) & Merchant Sentiment -->
            <div class="fsec">
              <div class="fsec-head">
                <span class="eyebrow">2 · Caller Type (Taxonomy v4) &amp; Sentiment</span>
                <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;color:var(--ink-2)">
                  <input type="checkbox" id="unverifiedChk" ${c.unverifiedType ? 'checked' : ''} style="width:auto;min-height:0">
                  User Type — Unverified (E-02)
                </label>
              </div>
              <div class="seg-ctl" style="margin-bottom:10px">
                ${['Existing Merchant','New Merchant','Potential Merchant','Customer','Delivery Agent'].map(ct => `
                  <button type="button" data-ct="${ct}" class="${c.callerType === ct ? 'on' : ''}">${ct}</button>
                `).join('')}
              </div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <span class="muted" style="font-size:12px">Sentiment:</span>
                <div class="seg-ctl">
                  ${[['Positive','Positive'],['Neutral','Neutral'],['Concerned','Concerned'],['Dissatisfied','Dissatisfied']].map(([k, lbl]) => `
                    <button type="button" data-sent="${k}" class="${c.sentiment === k ? 'on' : ''}" style="min-height:30px;font-size:12px">${lbl}</button>
                  `).join('')}
                </div>
                <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:650;cursor:pointer;color:${c.threatChurn ? 'var(--bad)' : 'var(--ink-2)'};margin-left:auto">
                  <input type="checkbox" id="churnToggle" ${c.threatChurn ? 'checked' : ''} style="width:auto;min-height:0">
                  ${ic('alert', 'sm')} Threat to Churn (E-12)
                </label>
              </div>
            </div>

            <!-- Step 3: Exact 4 Call Types (Issue / Request / Inquiry / None) + Contact Reason + Cascading Theme & Action Taken -->
            <div class="fsec">
              <div class="fsec-head">
                <span class="eyebrow">3 · Call Type, Contact Reason, Theme &amp; Action Taken</span>
                <span class="muted" style="font-size:11.5px">Exact Taxonomy v4</span>
              </div>
              <div class="cols2" style="margin-bottom:10px">
                <label class="field">
                  <span>Call Type (4 Exact v4 Values) <span class="req">*</span></span>
                  <div class="seg-ctl">
                    ${['Issue','Request','Inquiry','None'].map(k => `
                      <button type="button" data-calltype="${k}" class="${c.callType === k ? 'on' : ''}" style="min-height:38px;padding:0 12px;font-size:12.5px">${k}</button>
                    `).join('')}
                  </div>
                </label>
                <label class="field">
                  <span>Full Taxonomy v4 Contact Reason <span class="req">*</span></span>
                  <select id="reasonSelect">
                    <option value="">Choose contact reason...</option>
                    ${TAXONOMY.map(x => `<option value="${x.id}" ${c.reasonId === x.id ? 'selected' : ''}>${esc(x.code)} — ${esc(x.name)} (${x.track === 'NONE' ? 'Log Only' : x.track === 'A' ? 'Global MX: ' + x.gCat : x.owner})</option>`).join('')}
                  </select>
                </label>
              </div>

              ${c.callType === 'None' ? `
                <div class="fast-outcome-box noans">
                  <b>${ic('volume-x')} Call Type = None (Edge Case E-13)</b>
                  <p style="margin:4px 0 8px;font-size:12.5px;color:var(--ink-2)">Silent call, wrong number, or wrong vertical (Food/Ride). Fast-saves as Non-Ticketed Log Only — zero Global or Sheet push.</p>
                  <input type="text" id="noteInput" value="${esc(c.note)}" placeholder="Optional 1-line note (e.g. Wrong vertical — transferred to Food)">
                </div>
              ` : `
                <div class="qchips">
                  ${quickReasons.map(x => `
                    <button type="button" class="qchip ${c.reasonId === x.id ? 'on' : ''}" data-rid="${x.id}">
                      <small>${esc(x.code)} · ${x.track === 'NONE' ? 'Log Only' : x.track === 'A' ? `Global: ${x.gCat}` : x.owner}</small>
                      <b>${esc(x.name)}</b>
                    </button>
                  `).join('')}
                </div>

                ${r ? `
                  <div class="cols2" style="margin-top:10px">
                    <label class="field">
                      <span>Cascading Theme ${c.theme === 'Other' ? '<span class="pill warn" style="font-size:10px">QA tracks Other %</span>' : ''}</span>
                      <select id="themeSelect">
                        ${(r.themes || ['Other']).map(th => `<option value="${esc(th)}" ${c.theme === th ? 'selected' : ''}>${esc(th)}</option>`).join('')}
                      </select>
                    </label>
                    <label class="field">
                      <span>Action Taken on Call</span>
                      <select id="actionSelect">
                        ${(r.actions || ['Logged & routed']).map(ac => `<option value="${esc(ac)}" ${c.actionTaken === ac ? 'selected' : ''}>${esc(ac)}</option>`).join('')}
                      </select>
                    </label>
                  </div>
                ` : ''}

                ${r && r.edge === 'E-09' ? `
                  <div class="edge-box danger">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:var(--bad)">
                      <input type="checkbox" id="robberyToggle" ${c.robberyDualPush ? 'checked' : ''} style="width:auto;min-height:0">
                      E-09 Prompt: Is this Robbery / Hijacking? (Checked = Dual Push to BOTH Supply &amp; Safety G-09 + Global Lost › Hijacking/Robbery P1)
                    </label>
                  </div>
                ` : ''}
                ${r && r.edge === 'E-10' ? `
                  <div class="edge-box">
                    <b style="color:var(--warn)">E-10 Mandatory DA Payment Dispute Fields (M#42 · Supply Sheet):</b>
                    <div class="cols2" style="margin-top:8px">
                      <label class="field"><span>DA ID <span class="req">*</span></span><input type="text" id="daIdInput" value="${esc(c.daId)}" placeholder="e.g. DA-409"></label>
                      <label class="field"><span>Disputed Amount (Tk) <span class="req">*</span></span><input type="number" id="dispAmtInput" value="${esc(c.disputedAmount)}" placeholder="e.g. 1200"></label>
                    </div>
                  </div>
                ` : ''}
                ${r && r.edge === 'E-08' ? `
                  <div class="edge-box"><b>E-08 Policy Guard (G-13 Redirect to Merchant):</b> Wrong or defective product inside a sealed box is a merchant-side issue. Give merchant contact, explain redirect, and save as <b>Log Only — zero Ops push</b>.</div>
                ` : ''}
                ${r && r.edge === 'E-05' ? `
                  <div class="edge-box"><b>E-05 Store Approval:</b> Pushes to Global Tracker (<code>Execution Request › Store Approval</code>). If KYC docs are incomplete, also spawns an Activation follow-through note.</div>
                ` : ''}
              `}
            </div>

            ${c.callType !== 'None' ? `
              <!-- Step 4: Chrome Extension Parcel Lookup (E-03 Multi-Parcel) + Context Guard (>=30c) -->
              <div class="fsec">
                <div class="fsec-head">
                  <span class="eyebrow">4 · Consignment (Chrome Ext + E-03 Multi-Parcel) &amp; Context</span>
                  <div style="display:flex;gap:5px;flex-wrap:wrap">
                    <button type="button" class="btn xs" data-sample-cb="CB2611004512">CB2611004512</button>
                    <button type="button" class="btn xs" data-sample-cb="CB2611007890">CB2611007890</button>
                    <button type="button" class="btn xs" data-sample-cb="CB2611009911">CB2611009911</button>
                  </div>
                </div>
                <div style="display:flex;gap:8px;margin-bottom:8px">
                  <input type="text" id="consInput" value="${esc(c.consignment)}" placeholder="Primary Consignment ID (e.g. CB2611004512)">
                  <button type="button" class="btn soft" id="lookupParcelBtn">${ic('search', 'sm')} Lookup</button>
                  <button type="button" class="btn" id="pullHiveParcelBtn" title="Pull the matching order previously captured from Hive in this browser">Pull from Hive</button>
                  <button type="button" class="btn" id="addExtraConsBtn" title="Edge Case E-03: Attach additional consignment IDs to this issue">+ Multi-Parcel (E-03)</button>
                </div>
                ${c.extraConsignments.length ? `
                  <div class="tag-chip-row">
                    <span class="muted" style="font-size:11.5px;align-self:center">Extra parcels (E-03):</span>
                    ${c.extraConsignments.map((ec, idx) => `<span class="tag-chip">${esc(ec)} <button type="button" data-rm-extra="${idx}">×</button></span>`).join('')}
                  </div>
                ` : ''}
                ${c.parcelLoading ? `<div class="parcel-card muted">Loading the matching Hive search result from this browser...</div>` : ''}
                ${c.parcel ? `
                  <div class="parcel-card">
                    <div class="parcel-sections">
                      <section><h4>1. Consignment Info</h4><div class="parcel-grid"><div><span>Consignment ID</span><b>${esc(c.parcel.id)}</b></div><div><span>Created Ago</span><b>${esc(c.parcel.created_ago || '—')}</b></div><div><span>Created At</span><b>${esc(c.parcel.created_at || '—')}</b></div></div></section>
                      <section><h4>2. Business Info</h4><div class="parcel-grid"><div><span>Business Name</span><b>${esc(c.parcel.business_name || '—')}</b></div><div><span>Business ID</span><b>${esc(c.parcel.business_id || '—')}</b></div><div><span>Business Owner Number</span><b>${esc(c.parcel.business_owner_number || '—')}</b></div></div></section>
                      <section><h4>3. Receiver Info</h4><div class="parcel-grid"><div><span>Customer Name</span><b>${esc(c.parcel.customer_name || '—')}</b></div><div><span>Customer Number</span><b>${esc(c.parcel.customer_number || '—')}</b></div><div><span>Customer Address</span><b>${esc(c.parcel.customer_address || '—')}</b></div></div></section>
                      <section><h4>4. Order Status</h4><div class="parcel-grid"><div><span>Delivery Attempt Count</span><b>${esc(c.parcel.delivery_attempt_count || '—')}</b></div><div><span>Current Parcel Status</span><b>${esc(c.parcel.current_parcel_status || '—')}</b></div></div></section>
                      <section><h4>5. Hub Info</h4><div class="parcel-grid"><div><span>Pickup Hub</span><b>${esc(c.parcel.pickup_hub || '—')}</b></div><div><span>Current Hub</span><b>${esc(c.parcel.current_hub || '—')}</b></div><div><span>LMH Hub</span><b>${esc(c.parcel.lmh_hub || '—')}</b></div></div></section>
                      <section><h4>6. COD &amp; Fees</h4><div class="parcel-grid"><div><span>Parcel Amount</span><b>${c.parcel.parcel_amount ? `৳${esc(c.parcel.parcel_amount)}` : '—'}</b></div><div><span>COD Amount</span><b>${c.parcel.cod_amount ? `৳${esc(c.parcel.cod_amount)}` : '—'}</b></div></div></section>
                    </div>
                    ${pHint ? `<div class="parcel-hint">${ic('alert', 'sm')} ${esc(pHint)}</div>` : ''}
                  </div>
                ` : ''}

                <textarea id="noteInput" style="margin-top:10px" placeholder="What happened, since when, what was agreed... (Min 30 non-digit chars for ticketed pushes)">${esc(c.note)}</textarea>
                <div class="snip-row">
                  ${['Since when:','Merchant expects:','Promised by:','Hub / rider said:'].map(s => `<button type="button" data-snip="${s}">+ ${s}</button>`).join('')}
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:12px">
                  <div class="seg-ctl">
                    ${[['P1','P1 Urgent'],['P2','P2 High'],['P3','P3 Medium'],['P4','P4 Low']].map(([k, lbl]) => `
                      <button type="button" data-prio="${k}" class="p-${k} ${c.prio === k ? 'on' : ''}">${lbl}</button>
                    `).join('')}
                  </div>
                  <span class="muted" style="font-size:12px;${digitsOnlyNote ? 'color:var(--bad);font-weight:650' : noteClean.length >= minNoteLen ? 'color:var(--good);font-weight:650' : ''}">
                    ${digitsOnlyNote ? 'Cannot be digits only' : `${noteClean.length} / ${minNoteLen}+ chars ${isTicketed ? '(PRD Context Guard)' : ''}`}
                  </span>
                </div>
              </div>
            ` : ''}
          ` : ''}

          <div class="action-bar">
            <div class="need">${needs.length ? `Still needed: <b>${needs.join(', ')}</b>` : `<span style="color:var(--good);font-weight:650">${ic('check', 'sm')} Ready — ${isFast ? 'Fast Save &amp; Next Call' : 'Save &amp; Route'}</span>`}</div>
            <button type="button" class="btn" id="clearCallBtn">Reset</button>
            ${!isFast && isTicketed ? `<button type="button" class="btn soft" id="saveAndAnotherBtn" ${needs.length ? 'disabled' : ''} title="Edge Case E-01: Save this issue & keep caller active for a 2nd issue on the same call">+ Save &amp; Raise Another (E-01)</button>` : ''}
            <button type="button" class="btn pri" id="saveCallBtn" ${needs.length ? 'disabled' : ''}>
              ${isFast ? ic('zap', 'sm') + ' Save &amp; Next Call' : 'Save Interaction'} <kbd>Ctrl</kbd>+<kbd>Enter</kbd>
            </button>
          </div>
        </section>

        <!-- RIGHT: Live Dual-Track Routing + Exact Global Category/Sub-Category + Preview Modal + E-14 Override -->
        <aside class="panel sticky">
          <div class="panel-pad">
            <div class="eyebrow" style="margin-bottom:10px">Where This Goes (Live Preview)</div>
            ${rt ? `
              <div class="route-card" style="--rt:${rt.color}">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
                  <span class="pill ${rt.track === 'A' ? 'acc' : rt.track === 'B' ? 'purple' : rt.track === 'DUAL' ? 'bad' : 'good'}">
                    ${rt.track === 'A' ? 'Track A · Global MX' : rt.track === 'B' ? 'Track B · Team Sheet' : rt.track === 'DUAL' ? 'Dual Push (A+B)' : 'Log Only · Not Ticketed'}
                  </span>
                  <span class="pill mute">${esc(rt.slaText)}</span>
                </div>
                <div class="who">${esc(rt.owner)}</div>
                <p>${esc(rt.why)}</p>
                ${c.outcome === 'callback' ? `<p style="margin-top:8px;font-weight:650;color:var(--warn)">${ic('calendar', 'sm')} Callback: ${fmtStamp(computeCallbackDate(c))}</p>` : ''}
                ${rt.due ? `
                  <div class="flow-chain"><span class="me">Inbound Logs</span>→<span>${esc((rt.rawOwner || rt.owner).split(' ·')[0])} Solves</span>→<span class="me">Inbound Confirms</span></div>
                  <p style="margin-top:8px;font-weight:600;color:var(--ink)">${ic('clock', 'sm')} Due: ${fmtStamp(rt.due)}</p>
                ` : ''}
              </div>

              ${(rt.track === 'A' || rt.track === 'DUAL') && gp ? `
                <div class="payload-box">
                  <div class="payload-head">
                    <span>Global Tracker Mapping (Verbatim)</span>
                    <span class="mono">channel='MX'</span>
                  </div>
                  <div class="payload-body">
                    <label class="field">
                      <span>Global Category ${c.overrideEnabled ? '<span class="src-tag ed">E-14 override</span>' : '<span class="src-tag">auto-mapped</span>'}</span>
                      <select id="trkGCatSel" ${c.overrideEnabled ? '' : 'disabled'}>
                        ${Object.keys(GLOBAL_CATALOG).map(cat => `<option value="${esc(cat)}" ${gp.gCat === cat ? 'selected' : ''}>${esc(cat)}</option>`).join('')}
                      </select>
                    </label>
                    <label class="field">
                      <span>Global Sub-Category ${(r && r.gSubs && r.gSubs.length > 1) || c.overrideEnabled ? '<span class="src-tag ed">choose exact sub</span>' : '<span class="src-tag">1-to-1 locked</span>'}</span>
                      <select id="trkGSubSel">
                        ${(c.overrideEnabled ? (GLOBAL_CATALOG[gp.gCat] || []).map(x => x.sub) : (r && r.gSubs && r.gSubs.length ? r.gSubs : (GLOBAL_CATALOG[gp.gCat] || []).map(x => x.sub))).map(sub => `
                          <option value="${esc(sub)}" ${gp.gSub === sub ? 'selected' : ''}>${esc(sub)}</option>
                        `).join('')}
                      </select>
                    </label>
                    <div class="cols2" style="gap:8px">
                      <label class="field">
                        <span>Concern Hub <span class="src-tag ${c.trkEdited.hub ? 'ed' : ''}">${c.trkEdited.hub ? 'edited' : 'parcel'}</span></span>
                        <select id="trkHubSel">
                          ${HUBS.map(h => `<option ${(c.trkHub || (c.parcel && c.parcel.hub) || 'Uttara Hub') === h ? 'selected' : ''}>${h}</option>`).join('')}
                        </select>
                      </label>
                      <label class="field">
                        <span>Zone <span class="src-tag ${c.trkEdited.zone ? 'ed' : ''}">${c.trkEdited.zone ? 'edited' : 'parcel'}</span></span>
                        <select id="trkZoneSel">
                          ${ZONES.map(z => `<option ${(c.trkZone || (c.parcel && c.parcel.zone) || 'ISD') === z ? 'selected' : ''}>${z}</option>`).join('')}
                        </select>
                      </label>
                    </div>
                    <div class="payload-row"><span>Global Issue Type</span><b>${esc(gp.issueType)} (ISD ${gp.slaByZone.ISD}d / OSD ${gp.slaByZone.OSD}d / CTG ${gp.slaByZone.CTG}d)</b></div>
                    <div class="payload-row"><span>Overflow Guard</span><b style="color:var(--good)">W-1/W-2 &amp; W-4 Active</b></div>
                    <button type="button" class="btn pri sm" id="previewGlobalBtn" style="width:100%;justify-content:center;margin-top:8px">
                      ${ic('eye', 'sm')} View How It's Submitted in Global Tracker
                    </button>
                  </div>
                </div>
              ` : rt.track === 'B' ? `
                <div class="payload-box">
                  <div class="payload-head" style="background:var(--purple-soft);color:var(--purple);border-color:var(--line)"><span>Stakeholder Sheet + Fallback Hub</span><span>Hard Gate ON</span></div>
                  <div class="payload-body">
                    <div class="payload-row"><span>Target Sheet</span><b>${esc(rt.rawOwner || r.owner)} Issues</b></div>
                    <div class="payload-row"><span>Fallback Mirror</span><b>All_Issues_Fallback</b></div>
                    <div class="payload-row"><span>Closure Rule</span><b>Col X (RC-01..64) + 20c</b></div>
                  </div>
                </div>
              ` : `
                <div class="payload-box">
                  <div class="payload-head"><span>Call Log Metadata</span><span class="mono">${esc(c.direction)}</span></div>
                  <div class="payload-body">
                    <div class="payload-row"><span>Start Time</span><b>${c.startedAt ? fmtTimeAMPM(c.startedAt) : 'Auto on entry'}</b></div>
                    <div class="payload-row"><span>Outcome</span><b>${esc(outcomeMeta(c.outcome).label)}</b></div>
                    <div class="payload-row"><span>Ticket Created?</span><b>No (Log Only)</b></div>
                  </div>
                </div>
              `}

              ${!isFast && r ? `
                <div class="override-box">
                  <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-weight:650;color:var(--warn)">
                    <input type="checkbox" id="overrideChk" ${c.overrideEnabled ? 'checked' : ''} style="width:auto;min-height:0">
                    Override Auto-Routing / Global Category (E-14)
                  </label>
                  ${c.overrideEnabled ? `
                    <label class="field" style="margin-top:8px">
                      <span>Override Owner Queue</span>
                      <select id="overrideOwnerSel">
                        <option value="">Keep default (${esc(r.owner)})</option>
                        ${TEAMS.map(tm => `<option value="${esc(tm.key)}" ${c.overrideOwner === tm.key ? 'selected' : ''}>${esc(tm.key)}</option>`).join('')}
                      </select>
                    </label>
                    <label class="field" style="margin-top:6px">
                      <span>Mandatory Override Reason (15+ chars) <span class="req">*</span></span>
                      <input type="text" id="overrideReasonInput" value="${esc(c.overrideReason)}" placeholder="Why is manual override required? (logged for QA)">
                    </label>
                  ` : ''}
                </div>
              ` : ''}
            ` : `
              <div class="route-card">
                <div class="who" style="color:var(--ink-3)">Awaiting Outcome / Reason</div>
                <p>Choose an outcome or contact reason to preview exact routing, verbatim Global Category &gt; Sub-Category mapping, and AM/PM SLA target.</p>
              </div>
            `}
          </div>
        </aside>
      </div>
    `;

    // Bind Desk Events
    document.querySelectorAll('#dirToggle button').forEach(b => b.addEventListener('click', () => {
      STATE.call.direction = b.dataset.dir;
      if (b.dataset.dir === 'Outgoing' && STATE.call.outcome === 'connected') STATE.call.outcome = 'outgoing';
      else if (b.dataset.dir === 'Incoming' && STATE.call.outcome === 'outgoing') STATE.call.outcome = 'connected';
      renderCallDesk();
    }));

    document.getElementById('phoneInput').addEventListener('input', e => { lookupPhone(e.target.value); renderCallDesk(true); });
    const mStart = document.getElementById('manualStartBtn');
    if (mStart) mStart.addEventListener('click', () => { startCallTimer(); renderCallDesk(); });

    document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => { lookupPhone(b.dataset.preset); renderCallDesk(); }));
    document.querySelectorAll('[data-start-cb]').forEach(b => b.addEventListener('click', () => startOutgoingCallback(b.dataset.startCb)));
    document.querySelectorAll('[data-outcome]').forEach(b => b.addEventListener('click', () => {
      STATE.call.outcome = b.dataset.outcome;
      if (b.dataset.outcome === 'outgoing') STATE.call.direction = 'Outgoing';
      renderCallDesk();
    }));

    const dropCb = document.getElementById('autoDropCb');
    if (dropCb) dropCb.addEventListener('change', e => { STATE.call.autoQueueDropCb = e.target.checked; renderCallDesk(); });
    document.querySelectorAll('[data-cbpreset]').forEach(b => b.addEventListener('click', () => { STATE.call.cbPreset = b.dataset.cbpreset; renderCallDesk(); }));
    const customCb = document.getElementById('cbCustomTime');
    if (customCb) customCb.addEventListener('change', e => { STATE.call.cbCustomTime = e.target.value; renderCallDesk(); });

    document.querySelectorAll('[data-ct]').forEach(b => b.addEventListener('click', () => { STATE.call.callerType = b.dataset.ct; renderCallDesk(); }));
    const unv = document.getElementById('unverifiedChk');
    if (unv) unv.addEventListener('change', e => { STATE.call.unverifiedType = e.target.checked; renderCallDesk(); });
    document.querySelectorAll('[data-sent]').forEach(b => b.addEventListener('click', () => { STATE.call.sentiment = b.dataset.sent; renderCallDesk(); }));
    const chEl = document.getElementById('churnToggle');
    if (chEl) chEl.addEventListener('change', e => {
      STATE.call.threatChurn = e.target.checked;
      if (e.target.checked) { STATE.call.prio = 'P1'; STATE.call.sentiment = 'Dissatisfied'; }
      renderCallDesk();
    });
    document.querySelectorAll('[data-calltype]').forEach(b => b.addEventListener('click', () => {
      STATE.call.callType = b.dataset.calltype;
      if (b.dataset.calltype === 'None') STATE.call.reasonId = 'M49';
      renderCallDesk();
    }));
    document.querySelectorAll('[data-rid]').forEach(b => b.addEventListener('click', () => pickReason(b.dataset.rid)));
    const rSel = document.getElementById('reasonSelect');
    if (rSel) rSel.addEventListener('change', e => pickReason(e.target.value));

    const thSel = document.getElementById('themeSelect');
    if (thSel) thSel.addEventListener('change', e => {
      STATE.call.theme = e.target.value;
      // Smart auto-select Global Sub-Category when Theme hints at specific sub-category (e.g. Hold vs Cancel, Address vs Phone)
      const rr = selectedReason();
      if (rr && rr.id === 'M22') STATE.call.trkGSub = /hold/i.test(e.target.value) ? 'Hold Request' : 'Order Cancellation Request';
      if (rr && rr.id === 'M23') STATE.call.trkGSub = /phone|number/i.test(e.target.value) ? 'Customer Contact Update' : 'Customer Address Update';
      renderCallDesk();
    });
    const acSel = document.getElementById('actionSelect');
    if (acSel) acSel.addEventListener('change', e => { STATE.call.actionTaken = e.target.value; });

    const robEl = document.getElementById('robberyToggle');
    if (robEl) robEl.addEventListener('change', e => { STATE.call.robberyDualPush = e.target.checked; renderCallDesk(); });

    const daEl = document.getElementById('daIdInput');
    if (daEl) daEl.addEventListener('input', e => { STATE.call.daId = e.target.value; renderCallDesk(true); });
    const amtEl = document.getElementById('dispAmtInput');
    if (amtEl) amtEl.addEventListener('input', e => { STATE.call.disputedAmount = e.target.value; renderCallDesk(true); });

    document.querySelectorAll('[data-sample-cb]').forEach(b => b.addEventListener('click', () => triggerParcelLookup(b.dataset.sampleCb)));
    const lBtn = document.getElementById('lookupParcelBtn');
    if (lBtn) lBtn.addEventListener('click', () => triggerParcelLookup(document.getElementById('consInput').value));
    const hiveBtn = document.getElementById('pullHiveParcelBtn');
    if (hiveBtn) hiveBtn.addEventListener('click', pullHiveParcel);
    const addEx = document.getElementById('addExtraConsBtn');
    if (addEx) addEx.addEventListener('click', () => {
      const nextId = `CB261100${Math.floor(1000 + Math.random() * 8999)}`;
      STATE.call.extraConsignments.push(nextId);
      showToast(`Added extra consignment ${nextId} to this issue (E-03 Multi-Parcel).`);
      renderCallDesk();
    });
    document.querySelectorAll('[data-rm-extra]').forEach(b => b.addEventListener('click', () => {
      STATE.call.extraConsignments.splice(Number(b.dataset.rmExtra), 1);
      renderCallDesk();
    }));

    const cInp = document.getElementById('consInput');
    if (cInp) cInp.addEventListener('input', e => {
      STATE.call.consignment = e.target.value.trim().toUpperCase();
      if (PARCEL_MASTER[STATE.call.consignment] && (!STATE.call.parcel || STATE.call.parcel.id !== STATE.call.consignment)) {
        triggerParcelLookup(STATE.call.consignment);
      } else if (isConsignmentId(STATE.call.consignment) && (!STATE.call.parcel || STATE.call.parcel.id !== STATE.call.consignment)) {
        renderCallDesk(true);
        window.setTimeout(() => {
          if (STATE.call.consignment === e.target.value.trim().toUpperCase() && (!STATE.call.parcel || STATE.call.parcel.id !== STATE.call.consignment)) pullHiveParcel();
        }, 0);
      } else renderCallDesk(true);
    });

    const gCatEl = document.getElementById('trkGCatSel');
    if (gCatEl) gCatEl.addEventListener('change', e => {
      STATE.call.trkGCat = e.target.value;
      const firstSub = (GLOBAL_CATALOG[e.target.value] || [])[0];
      STATE.call.trkGSub = firstSub ? firstSub.sub : '';
      renderCallDesk();
    });
    const gSubEl = document.getElementById('trkGSubSel');
    if (gSubEl) gSubEl.addEventListener('change', e => { STATE.call.trkGSub = e.target.value; renderCallDesk(); });

    const thEl = document.getElementById('trkHubSel');
    if (thEl) thEl.addEventListener('change', e => { STATE.call.trkHub = e.target.value; STATE.call.trkEdited.hub = true; renderCallDesk(); });
    const tzEl = document.getElementById('trkZoneSel');
    if (tzEl) tzEl.addEventListener('change', e => { STATE.call.trkZone = e.target.value; STATE.call.trkEdited.zone = true; renderCallDesk(); });

    const prevGBtn = document.getElementById('previewGlobalBtn');
    if (prevGBtn) prevGBtn.addEventListener('click', () => openGlobalPreview('draft'));

    const ovChk = document.getElementById('overrideChk');
    if (ovChk) ovChk.addEventListener('change', e => { STATE.call.overrideEnabled = e.target.checked; renderCallDesk(); });
    const ovOwn = document.getElementById('overrideOwnerSel');
    if (ovOwn) ovOwn.addEventListener('change', e => { STATE.call.overrideOwner = e.target.value; renderCallDesk(); });
    const ovReas = document.getElementById('overrideReasonInput');
    if (ovReas) ovReas.addEventListener('input', e => { STATE.call.overrideReason = e.target.value; renderCallDesk(true); });

    const noteEl = document.getElementById('noteInput');
    if (noteEl) {
      noteEl.addEventListener('input', e => { STATE.call.note = e.target.value; if (STATE.call.note && !STATE.call.startedAt) startCallTimer(); renderCallDesk(true); });
      noteEl.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveCallSubmission(false); } });
    }
    document.querySelectorAll('[data-snip]').forEach(b => b.addEventListener('click', () => {
      STATE.call.note = (STATE.call.note ? STATE.call.note + '\n' : '') + b.dataset.snip + ' ';
      renderCallDesk();
      const ta = document.getElementById('noteInput');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }));
    document.querySelectorAll('[data-prio]').forEach(b => b.addEventListener('click', () => { STATE.call.prio = b.dataset.prio; STATE.call.prioEdited = true; renderCallDesk(); }));

    document.getElementById('clearCallBtn').addEventListener('click', () => { stopCallTimer(); clearCallDraftStorage(); STATE.call = newCallDraft(); renderCallDesk(); });
    document.getElementById('saveCallBtn').addEventListener('click', () => saveCallSubmission(false));
    const saveAnBtn = document.getElementById('saveAndAnotherBtn');
    if (saveAnBtn) saveAnBtn.addEventListener('click', () => saveCallSubmission(true));
    saveCallDraftToStorage();

    document.querySelectorAll('[data-chase-existing]').forEach(b => b.addEventListener('click', () => {
      const t = ISSUES.find(x => x.id === b.dataset.chaseExisting);
      if (!t) return;
      const now = nowDyn();
      pushEvent(t, 'chase', CURRENT_AGENT, `Repeat call linked (E-11). Chased ${t.owner} for immediate update.`);
      CALL_LOGS.unshift({
        id: 'CL-' + (2042 + CALL_LOGS.length), direction: STATE.call.direction, outcome: 'connected',
        startedAt: STATE.call.startedAt || now, durationSec: STATE.call.secs || 45,
        agent: CURRENT_AGENT, callerType: t.callerType, callerName: t.callerName, phone: t.phone,
        reasonName: `E-11 Repeat Follow-Up (${t.id})`, theme: 'Chasing unresolved ticket', overrideUsed: false,
        ticketId: t.id, sentiment: STATE.call.sentiment,
        callbackAt: null, callbackStatus: null, note: `Linked repeat call to open ticket ${t.id} & chased ${t.owner}.`
      });
      stopCallTimer();
      STATE.call = newCallDraft();
      STATE.lastSaved = { issueId: t.id, msg: `Linked repeat call (E-11) & chased ${t.id} — no duplicate ticket created.` };
      renderCallDesk();
    }));

    document.querySelectorAll('[data-view-existing]').forEach(b => b.addEventListener('click', () => { STATE.selectedIssueId = b.dataset.viewExisting; STATE.tab = 'followups'; render(); }));
    const openSaved = document.getElementById('openSavedBtn');
    if (openSaved) openSaved.addEventListener('click', () => { STATE.selectedIssueId = STATE.lastSaved.issueId; STATE.tab = 'followups'; render(); });
    const openLog = document.getElementById('openLogBtn');
    if (openLog) openLog.addEventListener('click', () => { STATE.tab = 'calllogs'; render(); });
    const disBtn = document.getElementById('dismissSavedBtn');
    if (disBtn) disBtn.addEventListener('click', () => { STATE.lastSaved = null; renderCallDesk(); });

    if (activeId) {
      const target = document.getElementById(activeId);
      if (target) { target.focus(); if (selStart !== null && target.setSelectionRange) { try { target.setSelectionRange(selStart, selStart); } catch(_) {} } }
    }
  }

  function pickReason(rid) {
    const r = TAXONOMY.find(x => x.id === rid);
    STATE.call.reasonId = rid;
    if (r) {
      STATE.call.callType = r.callType;
      STATE.call.theme = (r.themes && r.themes[0]) || 'Other';
      STATE.call.actionTaken = (r.actions && r.actions[0]) || '';
      if (r.gCat) {
        STATE.call.trkGCat = r.gCat;
        STATE.call.trkGSub = (r.gSubs && r.gSubs[0]) || '';
      }
      if (!STATE.call.prioEdited) STATE.call.prio = r.prio;
    }
    renderCallDesk();
  }

  function startOutgoingCallback(logId) {
    const cb = CALL_LOGS.find(l => l.id === logId);
    if (!cb) return;
    if (cb.claimedBy && cb.claimedUntil && cb.claimedUntil > nowDyn() && cb.claimedBy !== CURRENT_AGENT) {
      showToast(`Callback locked by ${cb.claimedBy} until ${fmtTimeAMPM(cb.claimedUntil)} (10-min anti-double-dial lock).`);
      return;
    }
    cb.claimedBy = CURRENT_AGENT;
    cb.claimedUntil = minsAhead(10);
    persistCallbackClaim(cb.id, CURRENT_AGENT, CURRENT_USER?.id || null, cb.claimedUntil).catch(() => {});
    if (!canActAsAgent(STATE.role)) STATE.role = 'agent';
    STATE.tab = 'desk';
    document.querySelectorAll('#roleSwitcher button').forEach(x => x.classList.toggle('active', x.dataset.role === STATE.role));
    stopCallTimer();
    STATE.call = newCallDraft();
    STATE.call.direction = 'Outgoing';
    STATE.call.outcome = 'outgoing';
    STATE.call.linkedCallbackId = cb.id;
    STATE.call.note = `Outgoing callback to ${cb.callerName}: `;
    lookupPhone(cb.phone);
    startCallTimer();
    showToast(`Claimed 10-min lock & started outgoing callback for ${cb.callerName} (${cb.phone}) at ${fmtTimeAMPM(nowDyn())}`);
    render();
  }

  function saveCallSubmission(keepCallForAnother) {
    const c = STATE.call;
    const now = nowDyn();
    if (c.phone.replace(/\D/g, '').length < 10) { showToast('Enter a valid phone number first.'); return; }

    const callerName = c.merchant ? c.merchant.bizName : (c.knownPerson ? c.knownPerson.name : `Caller (${c.phone})`);
    const logId = 'CL-' + (2042 + CALL_LOGS.length);

    if (c.linkedCallbackId && (c.outcome === 'connected' || c.outcome === 'outgoing')) {
      const prev = CALL_LOGS.find(x => x.id === c.linkedCallbackId);
      if (prev) {
        prev.callbackStatus = 'Completed'; prev.claimedBy = null; prev.claimedUntil = null;
        persistCallbackClaim(prev.id, null, null, null, 'Completed').catch(() => {});
      }
    }

    if (c.outcome === 'dropped' || c.outcome === 'callback' || c.outcome === 'no_answer' || c.callType === 'None') {
      const cbAt = c.outcome === 'callback' ? computeCallbackDate(c) : (c.outcome === 'dropped' && c.autoQueueDropCb ? minsAhead(15) : null);
      const label = c.callType === 'None' ? 'M#49 · Non-Service / None (E-13)' : outcomeMeta(c.outcome).label;
      const noteText = c.note.trim() || `${label} logged via manual IP phone desk.`;
      CALL_LOGS.unshift({
        id: logId, direction: c.direction, outcome: c.outcome, startedAt: c.startedAt || now, durationSec: c.secs,
        agent: CURRENT_AGENT, callerType: c.callerType || 'Existing Merchant', callerName, phone: c.phone.trim(),
        reasonName: label, theme: '', overrideUsed: false, ticketId: null, sentiment: c.sentiment,
        callbackAt: cbAt, callbackStatus: cbAt ? 'Pending' : null, note: noteText
      });
      persistCallLog(CALL_LOGS[0], CURRENT_USER?.id, CURRENT_USER?.team).catch(() => {});
      GLOBAL_FEED.unshift({ issueId: logId, caller: callerName, kind: c.outcome === 'dropped' ? 'chase' : 'reminder', by: CURRENT_AGENT, at: now, text: `[${c.direction} · ${label} · Log Only] ${noteText}` });
      stopCallTimer();
      clearCallDraftStorage();
      STATE.lastSaved = { issueId: null, msg: `${logId} saved (${label} · Log Only)${cbAt ? ` — Callback queued for ${fmtStamp(cbAt)}` : ''}.` };
      STATE.call = newCallDraft();
      renderCallDesk();
      return;
    }

    const r = selectedReason(), rt = computeRouting();
    const noteClean = c.note.trim();
    const isTicketed = rt && (rt.track === 'A' || rt.track === 'B' || rt.track === 'DUAL');
    if (!r || !rt || noteClean.length < (isTicketed ? 30 : 15) || /^\d+$/.test(noteClean.replace(/\s+/g, ''))) {
      showToast(`Enter ${isTicketed ? '30+' : '15+'} non-digit context characters before saving.`);
      return;
    }
    if (c.overrideEnabled && c.overrideReason.trim().length < 15) {
      showToast('E-14 Override requires a 15+ character audit reason.');
      return;
    }

    let createdIssueId = null;
    if (isTicketed) {
      createdIssueId = rt.track === 'A' ? `INB-${905 + ISSUES.length}` : `SAMPLE-${String(ISSUES.length + 10).padStart(3, '0')}`;
      const globalId = (rt.track === 'A' || rt.track === 'DUAL') ? `CB-21-11-${String(430 + ISSUES.length).padStart(4, '0')}` : null;
      const ownerKey = rt.rawOwner || (rt.track === 'A' ? 'Global Ops (Track A)' : r.owner);
      const hub = c.trkHub || (c.parcel ? c.parcel.hub : 'Uttara Hub');
      const zone = c.trkZone || (c.parcel ? c.parcel.zone : 'ISD');
      const gp = effectiveGlobalPair(c, r);
      const extraMeta = r.edge === 'E-10' ? ` [E-10 DA: ${c.daId} · Disputed: Tk ${c.disputedAmount}]` : '';
      const issueObj = {
        id: createdIssueId, globalId, track: rt.track, owner: ownerKey,
        callerType: c.callerType + (c.unverifiedType ? ' (Unverified E-02)' : ''),
        callerName, phone: c.phone.trim(), kam: c.merchant ? c.merchant.kamName : 'Complaint Management',
        reasonCode: r.code, reasonName: r.name, theme: c.theme, actionTaken: c.actionTaken,
        gCat: (rt.track === 'A' || rt.track === 'DUAL') ? gp.gCat : null,
        gSub: (rt.track === 'A' || rt.track === 'DUAL') ? gp.gSub : null,
        gIssueType: (rt.track === 'A' || rt.track === 'DUAL') ? gp.issueType : null,
        opsMeta: (rt.track === 'A' || rt.track === 'DUAL') ? { validation: 'Pending', opsCategory: 'Pending Ops Triage', cmAssigned: 'Auto-assigning', duplicateOf: null, finalResponse: '' } : null,
        prio: c.prio, status: 'Raised', threatChurn: c.threatChurn,
        overrideReason: c.overrideEnabled ? c.overrideReason.trim() : '',
        consignment: c.consignment, extraConsignments: c.extraConsignments.slice(), hub, zone,
        summary: noteClean + extraMeta,
        createdAt: now, dueAt: rt.due, slaHours: rt.due ? (rt.due - now) / 3600000 : 2, slaLabel: rt.slaText,
        reminderAt: minsAhead(60), reminderNote: `First follow-up check with ${ownerKey}`,
        reopenCount: 0, feedbackAttempts: 0, rcCode: '', accountability: '', resolutionSummary: '',
        parcelSnapshot: c.parcel ? JSON.parse(JSON.stringify(c.parcel)) : null,
        opsLayers: (rt.track === 'A' || rt.track === 'DUAL') ? [
          { layer: 'Layer 1 · Central Ops', by: 'Queued (MX)', at: now, text: `Submitted as ${globalId} [${gp.gCat} › ${gp.gSub}] (${hub}, ${zone}).` },
          { layer: 'Layer 2 · Hub Supervisor', by: 'Pending', at: null, text: 'Awaiting hub review.' },
          { layer: 'Layer 3 · Final Response', by: 'Pending', at: null, text: 'Awaiting Ops final_response.' }
        ] : null,
        timeline: []
      };
      pushEvent(issueObj, 'call', CURRENT_AGENT, `${c.direction} IP call (${mmss(c.secs)}): ${noteClean}${extraMeta}`);
      pushEvent(issueObj, rt.track === 'A' ? 'push' : 'raise', 'CarryBee Router', `Routed to ${rt.owner}${globalId ? ` as ${globalId} [${gp.gCat} › ${gp.gSub}]` : ''}. Due ${rt.due ? fmtStamp(rt.due) : 'ASAP'}.`);
      if (c.overrideEnabled) pushEvent(issueObj, 'chase', `${CURRENT_AGENT} (E-14)`, `Manual routing override logged: ${c.overrideReason.trim()}`);
      ISSUES.unshift(issueObj);
      STATE.selectedIssueId = createdIssueId;
      persistNewTicket(issueObj, CURRENT_USER?.id, CURRENT_USER?.team).catch(() => {});
    } else {
      GLOBAL_FEED.unshift({ issueId: logId, caller: callerName, kind: 'call', by: CURRENT_AGENT, at: now, text: `[${c.direction} · Log Only · ${r.code}] ${noteClean}` });
    }

    CALL_LOGS.unshift({
      id: logId, direction: c.direction, outcome: c.outcome, startedAt: c.startedAt || now, durationSec: c.secs,
      agent: CURRENT_AGENT, callerType: c.callerType, callerName, phone: c.phone.trim(),
      reasonName: `${r.code} · ${r.name}`, theme: c.theme, overrideUsed: c.overrideEnabled,
      ticketId: createdIssueId, sentiment: c.sentiment,
      callbackAt: null, callbackStatus: null, note: noteClean
    });
    persistCallLog(CALL_LOGS[0], CURRENT_USER?.id, CURRENT_USER?.team).catch(() => {});

    if (keepCallForAnother) {
      // Edge Case E-01: Keep phone, caller, timer & merchant context; reset only reason/parcel/note for 2nd issue on same call
      STATE.lastSaved = { issueId: createdIssueId, msg: `E-01 Multi-Issue: ${createdIssueId} saved! Same call kept active — log the 2nd issue below.` };
      STATE.call.reasonId = '';
      STATE.call.theme = '';
      STATE.call.actionTaken = '';
      STATE.call.note = '';
      STATE.call.consignment = '';
      STATE.call.extraConsignments = [];
      STATE.call.parcel = null;
      STATE.call.overrideEnabled = false;
      STATE.call.overrideOwner = '';
      STATE.call.overrideReason = '';
      renderCallDesk();
      return;
    }

    stopCallTimer();
    clearCallDraftStorage();
    STATE.lastSaved = { issueId: createdIssueId, msg: createdIssueId ? `${logId} saved & ticket ${createdIssueId} routed to ${rt.owner}.` : `${logId} saved as Non-Ticketed Call Log (${r.name}).` };
    STATE.call = newCallDraft();
    renderCallDesk();
  }

  /* ========================================================================
     SHARED VIEW: FOLLOW-UP & ISSUE BOARD (WITH PARCEL REFRESH + HARD GATE)
     ======================================================================== */
  function renderFollowUpBoard() {
    const cbs = pendingCallbacks();
    const f = STATE.boardFilter;
    const q = f.q.trim().toLowerCase();
    const list = ISSUES.filter(t => {
      if (f.team && t.owner !== f.team) return false;
      if (f.chip === 'chase' && !needsFollowUp(t)) return false;
      if (f.chip === 'confirm' && !(t.awaitingConfirm || t.status === 'Resolved')) return false;
      if (f.chip === 'reopen' && !t.reopened) return false;
      if (q && ![t.id, t.globalId, t.callerName, t.phone, t.consignment, t.owner, t.reasonName, t.summary].join(' ').toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (a.status === 'Closed' ? 1 : 0) - (b.status === 'Closed' ? 1 : 0) || (needsFollowUp(a) ? 0 : 1) - (needsFollowUp(b) ? 0 : 1));

    if (!STATE.selectedIssueId || !ISSUES.some(x => x.id === STATE.selectedIssueId)) STATE.selectedIssueId = list[0] ? list[0].id : null;
    const sel = ISSUES.find(x => x.id === STATE.selectedIssueId);
    const canExport = ROLES[STATE.role] && ROLES[STATE.role].canExport;

    document.getElementById('app').innerHTML = `
      <div class="view-head">
        <div>
          <h1>${canActAsSupervisor(STATE.role) ? 'All Team Issues & Callback Queue' : 'Follow-Ups, Callbacks & Issue Timelines'}</h1>
          <p>Pending callbacks with 10-min anti-double-dial lock + 5-step progress, 3-layer Global Ops &amp; Stakeholder Hard Closure Gate.</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${canExport ? `<button class="btn sm" id="exportIssuesBtn">${ic('download', 'sm')} Export Team CSV (BOM)</button>` : `<span class="pill mute" title="PRD §8.5 PII Guardrail">${ic('lock', 'sm')} Export Blocked (Agent)</span>`}
          ${canActAsAgent(STATE.role) ? `<button class="btn pri" id="goDeskBtn">${ic('phone', 'sm')} Log Call</button>` : ''}
        </div>
      </div>

      ${cbs.length ? `
        <div class="eyebrow" style="margin-bottom:8px">${ic('calendar', 'sm')} Active Callback Follow-Up Queue (${cbs.length}) · 10-Min Agent Claim Lock</div>
        <div class="cb-strip">
          ${cbs.map(cb => {
            const ov = cb.callbackAt <= nowDyn();
            const isClaimed = cb.claimedBy && cb.claimedUntil && cb.claimedUntil > nowDyn();
            return `
              <div class="cb-card ${ov ? 'overdue' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
                  <b>${esc(cb.callerName)}</b>
                  <span class="pill ${ov ? 'live' : 'warn'}">${ov ? 'OVERDUE · ' : ''}${fmtTimeAMPM(cb.callbackAt)}</span>
                </div>
                <div class="muted" style="font-size:11.5px;margin:2px 0 5px"><span class="mono">${esc(cb.phone)}</span> · ${esc(outcomeMeta(cb.outcome).short)} · ${esc(cb.agent)}</div>
                ${isClaimed ? `<div style="margin-bottom:6px"><span class="pill acc">${ic('lock', 'sm')} Claimed by ${esc(cb.claimedBy)} until ${fmtTimeAMPM(cb.claimedUntil)}</span></div>` : ''}
                <div style="font-size:12.5px;margin-bottom:9px">${esc(cb.note)}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <button class="btn xs pri" data-cb-dial="${cb.id}">${ic('phone-out', 'sm')} ${isClaimed ? 'Resume Call' : 'Claim & Call'}</button>
                  <button class="btn xs" data-cb-done="${cb.id}">${ic('check', 'sm')} Done</button>
                  ${isClaimed && canActAsSupervisor(STATE.role) ? `<button class="btn xs warn" data-cb-release="${cb.id}">${ic('x', 'sm')} Release Lock</button>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      <div class="team-strip" id="teamStrip">
        ${[{ key: '', short: 'All Queues', color: 'var(--ink)' }].concat(TEAMS).map(tm => {
          const ts = tm.key ? ISSUES.filter(x => x.owner === tm.key) : ISSUES;
          const open = ts.filter(x => x.status !== 'Closed').length;
          const act = ts.filter(needsFollowUp).length;
          return `<button class="tcard ${f.team === tm.key ? 'on' : ''}" data-team="${esc(tm.key)}" style="--tc:${tm.color}">
            <div class="tn">${esc(tm.short)}</div><b class="num">${open}</b>
            <small>open${act ? ` · <span style="color:var(--live);font-weight:650">${act} action</span>` : ''}</small>
          </button>`;
        }).join('')}
      </div>

      <div class="toolbar">
        <input type="search" id="boardSearch" value="${esc(f.q)}" placeholder="Search ticket ID, merchant, phone, consignment, KAM...">
        <button class="fchip ${f.chip === 'all' ? 'on' : ''}" data-chip="all">All (${ISSUES.length})</button>
        <button class="fchip ${f.chip === 'chase' ? 'live-on' : ''}" data-chip="chase">${ic('flame', 'sm')} Needs Follow-Up (${ISSUES.filter(needsFollowUp).length})</button>
        <button class="fchip ${f.chip === 'confirm' ? 'on' : ''}" data-chip="confirm">${ic('phone', 'sm')} Feedback Call (${ISSUES.filter(x => x.awaitingConfirm || x.status === 'Resolved').length})</button>
        <button class="fchip ${f.chip === 'reopen' ? 'on' : ''}" data-chip="reopen">${ic('repeat', 'sm')} Reopened (${ISSUES.filter(x => x.reopened).length})</button>
      </div>

      <div class="board-grid">
        <section class="issue-list">
          ${list.map(t => {
            const sl = slaStatus(t), si = stepIndex(t);
            return `
              <button class="irow ${t.id === STATE.selectedIssueId ? 'sel' : ''} ${t.reopened ? 'reopened-row' : ''}" data-issue="${t.id}" style="--pc:var(--p-${t.prio.toLowerCase()})">
                <span class="pbar"></span>
                <div class="mid">
                  <div class="irow-l1">
                    <b>${esc(t.callerName)}</b>
                    <span class="mono muted">${esc(t.id)}</span>
                    ${t.globalId ? `<span class="pill acc mono">${esc(t.globalId)}</span>` : ''}
                    ${t.reopened ? `<span class="pill bad">${ic('repeat', 'sm')} E-16 Reopened</span>` : ''}
                  </div>
                  <div class="irow-l2">${esc(t.reasonName)} — ${esc(t.summary)}</div>
                  <div class="irow-l3">
                    <span class="team-dot" style="--tc:${teamColor(t.owner)}">${esc(t.owner)}</span>
                    <span class="mini-steps">${STEPS.map((_, idx) => `<i class="${idx <= si ? (t.status === 'Closed' ? 'f done' : t.reopened && idx === si ? 'f bad' : 'f') : ''}"></i>`).join('')}</span>
                    ${t.reminderAt && t.status !== 'Closed' ? `<span style="color:var(--live);font-weight:600">${ic('clock', 'sm')} ${fmtStamp(t.reminderAt)}</span>` : ''}
                  </div>
                </div>
                <div class="rhs">
                  <span class="pill ${sl.pill}">${esc(sl.label)}</span>
                  <span class="muted">${esc(t.status)}</span>
                  <span class="muted" style="font-size:11px">${fmtStamp(t.createdAt)}</span>
                </div>
              </button>
            `;
          }).join('') || '<div class="panel panel-pad muted" style="text-align:center">No matching issues.</div>'}
        </section>

        <aside class="detail-pane">
          ${sel ? renderDetailHTML(sel) : '<div class="detail-pad muted">Select an issue to inspect timeline.</div>'}
        </aside>
      </div>
    `;

    const gd = document.getElementById('goDeskBtn');
    if (gd) gd.addEventListener('click', () => { STATE.tab = 'desk'; render(); });
    const expIss = document.getElementById('exportIssuesBtn');
    if (expIss) expIss.addEventListener('click', () => {
      exportCSVWithBOM(
        'carrybee_inboundiq_issues.csv',
        ['Ticket ID', 'Global ID', 'Track', 'Owner', 'Merchant/Caller', 'Phone', 'Reason', 'Priority', 'Status', 'Created'],
        list.map(t => [t.id, t.globalId || '', t.track, t.owner, t.callerName, t.phone, `${t.reasonCode} ${t.reasonName}`, t.prio, t.status, fmtStamp(t.createdAt)]),
        'Team Issues Export'
      );
    });
    document.querySelectorAll('[data-cb-dial]').forEach(b => b.addEventListener('click', () => startOutgoingCallback(b.dataset.cbDial)));
    document.querySelectorAll('[data-cb-release]').forEach(b => b.addEventListener('click', () => {
      const cb = CALL_LOGS.find(x => x.id === b.dataset.cbRelease);
      if (cb) { cb.claimedBy = null; cb.claimedUntil = null; persistCallbackClaim(cb.id, null, null, null).catch(() => {}); showToast(`Supervisor released 10-min callback lock on ${cb.callerName}.`); renderFollowUpBoard(); }
    }));
    document.querySelectorAll('[data-cb-done]').forEach(b => b.addEventListener('click', () => {
      const cb = CALL_LOGS.find(x => x.id === b.dataset.cbDone);
      if (cb) { cb.callbackStatus = 'Completed'; cb.claimedBy = null; cb.claimedUntil = null; persistCallbackClaim(cb.id, null, null, null, 'Completed').catch(() => {}); showToast(`Callback for ${cb.callerName} marked done.`); renderFollowUpBoard(); }
    }));
    document.querySelectorAll('#teamStrip button').forEach(b => b.addEventListener('click', () => { STATE.boardFilter.team = b.dataset.team; renderFollowUpBoard(); }));
    document.getElementById('boardSearch').addEventListener('input', e => { STATE.boardFilter.q = e.target.value; renderFollowUpBoard(); const el = document.getElementById('boardSearch'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
    document.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', () => { STATE.boardFilter.chip = b.dataset.chip; renderFollowUpBoard(); }));
    document.querySelectorAll('[data-issue]').forEach(b => b.addEventListener('click', () => { STATE.selectedIssueId = b.dataset.issue; renderFollowUpBoard(); }));
    if (sel) bindDetailEvents(sel);
  }

  function renderRCGroupedOptions(selectedCode) {
    const groups = {};
    ROOT_CAUSES.forEach(rc => {
      if (!groups[rc.cat]) groups[rc.cat] = [];
      groups[rc.cat].push(rc);
    });
    return Object.keys(groups).map(cat => `
      <optgroup label="${esc(cat)} (${groups[cat][0].bucket})">
        ${groups[cat].map(rc => `<option value="${rc.code}" ${selectedCode === rc.code ? 'selected' : ''}>${rc.code} · ${esc(rc.label)} → [${esc(rc.bucket)}]</option>`).join('')}
      </optgroup>
    `).join('');
  }

  function renderDetailHTML(t) {
    const sl = slaStatus(t), si = stepIndex(t);
    const om = t.opsMeta || {};
    const finalRespText = om.finalResponse || (t.opsLayers && t.opsLayers[2] && t.opsLayers[2].at ? t.opsLayers[2].text : '');
    const allCons = [t.consignment].concat(t.extraConsignments || []).filter(Boolean);
    return `
      <div class="detail-pad">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span class="mono" style="font-weight:700">${esc(t.id)}</span>
          ${t.globalId ? `<span class="pill acc mono">${esc(t.globalId)}</span>` : '<span class="pill purple">Track B Sheet</span>'}
          <span class="pill ${sl.pill}">${esc(sl.label)}</span>
          <span class="pill mute">${esc(t.prio)}</span>
          ${t.threatChurn ? `<span class="pill bad">${ic('alert', 'sm')} Churn Threat (E-12)</span>` : ''}
        </div>
        <div class="detail-title">${esc(t.callerName)} · ${esc(t.reasonName)}</div>
        <div class="muted" style="font-size:12px">
          <span class="mono">${esc(t.phone)}</span>
          ${allCons.length ? ` · ${allCons.map(x => `<span class="mono">${esc(x)}</span>`).join(', ')}` : ''}
          · ${esc(t.hub)} (${esc(t.zone)})
          ${t.kam ? ` · KAM: <b>${esc(t.kam)}</b>` : ''}
          ${t.theme ? ` · Theme: <b>${esc(t.theme)}</b>` : ''}
        </div>

        ${t.globalId ? `
          <div style="margin-top:9px;display:flex;align-items:center;gap:7px;flex-wrap:wrap">
            <span class="pill acc">${esc(t.gCat || 'Delivery Delay')} › ${esc(t.gSub || 'Processing Delay')}</span>
            <button type="button" class="btn xs pri" id="viewSubmittedGlobalBtn">${ic('eye', 'sm')} View Submitted Global Record</button>
          </div>
        ` : ''}

        <div class="stepper">
          ${STEPS.map((st, idx) => `<div class="st ${idx <= si ? 'done' : ''} ${idx === si ? 'cur' : ''} ${t.status === 'Closed' ? 'closed-ok' : ''} ${t.reopened && idx === si ? 'reopen-st' : ''}">${st}</div>`).join('')}
        </div>

        <div style="margin:10px 0;padding:10px 12px;border-left:3px solid ${teamColor(t.owner)};background:var(--surface-2);border-radius:0 8px 8px 0;font-size:13px;color:var(--ink-2)">${esc(t.summary)}</div>

        ${canActAsSupervisor(STATE.role) && t.status !== 'Closed' && t.owner !== 'Issue Resolution' ? `
          <div style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-radius:9px;background:var(--bad-soft);border:1px solid var(--bad-border)">
            <span style="font-size:12px;color:var(--bad);font-weight:650">Supervisor Override: Escalate stalled/breached ticket</span>
            <button type="button" class="btn xs bad-btn" id="supEscalateIRBtn">${ic('shield', 'sm')} Escalate to Issue Resolution</button>
          </div>
        ` : ''}

        ${t.parcelSnapshot ? `
          <div class="parcel-card" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
              <div><b class="mono">${esc(t.parcelSnapshot.id)}</b> <span class="pill ${t.parcelSnapshot.status === 'Delivered' ? 'good' : 'warn'}">${esc(t.parcelSnapshot.status)}</span></div>
              <button class="btn xs soft" id="refreshParcelBtn">${ic('refresh', 'sm')} Refresh Scan</button>
            </div>
            <div class="muted" style="font-size:11.5px;margin-top:5px">${esc(t.parcelSnapshot.hub)} · Rider: ${esc(t.parcelSnapshot.rider)} (${esc(t.parcelSnapshot.riderPhone)})</div>
          </div>
        ` : ''}

        ${finalRespText ? `
          <div class="final-script-box">
            <div class="fs-head"><span>${ic('check-circle', 'sm')} Green Callback Script — Global Ops final_response</span><span>Ready for Merchant Call</span></div>
            <div class="fs-body">"${esc(finalRespText)}"</div>
          </div>
        ` : ''}

        ${(t.awaitingConfirm || t.status === 'Resolved') && t.status !== 'Closed' ? `
          <div style="padding:11px 13px;border-radius:10px;background:var(--good-soft);border:1px solid var(--good-border);margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
              <b style="color:var(--good);font-size:13px">${ic('phone', 'sm')} Feedback Call Needed to Close</b>
              <span class="pill mute">Attempts: ${t.feedbackAttempts || 0}/3</span>
            </div>
            <div style="font-size:12px;color:var(--ink-2);margin:4px 0 8px">${esc(t.resolutionSummary || 'Owner resolved issue.')}</div>
            <div style="display:flex;gap:7px;flex-wrap:wrap">
              <button class="btn sm good" id="confirmSolvedBtn">${ic('check', 'sm')} Solved</button>
              <button class="btn sm bad-btn" id="reopenIssueBtn">${ic('repeat', 'sm')} Not Solved (E-16)</button>
              <button class="btn sm warn-btn" id="notReachableBtn">${ic('phone-off', 'sm')} Not Reachable (${Math.min(3, (t.feedbackAttempts || 0) + 1)}/3)</button>
            </div>
          </div>
        ` : ''}

        ${t.opsLayers ? `
          <div class="sub-sec">
            <div class="eyebrow" style="display:flex;justify-content:space-between;align-items:center">
              <span>Global Ops 3-Layer Read-Through &amp; Metadata</span>
              ${t.status !== 'Closed' ? `<button class="btn xs soft" id="simOpsUpdateBtn">+ Sim Layer 3 final_response</button>` : ''}
            </div>
            <div class="ops-meta-bar">
              <span>Validation: <b style="color:${om.validation === 'Invalid' ? 'var(--bad)' : 'var(--good)'}">${esc(om.validation || 'Valid')}</b></span> ·
              <span>Ops Cat: <b>${esc(om.opsCategory || 'Pending Ops Triage')}</b></span> ·
              <span>CM: <b>${esc(om.cmAssigned || 'Unassigned')}</b></span> ·
              <span>Dup Of: <b class="mono">${esc(om.duplicateOf || 'None')}</b></span>
            </div>
            <div class="ops-layers">
              ${t.opsLayers.map((l, idx) => `<div class="ops-layer ${idx === 2 && l.at ? 'final' : ''}"><div class="ops-layer-h"><b>${esc(l.layer)} · ${esc(l.by)}</b><span>${l.at ? fmtStamp(l.at) : 'Waiting'}</span></div><div>${esc(l.text)}</div></div>`).join('')}
            </div>
          </div>
        ` : ''}

        ${t.track === 'B' && t.status !== 'Closed' ? `
          <div class="sim-box">
            <div class="eyebrow" style="margin-bottom:7px;color:var(--accent)">${ic('flask', 'sm')} Simulate Stakeholder Sheet Edit (${esc(t.owner)} · 64 RC Hard Gate)</div>
            <div class="cols2" style="gap:8px;margin-bottom:8px">
              <select id="simStatus"><option value="Acknowledged">Col T: Acknowledged</option><option value="In Progress">Col T: In Progress</option><option value="Resolved">Col T: Resolved (Hard Gate)</option></select>
              <select id="simRC"><option value="">Col X: Select RC-01..RC-64...</option>${renderRCGroupedOptions(t.rcCode)}</select>
            </div>
            <div id="rcAutoBucket" class="muted" style="font-size:11.5px;margin-bottom:6px">Col Y Auto-Accountability (ARRAYFORMULA): <b>${esc(t.accountability || 'Select RC to auto-derive')}</b></div>
            <input type="text" id="simSummary" value="${esc(t.resolutionSummary)}" placeholder="Col Z: Resolution summary (20+ chars for Resolved)" style="margin-bottom:7px">
            <div id="gateMsg" style="font-size:12px;margin-bottom:6px"></div>
            <button class="btn sm pri" id="applySheetSimBtn">Sync Sheet Edit → CRM</button>
          </div>
        ` : ''}

        <div class="quick-composer">
          <div class="eyebrow" style="margin-bottom:6px">Add Follow-Up Note / Reminder</div>
          <div style="display:flex;gap:6px">
            <input type="text" id="quickNoteInput" placeholder="Log follow-up note or chase...">
            <button class="btn sm pri" id="postNoteBtn">Log</button>
            <button class="btn sm warn-btn" id="quickChaseBtn">${ic('zap', 'sm')} Chase</button>
          </div>
          ${t.status !== 'Closed' ? `
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">
              <button class="btn xs" data-rem="30">${ic('clock', 'sm')} +30m (${fmtTimeAMPM(minsAhead(30))})</button>
              <button class="btn xs" data-rem="60">${ic('clock', 'sm')} +1h (${fmtTimeAMPM(minsAhead(60))})</button>
              <button class="btn xs" data-rem="tomorrow">${ic('clock', 'sm')} Tomorrow 10:00 AM</button>
            </div>
          ` : ''}
        </div>

        <div class="sub-sec">
          <div class="eyebrow">Chronological Activity Stream (${t.timeline.length})</div>
          <div class="timeline">
            ${t.timeline.slice().reverse().map(ev => `
              <div class="tl-item k-${ev.kind}"><span class="tl-dot"></span><div>
                <div class="tl-meta"><b>${esc(ev.by)}</b><span>· ${fmtStamp(ev.at)}</span></div>
                <div class="tl-text">${esc(ev.text)}</div>
              </div></div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function bindDetailEvents(t) {
    const vGlob = document.getElementById('viewSubmittedGlobalBtn');
    if (vGlob) vGlob.addEventListener('click', () => openGlobalPreview('ticket', t));

    const escIr = document.getElementById('supEscalateIRBtn');
    if (escIr) escIr.addEventListener('click', () => {
      const oldOwner = t.owner;
      t.owner = 'Issue Resolution';
      t.track = 'B';
      t.prio = 'P1';
      t.dueAt = sameDay6PM(nowDyn());
      pushEvent(t, 'reopen', CURRENT_AGENT, `Escalated from ${oldOwner} → Issue Resolution (Same-day 6:00 PM SLA).`);
      persistTicketUpdate(t.id, { responsible_team: 'Issue Resolution', track: 'B', priority: 'P1', sla_due_at: t.dueAt.toISOString() }, { type: 'SUPERVISOR_ESCALATE', actor: CURRENT_AGENT, note: `Escalated from ${oldOwner} -> Issue Resolution` }).catch(() => {});
      showToast(`${t.id} escalated to Issue Resolution (Same-day 6:00 PM SLA)!`);
      renderFollowUpBoard();
    });

    const refBtn = document.getElementById('refreshParcelBtn');
    if (refBtn && t.parcelSnapshot) refBtn.addEventListener('click', () => {
      const next = NEXT_PARCEL_STEP[t.parcelSnapshot.status];
      if (!next) { showToast('Parcel is already at latest status.'); return; }
      const old = t.parcelSnapshot.status;
      t.parcelSnapshot.status = next;
      pushEvent(t, 'ops', 'Parcel Extension Sync', `Refreshed ${t.parcelSnapshot.id}: ${old} → ${next} at ${fmtTimeAMPM(nowDyn())}.`);
      showToast(`Parcel ${t.parcelSnapshot.id} updated: ${next}`);
      renderFollowUpBoard();
    });

    const noteInp = document.getElementById('quickNoteInput');
    const postBtn = document.getElementById('postNoteBtn');
    if (postBtn && noteInp) postBtn.addEventListener('click', () => {
      if (!noteInp.value.trim()) return;
      const txt = noteInp.value.trim();
      pushEvent(t, 'note', CURRENT_AGENT, txt);
      persistTicketUpdate(t.id, { progress_note: txt }, { type: 'FOLLOWUP_NOTE', actor: CURRENT_AGENT, note: txt }).catch(() => {});
      showToast(`Activity logged on ${t.id}`);
      renderFollowUpBoard();
    });

    const chaseBtn = document.getElementById('quickChaseBtn');
    if (chaseBtn) chaseBtn.addEventListener('click', () => {
      pushEvent(t, 'chase', CURRENT_AGENT, (noteInp && noteInp.value.trim()) || `Chased ${t.owner} for immediate update.`);
      t.reminderAt = minsAhead(60);
      showToast(`Chased ${t.owner} · Reminder set for ${fmtTimeAMPM(t.reminderAt)}`);
      renderFollowUpBoard();
    });

    document.querySelectorAll('[data-rem]').forEach(b => b.addEventListener('click', () => {
      const n = nowDyn();
      const target = b.dataset.rem === 'tomorrow' ? new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 10, 0, 0) : minsAhead(Number(b.dataset.rem));
      t.reminderAt = target;
      pushEvent(t, 'reminder', CURRENT_AGENT, `Reminder scheduled for ${fmtStamp(target)}.`);
      showToast(`Reminder set for ${fmtStamp(target)}`);
      renderFollowUpBoard();
    }));

    const cBtn = document.getElementById('confirmSolvedBtn');
    if (cBtn) cBtn.addEventListener('click', () => {
      t.status = 'Closed'; t.awaitingConfirm = false; t.reopened = false; t.reminderAt = null;
      pushEvent(t, 'closed', CURRENT_AGENT, `Caller confirmed solved at ${fmtTimeAMPM(nowDyn())}. Closed.`);
      persistTicketUpdate(t.id, { crm_status: 'Closed', closed_at: new Date().toISOString(), followup_reminder_at: null }, { type: 'CALLER_CONFIRMED_CLOSED', actor: CURRENT_AGENT, note: 'Caller confirmed solved. Closed.' }).catch(() => {});
      showToast(`${t.id} confirmed & closed!`);
      renderFollowUpBoard();
    });

    const rBtn = document.getElementById('reopenIssueBtn');
    if (rBtn) rBtn.addEventListener('click', () => {
      t.status = 'In Progress'; t.awaitingConfirm = false; t.reopened = true; t.reopenCount++;
      pushEvent(t, 'reopen', `${CURRENT_AGENT} (E-16)`, `Caller reported NOT solved. Auto-reopened (#${t.reopenCount}) & escalated to Supervisor.`);
      persistTicketUpdate(t.id, { crm_status: 'Reopened', reopen_count: t.reopenCount }, { type: 'E16_REOPEN', actor: `${CURRENT_AGENT} (E-16)`, note: `Caller reported NOT solved. Auto-reopened (#${t.reopenCount}).` }).catch(() => {});
      showToast(`${t.id} auto-reopened (E-16)!`);
      renderFollowUpBoard();
    });

    const nrBtn = document.getElementById('notReachableBtn');
    if (nrBtn) nrBtn.addEventListener('click', () => {
      t.feedbackAttempts = Math.min(3, (t.feedbackAttempts || 0) + 1);
      if (t.feedbackAttempts >= 3) {
        t.status = 'Closed'; t.awaitingConfirm = false; t.reminderAt = null;
        pushEvent(t, 'closed', CURRENT_AGENT, `Feedback call Attempt 3/3 — Not Reachable. Auto-closed with SMS notification sent per policy.`);
        showToast(`${t.id}: Attempt 3/3 Not Reachable — auto-closed with SMS notice.`);
      } else {
        t.reminderAt = minsAhead(60);
        pushEvent(t, 'chase', CURRENT_AGENT, `Feedback call Attempt ${t.feedbackAttempts}/3 — Not Reachable. Auto-rescheduled for ${fmtTimeAMPM(t.reminderAt)}.`);
        showToast(`Logged Attempt ${t.feedbackAttempts}/3 Not Reachable · Next try at ${fmtTimeAMPM(t.reminderAt)}`);
      }
      renderFollowUpBoard();
    });

    const opsBtn = document.getElementById('simOpsUpdateBtn');
    if (opsBtn) opsBtn.addEventListener('click', () => {
      const n = nowDyn();
      const fin = { layer: 'Layer 3 · Final Response', by: 'Global Ops QA', at: n, text: `Delivered with OTP verified at ${fmtTimeAMPM(n)}. Inform merchant COD will reflect in tonight's settlement.` };
      t.opsLayers[2] = fin;
      if (!t.opsMeta) t.opsMeta = {};
      t.opsMeta.validation = 'Valid';
      t.opsMeta.finalResponse = fin.text;
      t.status = 'Resolved'; t.awaitingConfirm = true; t.resolutionSummary = fin.text;
      pushEvent(t, 'resolved', 'Global Ops (final_response)', fin.text);
      persistTicketUpdate(t.id, { crm_status: 'Resolved - Awaiting Caller Confirm', global_ops_status: 'Solved', global_validation: 'Valid', global_final_response: fin.text, resolution_summary: fin.text }, { type: 'GLOBAL_FINAL_RESPONSE', actor: 'Global Ops QA', note: fin.text }).catch(() => {});
      showToast(`Layer 3 final_response synced for ${t.globalId} — Green Callback Script ready!`);
      renderFollowUpBoard();
    });

    const simRC = document.getElementById('simRC');
    if (simRC) simRC.addEventListener('change', e => {
      const rcObj = ROOT_CAUSES.find(x => x.code === e.target.value);
      const el = document.getElementById('rcAutoBucket');
      if (el) el.innerHTML = `Col Y Auto-Accountability (ARRAYFORMULA): <b>${rcObj ? `${esc(rcObj.bucket)} (${esc(rcObj.cat)})` : 'Select RC to auto-derive'}</b>`;
    });

    const simBtn = document.getElementById('applySheetSimBtn');
    if (simBtn) simBtn.addEventListener('click', () => {
      const st = document.getElementById('simStatus').value;
      const rc = document.getElementById('simRC').value;
      const sum = document.getElementById('simSummary').value.trim();
      if (st === 'Resolved' && (!rc || sum.length < 20)) {
        document.getElementById('gateMsg').innerHTML = `<span style="color:var(--warn);font-weight:650">${ic('alert', 'sm')} Hard Closure Gate Blocked: Select Root Cause (Col X: RC-01..RC-64) + enter 20+ char summary.</span>`;
        return;
      }
      if (st === 'Resolved') {
        const rcObj = ROOT_CAUSES.find(x => x.code === rc);
        t.status = 'Resolved'; t.awaitingConfirm = true; t.rcCode = rc; t.accountability = rcObj ? rcObj.bucket : 'To be determined'; t.resolutionSummary = sum;
        pushEvent(t, 'resolved', `${t.owner} Sheet (Gate OK)`, `Resolved (${rc} -> ${t.accountability}): ${sum}`);
        persistTicketUpdate(t.id, { stakeholder_status: 'Resolved', handover_status: 'Accepted', crm_status: 'Resolved - Awaiting Caller Confirm', confirmed_rc_code: rc, derived_accountability: t.accountability, resolution_summary: sum, resolved_at: new Date().toISOString() }, { type: 'STAKEHOLDER_SHEET_SYNC', actor: `${t.owner} Sheet`, note: `Resolved (${rc} -> ${t.accountability}): ${sum}` }).catch(() => {});
        showToast(`Hard Gate passed! Col Y auto-set to "${t.accountability}".`);
      } else {
        t.status = st;
        pushEvent(t, 'sheet', `${t.owner} Sheet`, `Updated Col T to ${st}.`);
        persistTicketUpdate(t.id, { stakeholder_status: st, handover_status: 'Accepted', crm_status: st }, { type: 'STAKEHOLDER_SHEET_SYNC', actor: `${t.owner} Sheet`, note: `Updated Col T to ${st}.` }).catch(() => {});
      }
      renderFollowUpBoard();
    });
  }

  /* ========================================================================
     SHARED VIEW: CALL LOGS (TICKETED + LOG-ONLY NON-TICKETED)
     ======================================================================== */
  function renderCallLogs() {
    const notTickN = CALL_LOGS.filter(l => !l.ticketId).length;
    const tickN = CALL_LOGS.filter(l => !!l.ticketId).length;
    const cbN = CALL_LOGS.filter(l => l.outcome === 'callback' || l.callbackAt).length;
    const dropN = CALL_LOGS.filter(l => l.outcome === 'dropped' || l.outcome === 'no_answer').length;
    const outN = CALL_LOGS.filter(l => l.direction === 'Outgoing').length;

    const rows = CALL_LOGS.filter(l => {
      if (STATE.logFilter === 'not_ticketed') return !l.ticketId;
      if (STATE.logFilter === 'ticketed') return !!l.ticketId;
      if (STATE.logFilter === 'callbacks') return l.outcome === 'callback' || !!l.callbackAt;
      if (STATE.logFilter === 'dropped') return l.outcome === 'dropped' || l.outcome === 'no_answer';
      if (STATE.logFilter === 'outgoing') return l.direction === 'Outgoing';
      return true;
    });

    const canExport = ROLES[STATE.role] && ROLES[STATE.role].canExport;
    document.getElementById('app').innerHTML = `
      <div class="view-head">
        <div>
          <h1>${canActAsSupervisor(STATE.role) ? 'Full Call Log & QA Audit (Ticketed & Log-Only)' : 'Call Logs (Incl. Log-Only)'}</h1>
          <p>Every Incoming &amp; Outgoing IP phone call — including <b>Log-Only (Not Ticketed)</b> FCR inquiries, E-08 Redirects to Merchant, dropped calls, and callbacks.</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${canExport ? `<button class="btn sm" id="exportLogsBtn">${ic('download', 'sm')} Export Call Logs (UTF-8 BOM)</button>` : `<span class="pill mute" title="PRD §8.5 PII Guardrail">${ic('lock', 'sm')} Export Blocked (Agent)</span>`}
          ${canActAsAgent(STATE.role) ? `<button class="btn pri" id="newCallFromLog">${ic('phone', 'sm')} Log Call</button>` : ''}
        </div>
      </div>

      <div class="toolbar">
        <button class="fchip ${STATE.logFilter === 'all' ? 'on' : ''}" data-lf="all">All Calls (${CALL_LOGS.length})</button>
        <button class="fchip ${STATE.logFilter === 'not_ticketed' ? 'live-on' : ''}" data-lf="not_ticketed">${ic('file', 'sm')} Log Only — Not Ticketed (${notTickN})</button>
        <button class="fchip ${STATE.logFilter === 'ticketed' ? 'on' : ''}" data-lf="ticketed">${ic('tag', 'sm')} Ticketed (${tickN})</button>
        <button class="fchip ${STATE.logFilter === 'callbacks' ? 'on' : ''}" data-lf="callbacks">${ic('calendar', 'sm')} Callbacks (${cbN})</button>
        <button class="fchip ${STATE.logFilter === 'dropped' ? 'on' : ''}" data-lf="dropped">${ic('phone-off', 'sm')} Dropped / No Answer (${dropN})</button>
        <button class="fchip ${STATE.logFilter === 'outgoing' ? 'on' : ''}" data-lf="outgoing">${ic('phone-out', 'sm')} Outgoing (${outN})</button>
      </div>

      <section class="panel">
        <div class="tbl-wrap">
          <table class="clean">
            <thead><tr><th>Log ID &amp; Time</th><th>Direction &amp; Outcome</th><th>Caller / Merchant</th><th>Reason / Notes</th><th>Ticket</th><th>Agent</th><th class="r">Action</th></tr></thead>
            <tbody>
              ${rows.map(l => {
                const om = outcomeMeta(l.outcome);
                return `
                  <tr>
                    <td><b class="mono">${esc(l.id)}</b><div class="muted" style="font-size:11.5px">${fmtStamp(l.startedAt)} · ${mmss(l.durationSec)}</div></td>
                    <td><span class="pill ${l.direction === 'Outgoing' ? 'purple' : 'mute'}">${l.direction === 'Outgoing' ? ic('phone-out', 'sm') + ' Outgoing' : ic('phone-in', 'sm') + ' Incoming'}</span><div style="margin-top:4px"><span class="pill ${om.pill}">${esc(om.label)}</span></div></td>
                    <td><b>${esc(l.callerName)}</b><div class="mono muted" style="font-size:11.5px">${esc(l.phone)}</div><span class="muted" style="font-size:11px">${esc(l.callerType)} · ${esc(l.sentiment)}</span></td>
                    <td style="max-width:340px"><div style="font-weight:600;font-size:12.5px">${esc(l.reasonName)}</div><div class="sub" style="font-size:12px">${esc(l.note)}</div>${l.callbackAt ? `<div style="margin-top:4px;font-size:11.5px;color:var(--warn);font-weight:600">${ic('calendar', 'sm')} Callback: ${fmtStamp(l.callbackAt)} (${esc(l.callbackStatus)})</div>` : ''}</td>
                    <td>${l.ticketId ? `<button class="btn xs soft mono" data-open-tick="${l.ticketId}">${ic('tag', 'sm')} ${esc(l.ticketId)}</button>` : `<span class="pill mute">Log Only · No Ticket</span>`}</td>
                    <td>${esc(l.agent)}</td>
                    <td class="r">${l.callbackStatus && l.callbackStatus !== 'Completed' ? `<button class="btn xs pri" data-cb-dial="${l.id}">${ic('phone-out', 'sm')} Call Back</button>` : `<span class="muted" style="font-size:11.5px">Recorded</span>`}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;

    const nc = document.getElementById('newCallFromLog');
    if (nc) nc.addEventListener('click', () => { STATE.tab = 'desk'; render(); });
    const expLogs = document.getElementById('exportLogsBtn');
    if (expLogs) expLogs.addEventListener('click', () => {
      exportCSVWithBOM(
        'carrybee_inboundiq_call_logs.csv',
        ['Log ID', 'Started At', 'Duration', 'Direction', 'Outcome', 'Caller', 'Phone', 'Caller Type', 'Reason', 'Ticket ID', 'Sentiment', 'Agent', 'Note'],
        rows.map(l => [l.id, fmtStamp(l.startedAt), mmss(l.durationSec), l.direction, outcomeMeta(l.outcome).label, l.callerName, l.phone, l.callerType, l.reasonName, l.ticketId || 'LOG-ONLY', l.sentiment, l.agent, l.note]),
        'Call Interaction Ledger'
      );
    });
    document.querySelectorAll('[data-lf]').forEach(b => b.addEventListener('click', () => { STATE.logFilter = b.dataset.lf; renderCallLogs(); }));
    document.querySelectorAll('[data-cb-dial]').forEach(b => b.addEventListener('click', () => startOutgoingCallback(b.dataset.cbDial)));
    document.querySelectorAll('[data-open-tick]').forEach(b => b.addEventListener('click', () => { STATE.selectedIssueId = b.dataset.openTick; STATE.tab = 'followups'; render(); }));
  }

  /* ========================================================================
     SHARED VIEW: UNIFIED ACTIVITY STREAM / SUPERVISOR LOG-ONLY LIVE DESK ACTIVITY
     ======================================================================== */
  function renderActivityStream() {
    const isSup = canActAsSupervisor(STATE.role);
    const ticketRems = ISSUES.filter(t => t.status !== 'Closed' && (t.reminderAt || t.awaitingConfirm));
    const cbs = pendingCallbacks();
    const logOnlyEvents = CALL_LOGS.filter(l => !l.ticketId).map(l => ({
      issueId: l.id, caller: l.callerName, kind: l.outcome === 'dropped' ? 'chase' : 'call',
      by: l.agent, at: l.startedAt,
      text: `[Log-Only · ${l.direction} · ${outcomeMeta(l.outcome).label}] ${l.reasonName} — ${l.note}`
    }));

    const baseFeed = (isSup && STATE.streamFilter === 'log_only')
      ? logOnlyEvents
      : GLOBAL_FEED.filter(ev => {
          if (STATE.streamFilter === 'log_only') return ev.issueId.startsWith('CL-') || /Log Only/i.test(ev.text);
          if (STATE.streamFilter === 'all') return true;
          if (STATE.streamFilter === 'chase') return ev.kind === 'chase' || ev.kind === 'reopen' || ev.kind === 'reminder';
          if (STATE.streamFilter === 'ops') return ev.kind === 'ops' || ev.kind === 'sheet' || ev.kind === 'push';
          if (STATE.streamFilter === 'done') return ev.kind === 'resolved' || ev.kind === 'closed';
          return true;
        });

    const iconFor = k => ic({ call:'phone', push:'send', raise:'flag', ops:'radio', sheet:'table', chase:'zap', reminder:'clock', resolved:'check-circle', closed:'check', reopen:'repeat', note:'edit' }[k] || 'hex');

    document.getElementById('app').innerHTML = `
      <div class="view-head">
        <div>
          <h1>${isSup ? 'Log-Only Live Desk Activity' : 'Activity Stream & Upcoming Reminders'}</h1>
          <p>${isSup ? 'Real-time floor monitor of non-ticketed (Log-Only) FCR calls, dropped/no-answer attempts, and live desk interactions.' : 'Chronological pulse of every call, non-ticketed log, escalation, sheet sync, chase, and callback reminder.'}</p>
        </div>
        <div class="seg-ctl" id="sfCtl">
          <button data-sf="log_only" class="${STATE.streamFilter === 'log_only' ? 'on' : ''}">Log-Only (${logOnlyEvents.length})</button>
          <button data-sf="all" class="${STATE.streamFilter === 'all' ? 'on' : ''}">All Activity</button>
          <button data-sf="chase" class="${STATE.streamFilter === 'chase' ? 'on' : ''}">Chases &amp; Callbacks</button>
          <button data-sf="ops" class="${STATE.streamFilter === 'ops' ? 'on' : ''}">Ops &amp; Sheet Syncs</button>
          <button data-sf="done" class="${STATE.streamFilter === 'done' ? 'on' : ''}">Resolutions</button>
        </div>
      </div>

      <div class="stream-grid">
        <aside class="panel sticky">
          <div class="panel-pad">
            <div class="eyebrow" style="display:flex;justify-content:space-between;margin-bottom:11px">
              <span>Due Callbacks &amp; Reminders</span>
              <span class="pill live">${cbs.length + ticketRems.length} Active</span>
            </div>
            ${cbs.map(cb => `
              <div class="rem-card ${cb.callbackAt <= nowDyn() ? 'due' : ''}">
                <div style="display:flex;justify-content:space-between;gap:6px"><b style="font-size:12.5px">${ic('calendar', 'sm')} ${esc(cb.callerName)}</b><span class="pill warn">${fmtTimeAMPM(cb.callbackAt)}</span></div>
                <div class="muted" style="font-size:11.5px;margin:2px 0 6px">${esc(cb.note.slice(0, 65))}</div>
                <button class="btn xs pri" data-cb-dial="${cb.id}">${ic('phone-out', 'sm')} Claim &amp; Call</button>
              </div>
            `).join('')}
            ${ticketRems.map(t => `
              <div class="rem-card ${t.reminderAt && t.reminderAt <= nowDyn() ? 'due' : ''}">
                <div style="display:flex;justify-content:space-between;gap:6px"><b style="font-size:12.5px">${ic('clock', 'sm')} ${esc(t.callerName)}</b><span class="pill mute">${t.reminderAt ? fmtTimeAMPM(t.reminderAt) : 'Now'}</span></div>
                <div class="muted" style="font-size:11.5px;margin:2px 0 6px">${esc(t.id)} · ${esc(t.reminderNote || 'Confirm resolution')}</div>
                <button class="btn xs soft" data-open-tick="${t.id}">Open Timeline →</button>
              </div>
            `).join('')}
          </div>
        </aside>

        <section class="panel">
          <div style="padding:13px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between">
            <span class="eyebrow">${STATE.streamFilter === 'log_only' ? 'Log-Only Desk Stream' : 'Chronological Feed'} (${baseFeed.length} events)</span>
            <span class="muted" style="font-size:12px">Latest at top · 12-hour AM/PM</span>
          </div>
          ${baseFeed.map(ev => `
            <div class="feed-card">
              <div class="feed-icon">${iconFor(ev.kind)}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <b>${esc(ev.by)}</b><span class="muted" style="font-size:12px">on</span>
                  <span class="mono" style="font-weight:650;color:var(--accent)">${esc(ev.issueId)}</span>
                  <span class="muted" style="font-size:12px">· ${esc(ev.caller)}</span>
                  <span class="muted" style="margin-left:auto;font-size:11.5px">${fmtStamp(ev.at)}</span>
                </div>
                <div style="font-size:13px;color:var(--ink-2);margin-top:3px">${esc(ev.text)}</div>
              </div>
              ${ISSUES.some(x => x.id === ev.issueId) ? `<button class="btn xs" data-open-tick="${ev.issueId}">Inspect</button>` : ''}
            </div>
          `).join('')}
        </section>
      </div>
    `;

    document.querySelectorAll('#sfCtl button').forEach(b => b.addEventListener('click', () => { STATE.streamFilter = b.dataset.sf; renderActivityStream(); }));
    document.querySelectorAll('[data-cb-dial]').forEach(b => b.addEventListener('click', () => startOutgoingCallback(b.dataset.cbDial)));
    document.querySelectorAll('[data-open-tick]').forEach(b => b.addEventListener('click', () => { STATE.selectedIssueId = b.dataset.openTick; STATE.tab = 'followups'; render(); }));
  }

  /* ========================================================================
     SUPERVISOR VIEW: FLOOR COMMAND, SLA RESCUE & QA TAXONOMY HEALTH
     ======================================================================== */
  function computeQAHealth() {
    const logged = CALL_LOGS.filter(l => l.outcome === 'connected' || l.outcome === 'outgoing');
    const denom = Math.max(1, logged.length);
    const otherN = logged.filter(l => l.theme === 'Other').length;
    const overrideN = logged.filter(l => l.overrideUsed).length;
    const weakN = logged.filter(l => l.ticketId && (l.note || '').trim().length < 30).length;
    const otherPct = Number((((otherN + 3) / (denom + 85)) * 100).toFixed(1));
    const mismatchPct = 2.4;
    const weakPct = Number((((weakN + 1) / (denom + 85)) * 100).toFixed(1));
    const overridePct = Number((((overrideN + 2) / (denom + 85)) * 100).toFixed(1));
    return { otherPct, mismatchPct, weakPct, overridePct, otherAlert: otherPct > 5 };
  }

  function renderSupervisorFloor() {
    const overdueCbs = pendingCallbacks().filter(c => c.callbackAt <= nowDyn());
    const droppedCalls = CALL_LOGS.filter(l => l.outcome === 'dropped');
    const reopened = ISSUES.filter(t => t.reopened);
    const breached = ISSUES.filter(t => t.status !== 'Closed' && slaStatus(t).key === 'over' && t.owner !== 'Issue Resolution');
    const awaitingFeedback = ISSUES.filter(t => t.awaitingConfirm || t.status === 'Resolved');
    const qa = computeQAHealth();

    document.getElementById('app').innerHTML = `
      <div class="view-head">
        <div>
          <h1>Supervisor Floor Command &amp; QA Monitor</h1>
          <p>Live floor rescue queue, 1-click Escalation to Issue Resolution, overdue callbacks, E-16 auto-reopens, and Taxonomy QA health as of <b>${fmtTimeAMPM(nowDyn())}</b>.</p>
        </div>
      </div>

      <div class="pulse-strip">
        <div class="pulse-item"><b>${AGENTS.length}</b><span>Agents on shift</span></div>
        <div class="pulse-item"><b style="color:var(--live)">${overdueCbs.length}</b><span>Overdue callbacks now</span></div>
        <div class="pulse-item"><b style="color:var(--warn)">${droppedCalls.length}</b><span>Dropped after answer</span></div>
        <div class="pulse-item"><b style="color:var(--bad)">${reopened.length}</b><span>Active E-16 reopens</span></div>
        <div class="pulse-item"><b style="color:var(--accent)">${awaitingFeedback.length}</b><span>Pending feedback calls</span></div>
      </div>

      <div class="dash-grid">
        <section class="dc s7">
          <h2><span style="display:inline-flex;align-items:center;gap:7px">${ic('shield')} Supervisor Rescue &amp; Escalation Watch</span></h2>
          <div class="subt">Inspect stalled tickets or escalate directly to Issue Resolution (Same-day 6:00 PM SLA)</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead><tr><th>Ref</th><th>Merchant / Caller</th><th>Risk Trigger</th><th>Owner</th><th class="r">Action</th></tr></thead>
              <tbody>
                ${reopened.map(t => `
                  <tr><td class="mono"><b>${esc(t.id)}</b></td><td><b>${esc(t.callerName)}</b><div class="muted" style="font-size:11.5px">${esc(t.reasonName)}</div></td><td><span class="pill bad">E-16 Reopen · Churn</span></td><td>${esc(t.owner)}</td><td class="r"><button class="btn xs pri" data-sup-open="${t.id}">Inspect</button></td></tr>
                `).join('')}
                ${breached.map(t => `
                  <tr><td class="mono"><b>${esc(t.id)}</b></td><td><b>${esc(t.callerName)}</b><div class="muted" style="font-size:11.5px">${esc(t.reasonName)}</div></td><td><span class="pill bad">${esc(slaStatus(t).label)}</span></td><td>${esc(t.owner)}</td><td class="r"><button class="btn xs bad-btn" data-sup-esc="${t.id}">${ic('shield', 'sm')} Escalate to IR</button> <button class="btn xs" data-sup-open="${t.id}">Inspect</button></td></tr>
                `).join('')}
                ${overdueCbs.map(cb => `
                  <tr><td class="mono"><b>${esc(cb.id)}</b></td><td><b>${esc(cb.callerName)}</b><div class="muted" style="font-size:11.5px">${esc(cb.note.slice(0, 50))}…</div></td><td><span class="pill live">Overdue CB (${fmtTimeAMPM(cb.callbackAt)})</span></td><td>${esc(cb.agent)}</td><td class="r"><button class="btn xs warn-btn" data-sup-nudge="${cb.agent}">${ic('zap', 'sm')} Nudge</button></td></tr>
                `).join('')}
                ${awaitingFeedback.map(t => `
                  <tr><td class="mono"><b>${esc(t.id)}</b></td><td><b>${esc(t.callerName)}</b><div class="muted" style="font-size:11.5px">Resolved by ${esc(t.owner)} · Attempt ${t.feedbackAttempts || 0}/3</div></td><td><span class="pill acc">Feedback Pending</span></td><td>Inbound Desk</td><td class="r"><button class="btn xs" data-sup-open="${t.id}">Review</button></td></tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="dc s5">
          <h2><span style="display:inline-flex;align-items:center;gap:7px">${ic('headset')} Shift Agent QA &amp; Taxonomy Health</span></h2>
          <div class="subt">Real-time shift volume, FCR %, QA score &amp; PRD Taxonomy Guardrails</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead><tr><th>Agent</th><th>Status</th><th class="r">Calls</th><th class="r">FCR</th><th class="r">QA</th></tr></thead>
              <tbody>
                ${AGENTS.map(a => `
                  <tr>
                    <td><b>${esc(a.name)}</b><div class="muted" style="font-size:11px">${esc(a.shift)}</div></td>
                    <td><span class="pill ${a.status === 'On Call' ? 'live' : a.status === 'Online' ? 'good' : 'warn'}">${esc(a.status)}</span></td>
                    <td class="r"><b>${CALL_LOGS.filter(l => l.agent === a.name).length + 28}</b></td>
                    <td class="r">${a.fcrPct}%</td>
                    <td class="r"><span class="pill ${a.qaScore >= 90 ? 'good' : 'warn'}">${a.qaScore}%</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="qa-strip">
            <div class="qa-box ${qa.otherAlert ? 'alert' : ''}">
              <small>"Other" Theme %</small>
              <b style="color:${qa.otherAlert ? 'var(--bad)' : 'var(--good)'}">${qa.otherPct}%</b>
              <small>${qa.otherAlert ? 'Alert: >5%' : 'Target ≤5%'}</small>
            </div>
            <div class="qa-box">
              <small>Keyword Mismatch</small>
              <b>${qa.mismatchPct}%</b>
              <small>Target &lt;4%</small>
            </div>
            <div class="qa-box">
              <small>Weak Context &lt;30c</small>
              <b>${qa.weakPct}%</b>
              <small>Guard Active</small>
            </div>
            <div class="qa-box">
              <small>Override (E-14)</small>
              <b>${qa.overridePct}%</b>
              <small>QA Audited</small>
            </div>
          </div>
        </section>
      </div>
    `;

    document.querySelectorAll('[data-sup-open]').forEach(b => b.addEventListener('click', () => { STATE.selectedIssueId = b.dataset.supOpen; STATE.tab = 'followups'; render(); }));
    document.querySelectorAll('[data-sup-esc]').forEach(b => b.addEventListener('click', () => {
      const t = ISSUES.find(x => x.id === b.dataset.supEsc);
      if (!t) return;
      const old = t.owner;
      t.owner = 'Issue Resolution'; t.track = 'B'; t.prio = 'P1'; t.dueAt = sameDay6PM(nowDyn());
      pushEvent(t, 'reopen', 'Mahmudul Hasan (Supervisor)', `Escalated from ${old} → Issue Resolution (Same-day 6:00 PM SLA).`);
      showToast(`${t.id} escalated to Issue Resolution!`);
      renderSupervisorFloor();
    }));
    document.querySelectorAll('[data-sup-nudge]').forEach(b => b.addEventListener('click', () => showToast(`Supervisor nudge sent to ${b.dataset.supNudge}!`)));
  }

  /* ========================================================================
     MANAGEMENT SUITE SHARED HELPERS & DATASETS (UNIFIED CRM + EXEC BI)
     ======================================================================== */
  const CTRL_LABELS = { C: 'CRM-controlled', S: 'Stakeholder-dependent', M: 'Shared', I: 'External input' };
  const MGMT_TOP_REASONS = [
    { name: 'COD payout delay', type: 'Issue', calls: 480, wow: 9, owner: 'Accounts', ctrl: 'S', negPct: 38, rep7d: 31, rc: 'Payment cycle delay (RC-23) · payout failed or on hold (RC-24)' },
    { name: 'Pickup not done / late', type: 'Issue', calls: 410, wow: 14, owner: 'Global Ops', ctrl: 'S', negPct: 41, rep7d: 34, rc: 'Rider shortage in zone (RC-01) · pickup slot missed (RC-03)' },
    { name: 'Seeking KAM / KAM change', type: 'Request', calls: 380, wow: -3, owner: 'Business KAM', ctrl: 'S', negPct: 22, rep7d: 18, rc: 'KAM not reachable (RC-46) · KAM change without handover (RC-49)' },
    { name: 'Delivery delay / not attempted', type: 'Issue', calls: 330, wow: 6, owner: 'Global Ops', ctrl: 'S', negPct: 36, rep7d: 29, rc: 'Delivery not attempted (RC-07) · rider unreachable (RC-08)' },
    { name: 'Parcel status inquiry', type: 'Inquiry', calls: 280, wow: 2, owner: 'Inbound CC (CRM)', ctrl: 'C', negPct: 12, rep7d: 24, rc: 'Status sync or tracking error (RC-41)' },
    { name: 'App / OTP / bulk upload', type: 'Issue', calls: 230, wow: -9, owner: 'Tech & Product', ctrl: 'S', negPct: 27, rep7d: 21, rc: 'OTP or login failure (RC-42) · panel bug (RC-40)' },
    { name: 'Rate / coverage inquiry', type: 'Inquiry', calls: 200, wow: 4, owner: 'Activation', ctrl: 'S', negPct: 8, rep7d: 9, rc: 'Rate policy unclear (RC-54) · service not in area (RC-55)' },
    { name: 'Return processing delay', type: 'Issue', calls: 170, wow: 11, owner: 'Global Ops', ctrl: 'S', negPct: 33, rep7d: 27, rc: 'Processing delay at hub (RC-14)' },
    { name: 'Follow-up on existing ticket', type: 'Request', calls: 150, wow: 17, owner: 'Inbound CC (CRM)', ctrl: 'C', negPct: 44, rep7d: 52, rc: 'Slow resolution (RC-48) · callback missed (RC-47)' },
    { name: 'Rider misconduct', type: 'Issue', calls: 110, wow: 5, owner: 'Global Ops', ctrl: 'S', negPct: 49, rep7d: 14, rc: 'Rider misbehaviour (RC-09)' }
  ];

  const MGMT_STAKEHOLDER_BACKLOG = [
    { team: 'Global Ops', raised: 142, resolved: 118, open: 34, pastSla: 9, over7d: 4, median: '1d 6h' },
    { team: 'Accounts', raised: 96, resolved: 71, open: 27, pastSla: 10, over7d: 6, median: '2d 3h' },
    { team: 'Business KAM', raised: 78, resolved: 69, open: 19, pastSla: 4, over7d: 1, median: '3h 10m' },
    { team: 'Tech & Product', raised: 52, resolved: 44, open: 14, pastSla: 3, over7d: 1, median: '5h 40m' },
    { team: 'Activation', raised: 61, resolved: 49, open: 11, pastSla: 3, over7d: 1, median: '1d 2h' },
    { team: 'Supply & Safety', raised: 44, resolved: 37, open: 9, pastSla: 2, over7d: 0, median: '1d 4h' },
    { team: 'Issue Resolution', raised: 9, resolved: 8, open: 4, pastSla: 0, over7d: 0, median: '4h 30m' }
  ];

  const CHURN_WEIGHTS = {
    T: { label: 'Threat to churn (E-12)', pts: 30 },
    R: { label: 'Recurring complaint', pts: 20 },
    N: { label: 'Negative sentiment x2', pts: 20 },
    U: { label: 'Unresolved past SLA', pts: 15 },
    F: { label: 'Failed contact streak', pts: 10 },
    D: { label: 'Declining engagement', pts: 5 }
  };

  const CHURN_WATCHLIST = [
    {
      name: 'Rahman Fashion', phone: '01755667788', owner: 'Tanvir Ahmed (KAM)', trips: 195, signals: 'TRNU', last: 'Today, 10:20 AM',
      timeline: [
        ['Nov 17, 10:42 AM', 'Issue: COD payout delayed → Accounts · Concerned'],
        ['Nov 18, 4:10 PM', 'Callback attempt — No Answer (1/3)'],
        ['Nov 19, 11:05 AM', 'Connected · Dissatisfied · Mentioned switching courier (E-12)'],
        ['Nov 21, 9:30 AM', 'Follow-up: Ticket still open, SLA breached by 2h 30m'],
        ['Today, 10:20 AM', 'Flagged High-Risk (Score 85) — ready for retention call']
      ]
    },
    {
      name: 'Chattogram Tech Mart', phone: '01812345678', owner: 'Sadia Islam (KAM)', trips: 265, signals: 'TRN', last: 'Today, 10:15 AM',
      timeline: [
        ['Nov 14, 1:20 PM', 'Issue: OTP bypassed / CLOSEBOX policy breach → Global Ops · Concerned'],
        ['Nov 18, 3:45 PM', 'Repeat complaint on same Agrabad Hub rider · Dissatisfied'],
        ['Today, 10:15 AM', 'E-16 Auto-Reopen triggered · Threat to Churn (E-12) flagged']
      ]
    },
    {
      name: 'Urban Gadgets Dhaka', phone: '01711223344', owner: 'Tanvir Ahmed (KAM)', trips: 240, signals: 'RNU', last: 'Today, 10:50 AM',
      timeline: [
        ['Nov 12, 12:15 PM', 'Issue: Delivery delay >48h (OSD) → Global Ops · Concerned'],
        ['Nov 16, 2:40 PM', 'Issue: Pickup missed at Uttara Hub · Dissatisfied'],
        ['Today, 10:50 AM', 'Open ticket CB-21-11-0412 chased; awaiting final delivery scan']
      ]
    },
    {
      name: 'Urban Cart BD', phone: '01911224455', owner: 'Farhana Akter (KAM)', trips: 162, signals: 'RNUF', last: 'Yesterday, 3:05 PM',
      timeline: [
        ['Nov 12, 12:15 PM', 'Issue: Pickup missed → Global Ops · Concerned'],
        ['Nov 16, 2:40 PM', 'Issue: Pickup missed again · Dissatisfied'],
        ['Nov 19, 5:10 PM', 'Callback — No Answer (2/3)'],
        ['Yesterday, 3:05 PM', 'Callback — No Answer (3/3 · Failed-contact streak)']
      ]
    },
    {
      name: 'Tech Bazaar', phone: '01622334455', owner: 'Sadia Islam (KAM)', trips: 138, signals: 'TNF', last: 'Nov 20, 11:30 AM',
      timeline: [
        ['Nov 15, 1:00 PM', 'Issue: Rider misconduct (RC-09) · Dissatisfied'],
        ['Nov 18, 10:50 AM', 'Feedback call — Not Reachable (1/3)'],
        ['Nov 20, 11:30 AM', 'Mentioned switching courier (E-12) · Dissatisfied']
      ]
    },
    {
      name: 'GreenLeaf Organics', phone: '01744556677', owner: 'Complaint Management', trips: 31, signals: 'RUFD', last: 'Nov 16, 4:20 PM',
      timeline: [
        ['Nov 9, 11:10 AM', 'Issue: Parcel status sync mismatch · Neutral'],
        ['Nov 14, 3:00 PM', 'Same issue repeated within 7 days · Concerned'],
        ['Nov 16, 4:20 PM', 'Callback — No Answer (1/3)']
      ]
    },
    {
      name: 'Little Steps Kids', phone: '01833445566', owner: 'Rafiul Islam (KAM)', trips: 84, signals: 'NDF', last: 'Nov 19, 1:15 PM',
      timeline: [
        ['Nov 5, 10:00 AM', 'Contacts declined from 6 to 2 in 30 days'],
        ['Nov 19, 1:15 PM', 'Dissatisfied: Wrong delivery status marked']
      ]
    }
  ].map(m => Object.assign({}, m, {
    score: [...m.signals].reduce((s, c) => s + (CHURN_WEIGHTS[c] ? CHURN_WEIGHTS[c].pts : 0), 0)
  })).sort((a, b) => b.score - a.score);

  function renderCtrlLegend() {
    return `
      <div class="ctrl-legend">
        <span><span class="ctrl-tag cC">CRM-controlled</span> team directly moves it</span>
        <span><span class="ctrl-tag cS">Stakeholder-dependent</span> sits with Ops, Accounts, KAM, Activation, Tech, Supply</span>
        <span><span class="ctrl-tag cM">Shared</span> both influence it</span>
        <span><span class="ctrl-tag cI">External input</span> demand outside team control</span>
      </div>
    `;
  }

  function renderKpiCard(k) {
    const dirCls = k.goodDir == null ? 'muted' : k.goodDir ? 'up' : 'dn';
    return `
      <div class="kpi-card">
        <div class="k-top">
          <div class="kl">${esc(k.label)}</div>
          <span class="ctrl-tag c${k.ctrl}">${CTRL_LABELS[k.ctrl]}</span>
        </div>
        <div class="kv" ${k.color ? `style="color:${k.color}"` : ''}>${esc(k.val)}</div>
        <div class="kd"><span class="dl ${dirCls}">${esc(k.delta)}</span>${k.sub ? `<span class="muted">${esc(k.sub)}</span>` : ''}</div>
        ${k.spark ? sparkSVG(k.spark, k.sparkColor || 'var(--accent)') : ''}
        <details class="kpi-def" ${STATE.mgmtDefsOpen ? 'open' : ''}>
          <summary>${ic('compass', 'sm')} Definition</summary>
          <div class="def-body"><b>Formula:</b> ${esc(k.formula)}<br><b>Source:</b> <span class="mono">${esc(k.source)}</span></div>
        </details>
      </div>
    `;
  }

  function renderVCols(vals, labels, color) {
    const mx = Math.max(...vals, 1);
    return `<div class="vcol-chart">${vals.map((v, i) => `
      <div class="vc">
        <span>${v}${color === 'pct' ? '%' : ''}</span>
        <i style="height:${Math.max(8, Math.round((v / mx) * 76))}px;background:${color === 'pct' ? 'var(--saffron)' : (color || 'var(--accent)')}"></i>
        <div>${esc(labels[i])}</div>
      </div>
    `).join('')}</div>`;
  }

  function bindDefToggle(rerenderFn) {
    const btn = document.getElementById('toggleDefsBtn');
    if (btn) btn.addEventListener('click', () => {
      STATE.mgmtDefsOpen = !STATE.mgmtDefsOpen;
      rerenderFn();
    });
  }

  /* ========================================================================
     MANAGEMENT VIEW 1: UNIFIED EXECUTIVE BI (CONTROLLABILITY + HANDOVER + BENCHMARK)
     ======================================================================== */
  function sparkSVG(vals, color) {
    const w = 130, h = 24, min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="24" style="display:block;margin-top:3px"><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" points="${pts}"/></svg>`;
  }

  function renderMgmtBI() {
    const isWow = STATE.dashPeriod === 'wow';
    const isBench = STATE.benchMode === 'compare';
    const totalCalls = CALL_LOGS.length + (isWow ? 4166 : 16240);
    const connectedN = CALL_LOGS.filter(l => l.outcome === 'connected' || l.outcome === 'outgoing').length + (isWow ? 3412 : 13310);
    const droppedN = CALL_LOGS.filter(l => l.outcome === 'dropped').length + (isWow ? 318 : 1240);
    const cbN = CALL_LOGS.filter(l => l.outcome === 'callback').length + (isWow ? 286 : 1120);
    const noAnsN = CALL_LOGS.filter(l => l.outcome === 'no_answer').length + (isWow ? 436 : 1690);
    const connRate = ((connectedN / totalCalls) * 100).toFixed(1);
    const pendingCbCount = pendingCallbacks().length;
    const confirmCount = ISSUES.filter(t => t.awaitingConfirm || t.status === 'Resolved').length;
    const reopenCount = ISSUES.filter(t => t.reopened).length;
    const qa = computeQAHealth();

    // Negativity attribution by owner team from Top 10 Calling Reasons
    const negByOwner = {};
    let totalNeg = 0;
    MGMT_TOP_REASONS.forEach(r => {
      const n = (r.calls * r.negPct) / 100;
      totalNeg += n;
      negByOwner[r.owner] = (negByOwner[r.owner] || 0) + n;
    });
    const negOwnerList = Object.entries(negByOwner).sort((a, b) => b[1] - a[1]);
    const negShareOf = team => negByOwner[team] ? `${Math.round((negByOwner[team] / totalNeg) * 100)}%` : '—';

    const labels = isWow ? ['Sat','Sun','Mon','Tue','Wed','Thu','Today'] : ['W1','W2','W3','W4','W5','MTD'];
    const curTrend = isWow ? [542, 588, 634, 612, 628, 576, 412 + CALL_LOGS.length] : [3420, 3680, 3890, 4050, 4120, 4176];
    const prevTrend = isBench
      ? (isWow ? [210, 228, 254, 240, 248, 224, 186] : [1410, 1520, 1610, 1680, 1705, 1740])
      : (isWow ? [498, 540, 582, 574, 590, 546, 384] : [3180, 3390, 3560, 3710, 3840, 3910]);

    const gaps = [
      { code: 'W-1/W-2', sev: 'crit', title: 'OSD Sheet Row 2211 Cap', stat: `${OVERFLOW_LOG.length} bypassed`, note: 'Direct Supabase MX read-through active — zero lost rows.' },
      { code: 'G-02', sev: 'high', title: 'Pending Feedback Calls', stat: `${confirmCount} waiting`, note: 'Resolved tickets awaiting caller confirmation (1/3–3/3).' },
      { code: 'E-16', sev: 'crit', title: '7-Day Reopened Tickets', stat: `${reopenCount} active`, note: 'Auto-escalated to Supervisor & Issue Resolution.' },
      { code: 'G-08', sev: 'high', title: 'KAM Master Coverage', stat: `${KAM_DIRECTORY.length} KAM / ${BUSINESS_FALLBACK.length} Fallback`, note: 'Strict 5-Col KAM Master lookup with Complaint Mgmt fallback.' },
      { code: 'G-09', sev: 'ok', title: '64-RC Hard Closure Gate', stat: '100% enforced', note: 'No Track B ticket closes without RC-01..64 + 20c summary.' }
    ];

    const execKpis = [
      { label: 'Leads Received', val: isWow ? '486' : '1,914', delta: '▲ 8.4%', goodDir: null, ctrl: 'I', sub: 'Potential + Sales/KAM', spark: [64,70,74,82,78,84,86], sparkColor: 'var(--ink-3)', formula: 'COUNT(leads) with received_at in period (Potential Merchant or M#33/38/39/43)', source: 'call_logs + crm_leads (received_at)' },
      { label: 'Lead → Handover Rate', val: '90.9%', delta: '▲ 1.5 pts', goodDir: true, ctrl: 'C', sub: '261 ÷ 287 qualified', spark: [87,88,88.5,89,89.4,90.2,90.9], sparkColor: 'var(--good)', formula: 'Handed over ÷ qualified leads (CRM scope ends at stakeholder handover)', source: 'crm_leads (handed_over_at, handover_status)' },
      { label: 'Unique Merchants Engaged', val: isWow ? '1,284' : '3,840', delta: '▲ 6.2%', goodDir: null, ctrl: 'M', sub: 'Avg 2.4 touches', spark: [1090,1130,1165,1195,1220,1255,1284], sparkColor: 'var(--accent)', formula: 'COUNT(DISTINCT merchant_id) with >=1 logged interaction in period', source: 'call_logs.merchant_id' },
      { label: 'Call Connection Rate', val: `${connRate}%`, delta: '▲ 2.8 pts', goodDir: true, ctrl: 'M', sub: `${droppedN} drop · ${noAnsN} no-ans`, spark: [77,78,79,80,80.5,81,81.9], sparkColor: 'var(--good)', formula: 'Connected calls ÷ (Connected + Dropped + No Answer)', source: 'call_logs.outcome' },
      { label: 'Follow-Up Commitment', val: '85.6%', delta: '▼ 1.4 pts', goodDir: false, ctrl: 'C', sub: `${pendingCbCount} live callbacks`, spark: [89,88.5,88,87.4,87,86.2,85.6], sparkColor: 'var(--saffron)', formula: 'Follow-ups completed on time ÷ total follow-ups completed (333 ÷ 389)', source: 'callbacks + issue_reminders' },
      { label: 'High-Risk Merchants (≥70)', val: '23', delta: '▲ 4', goodDir: false, ctrl: 'M', color: 'var(--bad)', sub: 'Rule-based churn score', spark: [16,17,18,19,20,21,23], sparkColor: 'var(--bad)', formula: 'Merchants with rule-based churn risk score >= 70 (E-12 + repeats + SLA + sentiment)', source: 'Derived from CRM signals' }
    ];

    document.getElementById('app').innerHTML = `
      <div class="view-head">
        <div>
          <h1>Management Intelligence — Executive Business Pulse</h1>
          <p>CRM scope: lead intake → qualification → follow-up → stakeholder handover · Sat–Thu week · 12-hour AM/PM as of <b>${fmtTimeAMPM(nowDyn())}</b>.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button type="button" class="btn sm" id="toggleDefsBtn">${ic('compass', 'sm')} ${STATE.mgmtDefsOpen ? 'Collapse Definitions' : 'Expand All Definitions'}</button>
          <div class="seg-ctl" id="benchCtl">
            <button data-b="mx" class="${!isBench ? 'on' : ''}">MX Inbound Only</button>
            <button data-b="compare" class="${isBench ? 'on' : ''}">${ic('scale', 'sm')} Compare MX vs KAM</button>
          </div>
          <div class="seg-ctl" id="dashPeriodCtl">
            <button data-p="wow" class="${isWow ? 'on' : ''}">Week on Week</button>
            <button data-p="mom" class="${!isWow ? 'on' : ''}">Month on Month</button>
          </div>
        </div>
      </div>

      ${renderCtrlLegend()}

      <!-- Headline Executive Diagnosis -->
      <div class="ins-block" style="margin-bottom:14px">
        <b class="ih">${ic('target', 'sm')} What's Happening and Why</b>
        <p><b>69% of negative-sentiment calls trace to Global Operations and Accounts</b>, which hold 61 of the 118 open issues — so Inbound CRM hands over <b>90.9%</b> of qualified leads cleanly yet cannot lift merchant sentiment without Ops &amp; Accounts SLA recovery.</p>
      </div>

      <div class="kpi-grid">
        ${execKpis.map(renderKpiCard).join('')}
      </div>

      ${isBench ? `
        <div class="g-map-banner" style="margin-bottom:14px">
          <b>${ic('scale', 'sm')} Global Tracker Benchmark — MX (Inbound CC) vs KAM (Business Team) Read-Only Comparison:</b>
          <span>MX SLA Compliance: <b>88.4%</b> (Avg 1.8d)</span> ·
          <span>KAM SLA Compliance: <b>84.1%</b> (Avg 2.3d)</span> ·
          <span>MX Reopen Rate: <b>4.2%</b> vs KAM <b>6.8%</b></span> ·
          <span>Dashed trend line now displays <b>Business KAM</b> escalations.</span>
        </div>
      ` : ''}

      <div class="dash-grid">
        <!-- Lead Intake & Handover Funnel (CRM Scope vs Stakeholder Acceptance) -->
        <section class="dc s5">
          <h2>Lead Intake &amp; Stakeholder Handover Funnel <span class="ctrl-tag cC">CRM → Handover</span></h2>
          <div class="subt">Everything up to "Handed Over" (90.9%) is CRM-controlled; saffron bar = stakeholder acceptance (75.9%)</div>
          ${[
            ['1 · Received', 486, 'var(--accent)', '100%'],
            ['2 · Processed', 441, 'var(--accent)', '90.7%'],
            ['3 · Qualified', 287, 'var(--accent)', '65.1%'],
            ['4 · Handed Over (CRM Scope)', 261, 'var(--good)', '90.9%'],
            ['5 · Accepted by Stakeholder', 198, 'var(--saffron)', '75.9%']
          ].map(([lbl, cnt, col, pct]) => `
            <div class="hbar-row" style="grid-template-columns:185px minmax(0,1fr) 82px">
              <span>${lbl}</span>
              <div class="hbar-track"><i style="width:${(cnt / 486 * 100).toFixed(1)}%;background:${col}"></i></div>
              <b class="num" style="text-align:right">${cnt} <span class="muted" style="font-weight:400">(${pct})</span></b>
            </div>
          `).join('')}
          <div style="margin-top:10px;padding:9px 11px;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);font-size:12px;color:var(--ink-2)">
            <b>CRM Scope Boundary:</b> 63 qualified leads are waiting on Activation / KAM acceptance (oldest: Activation, 9h).
          </div>
        </section>

        <!-- Interactive Hover Trend Chart (with MX vs KAM Benchmark) -->
        <section class="dc s7">
          <h2>${isBench ? 'Global Escalations Benchmark: MX (Inbound) vs KAM (Business)' : `Engagement &amp; Call Trend (${isWow ? 'This Week vs Last Week' : 'MTD vs Last Month'})`}</h2>
          <div class="subt">Hover chart for exact comparison · Solid line = ${isBench ? 'MX Inbound CC' : 'Current'} · Dashed gray = ${isBench ? 'Business KAM' : 'Previous'}</div>
          <div class="chart-wrap" id="trendWrap"></div>
        </section>

        <!-- Where Negative-Sentiment Calls Come From (By Owner Team) + 5-Outcome Split -->
        <section class="dc s5">
          <h2>Where Negative-Sentiment Calls Come From <span class="ctrl-tag cS">Owner Attribution</span></h2>
          <div class="subt">Teal = CRM-owned · Saffron = external stakeholder team (${Math.round(totalNeg)} negative calls this week)</div>
          ${negOwnerList.map(([own, cnt]) => {
            const pct = Math.round((cnt / totalNeg) * 100);
            const isCrm = own.includes('CRM');
            return `
              <div class="hbar-row" style="grid-template-columns:145px minmax(0,1fr) 54px">
                <span>${esc(own)}</span>
                <div class="hbar-track"><i style="width:${(cnt / negOwnerList[0][1] * 100).toFixed(1)}%;background:${isCrm ? 'var(--good)' : 'var(--saffron)'}"></i></div>
                <b class="num" style="text-align:right">${pct}%</b>
              </div>
            `;
          }).join('')}

          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line-2)">
            <div class="eyebrow" style="margin-bottom:7px">5-Outcome Call Split (74% In / 26% Out · 56% Ticketed / 44% Log-Only)</div>
            <div class="stackbar" style="margin-bottom:8px">
              <i style="width:${(connectedN/totalCalls*100).toFixed(1)}%;background:var(--good)"></i>
              <i style="width:${(cbN/totalCalls*100).toFixed(1)}%;background:var(--gold)"></i>
              <i style="width:${(droppedN/totalCalls*100).toFixed(1)}%;background:var(--saffron)"></i>
              <i style="width:${(noAnsN/totalCalls*100).toFixed(1)}%;background:var(--ink-4)"></i>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px;color:var(--ink-2)">
              <span>Connected <b>${(connectedN/totalCalls*100).toFixed(0)}%</b></span>
              <span>Callback <b>${(cbN/totalCalls*100).toFixed(0)}%</b></span>
              <span>Dropped <b>${(droppedN/totalCalls*100).toFixed(0)}%</b></span>
              <span>No Answer <b>${(noAnsN/totalCalls*100).toFixed(0)}%</b></span>
            </div>
          </div>
        </section>

        <!-- Stakeholder Backlog & Resolve Rate (Other Teams' Dependency) -->
        <section class="dc s7">
          <h2>Stakeholder Backlog &amp; Resolve Rate (This Week) <span class="ctrl-tag cS">Stakeholder-dependent</span></h2>
          <div class="subt">118 open issues across Track A &amp; Track B (31 past SLA · 13 older than 7 days)</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead><tr><th>Owner Team</th><th class="r">Raised</th><th class="r">Resolved</th><th class="r">Resolve %</th><th class="r">Open</th><th class="r">Past SLA</th><th class="r">&gt;7d</th><th class="r">Median</th><th class="r">% Neg Calls</th></tr></thead>
              <tbody>
                ${MGMT_STAKEHOLDER_BACKLOG.map(b => {
                  const rr = Math.round((b.resolved / b.raised) * 100);
                  return `
                    <tr>
                      <td><b>${esc(b.team)}</b></td>
                      <td class="r">${b.raised}</td>
                      <td class="r">${b.resolved}</td>
                      <td class="r"><span class="pill ${rr >= 85 ? 'good' : rr >= 78 ? 'warn' : 'bad'}">${rr}%</span></td>
                      <td class="r"><b>${b.open}</b></td>
                      <td class="r">${b.pastSla ? `<b style="color:var(--bad)">${b.pastSla}</b>` : '0'}</td>
                      <td class="r">${b.over7d ? `<b style="color:var(--bad)">${b.over7d}</b>` : '0'}</td>
                      <td class="r muted">${esc(b.median)}</td>
                      <td class="r"><b>${negShareOf(b.team)}</b></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Top 10 Calling Reasons (Connected Calls: 3,420) -->
        <section class="dc s8">
          <h2>Top 10 Calling Reasons (Connected Calls: 3,420)</h2>
          <div class="subt">Top 10 cover ${(MGMT_TOP_REASONS.reduce((a, r) => a + r.calls, 0) / 3420 * 100).toFixed(1)}% of connected volume · Source: call_logs.reason_id</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead><tr><th>#</th><th>Contact Reason</th><th>Type</th><th class="r">Calls</th><th class="r">Share</th><th class="r">WoW</th><th>Owner &amp; Control</th></tr></thead>
              <tbody>
                ${MGMT_TOP_REASONS.map((r, i) => `
                  <tr>
                    <td class="muted">${i + 1}</td>
                    <td><b>${esc(r.name)}</b></td>
                    <td><span class="pill mute">${esc(r.type)}</span></td>
                    <td class="r"><b>${r.calls}</b></td>
                    <td class="r muted">${(r.calls / 3420 * 100).toFixed(1)}%</td>
                    <td class="r"><span class="dl ${r.wow > 0 ? 'dn' : 'up'}">${r.wow > 0 ? '▲' : '▼'} ${Math.abs(r.wow)}%</span></td>
                    <td>${esc(r.owner)} <span class="ctrl-tag c${r.ctrl}">${r.ctrl === 'C' ? 'CRM' : 'Stakeholder'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Theme Movers (Rising vs Falling) -->
        <section class="dc s4">
          <h2>Theme Movers (Rising vs Falling)</h2>
          <div class="subt">Biggest period-over-period shifts in merchant friction</div>
          <div class="mover-row"><span><b>Follow-Up on Open Ticket</b><div class="muted" style="font-size:11px">128 → 150 calls · CRM-owned</div></span><span class="dl dn">+17% ▲</span></div>
          <div class="mover-row"><span><b>Pickup Not Done / Late</b><div class="muted" style="font-size:11px">360 → 410 calls · Global Ops</div></span><span class="dl dn">+14% ▲</span></div>
          <div class="mover-row"><span><b>Return Processing Delay</b><div class="muted" style="font-size:11px">153 → 170 calls · Global Ops</div></span><span class="dl dn">+11% ▲</span></div>
          <div class="mover-row"><span><b>COD Payout Delay</b><div class="muted" style="font-size:11px">440 → 480 calls · Accounts</div></span><span class="dl dn">+9% ▲</span></div>
          <div class="mover-row"><span><b>App / OTP / Bulk Upload</b><div class="muted" style="font-size:11px">253 → 230 calls · Tech</span></span><span class="dl up">-9% ▼</span></div>
          <div class="mover-row"><span><b>Seeking / Changing KAM</b><div class="muted" style="font-size:11px">392 → 380 calls · KAM</span></span><span class="dl up">-3% ▼</span></div>
        </section>

        <!-- Exact 5-Bucket Accountability Pareto (PRD v3.2 / 8_Root_Cause) + QA Health -->
        <section class="dc s6">
          <h2>5-Bucket Accountability Pareto (Col Y · RC-01..RC-64)</h2>
          <div class="subt">Exact 5 auto-derived Taxonomy v4 accountability buckets + QA Taxonomy Guardrails</div>
          ${[
            ['Carrybee - Internal (RC-01..27, 40..58)', 64, 'var(--t-global)'],
            ['Merchant (RC-28..34)', 14, 'var(--t-kam)'],
            ['Customer (RC-35..39)', 12, 'var(--t-act)'],
            ['External (RC-59..61)', 6, 'var(--t-sup)'],
            ['To be determined (RC-62..64)', 4, 'var(--ink-4)']
          ].map(([lbl, pct, col]) => `
            <div class="hbar-row" style="grid-template-columns:235px minmax(0,1fr) 48px">
              <span>${lbl}</span>
              <div class="hbar-track"><i style="width:${pct}%;background:${col}"></i></div>
              <b class="num" style="text-align:right">${pct}%</b>
            </div>
          `).join('')}

          <div class="qa-strip">
            <div class="qa-box ${qa.otherAlert ? 'alert' : ''}">
              <small>"Other" Theme %</small>
              <b style="color:${qa.otherAlert ? 'var(--bad)' : 'var(--good)'}">${qa.otherPct}%</b>
              <small>${qa.otherAlert ? 'Alert: >5%' : '≤5% OK'}</small>
            </div>
            <div class="qa-box"><small>Keyword Mismatch</small><b>${qa.mismatchPct}%</b><small>QA Audit</small></div>
            <div class="qa-box"><small>Weak Context &lt;30c</small><b>${qa.weakPct}%</b><small>Enforced</small></div>
            <div class="qa-box"><small>Override (E-14)</small><b>${qa.overridePct}%</b><small>Logged</small></div>
          </div>
        </section>

        <!-- 5 Operational Gap Monitors -->
        <section class="dc s6">
          <h2>Operational Gap &amp; Resilience Safeguards</h2>
          <div class="subt">Live PRD v3.2 resilience &amp; governance monitors (W-1..W-5)</div>
          <div class="gap-grid">
            ${gaps.map(g => `
              <div class="gap-card ${g.sev}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                  <span class="mono" style="font-weight:700">${g.code}</span>
                  <span class="pill ${g.sev === 'crit' ? 'bad' : g.sev === 'high' ? 'warn' : 'good'}">${g.stat}</span>
                </div>
                <div style="font-weight:650;font-size:12.5px">${g.title}</div>
                <div class="muted" style="font-size:11.5px;margin-top:2px">${g.note}</div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;

    const tw = document.getElementById('trendWrap');
    drawInteractiveTrend(tw, curTrend, prevTrend, labels);
    bindDefToggle(renderMgmtBI);
    document.querySelectorAll('#dashPeriodCtl button').forEach(b => b.addEventListener('click', () => { STATE.dashPeriod = b.dataset.p; renderMgmtBI(); }));
    document.querySelectorAll('#benchCtl button').forEach(b => b.addEventListener('click', () => { STATE.benchMode = b.dataset.b; renderMgmtBI(); }));
  }

  function drawInteractiveTrend(container, cur, prev, labels) {
    const w = 620, h = 210, padL = 38, padR = 16, padT = 16, padB = 28;
    const pw = w - padL - padR, ph = h - padT - padB;
    const max = Math.ceil(Math.max(...cur, ...prev) / 50) * 50;
    const xAt = i => padL + (i / (labels.length - 1)) * pw;
    const yAt = v => padT + ph - (v / max) * ph;
    const lineOf = arr => arr.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
    const areaOf = `${padL},${padT + ph} ${lineOf(cur)} ${xAt(cur.length - 1)},${padT + ph}`;
    const ticks = [0, Math.round(max * 0.5), max];

    container.innerHTML = `
      <svg id="trendSvg" viewBox="0 0 ${w} ${h}" width="100%" style="display:block;max-height:220px;cursor:crosshair">
        ${ticks.map(t => `<line x1="${padL}" x2="${w - padR}" y1="${yAt(t)}" y2="${yAt(t)}" stroke="var(--line)" stroke-dasharray="3,3"/><text x="${padL - 8}" y="${yAt(t) + 4}" text-anchor="end" fill="var(--ink-3)" font-size="10.5">${t}</text>`).join('')}
        <polygon points="${areaOf}" fill="var(--accent)" opacity="0.09"/>
        <polyline fill="none" stroke="var(--ink-4)" stroke-width="2" stroke-dasharray="5,4" points="${lineOf(prev)}"/>
        <polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${lineOf(cur)}"/>
        <line id="tCross" x1="0" x2="0" y1="${padT}" y2="${padT + ph}" stroke="var(--accent)" stroke-dasharray="3,3" visibility="hidden"/>
        ${cur.map((v, i) => {
          const cx = xAt(i), cy = yAt(v), r = 4.6;
          const hp = [0,1,2,3,4,5].map(k => {
            const a = (Math.PI / 3) * k - Math.PI / 2;
            return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
          }).join(' ');
          return `<polygon points="${hp}" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/><text x="${cx}" y="${h - 8}" text-anchor="middle" fill="var(--ink-3)" font-size="10.5">${labels[i]}</text>`;
        }).join('')}
      </svg>
      <div class="chart-tip" id="trendTip" hidden></div>
    `;

    const svg = document.getElementById('trendSvg');
    const tip = document.getElementById('trendTip');
    const cross = document.getElementById('tCross');
    svg.addEventListener('mousemove', e => {
      const r = svg.getBoundingClientRect();
      const relX = ((e.clientX - r.left) / r.width) * w;
      const idx = Math.max(0, Math.min(cur.length - 1, Math.round(((relX - padL) / pw) * (cur.length - 1))));
      cross.setAttribute('x1', xAt(idx));
      cross.setAttribute('x2', xAt(idx));
      cross.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = `<b>${labels[idx]}</b> · Current: <b>${cur[idx]}</b> · Compare: ${prev[idx]}`;
      tip.style.left = Math.min(r.width - 170, Math.max(8, ((xAt(idx) / w) * r.width) + 10)) + 'px';
      tip.style.top = '12px';
    });
    svg.addEventListener('mouseleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
  }

  /* ========================================================================
     MANAGEMENT VIEW 2: MERCHANT HEALTH, CHURN SCORE & RELATIONSHIP TIMELINE
     ======================================================================== */
  function renderMgmtHealth() {
    CHURN_WATCHLIST.forEach(m => { m.score = computeChurnScore(m); });
    const selIdx = Math.min(STATE.selectedWatchIdx, CHURN_WATCHLIST.length - 1);
    const selM = CHURN_WATCHLIST[selIdx];
    const totalNeg = MGMT_TOP_REASONS.reduce((s, r) => s + (r.calls * r.negPct) / 100, 0);
    const negDrivers = MGMT_TOP_REASONS.map(r => ({
      name: r.name, neg: (r.calls * r.negPct) / 100, isCrm: r.ctrl === 'C'
    })).sort((a, b) => b.neg - a.neg);

    const healthKpis = [
      { label: 'Engaged Merchants (30d)', val: '1,284', delta: '▲ 6.2%', goodDir: null, ctrl: 'M', formula: 'DISTINCT merchants with >=1 logged interaction in last 30 days', source: 'call_logs.merchant_id' },
      { label: 'Avg Contacts / Merchant', val: '2.4', delta: '▲ 0.2', goodDir: null, ctrl: 'M', sub: 'Rising + issues = friction', formula: 'Interactions ÷ engaged merchants', source: 'call_logs' },
      { label: 'Silent Merchants', val: '74', delta: '▲ 9', goodDir: false, ctrl: 'M', formula: 'Merchants with >=2 contacts in prior 30d and 0 in last 30d', source: 'call_logs + KAM Master' },
      { label: 'Declining Engagement', val: '63', delta: '▲ 11', goodDir: false, ctrl: 'M', formula: 'Contacts fell >=50% vs prior 30d (prior >=4)', source: 'call_logs' },
      { label: 'Failed-Contact Streak', val: '29', delta: '▲ 6', goodDir: false, ctrl: 'C', formula: '>=3 No Answer / Dropped attempts in 7d and 0 Connected', source: 'call_logs.outcome' },
      { label: 'Recurring Complaints', val: '41', delta: '▲ 5', goodDir: false, ctrl: 'S', formula: 'Same Contact Reason raised >=3 times in 30 days', source: 'crm_tickets.reason_id' },
      { label: 'Unresolved Past SLA', val: '31 of 118', delta: '▲ 7', goodDir: false, ctrl: 'S', formula: 'Open tickets past due_at ÷ all open tickets', source: 'crm_tickets + sheets' },
      { label: 'Negative Sentiment Share', val: '25%', delta: '▲ 3.1 pts', goodDir: false, ctrl: 'M', formula: '(Concerned + Dissatisfied) ÷ interactions with sentiment', source: 'call_logs.merchant_sentiment' },
      { label: 'Threat-to-Churn (E-12)', val: '17', delta: '▲ 5', goodDir: false, ctrl: 'M', color: 'var(--bad)', formula: 'Interactions with E-12 Threat to Churn flag in period', source: 'call_logs.threat_to_churn' },
      { label: 'High-Risk (Score ≥ 70)', val: '23', delta: '▲ 4', goodDir: false, ctrl: 'M', color: 'var(--bad)', formula: 'Rule-based churn risk score (0–100) >= 70', source: 'Derived from CRM signals' },
      { label: 'Recovered Merchants', val: '37', delta: '▲ 6', goodDir: true, ctrl: 'M', color: 'var(--good)', formula: 'Negative sentiment -> Solved feedback call -> Neutral/Positive', source: 'feedback_calls + sentiment' }
    ];

    document.getElementById('app').innerHTML = `
      <div class="view-head">
        <div>
          <h1>Merchant Health, Churn Risk Score &amp; Relationship Watchlist</h1>
          <p>Rule-based churn risk scoring (0–100), root-cause negativity drivers, ageing, and 1-click retention callbacks into the Agent Queue.</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button type="button" class="btn sm" id="exportWatchlistBtn">${ic('download', 'sm')} Export Watchlist (UTF-8 BOM)</button>
          <button type="button" class="btn sm" id="toggleDefsBtn">${ic('compass', 'sm')} ${STATE.mgmtDefsOpen ? 'Collapse Definitions' : 'Expand All Definitions'}</button>
        </div>
      </div>

      ${renderCtrlLegend()}

      <div class="kpi-grid">
        ${healthKpis.map(renderKpiCard).join('')}
      </div>

      <div class="muted" style="font-size:12px;margin:-6px 0 14px">
        <b>Tunable Churn Risk Score (0–100, pure recorded signals — no black-box model):</b>
        ${Object.values(CHURN_WEIGHTS).map(w => `${w.label} <b>+${w.pts}</b>`).join(' · ')}
      </div>

      <!-- Watchlist + Clickable Merchant Relationship Timeline -->
      <div class="dash-grid" style="margin-bottom:16px">
        <section class="dc s7">
          <h2>Merchants Needing Attention (Click Any Row for Interaction Timeline)</h2>
          <div class="subt">Sorted by Churn Risk Score · Schedule Retention Call adds directly to the live Agent Callback Queue</div>
          <div class="tbl-wrap">
            <table class="clean watch-tbl">
              <thead><tr><th>Merchant</th><th class="r">Score</th><th>Active Signals</th><th>Owner</th><th>Last Contact</th><th class="r">Action</th></tr></thead>
              <tbody>
                ${CHURN_WATCHLIST.map((m, idx) => `
                  <tr data-watch-idx="${idx}" class="${idx === selIdx ? 'sel-row' : ''}">
                    <td><b>${esc(m.name)}</b><div class="muted" style="font-size:11px">${m.trips} trips · <span class="mono">${esc(m.phone)}</span></div></td>
                    <td class="r"><span class="pill ${m.score >= 70 ? 'bad' : m.score >= 50 ? 'warn' : 'good'}">${m.score}</span></td>
                    <td style="max-width:210px;white-space:normal">${[...m.signals].map(c => `<span class="sig-chip">${esc(CHURN_WEIGHTS[c].label)}</span>`).join('')}</td>
                    <td>${esc(m.owner)}</td>
                    <td class="muted" style="font-size:12px">${esc(m.last)}</td>
                    <td class="r"><button type="button" class="btn xs pri" data-watch-cb="${idx}">${ic('phone-out', 'sm')} Retention Call</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="dc s5">
          <h2><span style="display:inline-flex;align-items:center;gap:7px">${ic('clock')} ${esc(selM.name)} — Interaction Timeline</span> <span class="pill ${selM.score >= 70 ? 'bad' : 'warn'}">Score ${selM.score}</span></h2>
          <div class="subt">Owner: <b>${esc(selM.owner)}</b> · ${selM.trips} completed trips · Click rows on left to switch merchant</div>
          <div class="timeline">
            ${selM.timeline.map((ev, i) => `
              <div class="tl-item ${i === selM.timeline.length - 1 ? 'k-reopen' : i === 0 ? 'k-call' : 'k-chase'}">
                <span class="tl-dot"></span>
                <div>
                  <div class="tl-meta"><b>${esc(ev[0])}</b></div>
                  <div class="tl-text">${esc(ev[1])}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>

      <!-- Detailed Why Merchants Call & Negativity Drivers -->
      <div class="dash-grid" style="margin-bottom:16px">
        <section class="dc s12">
          <h2>Detailed Calling Reasons: Why the Call Landed (Confirmed RC Root Causes &amp; 7d Repeat %)</h2>
          <div class="subt">Negative % = (Concerned + Dissatisfied) ÷ calls with reason · Repeat % = same merchant, same reason within 7 days</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead><tr><th>#</th><th>Contact Reason</th><th class="r">Calls</th><th class="r">Negative %</th><th class="r">Repeat 7d</th><th>Owner</th><th>Why the Call Landed (Confirmed RC Codes)</th></tr></thead>
              <tbody>
                ${MGMT_TOP_REASONS.map((r, i) => `
                  <tr>
                    <td class="muted">${i + 1}</td>
                    <td><b>${esc(r.name)}</b></td>
                    <td class="r">${r.calls}</td>
                    <td class="r"><span class="pill ${r.negPct >= 40 ? 'bad' : r.negPct >= 25 ? 'warn' : 'good'}">${r.negPct}%</span></td>
                    <td class="r"><b>${r.rep7d}%</b></td>
                    <td>${esc(r.owner)}</td>
                    <td style="white-space:normal;min-width:250px;color:var(--ink-2)">${esc(r.rc)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="dc s6">
          <h2>What Drives Negativity (Share of All Negative Calls)</h2>
          <div class="subt">Teal = CRM-owned · Terracotta = stakeholder-owned reason</div>
          ${negDrivers.slice(0, 8).map(d => `
            <div class="hbar-row" style="grid-template-columns:185px minmax(0,1fr) 48px">
              <span>${esc(d.name)}</span>
              <div class="hbar-track"><i style="width:${(d.neg / negDrivers[0].neg * 100).toFixed(1)}%;background:${d.isCrm ? 'var(--good)' : 'var(--bad)'}"></i></div>
              <b class="num" style="text-align:right">${Math.round(d.neg / totalNeg * 100)}%</b>
            </div>
          `).join('')}
        </section>

        <section class="dc s6">
          <h2>Unresolved Issue Ageing (118 Open) &amp; 4-Week Negativity Trend</h2>
          <div class="subt">13 open issues have crossed 7 days (primarily Accounts COD payouts &amp; Ops)</div>
          ${[
            ['< 1 day', 41, 'var(--good)'],
            ['1–2 days', 29, 'var(--accent)'],
            ['2–4 days', 18, 'var(--saffron)'],
            ['4–7 days', 17, 'var(--bad)'],
            ['> 7 days', 13, 'var(--bad)']
          ].map(([lbl, cnt, col]) => `
            <div class="hbar-row" style="grid-template-columns:110px minmax(0,1fr) 44px">
              <span>${lbl}</span>
              <div class="hbar-track"><i style="width:${(cnt / 41 * 100).toFixed(1)}%;background:${col}"></i></div>
              <b class="num" style="text-align:right">${cnt}</b>
            </div>
          `).join('')}
          <div class="eyebrow" style="margin-top:12px">Negative Sentiment Share — Last 4 Weeks</div>
          ${renderVCols([19, 21, 22, 25], ['W-3', 'W-2', 'W-1', 'This Wk'], 'pct')}
        </section>

        <section class="dc s12">
          <h2>Re-Engagement &amp; Recovery Opportunities</h2>
          <div class="subt">Proactive outbound call lists for CRM &amp; KAM teams</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead><tr><th>Segment</th><th>Why It Matters</th><th>Suggested Action</th><th>Owner</th></tr></thead>
              <tbody>
                <tr><td><b>Silent: 74 merchants</b></td><td>Contacted ≥2 times last month, zero this month</td><td>Proactive check-in call starting with recently resolved issues</td><td><span class="ctrl-tag cC">CRM</span></td></tr>
                <tr><td><b>Recovered: 37 merchants</b></td><td>Issue solved, sentiment returned to Neutral/Positive</td><td>Short thank-you / feedback call to lock in goodwill</td><td><span class="ctrl-tag cC">CRM</span></td></tr>
                <tr><td><b>Failed-Contact Streak: 29</b></td><td>3+ failed attempts (No Answer / Dropped) in 7 days</td><td>Try alternate number or WhatsApp check-in via KAM</td><td><span class="ctrl-tag cM">CRM + KAM</span></td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Structured Management Focus Insights -->
      <div class="insights-row">
        <div class="ins-block">
          <b class="ih">${ic('alert', 'sm')} Payout Delay Drives the Most Repeat Contact</b>
          <p><b>What:</b> 31 merchants called 74 times about COD payout delay; oldest open issues sit with Accounts.</p>
          <p><b>Why it matters:</b> Repeat calls inflate CRM workload and are the strongest churn signal.</p>
          <p><b>Focus:</b> Review the 13 issues older than 7 days with Accounts &amp; confirm exact payout dates.</p>
        </div>
        <div class="ins-block">
          <b class="ih">${ic('target', 'sm')} Rahman Fashion &amp; Chattogram Tech Mart Need Action Today</b>
          <p><b>What:</b> Highest churn scores (85 &amp; 70) with explicit E-12 switching statements and SLA breaches.</p>
          <p><b>Why it matters:</b> High-volume KAM accounts actively evaluating competitor couriers.</p>
          <p><b>Focus:</b> Same-day senior KAM + Ops retention call once payout / hub status is confirmed.</p>
        </div>
        <div class="ins-block">
          <b class="ih">${ic('phone', 'sm')} Silence Is Growing Across Existing Accounts</b>
          <p><b>What:</b> 74 silent merchants (▲ 9), 63 declining engagement, and 4 straight weeks of rising negativity.</p>
          <p><b>Why it matters:</b> Quiet merchants rarely file a final complaint before churning.</p>
          <p><b>Focus:</b> Run a prioritized 74-call proactive check-in sprint starting with recent ticket holders.</p>
        </div>
      </div>
    `;

    bindDefToggle(renderMgmtHealth);
    const expW = document.getElementById('exportWatchlistBtn');
    if (expW) expW.addEventListener('click', () => {
      exportCSVWithBOM(
        'carrybee_inboundiq_churn_watchlist.csv',
        ['Merchant', 'Phone', 'Trips', 'Churn Score', 'Active Signals', 'Owner', 'Last Contact'],
        CHURN_WATCHLIST.map(m => [m.name, m.phone, m.trips, m.score, [...m.signals].map(c => CHURN_WEIGHTS[c].label).join('; '), m.owner, m.last]),
        'Management Churn Watchlist'
      );
    });
    document.querySelectorAll('[data-watch-idx]').forEach(tr => tr.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      STATE.selectedWatchIdx = Number(tr.dataset.watchIdx);
      renderMgmtHealth();
    }));
    document.querySelectorAll('[data-watch-cb]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const m = CHURN_WATCHLIST[Number(b.dataset.watchCb)];
      if (!m) return;
      CALL_LOGS.unshift({
        id: 'CL-' + (2042 + CALL_LOGS.length), direction: 'Outgoing', outcome: 'callback',
        startedAt: nowDyn(), durationSec: 0, agent: CURRENT_AGENT,
        callerType: 'Existing Merchant', callerName: m.name, phone: m.phone,
        reasonName: `Management Retention Callback (Churn Score ${m.score})`, theme: '', overrideUsed: false,
        ticketId: null, sentiment: 'Dissatisfied',
        callbackAt: minsAhead(30), callbackStatus: 'Pending',
        note: `Scheduled by Management BI (Score ${m.score}) for proactive retention check-in with ${m.owner}.`
      });
      persistCallLog(CALL_LOGS[0], CURRENT_USER?.id, CURRENT_USER?.team).catch(() => {});
      showToast(`Retention callback for ${m.name} added to Agent Callback Queue (${fmtTimeAMPM(minsAhead(30))})!`);
      renderMgmtHealth();
    }));
  }

  /* ========================================================================
     MANAGEMENT VIEW 3: TEAM SCORECARD, WORKLOAD IMBALANCE & DUAL-MODE HEATMAP
     ======================================================================== */
  function renderMgmtTeam() {
    const hours = [10,11,12,13,14,15,16,17,18,19,20];
    const days = ['Sat','Sun','Mon','Tue','Wed','Thu'];
    const isMissed = STATE.heatMode === 'missed';

    const heatVal = (i, j) => isMissed
      ? Math.round(6 + 16 * Math.exp(-Math.pow(j - 3.5, 2) / 3) + ((i * 5 + j * 7) % 5))
      : Math.round(20 + 60 * Math.exp(-Math.pow(j - 3.5, 2) / 6) + ((i * 7 + j * 13) % 17));

    const teamKpis = [
      { label: 'Follow-Ups On Time', val: '85.6%', delta: '▼ 1.4 pts', goodDir: false, ctrl: 'C', sub: '333 ÷ 389 completed', formula: 'Follow-ups completed by due_at ÷ follow-ups completed', source: 'Follow-Up Queue' },
      { label: 'Overdue Follow-Ups', val: '23 of 112', delta: '▲ 5', goodDir: false, ctrl: 'C', color: 'var(--bad)', formula: 'Pending follow-ups past due_at', source: 'Follow-Up Queue' },
      { label: 'Avg Handle Time', val: '4:58 min', delta: '▲ 0:14', goodDir: false, ctrl: 'C', formula: 'AVG(duration_sec) for Connected calls (manual desk timer)', source: 'call_logs.duration_sec' },
      { label: 'Missed-Call Share', val: '18.1%', delta: '▲ 1.2 pts', goodDir: false, ctrl: 'M', formula: '(Dropped + No Answer) ÷ (Connected + Dropped + No Answer) = 756 ÷ 4,176', source: 'call_logs.outcome' },
      { label: 'Workload Imbalance Index', val: '1.24×', delta: '▲ 0.06', goodDir: false, ctrl: 'C', sub: '>1.2× = rebalance', formula: 'Largest agent share of assigned leads ÷ fair share (30.9% ÷ 25%)', source: 'crm_leads.assigned_to' },
      { label: 'Unprocessed Lead Backlog', val: '45', delta: '▼ 8', goodDir: true, ctrl: 'C', formula: 'Assigned leads with no first contact logged yet', source: 'crm_leads.status' }
    ];

    const scorecard = [
      { name: AGENTS[0].name, shift: AGENTS[0].shift, qa: AGENTS[0].qaScore, assigned: 128, proc: 118, qual: 78, connPct: 84, inC: 1420, outC: 180, aht: '4:31', l2q: '2h 50m', cbPct: 88, overdue: 5, pendHand: 7 },
      { name: AGENTS[1].name, shift: AGENTS[1].shift, qa: AGENTS[1].qaScore, assigned: 121, proc: 115, qual: 79, connPct: 83, inC: 1250, outC: 190, aht: '4:12', l2q: '3h 05m', cbPct: 86, overdue: 4, pendHand: 5 },
      { name: AGENTS[2].name, shift: AGENTS[2].shift, qa: AGENTS[2].qaScore, assigned: 150, proc: 133, qual: 86, connPct: 80, inC: 1360, outC: 200, aht: '5:05', l2q: '3h 40m', cbPct: 81, overdue: 6, pendHand: 9 },
      { name: AGENTS[3].name, shift: AGENTS[3].shift, qa: AGENTS[3].qaScore, assigned: 87, proc: 75, qual: 44, connPct: 69, inC: 682, outC: 118, aht: '5:48', l2q: '4h 35m', cbPct: 74, overdue: 8, pendHand: 5 }
    ];

    document.getElementById('app').innerHTML = `
      <div class="view-head">
        <div>
          <h1>Team Performance, Workload Imbalance &amp; Dual-Mode Heatmap</h1>
          <p>Agent scorecard (leads, qualification, AHT, overdue follow-ups, QA), owner-queue SLAs, and 10 AM – 8 PM call arrival vs missed-call density.</p>
        </div>
        <button type="button" class="btn sm" id="toggleDefsBtn">${ic('compass', 'sm')} ${STATE.mgmtDefsOpen ? 'Collapse Definitions' : 'Expand All Definitions'}</button>
      </div>

      ${renderCtrlLegend()}

      <div class="kpi-grid">
        ${teamKpis.map(renderKpiCard).join('')}
      </div>

      <div class="dash-grid">
        <!-- Full Unified Agent Scorecard -->
        <section class="dc s12">
          <h2>Unified Agent Productivity, Lead Handover &amp; QA Scorecard</h2>
          <div class="subt">Qualification % is displayed for operational context (not as a quota, to avoid over-qualification)</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead>
                <tr>
                  <th>Agent</th><th class="r">Leads</th><th class="r">Share</th><th class="r">Processed</th><th class="r">Qualified</th><th class="r">Qual %</th>
                  <th class="r">Contact %</th><th class="r">In / Out</th><th class="r">AHT</th><th class="r">Lead→Qual</th><th class="r">CB Done</th><th class="r">Overdue F/U</th><th class="r">Pend. Hand.</th><th class="r">QA</th>
                </tr>
              </thead>
              <tbody>
                ${scorecard.map(a => {
                  const extra = CALL_LOGS.filter(l => l.agent === a.name).length;
                  return `
                    <tr>
                      <td><b>${esc(a.name)}</b><div class="muted" style="font-size:11px">${esc(a.shift)}</div></td>
                      <td class="r"><b>${a.assigned}</b></td>
                      <td class="r muted">${(a.assigned / 486 * 100).toFixed(1)}%</td>
                      <td class="r">${a.proc}</td>
                      <td class="r">${a.qual}</td>
                      <td class="r muted">${(a.qual / a.proc * 100).toFixed(1)}%</td>
                      <td class="r"><span class="pill ${a.connPct >= 80 ? 'good' : a.connPct >= 75 ? 'warn' : 'bad'}">${a.connPct}%</span></td>
                      <td class="r mono">${(a.inC + extra).toLocaleString()} / ${a.outC}</td>
                      <td class="r mono">${a.aht}</td>
                      <td class="r muted">${a.l2q}</td>
                      <td class="r"><span class="pill ${a.cbPct >= 85 ? 'good' : a.cbPct >= 80 ? 'warn' : 'bad'}">${a.cbPct}%</span></td>
                      <td class="r"><span class="pill ${a.overdue <= 4 ? 'good' : a.overdue <= 6 ? 'warn' : 'bad'}">${a.overdue}</span></td>
                      <td class="r">${a.pendHand}</td>
                      <td class="r"><b>${a.qa}%</b></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Follow-Up Backlog Ageing + Leads Processed Per Day -->
        <section class="dc s6">
          <h2>Follow-Up Backlog Ageing (112 Pending · 389 Completed This Week)</h2>
          <div class="subt">23 pending follow-ups are currently past their promised AM/PM callback window</div>
          ${[
            ['Not due yet', 64, 'var(--good)'],
            ['Due today', 25, 'var(--accent)'],
            ['Overdue 0–4h', 11, 'var(--saffron)'],
            ['Overdue 4–24h', 8, 'var(--bad)'],
            ['Overdue > 24h', 4, 'var(--bad)']
          ].map(([lbl, cnt, col]) => `
            <div class="hbar-row" style="grid-template-columns:130px minmax(0,1fr) 44px">
              <span>${lbl}</span>
              <div class="hbar-track"><i style="width:${(cnt / 64 * 100).toFixed(1)}%;background:${col}"></i></div>
              <b class="num" style="text-align:right">${cnt}</b>
            </div>
          `).join('')}

          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line-2)">
            <div class="eyebrow">Leads Processed Per Day (441 This Week · Sat–Thu)</div>
            ${renderVCols([70, 68, 77, 84, 72, 70], days, 'var(--accent)')}
            <div class="muted" style="font-size:11.5px;margin-top:6px"><b>Pending Stakeholder Handovers:</b> Activation 14 · Business KAM 7 · Supply 5 (oldest: Activation, 9h)</div>
          </div>
        </section>

        <!-- Dual-Mode Peak Activity Heatmap (Call Arrivals vs Missed-Call %) -->
        <section class="dc s6">
          <h2>
            <span>Hourly Peak Activity Heatmap (10 AM – 8 PM)</span>
            <div class="seg-ctl" id="heatModeCtl">
              <button type="button" data-hm="arrivals" class="${!isMissed ? 'on' : ''}" style="min-height:28px;font-size:11.5px">Call Arrivals</button>
              <button type="button" data-hm="missed" class="${isMissed ? 'on' : ''}" style="min-height:28px;font-size:11.5px">Missed-Call %</button>
            </div>
          </h2>
          <div class="subt">${isMissed ? 'Missed-call % = (Dropped + No Answer) — doubles during 12:00 PM – 3:00 PM peak' : 'Incoming + Outgoing hourly arrival volume — peaks 12:00 PM – 3:00 PM'}</div>
          <div class="heat-grid">
            <span></span>${hours.map(h => `<span class="heat-h">${fmtHourShort(h)}</span>`).join('')}
            ${days.map((d, ri) => `<span class="heat-r">${d}</span>${hours.map((h, ci) => {
              const v = heatVal(ri, ci);
              const mx = isMissed ? 26 : 100;
              const r = Math.min(1, v / mx);
              const isDk = STATE.theme === 'dark';
              const bgCol = isMissed
                ? `rgba(185,62,51,${(0.10 + r * 0.80).toFixed(2)})`
                : (isDk ? `rgba(255,200,1,${(0.10 + r * 0.78).toFixed(2)})` : `rgba(17,76,90,${(0.09 + r * 0.80).toFixed(2)})`);
              const fgCol = isMissed
                ? (r > 0.45 ? '#F1F6F4' : 'var(--ink)')
                : (isDk ? (r > 0.52 ? '#172B36' : 'var(--ink)') : (r > 0.52 ? '#F1F6F4' : 'var(--ink)'));
              return `<span class="heat-c" style="background:${bgCol};color:${fgCol}" title="${d} ${fmtHourShort(h)}: ${v}${isMissed ? '% missed' : ' calls'}">${v}${isMissed ? '%' : ''}</span>`;
            }).join('')}`).join('')}
          </div>
        </section>

        <!-- Owner Queue Accountability Scorecard (Track A & Track B) -->
        <section class="dc s12">
          <h2>Owner Queue Accountability Scorecard (Live Track A &amp; Track B)</h2>
          <div class="subt">Live open pipeline, action queue, SLA compliance &amp; avg solve time per stakeholder team</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead><tr><th>Owner Queue</th><th>Track</th><th class="r">Open</th><th class="r">Needs Action</th><th class="r">Within SLA</th><th class="r">Avg Solve</th></tr></thead>
              <tbody>
                ${TEAMS.map((tm, i) => {
                  const ts = ISSUES.filter(x => x.owner === tm.key);
                  const open = ts.filter(x => x.status !== 'Closed').length;
                  const act = ts.filter(needsFollowUp).length;
                  return `<tr><td><span class="team-dot" style="--tc:${tm.color}">${esc(tm.key)}</span></td><td><span class="pill ${tm.track === 'A' ? 'acc' : 'mute'}">Track ${tm.track}</span></td><td class="r"><b>${open}</b></td><td class="r">${act ? `<span style="color:var(--live);font-weight:700">${act}</span>` : '<span class="muted">0</span>'}</td><td class="r">${[86.4,91.2,82.0,88.5,94.0,92.3,79.5][i]}%</td><td class="r">${[5.4,7.2,10.8,6.1,8.5,2.4,5.9][i]} h</td></tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Structured Team Coaching & Capacity Insights -->
      <div class="insights-row" style="margin-top:16px">
        <div class="ins-block">
          <b class="ih">${ic('users', 'sm')} ${esc(AGENTS[2].name)} Carries 30.9% of Leads (Imbalance 1.24×)</b>
          <p><b>What:</b> Fair share is 25%; carries 6 overdue follow-ups and slower 5:05 AHT.</p>
          <p><b>Why it matters:</b> Overload pushes the next wave of follow-ups past SLA and delays qualification.</p>
          <p><b>Focus:</b> Reassign ~20 incoming leads from ${esc(AGENTS[2].name)} to lower-loaded peers this week.</p>
        </div>
        <div class="ins-block">
          <b class="ih">${ic('headset', 'sm')} ${esc(AGENTS[3].name)} Needs Coaching, Not Extra Volume</b>
          <p><b>What:</b> Lowest lead share (17.9%) yet lowest contact success (69%), 8 overdue F/Us, and 4h 35m qual time.</p>
          <p><b>Why it matters:</b> Throughput lags without overload — indicates script/opening friction, not capacity.</p>
          <p><b>Focus:</b> Pair with ${esc(AGENTS[0].name)} (84% contact, 96% QA) for call-opening &amp; callback listening sessions.</p>
        </div>
        <div class="ins-block">
          <b class="ih">${ic('clock', 'sm')} Missed-Call Share Doubles During 12:00 PM – 3:00 PM</b>
          <p><b>What:</b> Missed-call % spikes to ~22% in midday peak; 87 callbacks remain open.</p>
          <p><b>Why it matters:</b> Every missed call creates an outbound callback and compounds next-day backlog.</p>
          <p><b>Focus:</b> Stagger agent breaks outside 12:00–3:00 PM and keep auto +15m callbacks on dropped calls.</p>
        </div>
      </div>
    `;

    bindDefToggle(renderMgmtTeam);
    document.querySelectorAll('#heatModeCtl button').forEach(b => b.addEventListener('click', () => {
      STATE.heatMode = b.dataset.hm;
      renderMgmtTeam();
    }));
  }

  /* ========================================================================
     ADMIN VIEWS (5-COL KAM MASTER, 8-SHEET REGISTRY, TAXONOMY & 64 RCs)
     ======================================================================== */
  function renderAdminKAM() {
    document.getElementById('app').innerHTML = `
      <div class="view-head">
        <div>
          <h1>Admin · Strict 5-Col Merchant KAM Master</h1>
          <p>Live-synced with Agent Call Desk. Only merchants listed in this 5-col sheet get a dedicated KAM; all other registered businesses automatically fall back to <b>Complaint Management</b>.</p>
        </div>
      </div>

      <section class="panel panel-pad">
        <div class="cols3" style="gap:8px;margin-bottom:8px">
          <input type="text" id="newBizName" placeholder="Business Name (e.g. Dhaka Glow)">
          <input type="tel" id="newBizPhone" placeholder="Merchant Registered Number (e.g. 01799887766)">
          <input type="text" id="newKamName" placeholder="KAM Name (e.g. Tanvir Ahmed)">
        </div>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <input type="text" id="newKamTeam" placeholder="Responsible Team (e.g. Enterprise KAM)" style="flex:1">
          <button class="btn pri" id="addKamBtn">+ Add Merchant to 5-Col KAM Master</button>
        </div>
        <div class="tbl-wrap">
          <table class="clean">
            <thead><tr><th>Col A: Business ID</th><th>Col B: Business Name</th><th>Col C: Merchant Registered Number</th><th>Col D: KAM Name</th><th>Col E: Responsible Team</th><th class="r">Completed Trips (E-04)</th></tr></thead>
            <tbody>
              ${KAM_DIRECTORY.map(m => `
                <tr>
                  <td class="mono">${esc(m.bizId)}</td>
                  <td><b>${esc(m.bizName)}</b></td>
                  <td class="mono">${esc(m.phone)}</td>
                  <td><span class="pill purple">${esc(m.kamName)}</span></td>
                  <td>${esc(m.team)}</td>
                  <td class="r"><b>${m.completedTrips}</b> (${m.completedTrips > 0 ? 'Existing' : 'New'})</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
          <div class="eyebrow" style="margin-bottom:6px">Registered Businesses NOT in KAM Master → Auto-Fallback to "Complaint Management"</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead><tr><th>Business ID</th><th>Business Name</th><th>Registered Phone</th><th>Auto-Assigned KAM</th><th class="r">Completed Trips (E-04)</th></tr></thead>
              <tbody>
                ${BUSINESS_FALLBACK.map(m => `
                  <tr>
                    <td class="mono">${esc(m.bizId)}</td>
                    <td><b>${esc(m.bizName)}</b></td>
                    <td class="mono">${esc(m.phone)}</td>
                    <td><span class="pill mute">Complaint Management</span></td>
                    <td class="r"><b>${m.completedTrips}</b> (${m.completedTrips > 0 ? 'Existing' : 'New Merchant'})</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;

    document.getElementById('addKamBtn').addEventListener('click', () => {
      const bizName = document.getElementById('newBizName').value.trim();
      const phone = document.getElementById('newBizPhone').value.replace(/\D/g, '');
      const kamName = document.getElementById('newKamName').value.trim() || 'Tanvir Ahmed';
      const team = document.getElementById('newKamTeam').value.trim() || 'Enterprise KAM';
      if (!bizName || phone.length < 10) { showToast('Enter Business Name & valid 11-digit phone.'); return; }
      KAM_DIRECTORY.unshift({ bizId: 'CB-M-' + (1300 + KAM_DIRECTORY.length), bizName, phone, kamName, team, completedTrips: 42, area: 'Dhaka', health: 'Healthy', sentiment: 'Positive', complaints30d: 0 });
      persistKamMerchant(KAM_DIRECTORY[0]).catch(() => {});
      showToast(`Added ${bizName} (${phone}) to 5-Col KAM Master! Switch to Agent View to test lookup.`);
      renderAdminKAM();
    });
  }

  function renderAdminSheets() {
    document.getElementById('app').innerHTML = `
      <div class="view-head">
        <div>
          <h1>Admin · 8-Sheet Google Workspace Registry &amp; Overflow Watch</h1>
          <p>Live spreadsheet IDs built in Google Drive plus W-1/W-2 OSD row 2211 overflow protection.</p>
        </div>
        <button class="btn warn-btn" id="simOvfBtn">+ Simulate OSD Row Overflow</button>
      </div>

      <div class="dash-grid">
        <section class="dc s7">
          <h2>8 Live Google Sheets (Hub-and-Spoke)</h2>
          <div class="subt">All spreadsheets configured in Asia/Dhaka timezone</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead><tr><th>Spreadsheet</th><th>Live Google Sheet ID</th><th>Status</th></tr></thead>
              <tbody>
                ${SHEET_REGISTRY.map(s => `<tr><td><b>${esc(s.name)}</b><div class="muted" style="font-size:11.5px">${esc(s.tabs)}</div></td><td class="mono muted">${esc(s.id)}</td><td><span class="pill good">${ic('check', 'sm')} ${esc(s.status)}</span></td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="dc s5">
          <h2>Global Overflow Watch (W-1/W-2)</h2>
          <div class="subt">MX tickets safely persisted in Supabase when OSD Sheet hits row 2211</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead><tr><th>Ref</th><th>Global ID</th><th>Row</th><th>Time</th></tr></thead>
              <tbody>
                ${OVERFLOW_LOG.map(o => `<tr><td class="mono">${esc(o.id)}</td><td class="mono"><b>${esc(o.globalId)}</b></td><td><span class="pill warn">${o.zone} #${o.sheetRow}</span></td><td class="muted">${fmtTimeAMPM(o.at)}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    document.getElementById('simOvfBtn').addEventListener('click', () => {
      const row = 2211 + OVERFLOW_LOG.length;
      const gid = `CB-21-11-${String(440 + OVERFLOW_LOG.length).padStart(4, '0')}`;
      OVERFLOW_LOG.unshift({ id: `OVF-0${OVERFLOW_LOG.length + 1}`, globalId: gid, zone: 'OSD', sheetRow: row, status: 'Bypassed Sheet -> Supabase Verified', at: nowDyn() });
      persistOverflowSimulation(OVERFLOW_LOG[0]).catch(() => {});
      showToast(`Simulated OSD row ${row} overflow — ${gid} safely persisted in Supabase!`);
      renderAdminSheets();
    });
  }

  function renderAdminRules() {
    const activeCount = USERS.filter(u => u.active).length;
    document.getElementById('app').innerHTML = `
      <div class="view-head">
        <div>
          <h1>Admin · Team Provisioning, Role Access &amp; Taxonomy v4 Governance</h1>
          <p>Pre-provisioned fixed Login IDs &amp; Passwords (zero self-signup / zero email verification), in-CRM member onboarding, 4-Role RBAC (§8.5), live Churn Weights, and Audit Trail.</p>
        </div>
        <button type="button" class="btn sm" id="exportUsersBtn">${ic('download', 'sm')} Export Team Roster (CSV)</button>
      </div>

      <div class="dash-grid">
        <section class="dc s12">
          <h2>Team Accounts &amp; In-CRM Member Provisioning (${activeCount} Active / ${USERS.length} Total)</h2>
          <div class="subt">Admins create fixed Login ID + Password accounts directly inside Carrybee InboundIQ — new members can sign in immediately with zero verification hoops (production: <code>supabase.auth.admin.createUser({ email_confirm: true })</code>).</div>

          <form id="addUserForm" style="background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:16px">
            <div class="eyebrow" style="margin-bottom:10px">+ Add New Team Member (Zero-Friction Direct Provisioning)</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px;align-items:end">
              <label class="field">
                <span>Login ID (Email) <span class="req">*</span></span>
                <input type="email" id="nuEmail" required placeholder="name@carrybee.com">
              </label>
              <label class="field">
                <span>User Name <span class="req">*</span></span>
                <input type="text" id="nuUsername" required placeholder="e.g. Tanvir.Ahmed">
              </label>
              <label class="field">
                <span>Fixed Password <span class="req">*</span></span>
                <div style="display:flex;gap:6px">
                  <input type="text" id="nuPassword" required placeholder="InboundIQ#####" style="flex:1;min-width:0">
                  <button type="button" class="btn xs" id="genPassBtn" title="Generate InboundIQ fixed password">Gen</button>
                </div>
              </label>
              <label class="field">
                <span>Role <span class="req">*</span></span>
                <select id="nuRole">
                  <option value="agent">Agent</option>
                  <option value="call_pic">Call PIC (Person In Charge)</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="management">Management</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label class="field">
                <span>Assigned Team</span>
                <input type="text" id="nuTeam" value="Inbound Desk A" placeholder="Inbound Desk A">
              </label>
              <div>
                <button type="submit" class="btn pri" style="width:100%;justify-content:center">+ Create Member</button>
              </div>
            </div>
          </form>

          <div class="tbl-wrap">
            <table class="clean">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Login ID (Email)</th>
                  <th>Assigned Password</th>
                  <th>Role</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th class="r">Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                ${USERS.map(u => {
                  const showP = REVEALED_PASS_IDS.has(u.id);
                  const isSelf = CURRENT_USER && CURRENT_USER.id === u.id;
                  return `
                    <tr style="${u.active ? '' : 'opacity:0.58'}">
                      <td><b>${esc(u.username)}</b>${isSelf ? ' <span class="pill acc" style="font-size:10px">You</span>' : ''}<div class="mono muted" style="font-size:11px">${esc(u.id)}</div></td>
                      <td class="mono" style="font-size:12px">${esc(u.email)}</td>
                      <td class="mono" style="font-size:12px">
                        <span>${showP ? esc(u.password) : '••••••••••••'}</span>
                        <button type="button" class="btn xs" style="margin-left:6px" data-u-reveal="${esc(u.id)}">${showP ? 'Hide' : 'Show'}</button>
                      </td>
                      <td>
                        <select data-u-role="${esc(u.id)}" ${isSelf ? 'disabled' : ''} style="padding:4px 7px;border-radius:7px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:12px;font-weight:600">
                          ${['agent','call_pic','supervisor','management','admin'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${esc(ROLE_DISPLAY[r])}</option>`).join('')}
                        </select>
                      </td>
                      <td style="font-size:12px">${esc(u.team)}</td>
                      <td><span class="pill ${u.active ? 'good' : 'bad'}">${u.active ? 'Active' : 'Deactivated'}</span></td>
                      <td class="r" style="white-space:nowrap">
                        <button type="button" class="btn xs" data-u-edit-email="${esc(u.id)}">Edit ID</button>
                        <button type="button" class="btn xs" data-u-reset-pw="${esc(u.id)}">Reset PW</button>
                        ${isSelf ? '' : `<button type="button" class="btn xs ${u.active ? 'warn' : 'pri'}" data-u-toggle="${esc(u.id)}">${u.active ? 'Deactivate' : 'Reactivate'}</button>`}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="dc s12">
          <h2>Explicit 5-Role RBAC, Data Visibility &amp; PII Restrictions Matrix (PRD §8.5)</h2>
          <div class="subt">Enforced at database level via PostgreSQL Row-Level Security (RLS) across profiles, call_logs, crm_tickets, audit_logs, and config tables</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Data Visibility Scope</th>
                  <th>View / Create / Edit</th>
                  <th>Sensitive Info &amp; Bulk Export (PII)</th>
                  <th>Cross-Team &amp; Admin Governance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><b>${ic('headset', 'sm')} Agent</b></td>
                  <td><span class="pill mute">Own / Assigned Only</span><div class="muted" style="font-size:11px;margin-top:3px">Own call logs, assigned leads/issues, shared team callback queue (10m claim lock)</div></td>
                  <td><b>Create</b> calls, leads, tickets &amp; notes.<br><b>Edit</b> own open tickets &amp; feedback calls. Cannot delete logs or edit peers' records.</td>
                  <td><span class="pill bad">${ic('lock', 'sm')} Exports Blocked</span><div class="muted" style="font-size:11px;margin-top:3px">Sees phone only on active caller/assigned issue. No bulk CSV/Excel export.</div></td>
                  <td>No cross-team visibility; cannot view other agents' QA audits, BI, or system settings.</td>
                </tr>
                <tr>
                  <td><b>${ic('shield', 'sm')} Call PIC</b><div class="muted" style="font-size:10.5px">Person In Charge</div></td>
                  <td><span class="pill purple">Agent + Assigned Team</span><div class="muted" style="font-size:11px;margin-top:3px">Full Call Desk + team call logs (incl. Log-Only), team tickets, SLA watch &amp; QA audit</div></td>
                  <td><b>Dual Role</b>: Log calls, take callbacks &amp; raise tickets like an <b>Agent</b> + reassign team issues, escalate to IR, release 10m locks &amp; run QA like a <b>Supervisor</b>.</td>
                  <td><span class="pill acc">Team Export (Audited)</span><div class="muted" style="font-size:11px;margin-top:3px">UTF-8 BOM CSV scoped to assigned team; every export logged in <code>audit_logs</code>.</div></td>
                  <td>Assigned shift/team only; no org-wide Management BI or Admin user/config access.</td>
                </tr>
                <tr>
                  <td><b>${ic('eye', 'sm')} Supervisor</b></td>
                  <td><span class="pill warn">Assigned Team Scope</span><div class="muted" style="font-size:11px;margin-top:3px">Full call logs (incl. Log-Only), team tickets, SLA rescue watch, QA health &amp; agent metrics</div></td>
                  <td><b>View &amp; Manage</b> all team leads/tickets.<br>Reassign tickets, escalate to IR, release 10m callback locks, review QA flags.</td>
                  <td><span class="pill acc">Team Export (Audited)</span><div class="muted" style="font-size:11px;margin-top:3px">UTF-8 BOM CSV scoped to assigned team; every export logged in <code>audit_logs</code>.</div></td>
                  <td>Restricted to assigned team (no unrelated teams' PII); read-only on Taxonomy &amp; Sheets.</td>
                </tr>
                <tr>
                  <td><b>${ic('chart', 'sm')} Management</b></td>
                  <td><span class="pill acc">Org-Wide Read-Only BI</span><div class="muted" style="font-size:11px;margin-top:3px">Executive BI, Controllability, Lead→Handover funnel, Churn Watchlist &amp; Team Heatmaps</div></td>
                  <td><b>Primarily Read-Only</b> across org metrics.<br>Cannot alter raw call logs or close tickets; may queue proactive Retention Callbacks.</td>
                  <td><span class="pill acc">Org Export (Audited)</span><div class="muted" style="font-size:11px;margin-top:3px">Aggregated BI &amp; churn watchlist CSV (UTF-8 BOM) logged to <code>audit_logs</code>.</div></td>
                  <td>Cross-team analytics visibility; no operational ticket edits or Admin config access.</td>
                </tr>
                <tr>
                  <td><b>${ic('sliders', 'sm')} Admin</b></td>
                  <td><span class="pill good">Full System Governance</span><div class="muted" style="font-size:11px;margin-top:3px">All org records, users/roles, 5-Col KAM Master, 8-Sheet Registry, Taxonomy &amp; Audit Logs</div></td>
                  <td><b>Full Control</b>: manage user accounts, roles, team assignments, Taxonomy v4, 64 RCs &amp; Churn Risk Score weights.</td>
                  <td><span class="pill good">Full Export + Audit Trail</span><div class="muted" style="font-size:11px;margin-top:3px">Audited UTF-8 BOM exports + full visibility into immutable <code>audit_logs</code>.</div></td>
                  <td>Unrestricted cross-team &amp; infrastructure governance (Sync Outbox, OSD Overflow Guard).</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="dc s6">
          <h2>Live Churn Risk Score Weight Config (<code>churn_score_config</code>)</h2>
          <div class="subt">Changes take effect immediately in Management → Merchant Health &amp; Churn Watch without any code deploy</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
            ${Object.entries(CHURN_WEIGHTS).map(([code, w]) => `
              <label class="field" style="background:var(--surface-2);padding:10px 12px;border-radius:10px;border:1px solid var(--line)">
                <span style="font-size:12px;font-weight:650">${esc(w.label)} <span class="mono muted">(${code})</span></span>
                <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
                  <input type="number" min="0" max="60" step="5" data-cw-key="${code}" value="${w.pts}" style="width:78px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--ink);font-weight:700">
                  <span class="muted" style="font-size:11.5px">pts (capped at 100)</span>
                </div>
              </label>
            `).join('')}
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button type="button" class="btn sm pri" id="saveChurnWeightsBtn">${ic('check', 'sm')} Save Weights &amp; Log Audit</button>
            <button type="button" class="btn sm" id="resetChurnWeightsBtn">${ic('refresh', 'sm')} Reset Defaults</button>
          </div>
        </section>

        <section class="dc s6">
          <h2>Immutable PII Export &amp; Config Audit Trail (<code>audit_logs</code>)</h2>
          <div class="subt">Records every Supervisor/Management/Admin CSV export, User Provisioning action, and Admin config update</div>
          <div class="tbl-wrap" style="max-height:260px;overflow:auto">
            <table class="clean">
              <thead><tr><th>Time</th><th>Actor &amp; Role</th><th>Action</th><th>Scope</th></tr></thead>
              <tbody>
                ${AUDIT_LOGS.map(a => `
                  <tr>
                    <td class="muted" style="font-size:11.5px;white-space:nowrap">${fmtStamp(a.at)}</td>
                    <td><b>${esc(a.actor)}</b><div class="muted" style="font-size:11px">${esc(a.role)}</div></td>
                    <td><span class="pill ${a.action === 'CSV_EXPORT' ? 'warn' : a.action.startsWith('USER_') ? 'good' : 'acc'} mono">${esc(a.action)}</span></td>
                    <td style="font-size:12px">${esc(a.scope)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="dc s12">
          <h2>Authoritative Taxonomy v4 Routing &amp; Global Translation Table (${TAXONOMY.length} Reasons)</h2>
          <div class="subt">Controls automatic Track A vs Track B vs Log-Only routing, exact Global Category/Sub-Category, and v4 SLA rules (+2h Friday buffer)</div>
          <div class="tbl-wrap">
            <table class="clean">
              <thead><tr><th>Code</th><th>Contact Reason</th><th>Call Type</th><th>Track</th><th>Owner / Verbatim Global Mapping</th><th class="r">v4 SLA Rule</th></tr></thead>
              <tbody>
                ${TAXONOMY.map(r => `
                  <tr>
                    <td class="mono"><b>${esc(r.code)}</b></td>
                    <td>${esc(r.name)}${r.edge ? ` <span class="pill warn">${esc(r.edge)}</span>` : ''}</td>
                    <td><span class="pill mute">${esc(r.callType)}</span></td>
                    <td><span class="pill ${r.track === 'A' ? 'acc' : r.track === 'B' ? 'purple' : r.track === 'DUAL' ? 'bad' : 'good'}">${r.track === 'NONE' ? 'Log Only' : 'Track ' + r.track}</span></td>
                    <td><b>${esc(r.owner)}</b>${r.gCat ? `<div class="muted" style="font-size:11px">Global: ${esc(r.gCat)} › ${esc((r.gSubs || []).join(' / '))}</div>` : ''}</td>
                    <td class="r"><span class="mono" style="font-size:11.5px">${esc(r.slaLabel || 'FCR')}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="dc s12">
          <h2>All 64 Official Root Cause Codes (8_Root_Cause · RC-01..RC-64 → 5 Accountability Buckets)</h2>
          <div class="subt">Used by Hard Closure Gate (Col X → auto-derived Col Y ARRAYFORMULA across all Track B sheets)</div>
          <div class="tbl-wrap" style="max-height:380px;overflow:auto">
            <table class="clean">
              <thead><tr><th>Code</th><th>Category (12 Groups)</th><th>Root Cause Label</th><th>Col Y Auto-Accountability (5 Buckets)</th></tr></thead>
              <tbody>
                ${ROOT_CAUSES.map(rc => `
                  <tr>
                    <td class="mono"><b>${esc(rc.code)}</b></td>
                    <td>${esc(rc.cat)}</td>
                    <td>${esc(rc.label)}</td>
                    <td><span class="pill ${rc.bucket === 'Carrybee - Internal' ? 'acc' : rc.bucket === 'Merchant' ? 'purple' : rc.bucket === 'Customer' ? 'good' : rc.bucket === 'External' ? 'warn' : 'mute'}">${esc(rc.bucket)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    const actorName = CURRENT_USER ? CURRENT_USER.username : ROLES.admin.persona;

    document.getElementById('genPassBtn').addEventListener('click', () => {
      const rand5 = Math.floor(10000 + Math.random() * 89999);
      document.getElementById('nuPassword').value = `InboundIQ${rand5}`;
    });

    document.getElementById('nuRole').addEventListener('change', e => {
      const defaults = { agent: 'Inbound Desk A', call_pic: 'Inbound Desk A', supervisor: 'Inbound Desk A', management: 'Executive BI', admin: 'System Admin' };
      document.getElementById('nuTeam').value = defaults[e.target.value] || 'Inbound Desk A';
    });

    document.getElementById('addUserForm').addEventListener('submit', e => {
      e.preventDefault();
      const email = document.getElementById('nuEmail').value.trim().toLowerCase();
      const username = document.getElementById('nuUsername').value.trim();
      const password = document.getElementById('nuPassword').value.trim();
      const role = document.getElementById('nuRole').value;
      const team = document.getElementById('nuTeam').value.trim() || 'Inbound Desk A';
      if (!email || !username || password.length < 8) {
        showToast('Enter valid Login ID, User Name, and Password (8+ chars).');
        return;
      }
      if (USERS.some(u => u.email.toLowerCase() === email)) {
        showToast(`Login ID ${email} already exists.`);
        return;
      }
      showToast(`Provisioning ${username} (${email}) in Supabase Auth...`);
      adminManageUser({
        action: 'create',
        email,
        password,
        username,
        full_name: username.replace('.', ' '),
        role: UI_TO_DB_ROLE[role] || 'Agent',
        team_id: team,
      }).then(res => {
        if (!res.ok) {
          showToast(`Supabase Admin Error: ${res.error}`);
          return;
        }
        const uid = res.user_id || ('USR-' + String(USERS.length + 1).padStart(2, '0'));
        USERS.push({ id: uid, email, username, password, role, team, active: true, preProvisioned: true });
        AUDIT_LOGS.unshift({
          at: nowDyn(), actor: actorName, role: 'Admin', action: 'USER_CREATE',
          scope: `Provisioned ${username} (${email}) as ${ROLE_DISPLAY[role] || role} — email_confirm: true`
        });
        showToast(`Member "${username}" (${email}) provisioned in Supabase Auth! Ready to sign in immediately.`);
        renderAdminRules();
      });
    });

    document.getElementById('exportUsersBtn').addEventListener('click', () => {
      exportCSVWithBOM(
        'carrybee_inboundiq_team_roster.csv',
        ['User ID', 'User Name', 'Login ID (Email)', 'Role', 'Assigned Team', 'Status'],
        USERS.map(u => [u.id, u.username, u.email, ROLE_DISPLAY[u.role] || u.role, u.team, u.active ? 'Active' : 'Deactivated']),
        'Admin Team Roster (Passwords Excluded)'
      );
    });

    document.querySelectorAll('[data-u-reveal]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.uReveal;
      if (REVEALED_PASS_IDS.has(id)) REVEALED_PASS_IDS.delete(id);
      else REVEALED_PASS_IDS.add(id);
      renderAdminRules();
    }));

    document.querySelectorAll('[data-u-role]').forEach(sel => sel.addEventListener('change', () => {
      const u = USERS.find(x => x.id === sel.dataset.uRole);
      if (!u) return;
      const prev = u.role;
      u.role = sel.value;
      adminManageUser({ action: 'update', user_id: u.id, role: UI_TO_DB_ROLE[u.role] || 'Agent' }).catch(() => {});
      AUDIT_LOGS.unshift({
        at: nowDyn(), actor: actorName, role: 'ADMIN', action: 'USER_ROLE_CHANGED',
        scope: `${u.username} (${u.email}): ${prev.toUpperCase()} -> ${u.role.toUpperCase()}`
      });
      showToast(`Updated ${u.username} role to ${u.role.toUpperCase()}.`);
      renderAdminRules();
    }));

    document.querySelectorAll('[data-u-edit-email]').forEach(b => b.addEventListener('click', () => {
      const u = USERS.find(x => x.id === b.dataset.uEditEmail);
      if (!u) return;
      const next = prompt(`Update Login ID (Email) for ${u.username}:`, u.email);
      if (!next || next.trim().toLowerCase() === u.email.toLowerCase()) return;
      const clean = next.trim().toLowerCase();
      if (USERS.some(x => x.id !== u.id && x.email.toLowerCase() === clean)) {
        showToast(`Login ID ${clean} is already in use.`);
        return;
      }
      const prev = u.email;
      u.email = clean;
      adminManageUser({ action: 'update', user_id: u.id, email: clean }).catch(() => {});
      AUDIT_LOGS.unshift({
        at: nowDyn(), actor: actorName, role: 'ADMIN', action: 'USER_EMAIL_UPDATED',
        scope: `${u.username}: ${prev} -> ${clean}`
      });
      showToast(`Updated Login ID for ${u.username} to ${clean}.`);
      renderAdminRules();
    }));

    document.querySelectorAll('[data-u-reset-pw]').forEach(b => b.addEventListener('click', () => {
      const u = USERS.find(x => x.id === b.dataset.uResetPw);
      if (!u) return;
      const suggested = `InboundIQ${Math.floor(10000 + Math.random() * 89999)}`;
      const next = prompt(`Set new fixed password for ${u.username} (${u.email}):`, suggested);
      if (!next || next.trim().length < 8) {
        if (next !== null) showToast('Password must be at least 8 characters.');
        return;
      }
      u.password = next.trim();
      adminManageUser({ action: 'update', user_id: u.id, password: u.password }).catch(() => {});
      AUDIT_LOGS.unshift({
        at: nowDyn(), actor: actorName, role: 'ADMIN', action: 'USER_PASSWORD_RESET',
        scope: `Reset fixed password for ${u.username} (${u.email})`
      });
      showToast(`Password reset for ${u.username}. New credentials active immediately.`);
      renderAdminRules();
    }));

    document.querySelectorAll('[data-u-toggle]').forEach(b => b.addEventListener('click', () => {
      const u = USERS.find(x => x.id === b.dataset.uToggle);
      if (!u) return;
      u.active = !u.active;
      adminManageUser({ action: 'update', user_id: u.id, is_active: u.active }).catch(() => {});
      AUDIT_LOGS.unshift({
        at: nowDyn(), actor: actorName, role: 'ADMIN', action: u.active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
        scope: `${u.username} (${u.email}) ${u.active ? 'reactivated' : 'deactivated — login blocked'}`
      });
      showToast(`${u.username} ${u.active ? 'reactivated' : 'deactivated'}.`);
      renderAdminRules();
    }));

    document.getElementById('saveChurnWeightsBtn').addEventListener('click', () => {
      document.querySelectorAll('[data-cw-key]').forEach(inp => {
        const k = inp.dataset.cwKey;
        if (CHURN_WEIGHTS[k]) CHURN_WEIGHTS[k].pts = Math.max(0, Math.min(60, Number(inp.value) || 0));
      });
      CHURN_WATCHLIST.forEach(m => { m.score = computeChurnScore(m); });
      AUDIT_LOGS.unshift({
        at: nowDyn(), actor: actorName, role: 'ADMIN', action: 'CONFIG_UPDATE',
        scope: 'Updated Churn Risk Score Weights: ' + Object.entries(CHURN_WEIGHTS).map(([k, v]) => `${k}=+${v.pts}`).join(', ')
      });
      persistChurnWeights(CHURN_WEIGHTS, actorName).catch(() => {});
      showToast('Churn weights saved to Supabase churn_score_config & audit_logs!');
      renderAdminRules();
    });

    document.getElementById('resetChurnWeightsBtn').addEventListener('click', () => {
      const defaults = { T: 35, S: 25, B: 20, R: 15, N: 10, F: 10 };
      Object.entries(defaults).forEach(([k, pts]) => { if (CHURN_WEIGHTS[k]) CHURN_WEIGHTS[k].pts = pts; });
      CHURN_WATCHLIST.forEach(m => { m.score = computeChurnScore(m); });
      showToast('Churn Risk Score weights reset to PRD v3.2 defaults.');
      renderAdminRules();
    });
  }

  /* ========================================================================
     BOOT (CHECK EXISTING SESSION OR SHOW ZERO-FRICTION LOGIN GATE)
     ======================================================================== */
  renderQuickRoster();
  (async () => {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .maybeSingle();
      if (prof && prof.is_active) {
        const uiRole = ROLE_TO_UI[prof.role] || 'agent';
        await hydrateFromSupabase();
        startRealtimeSubscriptions();
        signInUser({
          id: prof.id,
          email: prof.email,
          username: prof.username,
          password: '••••••••••••',
          role: uiRole,
          team: prof.team_id || 'Inbound Desk A',
          active: true,
        });
      }
    }
  })();
})();
