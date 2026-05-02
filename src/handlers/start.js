import { mainMenu } from '../keyboards.js';
import { getOrCreateBotProfile } from '../queries.js';

export function registerStart(bot) {
  bot.start(async (ctx) => {
    const { id, username, first_name, last_name } = ctx.from;
    const fullName = [first_name, last_name].filter(Boolean).join(' ');
    await getOrCreateBotProfile(id, username, fullName);

    await ctx.reply(
      `Salom, <b>${fullName}</b>! 👋\n\nMakerPay botiga xush kelibsiz.\nQuyidagi tugmalardan birini tanlang:`,
      { parse_mode: 'HTML', ...mainMenu() },
    );
  });
}
