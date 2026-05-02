import { paginateButtons, backButton } from '../keyboards.js';
import { getUserDeployments, getDeploymentDetail } from '../queries.js';
import { fmtDate } from '../utils.js';

const STATUS_ICONS = { success: '✅', failed: '❌', running: '🔄', pending: '🟡', cancelled: '🚫', queued: '⏳', active: '🟢', inactive: '🔴' };
const PER_PAGE = 8;

function buildItems(deploys) {
  return deploys.map((d) => ({
    id: d.id,
    label: `${STATUS_ICONS[d.status] || '🚀'} ${d.project_name || 'Deploy #' + d.id}`,
  }));
}

export function registerDeployments(bot) {
  bot.hears('🚀 Deploylar', async (ctx) => {
    const deploys = await getUserDeployments(ctx.from.id);
    if (!deploys.length) {
      return ctx.reply("🚀 Hozircha deploylar yo'q.", backButton('back_main'));
    }
    await ctx.reply(
      `🚀 <b>Deploylar</b> (${deploys.length} ta)`,
      { parse_mode: 'HTML', ...paginateButtons(buildItems(deploys), 0, PER_PAGE, 'dep', 'back_main') },
    );
  });

  bot.action(/^dep:(.+)$/, async (ctx) => {
    const d = await getDeploymentDetail(ctx.match[1]);
    if (!d) return ctx.answerCbQuery('Deploy topilmadi', { show_alert: true });
    const icon = STATUS_ICONS[d.status] || '🚀';
    let duration = '';
    if (d.created_at && d.updated_at) {
      const secs = Math.floor((new Date(d.updated_at) - new Date(d.created_at)) / 1000);
      if (secs > 0) duration = `\n⏱️ Davomiylik: ${Math.floor(secs / 60)}m ${secs % 60}s`;
    }
    const text =
      `🚀 <b>${d.project_name_linked || d.project_name || '—'}</b>\n\n` +
      `${icon} Holat: <b>${d.status || '—'}</b>\n` +
      `🌐 URL: ${d.url || '—'}\n` +
      `📅 Yaratilgan: ${fmtDate(d.created_at)}\n` +
      `🔄 Yangilangan: ${fmtDate(d.updated_at)}` +
      duration;
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...backButton('back_deploys') });
    await ctx.answerCbQuery();
  });

  bot.action('back_deploys', async (ctx) => {
    const deploys = await getUserDeployments(ctx.from.id);
    if (!deploys.length) return ctx.editMessageText("🚀 Hozircha deploylar yo'q.");
    await ctx.editMessageText(
      `🚀 <b>Deploylar</b> (${deploys.length} ta)`,
      { parse_mode: 'HTML', ...paginateButtons(buildItems(deploys), 0, PER_PAGE, 'dep', 'back_main') },
    );
    await ctx.answerCbQuery();
  });

  bot.action(/^page:dep:(\d+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    const deploys = await getUserDeployments(ctx.from.id);
    await ctx.editMessageText(
      `🚀 <b>Deploylar</b> (${deploys.length} ta) — ${page + 1}-sahifa`,
      { parse_mode: 'HTML', ...paginateButtons(buildItems(deploys), page, PER_PAGE, 'dep', 'back_main') },
    );
    await ctx.answerCbQuery();
  });
}
