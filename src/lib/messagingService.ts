import {
  mergeSystemConfiguration,
  type EmailConfig,
  type MessagingConfig,
} from "./systemConfiguration";

export interface SendEmailOptions {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  html?: string;
  email?: EmailConfig;
}

export interface SendSmsOptions {
  to: string;
  message: string;
  messaging?: MessagingConfig;
}

function apiBase(): string {
  return (
    import.meta.env.VITE_PUBLIC_API_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function getAuthToken(): string | null {
  try {
    return localStorage.getItem("sutra_access_token");
  } catch {
    return null;
  }
}

function openMailto(opts: SendEmailOptions): void {
  const params = new URLSearchParams();
  if (opts.cc) params.set("cc", opts.cc);
  if (opts.bcc) params.set("bcc", opts.bcc);
  params.set("subject", opts.subject);
  params.set("body", opts.body);
  window.open(`mailto:${opts.to}?${params.toString()}`, "_blank");
}

export async function sendEmailMessage(
  opts: SendEmailOptions,
): Promise<{ ok: boolean; method: "smtp" | "mailto" }> {
  const email = opts.email;
  const token = getAuthToken();

  if (email?.smtpHost?.trim() && token) {
    try {
      const res = await fetch(`${apiBase()}/api/messaging/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: opts.to,
          cc: opts.cc,
          bcc: opts.bcc,
          subject: opts.subject,
          body: opts.body,
          html: opts.html,
          email,
        }),
      });
      const body = await res.json();
      if (res.ok && body?.success !== false) {
        return { ok: true, method: "smtp" };
      }
    } catch {
      /* fall through to mailto */
    }
  }

  openMailto(opts);
  return { ok: true, method: "mailto" };
}

export async function sendSmsMessage(
  opts: SendSmsOptions,
): Promise<{ ok: boolean; method: "gateway" | "whatsapp" }> {
  const messaging = opts.messaging;
  const token = getAuthToken();
  const phone = opts.to.replace(/\D/g, "");

  if (messaging?.gatewayUrl?.trim() && token) {
    try {
      const res = await fetch(`${apiBase()}/api/messaging/sms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: opts.to,
          message: opts.message,
          messaging,
        }),
      });
      const body = await res.json();
      if (res.ok && body?.success !== false) {
        return { ok: true, method: "gateway" };
      }
    } catch {
      /* fall through to WhatsApp deep link */
    }
  }

  if (phone) {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(opts.message)}`, "_blank");
    return { ok: true, method: "whatsapp" };
  }

  return { ok: false, method: "whatsapp" };
}

export async function sendTestEmail(
  email: EmailConfig,
  recipient: string,
): Promise<{ ok: boolean; method: "smtp" | "mailto" }> {
  return sendEmailMessage({
    to: recipient,
    subject: "Sutra ERP — Test Email",
    body: "This is a test email from your Sutra ERP system configuration.",
    email,
  });
}

export function getMessagingConfigFromSettings(companySettings?: {
  systemConfiguration?: unknown;
}): { email: EmailConfig; messaging: MessagingConfig } {
  const config = mergeSystemConfiguration(
    companySettings?.systemConfiguration as Parameters<typeof mergeSystemConfiguration>[0],
  );
  return { email: config.email, messaging: config.messaging };
}
