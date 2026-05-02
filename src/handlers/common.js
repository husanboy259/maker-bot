import { mainMenu } from '../keyboards.js';

export function registerCommon(bot) {
  bot.action('back_main', async (ctx) => {
    await ctx.deleteMessage().catch(() => {});
    await ctx.answerCbQuery();
  });

  bot.command('menu', async (ctx) => {
    await ctx.reply('Asosiy menyu:', mainMenu());
  });
}
