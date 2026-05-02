import express from 'express';
import {
  consumeOAuthState,
  exchangeGoogleCode,
  getGoogleUserInfo,
  linkUserToProfile,
  purgeExpiredStates,
} from './auth.js';

export function createCallbackServer(bot) {
  const app = express();
  app.use(express.json());

  // Step 1 — Google redirects here with ?code=...&state=...
  app.get('/auth/google/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.send(htmlPage('❌ Kirish bekor qilindi', `Google: ${error}`, false));
    }
    if (!code || !state) {
      return res.send(htmlPage('❌ Xatolik', 'Code yoki state yetishmayapti.', false));
    }

    // Verify state → get telegram_id
    const telegramId = await consumeOAuthState(state).catch(() => null);
    if (!telegramId) {
      return res.send(htmlPage('❌ Havola eskirgan', 'Iltimos, botdan qayta urinib ko\'ring.', false));
    }

    try {
      // Exchange code for token
      const tokens = await exchangeGoogleCode(code);
      const googleUser = await getGoogleUserInfo(tokens.access_token);

      if (!googleUser.email) {
        return res.send(htmlPage('❌ Email topilmadi', 'Google hisobingizda email yo\'q.', false));
      }

      // Link to bot_profile
      const user = await linkUserToProfile(telegramId, googleUser);

      // Notify user on Telegram
      await bot.telegram.sendMessage(
        telegramId,
        `✅ <b>Google hisob muvaffaqiyatli ulandi!</b>\n\n` +
        `📧 Email: <code>${googleUser.email}</code>\n` +
        `👤 Ism: ${googleUser.name || '—'}\n\n` +
        `Endi 👤 <b>Profil</b> tugmasini bosib ma'lumotlaringizni ko'ring.`,
        { parse_mode: 'HTML' },
      ).catch(() => {});

      return res.send(htmlPage(
        '✅ Muvaffaqiyatli!',
        `${googleUser.email} bilan ulandi.<br>Telegram botga qayting!`,
        true,
      ));
    } catch (err) {
      console.error('OAuth callback error:', err.message);
      await bot.telegram.sendMessage(
        telegramId,
        `❌ Kirish vaqtida xatolik: ${err.message}`,
      ).catch(() => {});
      return res.send(htmlPage('❌ Server xatosi', err.message, false));
    }
  });

  // Health check
  app.get('/health', (_, res) => res.json({ ok: true }));

  // Cleanup expired states every 30 min
  setInterval(purgeExpiredStates, 30 * 60 * 1000);

  // In production, index.js starts the server after attaching webhook.
  // In development, start immediately.
  if (process.env.NODE_ENV !== 'production') {
    const port = Number(process.env.PORT) || Number(process.env.CALLBACK_PORT) || 3002;
    app.listen(port, () => {
      console.log(`🌐 OAuth callback server: http://localhost:${port}`);
    });
  }

  return app;
}

export function startServer(app) {
  const port = Number(process.env.PORT) || Number(process.env.CALLBACK_PORT) || 3002;
  app.listen(port, () => {
    console.log(`🌐 Server listening on port ${port}`);
  });
}

function htmlPage(title, message, success) {
  const icon = success ? '✅' : '❌';
  const color = success ? '#22c55e' : '#ef4444';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MakerPay — ${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#0f172a;color:#e2e8f0;display:flex;align-items:center;
         justify-content:center;min-height:100vh;padding:16px}
    .card{background:#1e293b;border-radius:16px;padding:40px 32px;
          text-align:center;max-width:420px;width:100%;
          box-shadow:0 25px 50px -12px rgba(0,0,0,.5)}
    .icon{font-size:3rem;margin-bottom:16px}
    h1{font-size:1.4rem;margin-bottom:8px;color:${color}}
    p{color:#94a3b8;font-size:0.95rem;line-height:1.5}
    .btn{display:inline-block;margin-top:24px;padding:12px 28px;
         background:#6366f1;color:#fff;border-radius:8px;
         text-decoration:none;font-size:0.9rem;font-weight:600}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a class="btn" href="https://t.me/maketrpaybot">Telegram botga qaytish</a>
  </div>
</body>
</html>`;
}
