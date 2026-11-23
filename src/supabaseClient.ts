import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://cvgrryozzonwfnwpjxuf.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Z3JyeW96em9ud2Zud3BqeHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0NTgzOTAsImV4cCI6MjExMTAzNDM5MH0.397QtwewcThwKAJ_Kjvl-Ijo7XyqMVUyr6VVUmCO2Qo';
export const ADMIN_MANAGE_USER_URL = `${SUPABASE_URL}/functions/v1/admin-manage-user`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'carrybee_inboundiq_sb_auth_v32',
  },
});

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export async function callWorkerApi(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(path, { ...init, headers });
}
