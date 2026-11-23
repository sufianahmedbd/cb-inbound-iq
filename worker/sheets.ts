/**
 * Edge-Compatible Google Sheets API v4 Client for Cloudflare Workers
 * Uses Web Crypto API (RSASSA-PKCS1-v1_5 SHA-256) — zero Node.js native modules.
 */

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

let cachedAccessToken: { token: string; exp: number } | null = null;

export async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.exp > nowSec + 60) {
    return cachedAccessToken.token;
  }

  const creds: ServiceAccountCreds = JSON.parse(serviceAccountJson);
  const tokenUri = creds.token_uri || 'https://oauth2.googleapis.com/token';

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: tokenUri,
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );

  const signingInput = `${header}.${payload}`;
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(creds.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const assertion = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  const resp = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Google OAuth failed (${resp.status}): ${await resp.text()}`);
  }
  const data = (await resp.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = { token: data.access_token, exp: nowSec + data.expires_in };
  return data.access_token;
}

export async function appendSheetRow(
  accessToken: string,
  spreadsheetId: string,
  rangeA1: string,
  rowValues: string[]
): Promise<{ updatedRange?: string }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    rangeA1
  )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ majorDimension: 'ROWS', values: [rowValues] }),
  });
  if (!resp.ok) {
    throw new Error(`Sheets append failed (${resp.status}): ${await resp.text()}`);
  }
  const json = (await resp.json()) as { updates?: { updatedRange?: string } };
  return { updatedRange: json.updates?.updatedRange };
}

export async function readSheetRange(
  accessToken: string,
  spreadsheetId: string,
  rangeA1: string
): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    rangeA1
  )}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    throw new Error(`Sheets read failed (${resp.status}): ${await resp.text()}`);
  }
  const json = (await resp.json()) as { values?: string[][] };
  return json.values || [];
}
