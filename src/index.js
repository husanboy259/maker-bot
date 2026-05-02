import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { closePool } from './database.js';
import { createCallbackServer } from './server.js';
import { registerCommon } from './handlers/common.js';
import { registerStart } from './handlers/start.js';
import { registerProfile } from './handlers/profile.js';
import { registerProjects } from './handlers/projects.js';
import { registerApis } from './handlers/apis.js';
import { registerDeployments } from './handlers/deployments.js';
import { registerDone } from './handlers/done.js';
import { registerTerms } from './handlers/terms.js';
import { registerNotifications } from './handlers/notifications.js';
import { registerConnect } from './handlers/connect.js';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN .env faylida topilmadi!');

const bot = new Telegraf(token);

// Global error handler
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err.message);
  ctx.reply('Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.').catch(() => {});
});

// Register all handlers
registerCommon(bot);
registerStart(bot);
registerProfile(bot);
registerConnect(bot);
registerProjects(bot);
registerApis(bot);
registerDeployments(bot);
registerDone(bot);
registerTerms(bot);
registerNotifications(bot);

// Start OAuth callback server
createCallbackServer(bot);

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} qabul qilindi. Bot to'xtatilmoqda...`);
  bot.stop(signal);
  await closePool();
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

bot.launch().then(() => {
  console.log('✅ MakerPay bot ishga tushdi!');
}).catch((err) => {
  console.error('Bot ishga tushmadi:', err.message);
  process.exit(1);
});
