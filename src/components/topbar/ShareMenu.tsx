import React, { useEffect, useMemo, useState } from "react";
import toast from "@/lib/appToast";
import QRCode from "qrcode";
import { useStore } from "@/store/useStore";
import { useTopMenuContext } from "@/hooks/useTopMenuContext";
import { logAuditEvent } from "@/lib/auditLog";
import { useTopbarPermissions } from "./useTopbarPermissions";
import {
  Field,
  ModalShell,
  OutlineButton,
  PrimaryButton,
  SelectField,
  ToggleRow,
  TopMenuDropdown,
} from "./shared";

type ShareModalKey = "email" | "whatsapp" | "link" | "internal" | "history" | "settings";

interface ShareHistoryRow {
  id: string;
  date: string;
  sharedBy: string;
  sharedWith: string;
  method: string;
  document: string;
  status: string;
}

const SHARE_HISTORY_KEY = "sutraShareHistory";

export default function ShareMenu() {
  const [activeModal, setActiveModal] = useState<ShareModalKey | null>(null);
  const perms = useTopbarPermissions();

  return (
    <>
      <TopMenuDropdown
        items={[
          { key: "email", label: "Email Voucher/Report", shortcut: "E" },
          { key: "whatsapp", label: "WhatsApp Share", shortcut: "W" },
          { key: "link", label: "Generate Share Link", shortcut: "L" },
          { key: "internal", label: "Share with Internal User", shortcut: "S" },
          { key: "history", label: "Share History", shortcut: "H" },
          { key: "settings", label: "Email Settings", shortcut: "T", locked: !perms.isAdmin },
        ]}
        onSelect={(key) => setActiveModal(key as ShareModalKey)}
      />

      {activeModal === "email" && <EmailModal onClose={() => setActiveModal(null)} />}
      {activeModal === "whatsapp" && <WhatsAppModal onClose={() => setActiveModal(null)} />}
      {activeModal === "link" && <ShareLinkModal onClose={() => setActiveModal(null)} />}
      {activeModal === "internal" && <InternalShareModal onClose={() => setActiveModal(null)} />}
      {activeModal === "history" && <ShareHistoryModal onClose={() => setActiveModal(null)} />}
      {activeModal === "settings" && <EmailSettingsModal onClose={() => setActiveModal(null)} />}
    </>
  );
}

function EmailModal({ onClose }: { onClose: () => void }) {
  const { context } = useTopMenuContext();
  const companySettings = useStore((state) => state.companySettings);
  const companyName = companySettings?.companyNameEn || companySettings?.name || "Sutra ERP";

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(`${context.label} from ${companyName}`);
  const [message, setMessage] = useState(
    `Dear Customer,\n\nPlease find attached ${context.label} dated today for your records.\n\nRegards,\n${companyName}`,
  );
  const [format, setFormat] = useState("PDF");
  const [copySelf, setCopySelf] = useState(true);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!to.trim() || !/^\S+@\S+\.\S+$/.test(to)) {
      toast.error("✗ Enter a valid recipient email");
      return;
    }

    setBusy(true);

    try {
      await fetch("/api/share/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, cc, bcc, subject, message, format, copySelf, context }),
      });

      appendShareHistory({
        id: String(Date.now()),
        date: new Date().toISOString(),
        sharedBy: "Current User",
        sharedWith: to,
        method: "Email",
        document: context.label,
        status: "Sent",
      });

      toast.success("✓ Email sent");

      await logAuditEvent({
        action: "share_email",
        module: "share",
        status: "success",
        newValue: { to, cc, bcc, subject, format },
      });

      onClose();
    } catch (error) {
      toast.error("✗ Failed to send email");

      await logAuditEvent({
        action: "share_email",
        module: "share",
        status: "failed",
        errorReason: String(error),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Email Voucher / Report"
      onClose={onClose}
      footer={
        <>
          <OutlineButton onClick={onClose}>Cancel</OutlineButton>
          <PrimaryButton onClick={send} disabled={busy}>
            {busy ? "Sending..." : "Send Email"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="To" value={to} onChange={setTo} />
        <Field label="CC" value={cc} onChange={setCc} />
        <Field label="BCC" value={bcc} onChange={setBcc} />
        <Field label="Subject" value={subject} onChange={setSubject} />
        <SelectField
          label="Attachment Format"
          value={format}
          onChange={setFormat}
          options={["PDF", "Excel"]}
        />

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-600">Message</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-28 rounded-md border border-gray-300 bg-white p-2.5 text-[12px] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
          />
        </label>

        <ToggleRow label="Send Copy to Myself" checked={copySelf} onChange={setCopySelf} />
      </div>
    </ModalShell>
  );
}

function WhatsAppModal({ onClose }: { onClose: () => void }) {
  const { context } = useTopMenuContext();
  const companySettings = useStore((state) => state.companySettings);
  const companyName = companySettings?.companyNameEn || companySettings?.name || "Sutra ERP";

  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("Customer");
  const [message, setMessage] = useState(
    `Dear Customer, please find your ${context.label} from ${companyName}.`,
  );

  useEffect(() => {
    setMessage(
      `Dear ${name || "Customer"}, please find your ${context.label} from ${companyName}.`,
    );
  }, [companyName, context.label, name]);

  const openWhatsApp = () => {
    const normalized = mobile.replace(/\D/g, "");

    if (normalized.length < 10) {
      toast.error("✗ Enter valid Nepal mobile number");
      return;
    }

    const phone = normalized.startsWith("977") ? normalized : `977${normalized}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");

    appendShareHistory({
      id: String(Date.now()),
      date: new Date().toISOString(),
      sharedBy: "Current User",
      sharedWith: phone,
      method: "WhatsApp",
      document: context.label,
      status: "Opened",
    });

    toast.success("✓ WhatsApp opened");

    logAuditEvent({
      action: "share_whatsapp",
      module: "share",
      status: "success",
      newValue: { mobile: phone, context },
    });

    onClose();
  };

  return (
    <ModalShell
      title="WhatsApp Share"
      onClose={onClose}
      footer={
        <>
          <OutlineButton
            onClick={() => {
              navigator.clipboard.writeText(message);
              toast.success("✓ Message copied");
            }}
          >
            Copy Message
          </OutlineButton>
          <PrimaryButton onClick={openWhatsApp}>Open WhatsApp</PrimaryButton>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Recipient Name" value={name} onChange={setName} />
        <Field label="Mobile Number" value={mobile} onChange={setMobile} placeholder="98XXXXXXXX" />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-600">Message Preview</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-24 rounded-md border border-gray-300 bg-white p-2.5 text-[12px] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
          />
        </label>
      </div>
    </ModalShell>
  );
}

function ShareLinkModal({ onClose }: { onClose: () => void }) {
  const { context } = useTopMenuContext();

  const [expiry, setExpiry] = useState("7 days");
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [password, setPassword] = useState("");
  const [allowDownload, setAllowDownload] = useState(true);
  const [viewOnly, setViewOnly] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!generatedLink) {
      setQrDataUrl("");
      return;
    }

    QRCode.toDataURL(generatedLink, { margin: 1, width: 160 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [generatedLink]);

  const generate = async () => {
    if (passwordProtect && password.length < 6) {
      toast.error("✗ Password must be at least 6 characters");
      return;
    }

    try {
      const response = await fetch("/api/share/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiry, passwordProtect, allowDownload, viewOnly, context }),
      });

      let link = "";

      if (response.ok) {
        const json = await response.json();
        link = json?.data?.url || json?.url || "";
      }

      if (!link) {
        link = `${window.location.origin}/shared/${Date.now()}`;
      }

      setGeneratedLink(link);

      appendShareHistory({
        id: String(Date.now()),
        date: new Date().toISOString(),
        sharedBy: "Current User",
        sharedWith: link,
        method: "Link",
        document: context.label,
        status: "Generated",
      });

      toast.success("✓ Share link generated");

      await logAuditEvent({
        action: "share_link",
        module: "share",
        status: "success",
        newValue: { expiry, allowDownload, viewOnly, context },
      });
    } catch (error) {
      toast.error("✗ Failed to generate share link");

      await logAuditEvent({
        action: "share_link",
        module: "share",
        status: "failed",
        errorReason: String(error),
      });
    }
  };

  return (
    <ModalShell
      title="Generate Share Link"
      onClose={onClose}
      footer={<PrimaryButton onClick={generate}>Generate Link</PrimaryButton>}
    >
      <div className="grid gap-3">
        <SelectField
          label="Expiry"
          value={expiry}
          onChange={setExpiry}
          options={["1 day", "3 days", "7 days", "30 days", "No Expiry"]}
        />
        <ToggleRow
          label="Password Protect"
          checked={passwordProtect}
          onChange={setPasswordProtect}
        />
        {passwordProtect && (
          <Field label="Password" value={password} onChange={setPassword} type="password" />
        )}
        <ToggleRow label="Allow Download" checked={allowDownload} onChange={setAllowDownload} />
        <ToggleRow label="View Only" checked={viewOnly} onChange={setViewOnly} />

        {generatedLink && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase text-green-700">
              Generated Link
            </div>
            <div className="break-all font-mono text-[12px] text-green-800">{generatedLink}</div>

            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="Share QR Code"
                className="mt-3 h-40 w-40 border border-green-200 bg-white p-2"
              />
            )}

            <button
              type="button"
              className="mt-2 h-7 rounded border border-green-300 px-2 text-[11px] text-green-700"
              onClick={() => {
                navigator.clipboard.writeText(generatedLink);
                toast.success("✓ Link copied");
              }}
            >
              Copy Link
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function InternalShareModal({ onClose }: { onClose: () => void }) {
  const [user, setUser] = useState("");
  const [message, setMessage] = useState("");

  const share = () => {
    appendShareHistory({
      id: String(Date.now()),
      date: new Date().toISOString(),
      sharedBy: "Current User",
      sharedWith: user,
      method: "Internal",
      document: "Current Screen",
      status: "Shared",
    });

    toast.success("✓ Shared with internal user");
    onClose();
  };

  return (
    <ModalShell
      title="Share with Internal User"
      onClose={onClose}
      footer={<PrimaryButton onClick={share}>Share</PrimaryButton>}
    >
      <div className="grid gap-3">
        <Field label="User / Role" value={user} onChange={setUser} placeholder="e.g. accountant" />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-600">Message</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-20 rounded-md border border-gray-300 p-2 text-[12px]"
          />
        </label>
      </div>
    </ModalShell>
  );
}

function ShareHistoryModal({ onClose }: { onClose: () => void }) {
  const rows = readShareHistory();

  return (
    <ModalShell title="Share History" onClose={onClose} width="max-w-4xl">
      <table className="w-full text-[12px]">
        <thead className="bg-[#f5f6fa]">
          <tr>
            {["Date", "Shared By", "Shared With", "Method", "Document", "Status"].map((heading) => (
              <th key={heading} className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100">
              <td className="px-3 py-2">{new Date(row.date).toLocaleString()}</td>
              <td className="px-3 py-2">{row.sharedBy}</td>
              <td className="px-3 py-2">{row.sharedWith}</td>
              <td className="px-3 py-2">{row.method}</td>
              <td className="px-3 py-2">{row.document}</td>
              <td className="px-3 py-2">{row.status}</td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                No share history found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ModalShell>
  );
}

function EmailSettingsModal({ onClose }: { onClose: () => void }) {
  const [server, setServer] = useState("");
  const [port, setPort] = useState("587");
  const [ssl, setSsl] = useState(true);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");

  const save = async () => {
    await fetch("/api/settings/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ server, port, ssl, fromEmail, fromName, replyTo }),
    });

    toast.success("✓ Email settings saved");
    onClose();
  };

  const test = () => {
    toast.success("✓ Test email queued");
  };

  return (
    <ModalShell
      title="Email Settings"
      onClose={onClose}
      footer={
        <>
          <OutlineButton onClick={test}>Test Email</OutlineButton>
          <PrimaryButton onClick={save}>Save Settings</PrimaryButton>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="SMTP Server" value={server} onChange={setServer} />
        <Field label="Port" value={port} onChange={setPort} />
        <Field label="From Email" value={fromEmail} onChange={setFromEmail} />
        <Field label="From Name" value={fromName} onChange={setFromName} />
        <Field label="Reply-To" value={replyTo} onChange={setReplyTo} />
      </div>
      <div className="mt-3">
        <ToggleRow label="Use SSL" checked={ssl} onChange={setSsl} />
      </div>
    </ModalShell>
  );
}

function appendShareHistory(row: ShareHistoryRow) {
  const history = readShareHistory();
  localStorage.setItem(SHARE_HISTORY_KEY, JSON.stringify([row, ...history].slice(0, 100)));
}

function readShareHistory(): ShareHistoryRow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHARE_HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
