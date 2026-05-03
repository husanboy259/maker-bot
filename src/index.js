import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { closePool } from './database.js';
import { createCallbackServer, startServer } from './server.js';
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

bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err.message);
  ctx.reply('Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.').catch(() => {});
});

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

const shutdown = async (signal) => {
  console.log(`\n${signal} qabul qilindi. Bot to'xtatilmoqda...`);
  bot.stop(signal);
  await closePool();
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Render provides RENDER_EXTERNAL_URL automatically
const domain = process.env.RENDER_EXTERNAL_URL
  || process.env.CALLBACK_URL
  || null;

const isProduction = !!domain;

if (isProduction) {
  // Production: webhook mode — no polling, no 409 conflicts
  const app = createCallbackServer(bot);
  app.use(bot.webhookCallback('/telegram-webhook'));
  startServer(app);
  // Delete any old webhook first, then set new one
  await bot.telegram.deleteWebhook();
  await bot.telegram.setWebhook(`${domain}/telegram-webhook`);
  console.log(`✅ Webhook: ${domain}/telegram-webhook`);
} else {
  // Development: long polling
  createCallbackServer(bot);
  await bot.launch();
  console.log('✅ MakerPay bot ishga tushdi! (polling)');
}
