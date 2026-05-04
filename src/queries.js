import { fetchAll, fetchOne, execute } from './database.js';

// ── Bot Profile (Telegram user record) ───────────────────────────────────────
// bot_profiles.telegram_chat_id = Telegram user ID (stored as text)
// bot_profiles.telegram_enabled = notifications on/off

export async function getOrCreateBotProfile(telegramId, username, fullName) {
  const tid = String(telegramId);
  const existing = await fetchOne(
    'SELECT * FROM bot_profiles WHERE telegram_chat_id = $1',
    [tid],
  );
  if (existing) return existing;

  await execute(
    `INSERT INTO bot_profiles (id, supabase_uid, email, name, telegram_chat_id, telegram_enabled, created_at, updated_at)
     VALUES (gen_random_uuid(), '', NULL, $1, $2, true, NOW(), NOW())
     ON CONFLICT (telegram_chat_id) DO NOTHING`,
    [fullName, tid],
  );
  return fetchOne('SELECT * FROM bot_profiles WHERE telegram_chat_id = $1', [tid]);
}

export const getBotProfile = (telegramId) =>
  fetchOne('SELECT * FROM bot_profiles WHERE telegram_chat_id = $1', [String(telegramId)]);

export const updateNotificationEnabled = (telegramId, enabled) =>
  execute(
    'UPDATE bot_profiles SET telegram_enabled = $1, updated_at = NOW() WHERE telegram_chat_id = $2',
    [enabled, String(telegramId)],
  );

const ALLOWED_COLS = new Set([
  'deploy_notifications', 'api_notifications', 'project_notifications', 'payment_notifications',
]);

export async function updateNotificationType(telegramId, col, value) {
  if (!ALLOWED_COLS.has(col)) throw new Error(`Unknown column: ${col}`);
  await execute(
    `UPDATE bot_profiles SET ${col} = $1, updated_at = NOW() WHERE telegram_chat_id = $2`,
    [value, String(telegramId)],
  );
}

// ── User profile (linked via supabase_uid → users.id) ────────────────────────

export const getUserProfile = (telegramId) =>
  fetchOne(
    `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.is_active,
            u.created_at, u.last_login_at,
            m.business_name, m.status AS merchant_status, m.balance, m.currency
     FROM bot_profiles bp
     JOIN users u ON u.id::text = bp.supabase_uid
     LEFT JOIN merchants m ON m.user_id = u.id
     WHERE bp.telegram_chat_id = $1
       AND bp.supabase_uid != ''`,
    [String(telegramId)],
  );

// ── Projects (bot_projects.profile_id → bot_profiles.id) ─────────────────────

export const getUserProjects = (telegramId) =>
  fetchAll(
    `SELECT p.id, p.name, p.description, p.status, p.created_at, p.updated_at
     FROM bot_projects p
     JOIN bot_profiles bp ON bp.id = p.profile_id
     WHERE bp.telegram_chat_id = $1
     ORDER BY p.created_at DESC LIMIT 50`,
    [String(telegramId)],
  );

export const getProjectDetail = (projectId) =>
  fetchOne('SELECT * FROM bot_projects WHERE id = $1', [projectId]);

// ── Deployments (bot_deployments.profile_id → bot_profiles.id) ───────────────

export const getUserDeployments = (telegramId) =>
  fetchAll(
    `SELECT d.id, d.name AS project_name, d.status, d.url, d.project_id, d.created_at, d.updated_at
     FROM bot_deployments d
     JOIN bot_profiles bp ON bp.id = d.profile_id
     WHERE bp.telegram_chat_id = $1
     ORDER BY d.created_at DESC LIMIT 50`,
    [String(telegramId)],
  );

export const getDeploymentDetail = (deployId) =>
  fetchOne(
    `SELECT d.id, d.name AS project_name, d.status, d.url,
            d.project_id, d.created_at, d.updated_at,
            p.name AS project_name_linked
     FROM bot_deployments d
     LEFT JOIN bot_projects p ON p.id = d.project_id
     WHERE d.id = $1`,
    [deployId],
  );

// ── API Keys (via supabase_uid → users → merchants) ──────────────────────────

export const getUserApis = (telegramId) =>
  fetchAll(
    `SELECT a.id, a.name, a.key_prefix, a.environment,
            CASE WHEN a.is_active THEN 'active' ELSE 'inactive' END AS status,
            a.last_used_at, a.expires_at, a.created_at
     FROM api_keys a
     JOIN merchants m ON m.id = a.merchant_id
     JOIN users u ON u.id = m.user_id
     JOIN bot_profiles bp ON bp.supabase_uid = u.id::text
     WHERE bp.telegram_chat_id = $1
     ORDER BY a.created_at DESC LIMIT 50`,
    [String(telegramId)],
  );

export const getApiDetail = (apiId) =>
  fetchOne(
    `SELECT id, name, key_prefix, environment,
            CASE WHEN is_active THEN 'active' ELSE 'inactive' END AS status,
            last_used_at, expires_at, created_at, revoked_at
     FROM api_keys WHERE id = $1`,
    [apiId],
  );

// ── Completed / Done items ────────────────────────────────────────────────────
// bot_purchases with status = 'completed'

export const getCompletedItems = (telegramId) =>
  fetchAll(
    `SELECT bp2.id, s.name, 'purchase' AS type, bp2.created_at AS done_at
     FROM bot_purchases bp2
     JOIN bot_shop_items s ON s.id = bp2.item_id
     JOIN bot_profiles bp ON bp.id = bp2.profile_id
     WHERE bp.telegram_chat_id = $1 AND bp2.status = 'completed'
     ORDER BY bp2.created_at DESC LIMIT 30`,
    [String(telegramId)],
  );

// ── Payments (via merchant) ───────────────────────────────────────────────────

export const getUserPayments = (telegramId) =>
  fetchAll(
    `SELECT p.id, p.amount, p.currency, p.status, p.description,
            p.customer_name, p.provider_name, p.created_at, p.paid_at
     FROM payments p
     JOIN merchants m ON m.id = p.merchant_id
     JOIN users u ON u.id = m.user_id
     JOIN bot_profiles bp ON bp.supabase_uid = u.id::text
     WHERE bp.telegram_chat_id = $1
     ORDER BY p.created_at DESC LIMIT 30`,
    [String(telegramId)],
  );

// ── Notifications (from notifications table) ──────────────────────────────────

export const getUserNotifications = (telegramId) =>
  fetchAll(
    `SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     JOIN bot_profiles bp ON bp.supabase_uid = u.id::text
     WHERE bp.telegram_chat_id = $1
     ORDER BY n.created_at DESC LIMIT 20`,
    [String(telegramId)],
  );

// ── Broadcast helpers ─────────────────────────────────────────────────────────

const COL_MAP = {
  deploy: 'deploy_notifications',
  api: 'api_notifications',
  project: 'project_notifications',
  payment: 'payment_notifications',
};

export async function getSubscribedUsers(type) {
  const col = COL_MAP[type];
  if (!col) return [];
  const rows = await fetchAll(
    `SELECT telegram_chat_id FROM bot_profiles
     WHERE telegram_enabled = true AND ${col} = true AND telegram_chat_id IS NOT NULL`,
  );
  return rows.map((r) => r.telegram_chat_id);
}
