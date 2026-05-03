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

  // ── Step 1: Ask email ─────────────────────────────────────────────────────
  bot.action('connect_email', async (ctx) => {
    await ctx.answerCbQuery();
    awaitingStep.set(ctx.from.id, { step: 'email' });
    await ctx.editMessageText(
      `📧 <b>Email orqali ulash</b>\n\n` +
      `<b>1-qadam:</b> MakerPay da ro'yxatdan o'tgan email manzilingizni yuboring:\n\n` +
      `<i>Misol: user@gmail.com</i>`,
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

  // ── Text interceptor: email → password → verify ───────────────────────────
  bot.on('text', async (ctx, next) => {
    const state = awaitingStep.get(ctx.from.id);
    if (!state) return next();

    const text = ctx.message.text.trim();

    // ── Step 1: Receive email ─────────────────────────────────────────────
    if (state.step === 'email') {
      const email = text.toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return ctx.reply(
          '❌ Noto\'g\'ri email format.\n\nQayta yuboring:',
          Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'cancel_email')]]),
        );
      }

      const user = await fetchOne(
        'SELECT id, email, full_name FROM users WHERE LOWER(email) = $1',
        [email],
      );

      if (!user) {
        awaitingStep.delete(ctx.from.id);
        return ctx.reply(
          `❌ <b>${email}</b> email bilan hisob topilmadi.\n\n` +
          `Avval saytdan ro'yxatdan o'ting.`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.url('📝 Ro\'yxatdan o\'tish', 'https://makerpay.uz/sign-up')],
              [Markup.button.callback('🔙 Orqaga', 'connect_google')],
            ]),
          },
        );
      }

      // Email found — ask for password
      awaitingStep.set(ctx.from.id, { step: 'password', email, userId: user.id, fullName: user.full_name });
      return ctx.reply(
        `✅ Email topildi: <code>${email}</code>\n\n` +
        `<b>2-qadam:</b> Parolingizni yuboring:\n\n` +
        `<i>⚠️ Xabar yuborilgandan keyin parol avtomatik o'chiriladi.</i>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'cancel_email')]]),
        },
      );
    }

    // ── Step 2: Receive password ──────────────────────────────────────────
    if (state.step === 'password') {
      awaitingStep.delete(ctx.from.id);

      // Delete password message immediately for security
      await ctx.deleteMessage().catch(() => {});

      const { email, userId, fullName } = state;

      // Fetch hashed password
      const userWithPass = await fetchOne(
        'SELECT id, email, full_name, password FROM users WHERE id = $1',
        [userId],
      );

      if (!userWithPass?.password) {
        return ctx.reply(
          '❌ Bu hisob uchun parol o\'rnatilmagan.\n\n🔗 Google orqali ulashni sinab ko\'ring.',
          Markup.inlineKeyboard([[Markup.button.callback('🔗 Google bilan ulash', 'connect_google')]]),
        );
      }

      const isValid = await bcrypt.compare(text, userWithPass.password);

      if (!isValid) {
        return ctx.reply(
          '❌ <b>Parol noto\'g\'ri.</b>\n\nQayta urinib ko\'ring.',
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
        [String(userId), email, fullName || '', String(ctx.from.id)],
      );

      return ctx.reply(
        `✅ <b>Hisob muvaffaqiyatli ulandi!</b>\n\n` +
        `📧 Email: <code>${email}</code>\n` +
        `👤 Ism: ${fullName || '—'}\n\n` +
        `Endi 👤 <b>Profil</b> tugmasini bosib ma'lumotlaringizni ko'ring.`,
        { parse_mode: 'HTML' },
      );
    }

    return next();
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
