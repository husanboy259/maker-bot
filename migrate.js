import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const SQL = `
ALTER TABLE bot_profiles
  ADD COLUMN IF NOT EXISTS deploy_notifications  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS api_notifications     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS project_notifications BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_notifications BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_bot_profiles_telegram_chat_id ON bot_profiles(telegram_chat_id);

-- Temporary OAuth state tokens (auto-expire after 10 min)
CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT        PRIMARY KEY,
  telegram_id TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes'
);
`;

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

await client.connect();
await client.query(SQL);
await client.end();
console.log('✅ Migration muvaffaqiyatli bajarildi.');
