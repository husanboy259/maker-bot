import { paginateButtons, backButton } from '../keyboards.js';
import { getUserApis, getApiDetail } from '../queries.js';
import { fmtDate } from '../utils.js';

const STATUS_ICONS = { active: '🟢', inactive: '🔴', expired: '⏰', revoked: '🚫' };
const PER_PAGE = 8;

function buildItems(apis) {
  return apis.map((a) => ({
    id: a.id,
    label: `${STATUS_ICONS[a.status] || '🔑'} ${a.name || 'API #' + a.id}`,
  }));
}

export function registerApis(bot) {
  bot.hears('🔑 API kalitlar', async (ctx) => {
    const apis = await getUserApis(ctx.from.id);
    if (!apis.length) {
      return ctx.reply("🔑 Hozircha API kalitlar yo'q.", backButton('back_main'));
    }
    await ctx.reply(
      `🔑 <b>API kalitlar</b> (${apis.length} ta)`,
      { parse_mode: 'HTML', ...paginateButtons(buildItems(apis), 0, PER_PAGE, 'api', 'back_main') },
    );
  });

  bot.action(/^api:(\d+)$/, async (ctx) => {
    const a = await getApiDetail(Number(ctx.match[1]));
    if (!a) return ctx.answerCbQuery('API topilmadi', { show_alert: true });
    const icon = STATUS_ICONS[a.status] || '🔑';
    let prefix = a.key_prefix || '***';
    if (String(prefix).length > 12) prefix = String(prefix).slice(0, 8) + '****';
    const text =
      `🔑 <b>${a.name || '—'}</b>\n\n` +
      `${icon} Holat: <b>${a.status || '—'}</b>\n` +
      `🔐 Kalit: <code>${prefix}</code>\n` +
      `📅 Yaratilgan: ${fmtDate(a.created_at)}\n` +
      `🕐 Oxirgi ishlatilgan: ${fmtDate(a.last_used_at)}\n` +
      `⏳ Amal qilish muddati: ${fmtDate(a.expires_at)}`;
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...backButton('back_apis') });
    await ctx.answerCbQuery();
  });

  bot.action('back_apis', async (ctx) => {
    const apis = await getUserApis(ctx.from.id);
    if (!apis.length) return ctx.editMessageText("🔑 Hozircha API kalitlar yo'q.");
    await ctx.editMessageText(
      `🔑 <b>API kalitlar</b> (${apis.length} ta)`,
      { parse_mode: 'HTML', ...paginateButtons(buildItems(apis), 0, PER_PAGE, 'api', 'back_main') },
    );
    await ctx.answerCbQuery();
  });

  bot.action(/^page:api:(\d+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    const apis = await getUserApis(ctx.from.id);
    await ctx.editMessageText(
      `🔑 <b>API kalitlar</b> (${apis.length} ta) — ${page + 1}-sahifa`,
      { parse_mode: 'HTML', ...paginateButtons(buildItems(apis), page, PER_PAGE, 'api', 'back_main') },
    );
    await ctx.answerCbQuery();
  });
}
