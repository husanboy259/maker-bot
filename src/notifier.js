import { getSubscribedUsers } from './queries.js';
import { sleep } from './utils.js';

async function broadcast(bot, userIds, text) {
  for (const uid of userIds) {
    try {
      await bot.telegram.sendMessage(uid, text, { parse_mode: 'HTML' });
      await sleep(50); // Telegram rate limit
    } catch (err) {
      console.warn(`Failed to send to ${uid}:`, err.message);
    }
  }
}

export async function notifyDeploy(bot, { projectName, status, env = '', commit = '' }) {
  const icons = { success: '✅', failed: '❌', running: '🔄' };
  const icon = icons[status] || '🚀';
  const text =
    `${icon} <b>Deploy: ${projectName}</b>\n` +
    `Holat: <b>${status}</b>\n` +
    `Muhit: ${env || '—'}` +
    (commit ? `\nCommit: <code>${commit.slice(0, 10)}</code>` : '');
  const users = await getSubscribedUsers('deploy');
  await broadcast(bot, users, text);
}

export async function notifyApiEvent(bot, { apiName, event }) {
  const text = `🔑 <b>API: ${apiName}</b>\n${event}`;
  const users = await getSubscribedUsers('api');
  await broadcast(bot, users, text);
}

export async function notifyProjectEvent(bot, { projectName, event }) {
  const text = `📁 <b>Loyiha: ${projectName}</b>\n${event}`;
  const users = await getSubscribedUsers('project');
  await broadcast(bot, users, text);
}

export async function notifyPayment(bot, { amount, currency, status }) {
  const icons = { success: '✅', failed: '❌', pending: '🟡' };
  const icon = icons[status] || '💳';
  const text = `${icon} <b>To'lov: ${amount} ${currency}</b>\nHolat: ${status}`;
  const users = await getSubscribedUsers('payment');
  await broadcast(bot, users, text);
}
