import { Markup } from 'telegraf';
import { getGoogleOAuthUrl, getRedirectUri } from '../auth.js';
import { getBotProfile } from '../queries.js';
import { execute } from '../database.js';

export function registerConnect(bot) {

  bot.hears('🔗 Google bilan ulash', async (ctx) => {
    await handleConnect(ctx);
  });

  bot.command('connect', async (ctx) => {
    await handleConnect(ctx);
  });

  bot.action('connect_google', async (ctx) => {
    await ctx.answerCbQuery();
    await handleConnect(ctx);
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  bot.action('disconnect_account', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '⚠️ Haqiqatan ham hisobni uzmoqchimisiz?\n\nBot orqali ma\'lumotlarga kirish to\'xtatiladi.',
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Ha, uzish', 'confirm_disconnect')],
        [Markup.button.callback('❌ Bekor qilish', 'back_main')],
      ]),
    );
  });

  bot.action('confirm_disconnect', async (ctx) => {
    await execute(
      `UPDATE bot_profiles SET supabase_uid = '', email = '', updated_at = NOW()
       WHERE telegram_chat_id = $1`,
      [String(ctx.from.id)],
    );
    await ctx.editMessageText(
      '✅ Hisob uzildi.\n\n🔗 Qayta ulash uchun <b>Google bilan ulash</b> tugmasini bosing.',
      { parse_mode: 'HTML' },
    );
    await ctx.answerCbQuery();
  });
}

// ── handleConnect ─────────────────────────────────────────────────────────────
async function handleConnect(ctx) {
  const profile = await getBotProfile(ctx.from.id);

  if (profile?.supabase_uid && profile.supabase_uid.length > 5) {
    return ctx.reply(
      `✅ <b>Hisob allaqachon ulangan</b>\n\n` +
      `📧 Email: <code>${profile.email || '—'}</code>\n\n` +
      `Boshqa hisob ulash uchun avval uzishingiz kerak.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔓 Hisobni uzish', 'disconnect_account')],
          [Markup.button.callback('🔙 Orqaga', 'back_main')],
        ]),
      },
    );
  }

  let googleUrl;
  try {
    googleUrl = await getGoogleOAuthUrl(ctx.from.id);
    console.log('[OAuth] redirect_uri:', getRedirectUri());
  } catch (err) {
    console.error('[OAuth] URL error:', err.message);
    googleUrl = null;
  }

  const buttons = [];
  if (googleUrl) {
    buttons.push([Markup.button.url('🔗 Google bilan kirish', googleUrl)]);
  }
  buttons.push([Markup.button.callback('🔙 Orqaga', 'back_main')]);

  await ctx.reply(
    `🔗 <b>Google bilan ulash</b>\n\n` +
    `⚠️ <b>Avval saytdan ro'yxatdan o'ting!</b>\n` +
    `👉 <a href="https://makerpay.uz/sign-up">makerpay.uz/sign-up</a>\n\n` +
    `Ro'yxatdan o'tgach, Google hisobingiz bilan ulang.\n\n` +
    `⏱️ Havola <b>10 daqiqa</b> amal qiladi.`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) },
  );
}
