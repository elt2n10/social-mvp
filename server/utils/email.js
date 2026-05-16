let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (err) {
  console.warn('[YVED SMTP] nodemailer не установлен:', err.message);
}

function boolEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['true', '1', 'yes', 'y'].includes(String(value).trim().toLowerCase());
}

function clean(value) {
  return String(value || '').trim();
}

function cleanPassword(value) {
  // Google App Password часто копируется с пробелами: "abcd efgh ijkl mnop".
  // Для SMTP лучше отправлять его без пробелов.
  return String(value || '').replace(/\s+/g, '').trim();
}

function hasSmtp() {
  return Boolean(
    nodemailer &&
    clean(process.env.SMTP_HOST) &&
    clean(process.env.SMTP_USER) &&
    cleanPassword(process.env.SMTP_PASS)
  );
}

function getSmtpConfig() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE !== undefined
    ? boolEnv(process.env.SMTP_SECURE)
    : port === 465;

  return {
    host: clean(process.env.SMTP_HOST),
    port,
    secure,
    auth: {
      user: clean(process.env.SMTP_USER),
      pass: cleanPassword(process.env.SMTP_PASS)
    },
    // Чтобы Render не висел слишком долго, если Gmail/SMTP не отвечает.
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 20000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 20000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 30000),
    tls: {
      // Не отключаем проверку сертификатов. Это безопаснее.
      rejectUnauthorized: true
    }
  };
}

async function sendVerificationEmail(email, code) {
  const subject = 'Код подтверждения Yved';
  const text = `Твой код подтверждения Yved: ${code}\n\nЕсли ты не регистрировался в Yved, просто игнорируй это письмо.`;
  const html = `
    <div style="font-family:Arial,sans-serif;background:#0b0b12;color:#fff;padding:24px;border-radius:16px;max-width:520px">
      <h2 style="margin:0 0 12px;color:#a78bfa">Yved</h2>
      <p style="font-size:16px;line-height:1.5">Твой код подтверждения:</p>
      <div style="font-size:32px;font-weight:800;letter-spacing:6px;background:#171728;border:1px solid #2d2a44;border-radius:14px;padding:16px;text-align:center;color:#c4b5fd">
        ${code}
      </div>
      <p style="font-size:13px;color:#aaa;margin-top:18px">Если ты не регистрировался в Yved, просто игнорируй это письмо.</p>
    </div>
  `;

  if (!hasSmtp()) {
    console.log(`[YVED EMAIL CODE] ${email}: ${code}`);
    return { sent: false, reason: 'SMTP не настроен или nodemailer не установлен' };
  }

  const config = getSmtpConfig();

  console.log('[YVED SMTP] Отправка кода:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user,
    to: email
  });

  const transporter = nodemailer.createTransport(config);

  try {
    // Проверяем соединение отдельно, чтобы в Render Logs была понятная ошибка.
    await transporter.verify();

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || `Yved <${config.auth.user}>`,
      to: email,
      subject,
      text,
      html
    });

    console.log('[YVED SMTP] Код отправлен:', info.messageId || 'ok');
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('[YVED SMTP ERROR]', {
      code: err.code,
      command: err.command,
      response: err.response,
      message: err.message
    });

    return {
      sent: false,
      reason: err.message || 'SMTP error',
      code: err.code || ''
    };
  }
}

module.exports = { sendVerificationEmail, hasSmtp, getSmtpConfig };
