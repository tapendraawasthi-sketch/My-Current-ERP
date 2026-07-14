import React, { useMemo } from "react";
import { Bell } from "lucide-react";
import { useStore } from "../../store/useStore";
import { Drawer, DrawerContent, Button, EmptyState } from "@/design-system";

function severityFromType(type?: string): "neutral" | "info" | "success" | "warning" | "danger" {
  const t = (type || "info").toLowerCase();
  if (t === "error" || t === "danger" || t === "conflict") return "danger";
  if (t === "warning" || t === "warn") return "warning";
  if (t === "success") return "success";
  if (t === "neutral") return "neutral";
  return "info";
}

/**
 * Notification centre — presents authoritative Zustand/Dexie notifications.
 * Does not create a second notification database.
 */
export const NotificationCentre: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const notifications = useStore((s) => s.notifications);
  const markNotificationRead = useStore((s) => s.markNotificationRead);
  const clearNotifications = useStore((s) => s.clearNotifications);
  const companyName = useStore((s) => s.companySettings?.companyName);

  const unread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        side="right"
        title={unread ? `Notifications (${unread} unread)` : "Notifications"}
        description={companyName ? `Company: ${companyName}` : "High-value alerts for this company"}
        className="ds-no-print"
        data-testid="shell-notification-centre"
        footer={
          <div className="flex gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={!notifications.some((n) => !n.read)}
              onClick={() => {
                notifications.filter((n) => !n.read).forEach((n) => markNotificationRead(n.id));
              }}
            >
              Mark all read
            </Button>
            <Button
              size="small"
              variant="quiet"
              disabled={!notifications.length}
              onClick={() => clearNotifications()}
            >
              Clear
            </Button>
          </div>
        }
      >
        {!notifications.length ? (
          <EmptyState
            title="No notifications"
            description="High-value alerts such as sync conflicts, approvals, and failures appear here. Routine saves use toast feedback."
          />
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => {
              const sev = severityFromType(n.type);
              return (
                <li
                  key={n.id}
                  className={`rounded-[var(--ds-radius-md)] border px-3 py-2 ${
                    n.read
                      ? "border-[var(--ds-border-subtle)] bg-[var(--ds-surface)]"
                      : "border-[var(--ds-border-default)] bg-[var(--ds-surface-selected)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[14px] font-medium text-[var(--ds-text-strong)]">{n.message}</div>
                      <div className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">
                        {sev.toUpperCase()} · {new Date(n.timestamp).toLocaleString()}
                      </div>
                    </div>
                    {!n.read ? (
                      <Button size="small" variant="quiet" onClick={() => markNotificationRead(n.id)}>
                        Mark read
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export const NotificationBellButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const notifications = useStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <button
      type="button"
      onClick={onClick}
      className="ds-focus-ring relative inline-flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-hover)]"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      data-testid="shell-notification-bell"
    >
      <Bell className="h-4 w-4" aria-hidden />
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ds-status-danger)] px-1 text-[12px] font-semibold leading-none text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </button>
  );
};

export default NotificationCentre;
