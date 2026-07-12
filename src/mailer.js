import nodemailer from 'nodemailer';

// 從環境變數讀取 SMTP 設定；未設定則跳過寄信（不視為錯誤）。
export function mailerConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_TO);
}

export async function sendDigestEmail({ subject, html }) {
  if (!mailerConfigured()) {
    return { sent: false, reason: '未設定 SMTP（略過寄信）' };
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const info = await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: process.env.MAIL_TO,
    subject,
    html,
  });
  return { sent: true, messageId: info.messageId };
}
