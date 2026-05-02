import { backButton } from '../keyboards.js';

const TERMS_TEXT = `📜 <b>Foydalanish qoidalari</b>

<b>1. Umumiy qoidalar</b>
• MakerPay platformasidan foydalanish ushbu qoidalarga rozilikni bildiradi.
• Xizmatdan 18 yoshdan katta shaxslar foydalanishi mumkin.

<b>2. Hisob xavfsizligi</b>
• API kalitlaringizni hech kimga bermang.
• Shubhali faoliyat aniqlansa darhol bizga xabar bering.
• Hisobingizni himoya qilish — sizning mas'uliyatingiz.

<b>3. To'lov qoidalari</b>
• Barcha to'lovlar so'm yoki qabul qilinadigan valyutada amalga oshiriladi.
• Qaytarib berish 3–5 ish kuni ichida amalga oshiriladi.
• Firibgarlik holatlari qonunchilik doirasida ko'rib chiqiladi.

<b>4. Deploy va API cheklovlar</b>
• Bepul tarif: 3 ta loyiha, 5 ta API kalit.
• Pro tarif: Cheksiz loyihalar va API kalitlar.
• Rate limit: 1 000 so'rov/daqiqa (Pro: 10 000).

<b>5. Ma'lumotlar maxfiyligi</b>
• Shaxsiy ma'lumotlaringiz uchinchi shaxslarga berilmaydi.
• Ma'lumotlar Supabase serverlarida shifrlangan holda saqlanadi.

<b>6. Xizmatni to'xtatish</b>
• Qoidalarga zid foydalanish hisobni bloklashga olib keladi.
• Bloklangan hisob uchun to'lovlar qaytarilmaydi.

<b>7. Bildirishnomalar</b>
• Bot orqali bildirishnomalarni istalgan vaqt o'chirishingiz mumkin.
• Muhim xavfsizlik bildirishnomalari har doim yuboriladi.

📩 Savollar uchun: @makerpay_support`;

export function registerTerms(bot) {
  bot.hears('📜 Foydalanish qoidalari', async (ctx) => {
    await ctx.reply(TERMS_TEXT, { parse_mode: 'HTML', ...backButton('back_main') });
  });
}
