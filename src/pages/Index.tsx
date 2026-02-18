import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, ChatSession } from "@/components/leads/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { ManageUsersSheet } from "@/components/auth/ManageUsersSheet";
import { WorkflowStepper } from "@/components/leads/WorkflowStepper";
import { SearchPanel, type SearchParams } from "@/components/leads/SearchPanel";
import { LeadCard, Lead } from "@/components/leads/LeadCard";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";
import { StatsBar } from "@/components/leads/StatsBar";
import {
  MapPin, Search, Shield, Download,
  ChevronDown, ChevronUp, Layers, Zap
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api, toLead } from "@/lib/api";

type ViewMode = "dashboard" | "results";

const POLL_INTERVAL = 1500;

export default function Index() {
  const { user, isAdmin, logout } = useAuth();
  const { toast } = useToast();
  const [manageUsersOpen, setManageUsersOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState<SearchParams | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState(1);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [searchOpen, setSearchOpen] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const { sessions: list } = await api.sessions.list();
      setSessions(
        list.map((s) => ({
          id: s.id,
          title: s.title,
          time: s.time,
          leadCount: s.leadCount,
        }))
      );
      return list;
    } catch {
      setSessions([]);
      return [];
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchSessions().then((list) => {
      if (mounted && list.length > 0 && !activeSessionId) {
        setActiveSessionId(list[0].id);
      }
    });
    return () => { mounted = false; };
  }, [fetchSessions]);

  // Load session leads when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) {
      setLeads([]);
      return;
    }
    api.sessions
      .get(activeSessionId)
      .then((session) => {
        setLeads(session.leads.map(toLead));
        setSearchMeta(
          session.mode === "NATURAL"
            ? { mode: "natural", query: session.title, count: session.leadCount }
            : {
                mode: "manual",
                location: session.location ?? "",
                categories: session.categories,
                count: session.leadCount,
              }
        );
        setViewMode("results");
        setCurrentStep(3);
      })
      .catch(() => setLeads([]));
  }, [activeSessionId]);

  const handleSearch = async (params: SearchParams) => {
    setSearchError(null);
    setIsSearching(true);
    setSearchMeta(params);
    setCurrentStep(2);
    setSearchOpen(false);
    setViewMode("results");

    try {
      const { searchSessionId } = await api.search.start({
        ...params,
        count: params.count ?? (params.mode === "natural" ? 20 : 10),
      });

      const poll = async () => {
        const status = await api.search.status(searchSessionId);
        if (status.status === "COMPLETED" && status.leads) {
          setLeads(status.leads.map(toLead));
          setIsSearching(false);
          setCurrentStep(3);
          setActiveSessionId(searchSessionId);
          fetchSessions();
        } else if (status.status === "FAILED") {
          setIsSearching(false);
          setSearchError("Search failed");
        } else {
          setTimeout(poll, POLL_INTERVAL);
        }
      };
      poll();
    } catch (err) {
      setIsSearching(false);
      setSearchError(err instanceof Error ? err.message : "Search failed");
    }
  };

  const toggleLead = (id: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllNew = () => {
    setSelectedLeads(new Set(leads.filter((l) => l.isNew).map((l) => l.id)));
  };

  const handleNew = () => {
    setViewMode("dashboard");
    setLeads([]);
    setSelectedLeads(new Set());
    setSearchMeta(null);
    setCurrentStep(1);
    setActiveLead(null);
    setActiveSessionId(null);
    setSearchOpen(true);
    setSearchError(null);
  };

  const handleSaveToCrm = async (leadIds?: string[]) => {
    const ids = leadIds ?? Array.from(selectedLeads);
    if (ids.length === 0) return;
    try {
      const res = await api.leads.saveToCrm(ids);
      setSelectedLeads((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setLeads((prev) =>
        prev.map((l) =>
          res.results.some((r) => r.leadId === l.id) ? { ...l, isNew: false } : l
        )
      );
      if (activeLead && ids.includes(activeLead.id)) {
        setActiveLead(null);
      }
      fetchSessions();
      toast({ title: "Saved", description: `${res.saved} lead(s) saved to CRM` });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save",
        variant: "destructive",
      });
    }
  };

  const handleExport = async () => {
    const ids = Array.from(selectedLeads);
    if (ids.length === 0) return;
    try {
      await api.leads.export(ids, "csv");
      toast({ title: "Exported", description: `${ids.length} lead(s) exported as CSV` });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Failed to export",
        variant: "destructive",
      });
    }
  };

  const handleClearSelection = () => setSelectedLeads(new Set());

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await api.sessions.delete(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setLeads([]);
        setSearchMeta(null);
        setViewMode("dashboard");
        setCurrentStep(1);
        setActiveLead(null);
      }
      toast({ title: "Deleted", description: "Session deleted" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete session",
        variant: "destructive",
      });
    }
  };

  const handleLeadUpdated = (updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    if (activeLead?.id === updated.id) setActiveLead(updated);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Narrow sidebar */}
      <Sidebar
        sessions={sessions}
        activeId={activeSessionId ?? ""}
        onSelect={(id) => setActiveSessionId(id)}
        onNew={handleNew}
        onDeleteSession={handleDeleteSession}
        userEmail={user?.email}
        isAdmin={isAdmin}
        onLogout={logout}
        onManageUsers={isAdmin ? () => setManageUsersOpen(true) : undefined}
      />

      <ManageUsersSheet
        open={manageUsersOpen}
        onOpenChange={setManageUsersOpen}
        currentUserId={user?.id}
        isAdmin={isAdmin}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Top bar: workflow stepper */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface-1 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto scrollbar-none">
            <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <WorkflowStepper currentStep={currentStep} />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle className="flex-shrink-0" />
            {viewMode === "results" && selectedLeads.size > 0 && (
              <button
                onClick={handleExport}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-success/10 border border-success/30 text-success hover:bg-success/20 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export {selectedLeads.size} leads
              </button>
            )}
          </div>
        </div>

        {/* Content row */}
        <div className="flex flex-1 min-h-0">

          {/* Search sidebar — collapsible */}
          <div className="flex-shrink-0 border-r border-border bg-surface-1 flex flex-col"
            style={{ width: searchOpen ? 300 : 48, transition: "width 0.25s ease" }}
          >
            {/* Toggle */}
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-3 border-b border-border text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <Zap className="w-4 h-4 text-primary flex-shrink-0" />
              {searchOpen && (
                <>
                  <span className="text-xs font-semibold text-foreground flex-1 text-left">Search</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              )}
            </button>
            {searchOpen && (
              <div className="flex-1 overflow-y-auto">
                <SearchPanel onSearch={handleSearch} isSearching={isSearching} />
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto min-w-0">
            {viewMode === "dashboard" ? (
              <DashboardView />
            ) : (
              <ResultsView
                leads={leads}
                selectedLeads={selectedLeads}
                onToggle={toggleLead}
                onSelectAllNew={selectAllNew}
                onViewLead={setActiveLead}
                searchMeta={searchMeta}
                isSearching={isSearching}
                searchError={searchError}
                onSaveToCrm={handleSaveToCrm}
                onExport={handleExport}
                onClearSelection={handleClearSelection}
              />
            )}
          </div>
        </div>
      </div>

      {/* Lead detail slide-out */}
      {activeLead && (
        <LeadDetailPanel
          lead={activeLead}
          onClose={() => setActiveLead(null)}
          onLeadUpdated={handleLeadUpdated}
          onSaveLead={() => handleSaveToCrm([activeLead.id])}
          onSkipLead={async () => {
            try {
              await api.leads.skip(activeLead.id);
              handleLeadUpdated({ ...activeLead, isNew: false });
              setActiveLead(null);
              toast({ title: "Skipped", description: "Lead skipped" });
            } catch (err) {
              toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Failed to skip",
                variant: "destructive",
              });
            }
          }}
        />
      )}
    </div>
  );
}

/* ─── Dashboard ─── */
function DashboardView() {
  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto animate-fade-in">
      {/* Hero */}
      <div className="rounded-2xl border border-primary/15 p-8 relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 80% 40%, hsl(214 100% 58% / 0.1), transparent 60%)" }} />
        <div className="relative">
          <h1 className="text-3xl font-bold text-foreground">Lead Generation Portal</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">HK Exports · Jewellery Business Lead Finder</p>
          <div className="flex flex-wrap items-center gap-6 mt-5">
            {[
              { icon: MapPin, text: "Search by location" },
              { icon: Search, text: "6 business categories" },
              { icon: Shield, text: "CRM duplicate check" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="w-4 h-4 text-primary" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatsBar />
    </div>
  );
}

/* ─── Results ─── */
function ResultsView({
  leads,
  selectedLeads,
  onToggle,
  onSelectAllNew,
  onViewLead,
  searchMeta,
  isSearching,
  searchError,
  onSaveToCrm,
  onExport,
  onClearSelection,
}: {
  leads: Lead[];
  selectedLeads: Set<string>;
  onToggle: (id: string) => void;
  onSelectAllNew: () => void;
  onViewLead: (lead: Lead) => void;
  searchMeta: SearchParams | null;
  isSearching: boolean;
  searchError: string | null;
  onSaveToCrm: () => void;
  onExport: () => void;
  onClearSelection: () => void;
}) {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5">
        <div className="w-14 h-14 border-2 border-border border-t-primary rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Searching for leads...</p>
          <p className="text-xs text-muted-foreground mt-1">
            {searchMeta?.mode === "natural"
              ? searchMeta.query
              : `${searchMeta?.categories.join(", ")} in ${searchMeta?.location}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto animate-slide-up">
      {searchError && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {searchError}
        </div>
      )}
      {/* Result chips */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {searchMeta?.mode === "natural" ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground font-medium">
            <Search className="w-3 h-3 text-primary" />{searchMeta.query}
          </span>
        ) : (
          <>
            {(searchMeta?.mode === "manual" ? searchMeta.categories : []).map((c) => (
              <span key={c} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground font-medium">
                <Search className="w-3 h-3 text-primary" />{c}
              </span>
            ))}
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground font-medium">
              <MapPin className="w-3 h-3 text-primary" />{searchMeta?.mode === "manual" ? searchMeta.location : ""}
            </span>
          </>
        )}
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-semibold">
          <Shield className="w-3 h-3" />{leads.length} leads found
        </span>
        <div className="ml-auto flex items-center gap-3">
          {selectedLeads.size > 0 && (
            <span className="text-xs text-muted-foreground">{selectedLeads.size} selected</span>
          )}
          <button onClick={onSelectAllNew} className="text-xs text-primary hover:underline font-semibold">
            Select All New
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {leads.map((lead) => (
          <ClickableLeadCard
            key={lead.id}
            lead={lead}
            selected={selectedLeads.has(lead.id)}
            onToggle={onToggle}
            onView={onViewLead}
          />
        ))}
      </div>

      {/* Sticky save bar */}
      {selectedLeads.size > 0 && (
        <div className="sticky bottom-4 mt-6 flex items-center justify-between px-5 py-3.5 rounded-xl bg-card border border-primary/25 shadow-lg animate-slide-up">
          <p className="text-sm font-medium text-foreground">
            <span className="text-primary font-bold">{selectedLeads.size}</span> leads ready to save
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClearSelection}
              className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              Clear
            </button>
            <button
              onClick={onExport}
              className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={onSaveToCrm}
              className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-[0_0_16px_hsl(214_100%_58%/0.25)]"
            >
              <Download className="w-3.5 h-3.5" />
              Save to CRM
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Lead card with View button ─── */
function ClickableLeadCard({
  lead, selected, onToggle, onView,
}: {
  lead: Lead;
  selected: boolean;
  onToggle: (id: string) => void;
  onView: (lead: Lead) => void;
}) {
  return (
    <div className="relative group">
      <LeadCard lead={lead} selected={selected} onToggle={onToggle} />
      {/* View details button — appears on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onView(lead); }}
        className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] px-2.5 py-1 rounded-md bg-primary/15 border border-primary/30 text-primary font-semibold hover:bg-primary/25"
      >
        View →
      </button>
    </div>
  );
}
