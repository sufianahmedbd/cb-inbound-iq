export interface Env {
  ASSETS: Fetcher;
  APP_TIMEZONE: string;
  GLOBAL_TRACKER_CHANNEL: string;
  GLOBAL_TRACKER_SUPABASE_PROJECT: string;
  CRM_SUPABASE_URL: string;
  CRM_SUPABASE_ANON_KEY: string;
  CRM_SUPABASE_SERVICE_ROLE_KEY?: string;
  GLOBAL_TRACKER_API_URL?: string;
  GLOBAL_TRACKER_API_TOKEN?: string;
  GLOBAL_SUPABASE_URL?: string;
  GLOBAL_SUPABASE_READONLY_KEY?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  SHEETS_WEBHOOK_HMAC_SECRET?: string;

  SHEET_MASTER_FALLBACK_HUB_ID: string;
  SHEET_TEAM_BUSINESS_KAM_ID: string;
  SHEET_TEAM_TECH_PRODUCT_ID: string;
  SHEET_TEAM_ACCOUNTS_ID: string;
  SHEET_TEAM_ACTIVATION_ID: string;
  SHEET_TEAM_SUPPLY_SAFETY_ID: string;
  SHEET_TEAM_ISSUE_RES_ID: string;
  SHEET_MERCHANT_KAM_MASTER_ID: string;
  SHEET_TAXONOMY_V4_REF_ID: string;
}

export type UserRole = 'Agent' | 'Call PIC' | 'Supervisor' | 'Management' | 'Admin';

export interface CallerProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  team_id: string;
  is_active: boolean;
}
