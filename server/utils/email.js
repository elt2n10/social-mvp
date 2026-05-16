let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (err) {
  nodemailer = null;
}

function boolEnv(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function cleanPassword(value) {
  return String(value || '').replace(/\s/g, '');
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
          <h1 style="margin:0 0 12px;font-size:28px;color:#8b5cf6;">Yved</h1>
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

async function sendVerificationEmail(email, code) {
  const to = String(email || '').trim().toLowerCase();
  const subject = 'Код подтверждения Yved';
  const text = `Код подтверждения Yved: ${code}\n\nКод действует 15 минут. Если ты не регистрировался, просто игнорируй письмо.`;

  if (boolEnv(process.env.EMAIL_DEBUG_CODE)) {
    console.log(`[YVED DEBUG EMAIL CODE] ${to}: ${code}`);
    return { sent: false, debug: true, debugCode: code, reason: 'EMAIL_DEBUG_CODE=true' };
  }

  if (!hasSmtp()) {
    console.log(`[YVED EMAIL CODE - SMTP NOT CONFIGURED] ${to}: ${code}`);
    return { sent: false, debug: false, reason: 'SMTP не настроен' };
  }

  const transporter = createTransporter();

  await transporter.verify();

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || `Yved <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html: buildMailHtml(code)
  });

  return {
    sent: true,
    messageId: info.messageId || ''
  };
}

module.exports = {
  sendVerificationEmail,
  hasSmtp
};
