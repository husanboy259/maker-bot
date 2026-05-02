import { Markup } from 'telegraf';

export const mainMenu = () =>
  Markup.keyboard([
    ['👤 Profil', '✅ Tugatilganlar'],
    ['🔑 API kalitlar', '📁 Loyihalar'],
    ['🚀 Deploylar', '📜 Foydalanish qoidalari'],
    ['🔔 Bildirishnomalar', '🔗 Google bilan ulash'],
  ]).resize();

export const notificationsMenu = (isEnabled) =>
  Markup.inlineKeyboard([
    [Markup.button.callback(isEnabled ? "🔕 O'chirish" : '🔔 Yoqish', isEnabled ? 'notif_disable' : 'notif_enable')],
    [Markup.button.callback('📋 Bildirishnoma turlari', 'notif_types')],
    [Markup.button.callback('🔙 Orqaga', 'back_main')],
  ]);

export const notificationTypesMenu = (prefs) => {
  const icon = (val) => (val ? '✅' : '❌');
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${icon(prefs.deploy_notifications)} Deploy bildirishnomalari`, 'toggle_deploy')],
    [Markup.button.callback(`${icon(prefs.api_notifications)} API bildirishnomalari`, 'toggle_api')],
    [Markup.button.callback(`${icon(prefs.project_notifications)} Loyiha bildirishnomalari`, 'toggle_project')],
    [Markup.button.callback(`${icon(prefs.payment_notifications)} To'lov bildirishnomalari`, 'toggle_payment')],
    [Markup.button.callback('🔙 Orqaga', 'back_notifications')],
  ]);
};

export const paginateButtons = (items, page, perPage, cbPrefix, backCb) => {
  const start = page * perPage;
  const chunk = items.slice(start, start + perPage);
  const buttons = chunk.map((item) => [Markup.button.callback(item.label, `${cbPrefix}:${item.id}`)]);

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️ Oldingi', `page:${cbPrefix}:${page - 1}`));
  if (start + perPage < items.length) nav.push(Markup.button.callback('Keyingi ➡️', `page:${cbPrefix}:${page + 1}`));
  if (nav.length) buttons.push(nav);
  buttons.push([Markup.button.callback('🔙 Orqaga', backCb)]);

  return Markup.inlineKeyboard(buttons);
};

export const backButton = (cb = 'back_main') =>
  Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', cb)]]);
