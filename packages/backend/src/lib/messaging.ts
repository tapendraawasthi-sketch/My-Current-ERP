import nodemailer from "nodemailer";

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  senderEmail: string;
  useTls: boolean;
}

export interface MessagingConfig {
  provider: string;
  apiKey: string;
  senderId: string;
  gatewayUrl: string;
}

export interface SendEmailInput {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  html?: string;
  email: EmailConfig;
}

export interface SendSmsInput {
  to: string;
  message: string;
  messaging: MessagingConfig;
}

function parseRecipients(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function sendEmailViaSmtp(input: SendEmailInput): Promise<void> {
  const { email } = input;
  if (!email.smtpHost?.trim()) {
    throw new Error("SMTP host is not configured");
  }
  if (!input.to?.trim()) {
    throw new Error("Recipient email is required");
  }

  const transporter = nodemailer.createTransport({
    host: email.smtpHost,
    port: Number(email.smtpPort) || 587,
    secure: Number(email.smtpPort) === 465,
    auth:
      email.smtpUser && email.smtpPassword
        ? { user: email.smtpUser, pass: email.smtpPassword }
        : undefined,
    tls: email.useTls ? { rejectUnauthorized: false } : undefined,
  });

  await transporter.sendMail({
    from: email.senderEmail || email.smtpUser,
    to: input.to,
    cc: parseRecipients(input.cc),
    bcc: parseRecipients(input.bcc),
    subject: input.subject,
    text: input.body,
    html: input.html || undefined,
  });
}

export async function sendSmsViaGateway(input: SendSmsInput): Promise<void> {
  const { messaging, to, message } = input;
  if (!messaging.gatewayUrl?.trim()) {
    throw new Error("SMS gateway URL is not configured");
  }
  if (!to?.trim()) {
    throw new Error("Recipient phone number is required");
  }

  const res = await fetch(messaging.gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(messaging.apiKey ? { Authorization: `Bearer ${messaging.apiKey}` } : {}),
    },
    body: JSON.stringify({
      to,
      message,
      senderId: messaging.senderId,
      provider: messaging.provider,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `SMS gateway returned HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }
}
