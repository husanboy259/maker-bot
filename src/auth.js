import crypto from 'crypto';
import { execute, fetchOne } from './database.js';

// ── OAuth state store (DB) ────────────────────────────────────────────────────

export async function createOAuthState(telegramId) {
  const state = crypto.randomBytes(24).toString('hex');
  await execute(
    `INSERT INTO oauth_states (state, telegram_id) VALUES ($1, $2)
     ON CONFLICT (state) DO NOTHING`,
    [state, String(telegramId)],
  );
  return state;
}

export async function consumeOAuthState(state) {
  const row = await fetchOne(
    `DELETE FROM oauth_states
     WHERE state = $1 AND expires_at > NOW()
     RETURNING telegram_id`,
    [state],
  );
  return row?.telegram_id || null;
}

export async function purgeExpiredStates() {
  await execute('DELETE FROM oauth_states WHERE expires_at < NOW()');
}

// ── Redirect URI (must match Google Cloud Console exactly) ───────────────────

export function getRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI
    || `${process.env.CALLBACK_URL}/auth/google/callback`;
}

// ── Google OAuth2 ─────────────────────────────────────────────────────────────

export async function getGoogleOAuthUrl(telegramId) {
  const state = await createOAuthState(telegramId);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data;
}

export async function getGoogleUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

// ── Link Google user → bot_profile ───────────────────────────────────────────

export async function linkUserToProfile(telegramId, googleUser) {
  const { email, name, picture } = googleUser;

  let user = await fetchOne(
    'SELECT id, email, full_name, avatar_url FROM users WHERE email = $1',
    [email],
  );

  if (!user) {
    const newId = crypto.randomUUID();
    await execute(
      `INSERT INTO users
         (id, email, full_name, avatar_url, role, is_active, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'user', true, true, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
         SET full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url, updated_at = NOW()`,
      [newId, email, name || '', picture || ''],
    );
    user = await fetchOne('SELECT id, email, full_name FROM users WHERE email = $1', [email]);
  }

  await execute(
    `UPDATE bot_profiles
     SET supabase_uid = $1, email = $2, name = $3, updated_at = NOW()
     WHERE telegram_chat_id = $4`,
    [String(user.id), email, name || user.full_name || '', String(telegramId)],
  );

  return user;
}
