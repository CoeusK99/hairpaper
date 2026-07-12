import nodemailer from 'nodemailer';

// 兩種寄信方式，擇一即可（未設定就自動略過寄信，不視為錯誤）：
//   1) Resend HTTP API（推薦，雲端友善）— 只需 RESEND_API_KEY，不需 Gmail 密碼
//   2) SMTP（如 Gmail 應用程式密碼）— 需 SMTP_HOST / SMTP_USER / SMTP_PASS
export function mailerConfigured() {
  return Boolean(resendConfigured() || smtpConfigured());
}

function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_TO);
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_TO);
}

export async function sendDigestEmail({ subject, html }) {
  if (resendConfigured()) return sendViaResend({ subject, html });
  if (smtpConfigured()) return sendViaSmtp({ subject, html });
  return { sent: false, reason: '未設定 RESEND_API_KEY 或 SMTP（略過寄信）' };
}

// ---- Resend：純 HTTP，無需密碼，適合雲端排程 ----
async function sendViaResend({ subject, html }) {
  // 未驗證網域時，from 用 onboarding@resend.dev、收件人須為註冊 Resend 的信箱
  const from = process.env.MAIL_FROM || 'hair-papers <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: process.env.MAIL_TO, subject, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${data?.message || JSON.stringify(data)}`);
  }
  return { sent: true, messageId: data.id, via: 'resend' };
}

// ---- SMTP 備援（本機用 Gmail 應用程式密碼等）----
async function sendViaSmtp({ subject, html }) {
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
  return { sent: true, messageId: info.messageId, via: 'smtp' };
}
