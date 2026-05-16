let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (err) {
  nodemailer = null;
}

let Resend = null;
try {
  Resend = require('resend').Resend;
} catch (err) {
  Resend = null;
}

function boolEnv(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function cleanPassword(value) {
  return String(value || '').replace(/\s/g, '');
}

function getEmailProvider() {
  return String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
}

function hasResend() {
  return Boolean(Resend && process.env.RESEND_API_KEY);
}

function hasSmtp() {
  return Boolean(
    nodemailer &&
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function createTransporter() {
  if (!hasSmtp()) {
    throw new Error('SMTP не настроен: проверь SMTP_HOST, SMTP_USER, SMTP_PASS');
  }

  return nodemailer.createTransport({
    host: String(process.env.SMTP_HOST).trim(),
    port: Number(process.env.SMTP_PORT || 587),
    secure: boolEnv(process.env.SMTP_SECURE),
    auth: {
      user: String(process.env.SMTP_USER).trim(),
      pass: cleanPassword(process.env.SMTP_PASS)
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

function buildMailHtml(code) {
  return `
    <div style="margin:0;padding:0;background:#090a10;font-family:Arial,sans-serif;color:#f2f3ff;">
      <div style="max-width:520px;margin:0 auto;padding:28px;">
        <div style="background:#11131d;border:1px solid #25293d;border-radius:22px;padding:26px;">
          <h1 style="margin:0 0 12px;font-size:30px;color:#8b5cf6;">Yved</h1>
          <p style="margin:0 0 18px;color:#c8cbda;font-size:15px;line-height:1.5;">
            Код подтверждения почты:
          </p>
          <div style="font-size:34px;letter-spacing:8px;font-weight:800;color:#ffffff;background:#191b2a;border-radius:16px;padding:18px 20px;text-align:center;border:1px solid #313650;">
            ${code}
          </div>
          <p style="margin:18px 0 0;color:#8e94ad;font-size:13px;line-height:1.5;">
            Код действует 15 минут. Если ты не регистрировался в Yved, просто игнорируй это письмо.
          </p>
        </div>
      </div>
    </div>
  `;
}

async function sendWithResend(to, subject, text, html) {
  if (!hasResend()) {
    throw new Error('Resend не настроен: проверь RESEND_API_KEY и установку пакета resend');
  }

  const resend = new Resend(String(process.env.RESEND_API_KEY).trim());

  const from = process.env.RESEND_FROM || 'Yved <onboarding@resend.dev>';

  const result = await resend.emails.send({
    from,
    to,
    subject,
    text,
    html
  });

  if (result.error) {
    const message = result.error.message || JSON.stringify(result.error);
    throw new Error(`Resend: ${message}`);
  }

  return {
    sent: true,
    provider: 'resend',
    messageId: result.data?.id || ''
  };
}

async function sendWithSmtp(to, subject, text, html) {
  if (!hasSmtp()) {
    throw new Error('SMTP не настроен: проверь SMTP_HOST, SMTP_USER, SMTP_PASS');
  }

  const transporter = createTransporter();
  await transporter.verify();

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || `Yved <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html
  });

  return {
    sent: true,
    provider: 'smtp',
    messageId: info.messageId || ''
  };
}

async function sendVerificationEmail(email, code) {
  const to = String(email || '').trim().toLowerCase();
  const subject = 'Код подтверждения Yved';
  const text = `Код подтверждения Yved: ${code}\n\nКод действует 15 минут. Если ты не регистрировался, просто игнорируй письмо.`;
  const html = buildMailHtml(code);

  if (boolEnv(process.env.EMAIL_DEBUG_CODE)) {
    console.log(`[YVED DEBUG EMAIL CODE] ${to}: ${code}`);
    return { sent: false, debug: true, debugCode: code, reason: 'EMAIL_DEBUG_CODE=true' };
  }

  try {
    if (getEmailProvider() === 'resend') {
      return await sendWithResend(to, subject, text, html);
    }

    return await sendWithSmtp(to, subject, text, html);
  } catch (err) {
    console.error('[YVED EMAIL SEND ERROR]', err.message);
    throw err;
  }
}

module.exports = {
  sendVerificationEmail,
  hasSmtp,
  hasResend
};
