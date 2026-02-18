import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, ChatSession } from "@/components/leads/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { ManageUsersSheet } from "@/components/auth/ManageUsersSheet";
import { RenameSessionDialog } from "@/components/leads/RenameSessionDialog";
import { WorkflowStepper } from "@/components/leads/WorkflowStepper";
import { SearchPanel, type SearchParams } from "@/components/leads/SearchPanel";
import { LeadCard, Lead } from "@/components/leads/LeadCard";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";
import { StatsBar } from "@/components/leads/StatsBar";
import {
  MapPin, Search, Shield, Download,
  ChevronDown, ChevronUp, Layers, Zap,
  CheckCircle2, XCircle, Loader2, Phone, Globe, Star, RefreshCw, ArrowLeft,
  CheckSquare, Square, ChevronRight
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { api, toLead } from "@/lib/api";
import { cn } from "@/lib/utils";
import { generateLeadsCsv, downloadCsv } from "@/lib/csv-export";

type ViewMode = "dashboard" | "results" | "crm-check" | "enrichment" | "leads-total" | "leads-enriched" | "leads-pending";

export interface CrmCheckLead extends Lead {
  crmStatus?: string;
  checkMessage?: string;
  duplicateOf?: { id: string; name: string; crmId: string };
  isChecking?: boolean;
  checkedAt?: number;
}

const POLL_INTERVAL = 1500;

export default function Index() {
  const { user, isAdmin, logout } = useAuth();
  const { toast } = useToast();
  const [manageUsersOpen, setManageUsersOpen] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [renameSessionTitle, setRenameSessionTitle] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState<SearchParams | null>(null);
  const [sessionCrmStats, setSessionCrmStats] = useState<{ savedCount?: number; duplicateCount?: number }>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [searchOpen, setSearchOpen] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [crmCheckLeads, setCrmCheckLeads] = useState<CrmCheckLead[]>([]);
  const [crmCheckSavingIds, setCrmCheckSavingIds] = useState<Set<string>>(new Set());
  const [crmCheckSelectedLeads, setCrmCheckSelectedLeads] = useState<Set<string>>(new Set());
  const [enrichmentSelectedLeads, setEnrichmentSelectedLeads] = useState<Set<string>>(new Set());
  const [leadsCrmProcessed, setLeadsCrmProcessed] = useState<Set<string>>(new Set());
  const [leadsListData, setLeadsListData] = useState<Lead[]>([]);
  const [leadsListFilter, setLeadsListFilter] = useState<"all" | "enriched" | "pending">("all");
  const [isLoadingLeadsList, setIsLoadingLeadsList] = useState(false);

  useEffect(() => {
    setMaxStepReached((prev) => Math.max(prev, currentStep));
  }, [currentStep]);

  // Clear CRM/enrichment state when switching sessions
  useEffect(() => {
    setLeadsCrmProcessed(new Set());
    setCrmCheckSelectedLeads(new Set());
    setEnrichmentSelectedLeads(new Set());
  }, [activeSessionId]);

  // Sync CRM Check view: ONLY leads that have been saved, checked, or explicitly moved (not raw search results)
  useEffect(() => {
    if (viewMode !== "crm-check") return;
    if (activeSessionId && leads.length > 0) {
      const included = leads.filter((l) => {
        const status = l.crmStatus ?? "";
        if (status === "SAVED" || status === "DUPLICATE") return true;
        return leadsCrmProcessed.has(l.id);
      });
      setCrmCheckLeads(
        included.map((l) => {
          const isMoved = leadsCrmProcessed.has(l.id) && !["SAVED", "DUPLICATE"].includes(l.crmStatus ?? "");
          return {
            ...l,
            crmStatus: (isMoved ? "PENDING" : l.crmStatus) ?? "PENDING",
            duplicateOf: l.duplicateOf,
            checkedAt: l.crmStatus && l.crmStatus !== "PENDING" ? Date.now() : undefined,
          };
        })
      );
    } else if (!activeSessionId) {
      setCrmCheckLeads([]);
    }
  }, [viewMode, activeSessionId, leads, leadsCrmProcessed]);

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
      setSessionCrmStats({});
      setIsLoadingSession(false);
      return;
    }
    setIsLoadingSession(true);
    api.sessions
      .get(activeSessionId)
      .then((session) => {
        setLeads(session.leads.map(toLead));
        setSessionCrmStats({
          savedCount: session.savedCount,
          duplicateCount: session.duplicateCount,
        });
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
        const hasCrmData = (session.savedCount ?? 0) > 0 || (session.duplicateCount ?? 0) > 0;
        if (hasCrmData) setMaxStepReached((prev) => Math.max(prev, 5));
      })
      .catch(() => setLeads([]))
      .finally(() => setIsLoadingSession(false));
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
      setSessionCrmStats((prev) => ({
        ...prev,
        savedCount: (prev.savedCount ?? 0) + res.saved,
      }));
      const savedIds = res.results.map((r) => r.leadId);
      setLeadsCrmProcessed((prev) => new Set([...prev, ...savedIds]));
      setMaxStepReached((prev) => Math.max(prev, 4));
      toast({ title: "Saved", description: `${res.saved} lead(s) saved to CRM` });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    const ids = Array.from(selectedLeads);
    if (ids.length === 0) return;
    const selectedLeadData = leads
      .filter((l) => ids.includes(l.id))
      .sort((a, b) => a.rank - b.rank);
    const csv = generateLeadsCsv(selectedLeadData);
    downloadCsv(csv, "leads");
    toast({ title: "Exported", description: `${ids.length} lead(s) exported as CSV` });
  };

  const handleClearSelection = () => setSelectedLeads(new Set());

  const navigateToCrmCheck = () => {
    setViewMode("crm-check");
    setCurrentStep(4);
  };

  const navigateToEnrichment = async () => {
    setCrmCheckSelectedLeads(new Set());
    const enrichmentLeads = leads.filter(
      (l) => (l.crmStatus ?? "") === "SAVED" || (l.crmStatus ?? "") === "NEW"
    );
    setViewMode("enrichment");
    setCurrentStep(5);
    setMaxStepReached((prev) => Math.max(prev, 5));
    try {
      await Promise.all(
        enrichmentLeads.map((l) => api.leads.updateStep(l.id, 5).catch(() => null))
      );
    } catch {
      // Ignore persistence errors
    }
  };

  const navigateToCollectDetails = async () => {
    const ids = Array.from(enrichmentSelectedLeads);
    setEnrichmentSelectedLeads(new Set());
    setViewMode("results");
    setCurrentStep(6);
    setMaxStepReached((prev) => Math.max(prev, 6));
    try {
      await Promise.all(ids.map((id) => api.leads.updateStep(id, 6).catch(() => null)));
    } catch {
      // Ignore
    }
    if (ids.length > 0 && ids[0]) setActiveLead(leads.find((l) => l.id === ids[0]) ?? null);
  };

  const toggleEnrichmentLead = (id: string) => {
    setEnrichmentSelectedLeads((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const fetchLeadsList = useCallback(async (filter: "all" | "enriched" | "pending") => {
    setIsLoadingLeadsList(true);
    setLeadsListFilter(filter);
    try {
      const res = await api.leads.list({ filter, limit: 1000 });
      setLeadsListData((res.leads ?? []).map(toLead));
    } catch {
      try {
        const { sessions: list } = await api.sessions.list(50, 0);
        const allLeads: Lead[] = [];
        const seen = new Set<string>();
        for (const s of list) {
          const session = await api.sessions.get(s.id);
          for (const lr of session.leads ?? []) {
            if (seen.has(lr.id)) continue;
            seen.add(lr.id);
            const lead = toLead(lr);
            if (filter === "enriched" && !lead.email && !lead.linkedin && !lead.instagram) continue;
            if (filter === "pending" && (lead.email || lead.linkedin || lead.instagram)) continue;
            allLeads.push(lead);
          }
        }
        if (filter === "enriched") {
          setLeadsListData(allLeads.filter((l) => l.email || l.linkedin || l.instagram));
        } else if (filter === "pending") {
          setLeadsListData(allLeads.filter((l) => !l.email && !l.linkedin && !l.instagram));
        } else {
          setLeadsListData(allLeads);
        }
      } catch (err) {
        setLeadsListData([]);
      }
    } finally {
      setIsLoadingLeadsList(false);
    }
  }, []);

  const navigateToLeadsList = (statKey: "totalLeads" | "enriched" | "pendingReview") => {
    const filter = statKey === "totalLeads" ? "all" : statKey === "enriched" ? "enriched" : "pending";
    setViewMode(filter === "all" ? "leads-total" : filter === "enriched" ? "leads-enriched" : "leads-pending");
    fetchLeadsList(filter);
  };

  const toggleCrmCheckLead = (id: string) => {
    setCrmCheckSelectedLeads((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const runCrmCheckForSelected = async () => {
    const ids = Array.from(crmCheckSelectedLeads);
    if (ids.length === 0) return;
    const toCheck = crmCheckLeads.filter((l) => ids.includes(l.id));
    for (const lead of toCheck) {
      await runCrmCheck(lead);
    }
  };

  const handleSaveAndCheckDuplicate = async () => {
    const ids = Array.from(selectedLeads);
    if (ids.length === 0) return;
    setSelectedLeads(new Set());
    try {
      const res = await api.leads.saveToCrm(ids);
      const duplicateCount = res.results.filter((r) => r.status?.toUpperCase() === "DUPLICATE").length;
      setLeads((prev) =>
        prev.map((l) => {
          if (!ids.includes(l.id)) return l;
          const r = res.results.find((x) => x.leadId === l.id);
          const status = r?.status?.toUpperCase();
          return {
            ...l,
            isNew: status !== "SAVED",
            crmStatus: status === "SAVED" ? "SAVED" : status === "DUPLICATE" ? "DUPLICATE" : "PENDING",
          };
        })
      );
      setSessionCrmStats((prev) => ({
        ...prev,
        savedCount: (prev.savedCount ?? 0) + res.saved,
        duplicateCount: (prev.duplicateCount ?? 0) + duplicateCount,
      }));
      setLeadsCrmProcessed((prev) => new Set([...prev, ...ids]));
      const selectedLeadsData = leads
        .filter((l) => ids.includes(l.id))
        .sort((a, b) => a.rank - b.rank)
        .map((l) => {
          const r = res.results.find((x) => x.leadId === l.id);
          const status = r?.status?.toUpperCase();
          return {
            ...l,
            crmStatus: status === "SAVED" ? "SAVED" : status === "DUPLICATE" ? "DUPLICATE" : "PENDING",
            checkedAt: status ? Date.now() : undefined,
          } as CrmCheckLead;
        });
      setCrmCheckLeads((prev) => [...prev, ...selectedLeadsData]);
      setViewMode("crm-check");
      setCurrentStep(4);
      setMaxStepReached((prev) => Math.max(prev, 4));
      fetchSessions();
      toast({
        title: "Saved & moved",
        description: `${res.saved} saved to CRM${duplicateCount > 0 ? `, ${duplicateCount} duplicate(s) flagged` : ""}.`,
      });
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Could not save to CRM",
        variant: "destructive",
      });
    }
  };

  const runCrmCheck = async (lead: CrmCheckLead) => {
    setCrmCheckLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, isChecking: true } : l))
    );
    try {
      const res = await api.leads.crmCheck(lead.id, {
        phone: lead.phone,
        website: lead.website,
      });
      setCrmCheckLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                crmStatus: res.crmStatus,
                checkMessage: res.message,
                duplicateOf: res.duplicateOf as { id: string; name: string; crmId: string } | undefined,
                isChecking: false,
                checkedAt: Date.now(),
              }
            : l
        )
      );
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                crmStatus: res.crmStatus,
                duplicateOf: res.duplicateOf as { id: string; name: string; crmId: string } | undefined,
              }
            : l
        )
      );
      setLeadsCrmProcessed((prev) => new Set([...prev, lead.id]));
      toast({
        title: res.crmStatus === "NEW" ? "New lead" : "Duplicate found",
        description: res.message,
      });
    } catch (err) {
      setCrmCheckLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, isChecking: false } : l))
      );
      toast({
        title: "Check failed",
        description: err instanceof Error ? err.message : "Failed to run duplicate check",
        variant: "destructive",
      });
    }
  };

  const runAllCrmChecks = async () => {
    const pending = crmCheckLeads.filter(
      (l) => l.crmStatus === "PENDING" || !l.checkedAt
    );
    for (const lead of pending) {
      await runCrmCheck(lead);
    }
  };

  const handleCrmCheckSaveToCrm = async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    setCrmCheckSavingIds((prev) => new Set([...prev, ...leadIds]));
    try {
      const res = await api.leads.saveToCrm(leadIds);
      setCrmCheckLeads((prev) =>
        prev.map((l) =>
          leadIds.includes(l.id) ? { ...l, crmStatus: "SAVED", checkedAt: Date.now() } : l
        )
      );
      setLeads((prev) =>
        prev.map((l) =>
          leadIds.includes(l.id) ? { ...l, isNew: false, crmStatus: "SAVED" } : l
        )
      );
      setSessionCrmStats((prev) => ({
        ...prev,
        savedCount: (prev.savedCount ?? 0) + res.saved,
      }));
      setLeadsCrmProcessed((prev) => new Set([...prev, ...leadIds]));
      setMaxStepReached((prev) => Math.max(prev, 4));
      toast({ title: "Saved", description: `${res.saved} lead(s) saved to CRM` });
      fetchSessions();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setCrmCheckSavingIds((prev) => {
        const next = new Set(prev);
        leadIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

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

  const handleRenameSession = async (sessionId: string, title: string) => {
    await api.sessions.rename(sessionId, title);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
    );
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
        onRenameSession={(id, title) => {
          setRenameSessionId(id);
          setRenameSessionTitle(title);
        }}
        userEmail={user?.email}
        isAdmin={isAdmin}
        onLogout={logout}
        onManageUsers={isAdmin ? () => setManageUsersOpen(true) : undefined}
        onNavigateToCrmCheck={navigateToCrmCheck}
      />

      <ManageUsersSheet
        open={manageUsersOpen}
        onOpenChange={setManageUsersOpen}
        currentUserId={user?.id}
        isAdmin={isAdmin}
      />

      <RenameSessionDialog
        open={!!renameSessionId}
        onOpenChange={(open) => !open && setRenameSessionId(null)}
        sessionId={renameSessionId}
        currentTitle={renameSessionTitle}
        onRename={handleRenameSession}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Top bar: workflow stepper */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface-1 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto scrollbar-none">
            <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <WorkflowStepper
              currentStep={currentStep}
              maxStepReached={maxStepReached}
              onStepClick={(stepId) => {
                setCurrentStep(stepId);
                if (stepId === 1) setViewMode("dashboard");
                else if (stepId === 2 || stepId === 3) {
                  setViewMode("results");
                  if (stepId === 2) setSearchOpen(true);
                } else if (stepId === 4) navigateToCrmCheck();
                else if (stepId === 5) navigateToEnrichment();
                else if (stepId >= 6) {
                  setViewMode("results");
                  setCurrentStep(6);
                  setMaxStepReached((prev) => Math.max(prev, 6));
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle className="flex-shrink-0" />
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
              <DashboardView onStatClick={navigateToLeadsList} />
            ) : viewMode === "leads-total" || viewMode === "leads-enriched" || viewMode === "leads-pending" ? (
              <LeadsListView
                leads={leadsListData}
                filter={leadsListFilter}
                isLoading={isLoadingLeadsList}
                onBack={() => setViewMode("dashboard")}
                onViewLead={setActiveLead}
              />
            ) : viewMode === "enrichment" ? (
              <EnrichmentView
                leads={leads.filter((l) => (l.crmStatus ?? "") === "SAVED" || (l.crmStatus ?? "") === "NEW")}
                selectedLeads={enrichmentSelectedLeads}
                savingIds={crmCheckSavingIds}
                onToggle={toggleEnrichmentLead}
                onClearSelection={() => setEnrichmentSelectedLeads(new Set())}
                onSaveToCrm={handleCrmCheckSaveToCrm}
                onBack={() => { setViewMode("crm-check"); setCurrentStep(4); }}
                onNavigateToCollectDetails={navigateToCollectDetails}
                onViewLead={setActiveLead}
              />
            ) : viewMode === "crm-check" ? (
              <CrmCheckView
                leads={crmCheckLeads}
                savingIds={crmCheckSavingIds}
                selectedLeads={crmCheckSelectedLeads}
                sessionCrmStats={sessionCrmStats}
                onRunCheck={runCrmCheck}
                onRunAllChecks={runAllCrmChecks}
                onRunCheckForSelected={runCrmCheckForSelected}
                onSaveToCrm={handleCrmCheckSaveToCrm}
                onToggle={toggleCrmCheckLead}
                onClearSelection={() => setCrmCheckSelectedLeads(new Set())}
                onBack={() => { setViewMode("results"); setCurrentStep(3); }}
                onNavigateToEnrichment={navigateToEnrichment}
              />
            ) : (
              <ResultsView
                leads={leads}
                selectedLeads={selectedLeads}
                onToggle={toggleLead}
                onSelectAllNew={selectAllNew}
                onViewLead={setActiveLead}
                searchMeta={searchMeta}
                sessionCrmStats={sessionCrmStats}
                isSearching={isSearching}
                isLoadingSession={isLoadingSession}
                searchError={searchError}
                onSaveToCrm={handleSaveToCrm}
                onSaveAndCheckDuplicate={handleSaveAndCheckDuplicate}
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

type CrmCheckFilter = "all" | "to-save" | "saved" | "duplicate";

/* ─── CRM Duplicate Check View ─── */
function CrmCheckView({
  leads,
  savingIds,
  selectedLeads,
  sessionCrmStats,
  onRunCheck,
  onRunAllChecks,
  onRunCheckForSelected,
  onSaveToCrm,
  onToggle,
  onClearSelection,
  onBack,
  onNavigateToEnrichment,
}: {
  leads: CrmCheckLead[];
  savingIds: Set<string>;
  selectedLeads: Set<string>;
  sessionCrmStats: { savedCount?: number; duplicateCount?: number };
  onRunCheck: (lead: CrmCheckLead) => Promise<void>;
  onRunAllChecks: () => Promise<void>;
  onRunCheckForSelected: () => Promise<void>;
  onSaveToCrm: (leadIds: string[]) => Promise<void>;
  onToggle: (id: string) => void;
  onClearSelection: () => void;
  onBack: () => void;
  onNavigateToEnrichment: () => void;
}) {
  const [filter, setFilter] = useState<CrmCheckFilter>("all");

  const pendingCount = leads.filter((l) => l.crmStatus === "PENDING" || !l.checkedAt).length;
  const savedCount = leads.filter((l) => l.crmStatus === "SAVED").length;
  const duplicateCount = leads.filter((l) => l.crmStatus === "DUPLICATE").length;
  const toSaveCount = leads.filter(
    (l) => l.crmStatus === "PENDING" || !l.checkedAt || l.crmStatus === "NEW"
  ).length;
  const saveableLeads = leads.filter((l) => l.crmStatus === "NEW" && !savingIds.has(l.id));
  const hasSaveable = saveableLeads.length > 0;

  const filteredLeads = (() => {
    switch (filter) {
      case "to-save":
        return leads.filter(
          (l) => l.crmStatus === "PENDING" || !l.checkedAt || l.crmStatus === "NEW"
        );
      case "saved":
        return leads.filter((l) => l.crmStatus === "SAVED");
      case "duplicate":
        return leads.filter((l) => l.crmStatus === "DUPLICATE");
      default:
        return leads;
    }
  })();

  if (leads.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No leads to check</h2>
        <p className="text-muted-foreground max-w-sm mb-6">
          Select leads from a search and click &quot;Save and Check Duplicate&quot; to send them here.
        </p>
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to results
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto animate-slide-up">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Shield className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">CRM Duplicate Check</h1>
            <p className="text-xs text-muted-foreground">
              {leads.length} leads · {pendingCount} pending
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onRunAllChecks()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Check All for Duplicate
          </Button>
          {selectedLeads.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRunCheckForSelected()}
              className="gap-2"
            >
              <Search className="w-4 h-4" />
              Check Duplicate for Selected ({selectedLeads.size})
            </Button>
          )}
          {hasSaveable && (
            <Button
              size="sm"
              onClick={() => onSaveToCrm(saveableLeads.map((l) => l.id))}
              className="gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save {saveableLeads.length} to CRM
            </Button>
          )}
        </div>
      </div>

      {/* Session stats and filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {typeof sessionCrmStats?.savedCount === "number" && sessionCrmStats.savedCount > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/30 text-xs text-success font-medium">
            <CheckCircle2 className="w-3 h-3" />
            {sessionCrmStats.savedCount} saved to CRM
          </span>
        )}
        {typeof sessionCrmStats?.duplicateCount === "number" && sessionCrmStats.duplicateCount > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/30 text-xs text-destructive font-medium">
            <XCircle className="w-3 h-3" />
            {sessionCrmStats.duplicateCount} duplicates
          </span>
        )}
        <span className="w-px h-5 bg-border" />
        <div className="flex items-center gap-2">
          {selectedLeads.size > 0 && (
            <span className="text-xs text-muted-foreground">{selectedLeads.size} selected</span>
          )}
          <button
            type="button"
            onClick={() => {
              const filtered = (() => {
                switch (filter) {
                  case "to-save": return leads.filter((l) => l.crmStatus === "PENDING" || !l.checkedAt || l.crmStatus === "NEW");
                  case "saved": return leads.filter((l) => l.crmStatus === "SAVED");
                  case "duplicate": return leads.filter((l) => l.crmStatus === "DUPLICATE");
                  default: return leads;
                }
              })();
              const ids = new Set(filtered.map((l) => l.id));
              onClearSelection();
              ids.forEach((id) => onToggle(id));
            }}
            className="text-xs text-primary hover:underline font-semibold"
          >
            Select All
          </button>
        </div>
        <span className="w-px h-5 bg-border" />
        <span className="text-xs text-muted-foreground font-medium pr-1">Filter:</span>
        {(
          [
            { id: "all" as const, label: "All", count: leads.length },
            { id: "to-save" as const, label: "To Save", count: toSaveCount },
            { id: "saved" as const, label: "Saved", count: savedCount },
            { id: "duplicate" as const, label: "Duplicate", count: duplicateCount },
          ] as const
        ).map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              filter === id
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {label}
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px]",
              filter === id ? "bg-primary/20" : "bg-muted"
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Lead cards */}
      <div className="space-y-4">
        {filteredLeads.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">
              {filter === "all" ? "No leads" : `No leads match &quot;${filter === "to-save" ? "To Save" : filter === "saved" ? "Saved" : "Duplicate"}&quot; filter`}
            </p>
            {filter !== "all" && (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Show all leads
              </button>
            )}
          </div>
        ) : (
        filteredLeads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => onToggle(lead.id)}
            className={cn(
              "rounded-xl border p-5 bg-card transition-all cursor-pointer",
              selectedLeads.has(lead.id) && "ring-2 ring-primary/50 border-primary/40 bg-primary/5",
              lead.crmStatus === "NEW" && !selectedLeads.has(lead.id) && "border-primary/30 bg-primary/5",
              lead.crmStatus === "DUPLICATE" && !selectedLeads.has(lead.id) && "border-destructive/30 bg-destructive/5",
              lead.crmStatus === "SAVED" && !selectedLeads.has(lead.id) && "border-success/30 bg-success/5"
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1 min-w-0 flex items-start gap-3">
                <div className="flex-shrink-0 pt-0.5">
                  {selectedLeads.has(lead.id) ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4 text-muted-foreground/50" />
                  )}
                </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-foreground">{lead.name}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                        {lead.category}
                      </span>
                      {lead.rating > 0 && (
                        <span className="text-xs flex items-center gap-1 text-warning">
                          <Star className="w-3 h-3 fill-warning" />
                          {lead.rating}
                        </span>
                      )}
                    </div>
                  </div>
                  <CrmCheckStatusBadge status={lead.crmStatus} />
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {lead.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span className="break-words">{lead.address}</span>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                  {lead.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 flex-shrink-0" />
                      <a
                        href={`https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {lead.website}
                      </a>
                    </div>
                  )}
                </div>
                {lead.duplicateOf && (
                  <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
                    <p className="font-medium text-destructive">Duplicate of:</p>
                    <p className="text-foreground">{lead.duplicateOf.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      CRM ID: {lead.duplicateOf.crmId}
                    </p>
                  </div>
                )}
                {lead.checkMessage && !lead.duplicateOf && (
                  <p className="mt-2 text-xs text-muted-foreground">{lead.checkMessage}</p>
                )}
              </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                {(lead.crmStatus === "PENDING" || !lead.checkedAt) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRunCheck(lead)}
                    disabled={lead.isChecking}
                    className="gap-2"
                  >
                    {lead.isChecking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    {lead.isChecking ? "Checking..." : "Run Check"}
                  </Button>
                )}
                {lead.crmStatus === "NEW" && (
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() => onSaveToCrm([lead.id])}
                      disabled={savingIds.has(lead.id)}
                      className="gap-2"
                    >
                      {savingIds.has(lead.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Save to CRM
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRunCheck(lead)}
                      disabled={lead.isChecking}
                      className="gap-2"
                    >
                      {lead.isChecking ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      {lead.isChecking ? "Checking..." : "Check Duplication"}
                    </Button>
                  </div>
                )}
                {lead.crmStatus === "DUPLICATE" && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <XCircle className="w-4 h-4" />
                      Duplicate
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRunCheck(lead)}
                      disabled={lead.isChecking}
                      className="gap-2"
                    >
                      {lead.isChecking ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      {lead.isChecking ? "Checking..." : "Re-check Duplication"}
                    </Button>
                  </div>
                )}
                {lead.crmStatus === "SAVED" && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-success text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      Saved
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRunCheck(lead)}
                      disabled={lead.isChecking}
                      className="gap-2"
                    >
                      {lead.isChecking ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      {lead.isChecking ? "Checking..." : "Check Duplication"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
        )}

      {/* Sticky save bar when selected (like Create List) */}
      {selectedLeads.size > 0 && (
        <div className="sticky bottom-4 mt-6 flex items-center justify-between px-5 py-3.5 rounded-xl bg-card border border-primary/25 shadow-lg animate-slide-up z-20">
          <p className="text-sm font-medium text-foreground">
            <span className="text-primary font-bold">{selectedLeads.size}</span> selected
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              className="gap-2"
            >
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRunCheckForSelected}
              className="gap-2"
            >
              <Search className="w-3.5 h-3.5" />
              Check Duplicate for Selected
            </Button>
            {(() => {
              const selectedSaveable = leads.filter(
                (l) => selectedLeads.has(l.id) && l.crmStatus === "NEW" && !savingIds.has(l.id)
              );
              return selectedSaveable.length > 0 ? (
                <Button
                  size="sm"
                  onClick={() => onSaveToCrm(selectedSaveable.map((l) => l.id))}
                  className="gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save {selectedSaveable.length} to CRM
                </Button>
              ) : null;
            })()}
            <Button
              size="sm"
              onClick={onNavigateToEnrichment}
              className="gap-2 bg-primary"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              Go to Enrichment
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

/* ─── Leads List View (Total / Enriched / Pending with filters) ─── */
function LeadsListView({
  leads,
  filter,
  isLoading,
  onBack,
  onViewLead,
}: {
  leads: Lead[];
  filter: "all" | "enriched" | "pending";
  isLoading: boolean;
  onBack: () => void;
  onViewLead: (lead: Lead) => void;
}) {
  const [ratingMin, setRatingMin] = useState<number | "">("");
  const [cityFilter, setCityFilter] = useState("");
  const [categoriesFilter, setCategoriesFilter] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.category && set.add(l.category));
    return Array.from(set).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (ratingMin !== "" && (l.rating ?? 0) < ratingMin) return false;
      if (cityFilter.trim() && !(l.address ?? "").toLowerCase().includes(cityFilter.trim().toLowerCase())) return false;
      if (categoriesFilter.size > 0 && !categoriesFilter.has(l.category)) return false;
      return true;
    });
  }, [leads, ratingMin, cityFilter, categoriesFilter]);

  const title = filter === "all" ? "Total Leads" : filter === "enriched" ? "Enriched" : "Pending Review";

  return (
    <div className="p-6 max-w-5xl mx-auto animate-slide-up">
      <div className="flex items-center justify-between gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Rating:</span>
          <select
            value={ratingMin === "" ? "" : ratingMin}
            onChange={(e) => setRatingMin(e.target.value === "" ? "" : Number(e.target.value))}
            className="h-8 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">All</option>
            <option value={3}>3+</option>
            <option value={3.5}>3.5+</option>
            <option value={4}>4+</option>
            <option value={4.5}>4.5+</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">City:</span>
          <input
            type="text"
            placeholder="Filter by city..."
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="h-8 px-3 rounded-md border border-input bg-background text-sm w-40"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Category:</span>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() =>
                setCategoriesFilter((prev) => {
                  const next = new Set(prev);
                  next.has(c) ? next.delete(c) : next.add(c);
                  return next;
                })
              }
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                categoriesFilter.has(c)
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-secondary/50 border-border text-muted-foreground hover:bg-secondary"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-2 border-border border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading leads...</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-4">
            {filteredLeads.length} of {leads.length} leads
          </p>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
            {filteredLeads.map((lead) => (
              <ClickableLeadCard
                key={lead.id}
                lead={lead}
                selected={false}
                onToggle={() => onViewLead(lead)}
                onView={onViewLead}
              />
            ))}
          </div>
          {filteredLeads.length === 0 && (
            <div className="py-12 text-center rounded-xl border border-dashed border-border bg-muted/30">
              <p className="text-sm text-muted-foreground">No leads match the filters</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CrmCheckStatusBadge({ status }: { status?: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-muted text-muted-foreground border-border" },
    NEW: { label: "New", className: "bg-primary/15 text-primary border-primary/30" },
    DUPLICATE: { label: "Duplicate", className: "bg-destructive/15 text-destructive border-destructive/30" },
    ALREADY_REACHED: { label: "Already Reached", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    SAVED: { label: "Saved", className: "bg-success/15 text-success border-success/30" },
  };
  const c = config[status ?? "PENDING"] ?? config.PENDING;
  return (
    <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", c.className)}>
      {c.label}
    </span>
  );
}

/* ─── Enrichment View (verified + no duplicate leads only) ─── */
function EnrichmentView({
  leads,
  selectedLeads,
  savingIds,
  onToggle,
  onClearSelection,
  onSaveToCrm,
  onBack,
  onNavigateToCollectDetails,
  onViewLead,
}: {
  leads: Lead[];
  selectedLeads: Set<string>;
  savingIds: Set<string>;
  onToggle: (id: string) => void;
  onClearSelection: () => void;
  onSaveToCrm: (leadIds: string[]) => Promise<void>;
  onBack: () => void;
  onNavigateToCollectDetails: () => void;
  onViewLead: (lead: Lead) => void;
}) {
  if (leads.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Zap className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No verified leads for enrichment</h2>
        <p className="text-muted-foreground max-w-sm mb-6">
          Only leads that are saved or checked as new (no duplicate) appear here. Complete CRM Check first.
        </p>
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to CRM Check
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Zap className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Enrichment</h1>
            <p className="text-xs text-muted-foreground">
              {leads.length} verified leads · No duplicates
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedLeads.size > 0 && (
            <span className="text-xs text-muted-foreground">{selectedLeads.size} selected</span>
          )}
          <button
            type="button"
            onClick={() => {
              onClearSelection();
              leads.forEach((l) => onToggle(l.id));
            }}
            className="text-xs text-primary hover:underline font-semibold"
          >
            Select All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
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

      {selectedLeads.size > 0 && (
        <div className="sticky bottom-4 mt-6 flex items-center justify-between px-5 py-3.5 rounded-xl bg-card border border-primary/25 shadow-lg animate-slide-up z-20">
          <p className="text-sm font-medium text-foreground">
            <span className="text-primary font-bold">{selectedLeads.size}</span> selected
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              Clear
            </button>
            {(() => {
              const selectedNew = leads.filter(
                (l) => selectedLeads.has(l.id) && l.crmStatus === "NEW" && !savingIds.has(l.id)
              );
              return selectedNew.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSaveToCrm(selectedNew.map((l) => l.id))}
                  className="gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save {selectedNew.length} to CRM
                </Button>
              ) : null;
            })()}
            <Button size="sm" onClick={onNavigateToCollectDetails} className="gap-2">
              <ChevronRight className="w-3.5 h-3.5" />
              Collect Details ({selectedLeads.size})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Dashboard ─── */
function DashboardView({ onStatClick }: { onStatClick?: (key: "totalLeads" | "enriched" | "pendingReview") => void }) {
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
      <StatsBar onStatClick={onStatClick} />

      {/* Enrichment & CRM — where to see details */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Enrichment & CRM Check
        </h2>
        <p className="text-muted-foreground text-sm mt-2">
          The stats above show totals across all time. To see CRM check status (Saved, Duplicate, New) and enrichment data (email, LinkedIn, etc.) for each lead:
        </p>
        <ul className="mt-3 text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Select a search from <strong className="text-foreground">History</strong> in the sidebar</li>
          <li>Each lead card shows its CRM status badge and an <strong className="text-warning">Enriched</strong> badge when data is collected</li>
          <li>Click <strong className="text-foreground">View</strong> on a lead for full details including email, LinkedIn, Instagram</li>
        </ul>
      </div>
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
  sessionCrmStats,
  isSearching,
  isLoadingSession,
  searchError,
  onSaveToCrm,
  onSaveAndCheckDuplicate,
  onExport,
  onClearSelection,
}: {
  leads: Lead[];
  selectedLeads: Set<string>;
  onToggle: (id: string) => void;
  onSelectAllNew: () => void;
  onViewLead: (lead: Lead) => void;
  searchMeta: SearchParams | null;
  sessionCrmStats: { savedCount?: number; duplicateCount?: number };
  isSearching: boolean;
  isLoadingSession: boolean;
  searchError: string | null;
  onSaveToCrm: () => void;
  onSaveAndCheckDuplicate: () => void;
  onExport: () => void;
  onClearSelection: () => void;
}) {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 min-h-[300px]">
        <div className="w-14 h-14 border-2 border-border border-t-primary rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Searching for leads...</p>
          <p className="text-xs text-muted-foreground mt-1">
            {searchMeta?.mode === "natural"
              ? searchMeta.query
              : `${searchMeta?.categories?.join(", ")} in ${searchMeta?.location ?? ""}`}
          </p>
        </div>
      </div>
    );
  }

  if (isLoadingSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 min-h-[300px]">
        <div className="w-14 h-14 border-2 border-border border-t-primary rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Loading session...</p>
          <p className="text-xs text-muted-foreground mt-1">Fetching leads from history</p>
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
        {typeof sessionCrmStats?.savedCount === "number" && sessionCrmStats.savedCount > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/30 text-xs text-success font-medium">
            {sessionCrmStats.savedCount} saved to CRM
          </span>
        )}
        {typeof sessionCrmStats?.duplicateCount === "number" && sessionCrmStats.duplicateCount > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/30 text-xs text-destructive font-medium">
            {sessionCrmStats.duplicateCount} duplicates
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {selectedLeads.size > 0 && (
            <span className="text-xs text-muted-foreground">{selectedLeads.size} selected</span>
          )}
          <button onClick={onSelectAllNew} className="text-xs text-primary hover:underline font-semibold">
            Select All New
          </button>
        </div>
      </div>

      {/* Grid - items-stretch ensures equal height per row */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
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
        <div className="sticky bottom-4 mt-6 flex items-center justify-between px-5 py-3.5 rounded-xl bg-card border border-primary/25 shadow-lg animate-slide-up z-20">
          <p className="text-sm font-medium text-foreground">
            <span className="text-primary font-bold">{selectedLeads.size}</span> selected
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onClearSelection()}
              className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => onExport()}
              className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => onSaveAndCheckDuplicate()}
              className="text-xs px-4 py-2 rounded-lg bg-primary/80 text-primary-foreground font-semibold hover:bg-primary transition-all flex items-center gap-1.5 border border-primary/50"
            >
              <Shield className="w-3.5 h-3.5" />
              Save & Check Duplicate
            </button>
            <button
              type="button"
              onClick={() => onSaveToCrm()}
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
    <div className="relative group min-h-[220px] h-full flex flex-col">
      <LeadCard lead={lead} selected={selected} onToggle={onToggle} />
      {/* View button - inside card bounds, bottom right */}
      <button
        onClick={(e) => { e.stopPropagation(); onView(lead); }}
        className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] px-2.5 py-1.5 rounded-md bg-primary/15 border border-primary/30 text-primary font-semibold hover:bg-primary/25 z-10"
      >
        View →
      </button>
    </div>
  );
}
