import { notificationsMenu, notificationTypesMenu } from '../keyboards.js';
import { getBotProfile, updateNotificationEnabled, updateNotificationType } from '../queries.js';

export function registerNotifications(bot) {
  bot.hears('🔔 Bildirishnomalar', async (ctx) => {
    const profile = await getBotProfile(ctx.from.id);
    if (!profile) return ctx.reply("Avval /start ni bosing.");
    const enabled = profile.telegram_enabled;
    const status = enabled ? '🔔 Yoqilgan' : "🔕 O'chirilgan";
    await ctx.reply(
      `🔔 <b>Bildirishnomalar</b>\n\nHolat: <b>${status}</b>\n\nQuyida bildirishnomalarni boshqaring:`,
      { parse_mode: 'HTML', ...notificationsMenu(enabled) },
    );
  });

  bot.action('notif_enable', async (ctx) => {
    await updateNotificationEnabled(ctx.from.id, true);
    await ctx.editMessageText(
      "🔔 <b>Bildirishnomalar</b>\n\nHolat: <b>🔔 Yoqilgan</b>\n\nBildirishnomalar muvaffaqiyatli yoqildi!",
      { parse_mode: 'HTML', ...notificationsMenu(true) },
    );
    await ctx.answerCbQuery('✅ Bildirishnomalar yoqildi!');
  });

  bot.action('notif_disable', async (ctx) => {
    await updateNotificationEnabled(ctx.from.id, false);
    await ctx.editMessageText(
      "🔔 <b>Bildirishnomalar</b>\n\nHolat: <b>🔕 O'chirilgan</b>\n\nBildirishnomalar o'chirildi.",
      { parse_mode: 'HTML', ...notificationsMenu(false) },
    );
    await ctx.answerCbQuery("🔕 Bildirishnomalar o'chirildi.");
  });

  bot.action('notif_types', async (ctx) => {
    const profile = await getBotProfile(ctx.from.id);
    const prefs = {
      deploy_notifications: profile?.deploy_notifications ?? true,
      api_notifications: profile?.api_notifications ?? true,
      project_notifications: profile?.project_notifications ?? true,
      payment_notifications: profile?.payment_notifications ?? true,
    };
    await ctx.editMessageText(
      '📋 <b>Bildirishnoma turlari</b>\n\nQaysi bildirishnomalarni olishni tanlang:',
      { parse_mode: 'HTML', ...notificationTypesMenu(prefs) },
    );
    await ctx.answerCbQuery();
  });

  const toggleMap = {
    toggle_deploy: 'deploy_notifications',
    toggle_api: 'api_notifications',
    toggle_project: 'project_notifications',
    toggle_payment: 'payment_notifications',
  };

  for (const [action, col] of Object.entries(toggleMap)) {
    bot.action(action, async (ctx) => {
      const profile = await getBotProfile(ctx.from.id);
      const newVal = !profile?.[col];
      await updateNotificationType(ctx.from.id, col, newVal);

      const updated = { ...profile, [col]: newVal };
      const prefs = {
        deploy_notifications: updated.deploy_notifications ?? true,
        api_notifications: updated.api_notifications ?? true,
        project_notifications: updated.project_notifications ?? true,
        payment_notifications: updated.payment_notifications ?? true,
      };
      await ctx.editMessageReplyMarkup(notificationTypesMenu(prefs).reply_markup);
      const label = col.replace('_notifications', '');
      await ctx.answerCbQuery(`${label} bildirishnomalari ${newVal ? 'yoqildi ✅' : "o'chirildi ❌"}`);
    });
  }

  bot.action('back_notifications', async (ctx) => {
    const profile = await getBotProfile(ctx.from.id);
    const enabled = profile?.telegram_enabled ?? false;
    const status = enabled ? '🔔 Yoqilgan' : "🔕 O'chirilgan";
    await ctx.editMessageText(
      `🔔 <b>Bildirishnomalar</b>\n\nHolat: <b>${status}</b>\n\nQuyida bildirishnomalarni boshqaring:`,
      { parse_mode: 'HTML', ...notificationsMenu(enabled) },
    );
    await ctx.answerCbQuery();
  });
}
