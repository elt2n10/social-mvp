let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch {}

function hasSmtp() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendVerificationEmail(email, code) {
  const subject = 'Код подтверждения Yved';
  const text = `Твой код подтверждения Yved: ${code}\n\nЕсли ты не регистрировался, просто игнорируй письмо.`;

  if (!hasSmtp() || !nodemailer) {
    console.log(`[YVED EMAIL CODE] ${email}: ${code}`);
    return { sent: false, reason: 'SMTP не настроен' };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text
  });

  return { sent: true };
}

module.exports = { sendVerificationEmail, hasSmtp };
