/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useStore } from "../../store/useStore";
import { Bell, Info, AlertCircle, Package, Check, Trash2 } from "lucide-react";
import Badge from "./Badge";

interface NotificationPanelProps {
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const { notifications, markNotificationRead, clearNotifications } = useStore();

  const getIcon = (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.includes("stock") || lower.includes("item") || lower.includes("qty")) {
      return <Package className="h-[16px] w-[16px] text-amber-650" />;
    }
    if (lower.includes("payment") || lower.includes("due") || lower.includes("invoice") || lower.includes("bill") || lower.includes("credit")) {
      return <AlertCircle className="h-[16px] w-[16px] text-red-600" />;
    }
    return <Info className="h-[16px] w-[16px] text-blue-600" />;
  };

  const getBg = (read: boolean) => {
    if (read) return "bg-white opacity-85";
    return "bg-blue-50/30 hover:bg-blue-50/50 border-l-[3px] border-l-[#1557b0]";
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    notifications.forEach(n => {
      if (!n.read) {
        markNotificationRead(n.id);
      }
    });
  };

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 animate-fadeIn" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50/80" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-gray-800">Notifications</span>
          {unreadCount > 0 && (
            <Badge variant="danger" size="sm">
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button type="button" onClick={markAllRead} className="text-[10px] font-semibold text-[#1557b0] hover:underline cursor-pointer">
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearNotifications}
              className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-gray-100 cursor-pointer"
              title="Clear all alerts"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-gray-150">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-gray-400 gap-2 select-none">
            <Bell className="h-8 w-8 opacity-30 stroke-[1.5]" />
            <p className="text-[11px] font-medium">No notifications</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 text-xs border-b border-gray-100 transition-all flex gap-2.5 ${getBg(n.read)}`}
            >
              <div className="shrink-0 mt-0.5">{getIcon(n.message)}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-slate-800 leading-snug ${n.read ? "text-slate-500 font-medium" : "font-semibold"}`}>
                  {n.message}
                </p>
                <span className="text-[10px] text-gray-400 font-medium block mt-1">
                  {n.timestamp ? new Date(n.timestamp).toLocaleTimeString() : ""}
                </span>
              </div>
              {!n.read && (
                <button
                  type="button"
                  onClick={() => markNotificationRead(n.id)}
                  className="text-gray-400 hover:text-blue-600 transition-colors shrink-0 self-center cursor-pointer"
                  title="Mark as read"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-gray-200 px-4 py-2 bg-gray-50/50 text-center" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-bold text-gray-500 hover:text-blue-700 transition-colors inline-block cursor-pointer"
        >
          Dismiss Panel
        </button>
      </div>
    </div>
  );
};

export default NotificationPanel;
