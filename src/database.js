import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('DB pool error:', err.message);
});

export const query = (sql, params) => pool.query(sql, params);

export const fetchAll = async (sql, params = []) => {
  const { rows } = await pool.query(sql, params);
  return rows;
};

export const fetchOne = async (sql, params = []) => {
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
};

export const fetchVal = async (sql, params = []) => {
  const { rows } = await pool.query(sql, params);
  return rows[0] ? Object.values(rows[0])[0] : null;
};

export const execute = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result;
};

export const closePool = () => pool.end();
