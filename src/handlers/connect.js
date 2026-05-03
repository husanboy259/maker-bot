import { Markup } from 'telegraf';
import bcrypt from 'bcrypt';
import { getGoogleOAuthUrl, getRedirectUri } from '../auth.js';
import { getBotProfile } from '../queries.js';
import { fetchOne, execute } from '../database.js';

// State machine per user: null | 'email' | 'password'
const awaitingStep = new Map(); // telegramId → { step, email? }

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

  // ── Step 1: Ask email + password together ────────────────────────────────
  bot.action('connect_email', async (ctx) => {
    await ctx.answerCbQuery();
    awaitingStep.set(ctx.from.id, { step: 'email_password' });
    await ctx.editMessageText(
      `📧 <b>Email orqali ulash</b>\n\n` +
      `<b>1-qadam:</b> Saytdan ro'yxatdan o'ting:\n` +
      `👉 <a href="https://makerpay.uz/sign-up">makerpay.uz/sign-up</a>\n\n` +
      `<b>2-qadam:</b> MakerPay da ro'yxatdan o'tgan email va parolingizni yuboring:\n\n` +
      `<code>user@gmail.com\nparolingiz</code>\n\n` +
      `<i>⚠️ Xabar yuborilgandan so'ng avtomatik o'chiriladi.</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'cancel_email')]]),
      },
    );
  });

  bot.action('cancel_email', async (ctx) => {
    awaitingStep.delete(ctx.from.id);
    await ctx.answerCbQuery();
    await handleConnect(ctx);
  });

  // ── Text interceptor: email + password in one message ────────────────────
  bot.on('text', async (ctx, next) => {
    const state = awaitingStep.get(ctx.from.id);
    if (!state) return next();

    awaitingStep.delete(ctx.from.id);

    // Delete user's message immediately for security
    await ctx.deleteMessage().catch(() => {});

    const lines = ctx.message.text.trim().split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      return ctx.reply(
        '❌ Email va parolni <b>ikki qatorda</b> yuboring:\n\n' +
        '<code>user@gmail.com\nparolingiz</code>',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback('🔄 Qayta urinish', 'connect_email')]]),
        },
      );
    }

    const email = lines[0].toLowerCase();
    const password = lines[1];

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ctx.reply(
        '❌ Noto\'g\'ri email format.\n\nQayta yuboring:',
        Markup.inlineKeyboard([[Markup.button.callback('🔄 Qayta urinish', 'connect_email')]]),
      );
    }

    const user = await fetchOne(
      'SELECT id, email, full_name, password FROM users WHERE LOWER(email) = $1',
      [email],
    );

    if (!user) {
      return ctx.reply(
        `❌ <b>${email}</b> email bilan hisob topilmadi.\n\nAvval saytdan ro'yxatdan o'ting.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.url('📝 Ro\'yxatdan o\'tish', 'https://makerpay.uz/sign-up')],
            [Markup.button.callback('🔄 Qayta urinish', 'connect_email')],
          ]),
        },
      );
    }

    if (!user.password) {
      return ctx.reply(
        '❌ Bu hisob uchun parol o\'rnatilmagan.\n\n🔗 Google orqali ulashni sinab ko\'ring.',
        Markup.inlineKeyboard([[Markup.button.callback('🔗 Google bilan ulash', 'connect_google')]]),
      );
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return ctx.reply(
        '❌ <b>Email yoki parol noto\'g\'ri.</b>\n\nQayta urinib ko\'ring.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Qayta urinish', 'connect_email')],
            [Markup.button.callback('🔙 Orqaga', 'connect_google')],
          ]),
        },
      );
    }

    // ✅ Correct — link account
    await execute(
      `UPDATE bot_profiles
       SET supabase_uid = $1, email = $2, name = $3, updated_at = NOW()
       WHERE telegram_chat_id = $4`,
      [String(user.id), user.email, user.full_name || '', String(ctx.from.id)],
    );

    return ctx.reply(
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
  buttons.push([Markup.button.callback('📧 Email va parol bilan ulash', 'connect_email')]);
  buttons.push([Markup.button.callback('🔙 Orqaga', 'back_main')]);

  await ctx.reply(
    `🔗 <b>Hisob ulash</b>\n\n` +
    `⚠️ <b>Avval saytdan ro'yxatdan o'ting!</b>\n` +
    `👉 <a href="https://makerpay.uz/sign-up">makerpay.uz/sign-up</a>\n\n` +
    `Ro'yxatdan o'tgach, quyidagi usullardan biri bilan hisobingizni botga ulang:\n\n` +
    `<b>1️⃣ Google orqali</b> — tez va qulay\n` +
    `<b>2️⃣ Email va parol</b> — Google ishlamasa\n\n` +
    `⏱️ Google havolasi <b>10 daqiqa</b> amal qiladi.`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) },
  );
}
