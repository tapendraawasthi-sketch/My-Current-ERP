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
      <div className="flex flex-col items-center py-3 gap-3 border-r border-white/10 bg-[#080c14] w-12 flex-shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Show chat history"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNewChat}
          title="New chat"
          className="p-2 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition-colors"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <OrbixLogo size={22} />
      </div>
    );
  }

  return (
    <aside className="flex flex-col w-[220px] flex-shrink-0 border-r border-white/10 bg-[#080c14]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
        <button
          type="button"
          onClick={onNewChat}
          className="flex-1 flex items-center justify-center gap-2 h-8 rounded-lg border border-white/10 bg-white/[0.04] text-[11px] font-medium text-slate-200 hover:bg-white/[0.08] hover:border-cyan-500/30 transition-all"
        >
          <MessageSquarePlus className="h-3.5 w-3.5 text-cyan-400" />
          New chat
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Hide sidebar"
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/10"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-3 min-h-0">
        {groups.length === 0 && (
          <p className="px-2 py-4 text-[10px] text-slate-600 text-center leading-relaxed">
            No conversations yet.
            <br />
            Start typing to begin.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.sessions.map((session) => {
                const active = session.id === activeSessionId;
                return (
                  <li key={session.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelectSession(session.id)}
                      className={`w-full text-left rounded-lg px-2.5 py-2 pr-7 transition-all ${
                        active
                          ? "bg-cyan-500/15 border border-cyan-500/25 text-slate-100"
                          : "border border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                      }`}
                    >
                      <p className="text-[11px] font-medium truncate leading-snug">
                        {session.title}
                      </p>
                      <p className="text-[9px] text-slate-600 mt-0.5 tabular-nums">
                        {formatSessionTime(session.updatedAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      title="Delete chat"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
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

      <div className="px-3 py-2 border-t border-white/10">
        <p className="text-[9px] text-slate-600 text-center">
          Chats kept for 7 days
        </p>
      </div>
    </aside>
  );
};

export default OrbixChatSidebar;
