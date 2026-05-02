import { paginateButtons, backButton } from '../keyboards.js';
import { getUserProjects, getProjectDetail } from '../queries.js';
import { fmtDate } from '../utils.js';

const STATUS_ICONS = { active: '🟢', inactive: '🔴', pending: '🟡', archived: '📦', paused: '⏸️' };
const PER_PAGE = 8;

function buildItems(projects) {
  return projects.map((p) => ({
    id: p.id,
    label: `${STATUS_ICONS[p.status] || '📁'} ${p.name}`,
  }));
}

export function registerProjects(bot) {
  bot.hears('📁 Loyihalar', async (ctx) => {
    const projects = await getUserProjects(ctx.from.id);
    if (!projects.length) {
      return ctx.reply("📁 Hozircha loyihalar yo'q.", backButton('back_main'));
    }
    await ctx.reply(
      `📁 <b>Loyihalar</b> (${projects.length} ta)`,
      { parse_mode: 'HTML', ...paginateButtons(buildItems(projects), 0, PER_PAGE, 'proj', 'back_main') },
    );
  });

  // id is TEXT (uuid-like), match anything
  bot.action(/^proj:(.+)$/, async (ctx) => {
    const p = await getProjectDetail(ctx.match[1]);
    if (!p) return ctx.answerCbQuery("Loyiha topilmadi", { show_alert: true });
    const icon = STATUS_ICONS[p.status] || '📁';
    const text =
      `📁 <b>${p.name || '—'}</b>\n\n` +
      `${icon} Holat: <b>${p.status || '—'}</b>\n` +
      `📝 Tavsif: ${p.description || '—'}\n` +
      `📅 Yaratilgan: ${fmtDate(p.created_at)}\n` +
      `🔄 Yangilangan: ${fmtDate(p.updated_at)}`;
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...backButton('back_projects') });
    await ctx.answerCbQuery();
  });

  bot.action('back_projects', async (ctx) => {
    const projects = await getUserProjects(ctx.from.id);
    if (!projects.length) return ctx.editMessageText("📁 Hozircha loyihalar yo'q.");
    await ctx.editMessageText(
      `📁 <b>Loyihalar</b> (${projects.length} ta)`,
      { parse_mode: 'HTML', ...paginateButtons(buildItems(projects), 0, PER_PAGE, 'proj', 'back_main') },
    );
    await ctx.answerCbQuery();
  });

  bot.action(/^page:proj:(\d+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    const projects = await getUserProjects(ctx.from.id);
    await ctx.editMessageText(
      `📁 <b>Loyihalar</b> (${projects.length} ta) — ${page + 1}-sahifa`,
      { parse_mode: 'HTML', ...paginateButtons(buildItems(projects), page, PER_PAGE, 'proj', 'back_main') },
    );
    await ctx.answerCbQuery();
  });
}
