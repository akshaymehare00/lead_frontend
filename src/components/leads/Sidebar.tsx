import { MessageSquare, Clock, Gem, LogOut, Users, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatSession {
  id: string;
  title: string;
  time: string;
  leadCount?: number;
}

interface SidebarProps {
  sessions: ChatSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDeleteSession?: (sessionId: string) => void;
  userEmail?: string;
  isAdmin?: boolean;
  onLogout?: () => void;
  onManageUsers?: () => void;
}

export const Sidebar = ({ sessions, activeId, onSelect, onNew, onDeleteSession, userEmail, isAdmin, onLogout, onManageUsers }: SidebarProps) => {
  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border w-52 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
          <Gem className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-sidebar-accent-foreground font-space">LeadGen Pro</p>
          <p className="text-[10px] text-sidebar-foreground/50">HK Exports</p>
        </div>
      </div>

      {/* New Search Button */}
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-sidebar-border text-sidebar-foreground/60 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all text-sm font-medium"
        >
          <span className="text-lg leading-none">+</span>
          New Search
        </button>
      </div>

      {/* All Leads Header */}
      <div className="px-5 py-2">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-sidebar-foreground/40">Recent Searches</p>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto px-3 space-y-0.5 pb-4">
        {sessions.map((session) => {
          const active = session.id === activeId;
          return (
            <div
              key={session.id}
              className={cn(
                "group relative flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <button
                onClick={() => onSelect(session.id)}
                className="flex-1 min-w-0 flex items-start gap-3 text-left"
              >
                <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-60" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{session.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-2.5 h-2.5 opacity-40" />
                    <p className="text-[10px] opacity-50">{session.time}</p>
                    {session.leadCount !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium ml-1">
                        {session.leadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              {onDeleteSession && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-sidebar-foreground/50 hover:text-destructive transition-all flex-shrink-0"
                  title="Delete session"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* User section */}
      {(userEmail || onLogout) && (
        <div className="p-3 border-t border-sidebar-border space-y-1.5">
          {isAdmin && onManageUsers && (
            <button
              onClick={onManageUsers}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-all text-xs font-medium"
            >
              <Users className="w-3.5 h-3.5" />
              Manage Users
            </button>
          )}
          {userEmail && (
            <p className="text-[10px] text-sidebar-foreground/50 truncate px-3" title={userEmail}>
              {userEmail}
            </p>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-all text-xs font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
};
