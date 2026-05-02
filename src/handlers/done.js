import { backButton } from '../keyboards.js';
import { getCompletedItems } from '../queries.js';
import { fmtDateShort } from '../utils.js';

const TYPE_ICONS = { deploy: '🚀', task: '✅', payment: '💳', order: '📦' };

export function registerDone(bot) {
  bot.hears('✅ Tugatilganlar', async (ctx) => {
    const items = await getCompletedItems(ctx.from.id);
    if (!items.length) {
      return ctx.reply("✅ Hozircha tugatilgan elementlar yo'q.", backButton('back_main'));
    }
    const lines = [`✅ <b>Tugatilganlar</b> (${items.length} ta)\n`];
    for (const item of items) {
      const icon = TYPE_ICONS[item.type] || '✅';
      lines.push(`${icon} ${item.name || '—'} — <i>${fmtDateShort(item.done_at)}</i>`);
    }
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', ...backButton('back_main') });
  });
}
