import { Markup } from 'telegraf';
import { getGoogleOAuthUrl, getRedirectUri } from '../auth.js';
import { getBotProfile } from '../queries.js';
import { fetchOne, execute } from '../database.js';

// Track users waiting for email input
const awaitingEmail = new Set();

export function registerConnect(bot) {

  // ── Main connect button ───────────────────────────────────────────────────
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

  // ── Email fallback ────────────────────────────────────────────────────────
  bot.action('connect_email', async (ctx) => {
    await ctx.answerCbQuery();
    awaitingEmail.add(ctx.from.id);
    await ctx.editMessageText(
      `📧 <b>Email orqali ulash</b>\n\n` +
      `MakerPay da ro'yxatdan o'tgan email manzilingizni yuboring:\n\n` +
      `<i>Misol: user@gmail.com</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'cancel_email')]]),
      },
    );
  });

  bot.action('cancel_email', async (ctx) => {
    awaitingEmail.delete(ctx.from.id);
    await ctx.answerCbQuery();
    await handleConnect(ctx);
  });

  // Intercept plain text as email input
  bot.on('text', async (ctx, next) => {
    if (!awaitingEmail.has(ctx.from.id)) return next();
    awaitingEmail.delete(ctx.from.id);

    const email = ctx.message.text.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ctx.reply(
        '❌ Noto\'g\'ri email format. Qayta urinib ko\'ring.',
        Markup.inlineKeyboard([[Markup.button.callback('🔗 Qayta ulash', 'connect_google')]]),
      );
    }

    const user = await fetchOne(
      'SELECT id, email, full_name FROM users WHERE LOWER(email) = $1',
      [email],
    );

    if (!user) {
      return ctx.reply(
        `❌ <b>${email}</b> email bilan hisob topilmadi.\n\nAvval MakerPay da ro'yxatdan o'ting.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'connect_google')]]),
        },
      );
    }

    // Link account
    await execute(
      `UPDATE bot_profiles
       SET supabase_uid = $1, email = $2, name = $3, updated_at = NOW()
       WHERE telegram_chat_id = $4`,
      [String(user.id), user.email, user.full_name || '', String(ctx.from.id)],
    );

    await ctx.reply(
      `✅ <b>Hisob muvaffaqiyatli ulandi!</b>\n\n` +
      `📧 Email: <code>${user.email}</code>\n` +
      `👤 Ism: ${user.full_name || '—'}\n\n` +
      `Endi 👤 <b>Profil</b> tugmasini bosib ma'lumotlaringizni ko'ring.`,
      { parse_mode: 'HTML' },
    );
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

  // Generate Google OAuth URL
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
  buttons.push([Markup.button.callback('📧 Email bilan ulash', 'connect_email')]);
  buttons.push([Markup.button.callback('🔙 Orqaga', 'back_main')]);

  await ctx.reply(
    `🔗 <b>Hisob ulash</b>\n\n` +
    `MakerPay hisobingizni Telegram bot bilan ulang.\n\n` +
    `<b>1️⃣ Google orqali</b> — tez va qulay\n` +
    `<b>2️⃣ Email orqali</b> — Google ishlamasa\n\n` +
    `⏱️ Google havolasi <b>10 daqiqa</b> amal qiladi.`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) },
  );
}
