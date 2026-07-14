import React from "react";
import { MessageSquarePlus, Trash2, PanelLeftClose, PanelLeft } from "lucide-react";
import {
  formatSessionTime,
  groupSessionsByDate,
  type OrbixChatSession,
} from "@/lib/ekhata/orbixChatStorage";
import OrbixLogo from "./OrbixLogo";

interface OrbixChatSidebarProps {
  sessions: OrbixChatSession[];
  activeSessionId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

const OrbixChatSidebar: React.FC<OrbixChatSidebarProps> = ({
  sessions,
  activeSessionId,
  collapsed,
  onToggleCollapse,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}) => {
  const groups = groupSessionsByDate(sessions);

  if (collapsed) {
    return (
      <div className="flex w-full flex-col items-center gap-2 py-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Show chat history"
          className="rounded-[var(--ds-radius-md)] p-2 text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface)] hover:text-[var(--ds-text-default)]"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNewChat}
          title="New chat"
          className="rounded-[var(--ds-radius-md)] p-2 text-[var(--ds-action-primary)] hover:bg-[var(--ds-surface-selected)]"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <OrbixLogo size={20} />
      </div>
    );
  }

  return (
    <aside className="flex w-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--ds-border-default)] px-2 py-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-8 flex-1 items-center justify-center gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] text-[12px] font-medium text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-selected)]"
        >
          <MessageSquarePlus className="h-3.5 w-3.5 text-[var(--ds-action-primary)]" />
          New conversation
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Hide sidebar"
          className="rounded-[var(--ds-radius-md)] p-1.5 text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface)]"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 py-2">
        {groups.length === 0 && (
          <p className="px-2 py-6 text-center text-[12px] leading-relaxed text-[var(--ds-text-subtle)]">
            No conversations yet.
            <br />
            Start typing to begin.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-subtle)]">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.sessions.map((session: OrbixChatSession) => {
                const active = session.id === activeSessionId;
                return (
                  <li key={session.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelectSession(session.id)}
                      className={`w-full rounded-[var(--ds-radius-md)] px-2.5 py-2 pr-8 text-left transition-colors ${
                        active
                          ? "bg-[var(--ds-surface-selected)] text-[var(--ds-action-primary)]"
                          : "text-[var(--ds-text-default)] hover:bg-[var(--ds-surface)]"
                      }`}
                    >
                      <span className="block truncate text-[12px] font-medium">
                        {session.title || "New conversation"}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-[var(--ds-text-subtle)]">
                        {formatSessionTime(session.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSession(session.id)}
                      className="absolute right-1 top-1.5 hidden h-6 w-6 items-center justify-center rounded text-[var(--ds-text-subtle)] hover:bg-[var(--ds-status-danger-surface)] hover:text-[var(--ds-status-danger)] group-hover:inline-flex"
                      title="Delete conversation"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-[var(--ds-border-default)] px-3 py-2 text-[12px] text-[var(--ds-text-subtle)]">
        History: 7 days
      </p>
    </aside>
  );
};

export default OrbixChatSidebar;
