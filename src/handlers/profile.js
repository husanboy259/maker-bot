import { Markup } from 'telegraf';
import { getBotProfile, getUserProfile } from '../queries.js';
import { execute } from '../database.js';
import { fmtDateShort } from '../utils.js';

export function registerProfile(bot) {
  bot.hears('👤 Profil', async (ctx) => {
    await showProfile(ctx);
  });

  // Logout confirmation
  bot.action('logout_confirm', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '⚠️ <b>Chiqishni tasdiqlang</b>\n\nHisobingiz botdan uziladi. Keyinchalik qayta ulashingiz mumkin.',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Ha, chiqish', 'logout_do')],
          [Markup.button.callback('❌ Bekor qilish', 'profile_back')],
        ]),
      },
    );
  });

  // Do logout
  bot.action('logout_do', async (ctx) => {
    await execute(
      `UPDATE bot_profiles SET supabase_uid = '', email = '', name = '', updated_at = NOW()
       WHERE telegram_chat_id = $1`,
      [String(ctx.from.id)],
    );
    await ctx.editMessageText(
      '✅ <b>Muvaffaqiyatli chiqildi</b>\n\nHisobingiz uzildi.\n\n🔗 Qayta ulash uchun <b>Google bilan ulash</b> tugmasini bosing.',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔗 Qayta ulash', 'connect_google')],
        ]),
      },
    );
    await ctx.answerCbQuery('✅ Chiqildi');
  });

  // Back to profile
  bot.action('profile_back', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
    await showProfile(ctx);
  });
}

async function showProfile(ctx) {
  const tgId = ctx.from.id;
  const [profile, linked] = await Promise.all([getBotProfile(tgId), getUserProfile(tgId)]);

  const notif = profile?.telegram_enabled ? '✅ Yoqilgan' : "❌ O'chirilgan";
  let text;
  let keyboard;

  if (linked) {
    text =
      `👤 <b>Profil</b>\n\n` +
      `📧 Email: <code>${linked.email || '—'}</code>\n` +
      `👤 Ism: ${linked.full_name || '—'}\n` +
      `📱 Telefon: ${linked.phone || '—'}\n` +
      `🏢 Biznes: ${linked.business_name || '—'}\n` +
      `📊 Holat: ${linked.merchant_status || linked.role || '—'}\n` +
      `💰 Balans: ${linked.balance != null ? `${linked.balance} ${linked.currency || ''}` : '—'}\n` +
      `📅 Ro'yxatdan o'tgan: ${fmtDateShort(linked.created_at)}\n` +
      `🕐 Oxirgi kirish: ${fmtDateShort(linked.last_login_at)}\n` +
      `🔔 Bildirishnomalar: ${notif}`;

    keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚪 Chiqish (Logout)', 'logout_confirm')],
    ]);
  } else {
    text =
      `👤 <b>Telegram profil</b>\n\n` +
      `🆔 Telegram ID: <code>${tgId}</code>\n` +
      `👤 Ism: ${ctx.from.first_name || '—'}\n` +
      `🔔 Bildirishnomalar: ${notif}\n\n` +
      `<i>Hisob hali bog'lanmagan.</i>`;

    keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔗 Google bilan ulash', 'connect_google')],
    ]);
  }

  await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
}
