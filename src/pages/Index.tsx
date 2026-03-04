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
  MapPin, Search, Shield,
  ChevronDown, ChevronUp, Layers, Zap, FileCheck, Download,
  CheckCircle2, XCircle, Loader2, Phone, Globe, Star, RefreshCw, ArrowLeft,
  CheckSquare, Square,   ChevronRight, ChevronLeft,
  PanelLeftClose, PanelLeftOpen,
  AlertTriangle, Trash2
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, toLead, type CrmCheckSimilarMatch, type BulkCrmCheckOkItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { generateLeadsCsv, generateFullLeadsCsv, downloadCsv } from "@/lib/csv-export";

type ViewMode = "dashboard" | "results" | "crm-check" | "enrichment" | "collect-details" | "leads-total" | "leads-enriched" | "leads-pending";

export interface CrmCheckLead extends Lead {
  crmStatus?: string;
  checkMessage?: string;
  duplicateOf?: { id: string; name: string; crmId: string };
  similarMatches?: CrmCheckSimilarMatch[];
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
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [searchingSessionId, setSearchingSessionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState<SearchParams | null>(null);
  const [sessionCrmStats, setSessionCrmStats] = useState<{ savedCount?: number; duplicateCount?: number }>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [crmCheckLeads, setCrmCheckLeads] = useState<CrmCheckLead[]>([]);
  const [crmCheckSavingIds, setCrmCheckSavingIds] = useState<Set<string>>(new Set());
  const [crmCheckSelectedLeads, setCrmCheckSelectedLeads] = useState<Set<string>>(new Set());
  const [enrichmentSelectedLeads, setEnrichmentSelectedLeads] = useState<Set<string>>(new Set());
  const [enrichmentLeads, setEnrichmentLeads] = useState<Lead[]>([]);
  const [isLoadingEnrichment, setIsLoadingEnrichment] = useState(false);
  const [collectDetailsLeads, setCollectDetailsLeads] = useState<Lead[]>([]);
  const [collectDetailsSelectedLeads, setCollectDetailsSelectedLeads] = useState<Set<string>>(new Set());
  const [isLoadingCollectDetails, setIsLoadingCollectDetails] = useState(false);
  const [isLoadingCrmCheck, setIsLoadingCrmCheck] = useState(false);
  const [leadsListData, setLeadsListData] = useState<Lead[]>([]);
  const [leadsListFilter, setLeadsListFilter] = useState<"all" | "enriched" | "pending">("all");
  const [isLoadingLeadsList, setIsLoadingLeadsList] = useState(false);
  const [isSavingAndCheckDuplicate, setIsSavingAndCheckDuplicate] = useState(false);

  // Clear stage state when switching sessions
  useEffect(() => {
    setCrmCheckLeads([]);
    setCrmCheckSelectedLeads(new Set());
    setEnrichmentLeads([]);
    setEnrichmentSelectedLeads(new Set());
    setCollectDetailsLeads([]);
    setCollectDetailsSelectedLeads(new Set());
    setMaxStepReached(1);
  }, [activeSessionId]);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);
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
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchSessions();
    return () => { mounted = false; };
  }, [fetchSessions]);

  // Load session leads (all leads for Results view) when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) {
      setLeads([]);
      setSessionCrmStats({});
      setIsLoadingSession(false);
      return;
    }
    setIsLoadingSession(true);
    const isSearchingThisSession = searchingSessionId === activeSessionId;
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
            ? { mode: "natural", query: session.title, maxLead: session.leadCount }
            : session.mode === "CURRENT_LOCATION"
              ? { mode: "current_location", latitude: 0, longitude: 0, radiusKm: 25, maxLead: session.leadCount }
              : session.mode === "APIFY"
                ? { mode: "apify", location: session.location ?? "", searchStrings: session.categories, maxLead: session.leadCount }
                : {
                    mode: "manual",
                    location: session.location ?? "",
                    categories: session.categories,
                    maxLead: session.leadCount,
                  }
        );

        // Derive which workflow steps should be unlocked from backend stages
        // Backend stages: create_list, crm_check, enrichment, collect_details, saved, duplicate
        // Frontend steps: 1=Home, 2=Create List, 3=CRM Check, 4=Enrichment List, 5=Final List (collect_details)
        const stages = (session as { stages?: {
          create_list?: { unlocked: boolean };
          crm_check?: { unlocked: boolean };
          enrichment?: { unlocked: boolean };
          collect_details?: { unlocked: boolean };
          saved?: { unlocked: boolean };
          duplicate?: { unlocked: boolean };
        } }).stages;

        let maxStep = 1;
        if (stages?.create_list?.unlocked) maxStep = 2;
        if (stages?.crm_check?.unlocked) maxStep = 3;
        if (stages?.enrichment?.unlocked) maxStep = 4;
        if (stages?.collect_details?.unlocked) maxStep = 5;

        // Default view when opening a session is the results (create list) stage if available
        // Don't switch back to dashboard if we're actively searching this session (search in progress)
        const initialStep = maxStep >= 2 ? 2 : 1;
        const shouldShowResults = initialStep === 2 || isSearchingThisSession;
        setViewMode(shouldShowResults ? "results" : "dashboard");
        setCurrentStep(shouldShowResults ? 2 : initialStep);
        setMaxStepReached(Math.max(maxStep, shouldShowResults ? 2 : 1));
      })
      .catch(() => setLeads([]))
      .finally(() => setIsLoadingSession(false));
  }, [activeSessionId, searchingSessionId]);

  const handleSearch = async (params: SearchParams) => {
    setSearchError(null);
    setIsSearching(true);
    setSearchMeta(params);
    setCurrentStep(2);
    setViewMode("results");

    try {
      const isApify = params.mode === "apify";
      const { searchSessionId } = isApify
        ? await api.search.apify({
            location: params.location,
            searchStrings: params.searchStrings,
            maxLead: params.maxLead ?? 20,
          })
        : await api.search.start({
            ...params,
            maxLead: params.maxLead ?? (params.mode === "natural" ? 20 : 10),
          });

      // Track which session is currently searching
      setSearchingSessionId(searchSessionId);
      // Make the new search the active session immediately
      setActiveSessionId(searchSessionId);

      // Optimistically add this search to sidebar history immediately
      const sessionTitle = isApify
        ? (params.searchStrings?.length
            ? `Apify: ${params.searchStrings.join(", ")} in ${params.location}`
            : `Apify: ${params.location}`)
        : params.mode === "natural"
          ? params.query
          : params.mode === "manual"
            ? `${params.categories.join(", ")} in ${params.location}`
            : `Nearby search (${params.radiusKm ?? 25} km)`;

      setSessions((prev) => {
        const withoutDuplicate = prev.filter((s) => s.id !== searchSessionId);
        return [
          {
            id: searchSessionId,
            title: sessionTitle || "New search",
            time: "Just now",
            leadCount: 0,
          },
          ...withoutDuplicate,
        ];
      });

      const poll = async () => {
        const status = await api.search.status(searchSessionId);
        if (status.status === "COMPLETED" && status.leads) {
          setLeads(status.leads.map(toLead));
          setIsSearching(false);
          setSearchingSessionId(null);
          setCurrentStep(2);
          setMaxStepReached((prev) => Math.max(prev, 2));
          fetchSessions();
        } else if (status.status === "FAILED") {
          setIsSearching(false);
          setSearchingSessionId(null);
          const errMsg = (status as { errorMessage?: string }).errorMessage;
          setSearchError(errMsg || "Search failed");
        } else {
          setTimeout(poll, POLL_INTERVAL);
        }
      };
      poll();
    } catch (err) {
      setIsSearching(false);
      setSearchingSessionId(null);
      let msg = err instanceof Error ? err.message : "Search failed";
      const details = (err as Error & { details?: Record<string, unknown> })?.details;
      if (details && typeof details === "object") {
        const parts = Object.entries(details)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
          .slice(0, 3);
        if (parts.length) msg += ` (${parts.join("; ")})`;
      }
      setSearchError(msg);
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
    setMaxStepReached(1);
    setActiveLead(null);
    setActiveSessionId(null);
    setSearchError(null);
    setIsSearching(false);
    setSearchingSessionId(null);
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
      setMaxStepReached((prev) => Math.max(prev, 3));
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

  const fetchCrmCheckLeads = useCallback(async () => {
    if (!activeSessionId) return;
    setIsLoadingCrmCheck(true);
    try {
      const session = await api.sessions.get(activeSessionId, "crm_check");
      const mapped: CrmCheckLead[] = session.leads.map((l) => {
        const lead = toLead(l);
        return {
          ...lead,
          crmStatus: ["NEW", "DUPLICATE", "FOUND_SIMILAR"].includes(l.crmStatus ?? "")
            ? l.crmStatus!
            : "PENDING",
          duplicateOf: lead.duplicateOf,
          similarMatches: lead.similarMatches ?? [],
          checkMessage: undefined,
          checkedAt: lead.checkedAt ?? (l.crmCheckedAt ? Date.parse(l.crmCheckedAt) : undefined),
        };
      });
      setCrmCheckLeads(mapped);
      setSessionCrmStats({
        savedCount: session.savedCount,
        duplicateCount: session.duplicateCount,
      });
    } catch {
      setCrmCheckLeads([]);
    } finally {
      setIsLoadingCrmCheck(false);
    }
  }, [activeSessionId]);

  const fetchEnrichmentLeads = useCallback(async () => {
    if (!activeSessionId) return;
    setIsLoadingEnrichment(true);
    try {
      const session = await api.sessions.get(activeSessionId, "enrichment");
      setEnrichmentLeads(session.leads.map(toLead));
    } catch {
      setEnrichmentLeads([]);
    } finally {
      setIsLoadingEnrichment(false);
    }
  }, [activeSessionId]);

  const fetchCollectDetailsLeads = useCallback(async () => {
    if (!activeSessionId) return;
    setIsLoadingCollectDetails(true);
    try {
      const session = await api.sessions.get(activeSessionId, "collect_details");
      setCollectDetailsLeads(session.leads.map(toLead));
    } catch {
      setCollectDetailsLeads([]);
    } finally {
      setIsLoadingCollectDetails(false);
    }
  }, [activeSessionId]);

  const navigateToCrmCheck = () => {
    setViewMode("crm-check");
    setCurrentStep(3);
    fetchCrmCheckLeads();
  };

  const moveToEnrichment = async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    setCrmCheckSelectedLeads(new Set());
    try {
      const res = await api.leads.moveToEnrichment(leadIds);
      const total = res.moved + res.skipped;
      toast({
        title: "Enrichment",
        description: total > 0
          ? `${res.moved} moved${res.skipped > 0 ? `, ${res.skipped} already in enrichment` : ""}${res.failed > 0 ? `, ${res.failed} failed` : ""}.`
          : `${res.failed} failed to move.`,
      });
      setViewMode("enrichment");
      setCurrentStep(4);
      setMaxStepReached((prev) => Math.max(prev, 4));
      // Fetch enrichment leads fresh from backend
      await fetchEnrichmentLeads();
    } catch (err) {
      toast({
        title: "Move failed",
        description: err instanceof Error ? err.message : "Failed to move leads to enrichment",
        variant: "destructive",
      });
    }
  };

  const moveToCollectDetails = async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    setEnrichmentSelectedLeads(new Set());
    try {
      const res = await api.leads.moveToCollectDetails(leadIds);
      const total = res.moved + res.skipped;
      toast({
        title: "Collect Details",
        description: total > 0
          ? `${res.moved} moved${res.skipped > 0 ? `, ${res.skipped} already in final list` : ""}${res.failed > 0 ? `, ${res.failed} failed` : ""}.`
          : `${res.failed} failed to move.`,
      });
      setViewMode("collect-details");
      setCurrentStep(5);
      setMaxStepReached((prev) => Math.max(prev, 5));
      await fetchCollectDetailsLeads();
    } catch (err) {
      toast({
        title: "Move failed",
        description: err instanceof Error ? err.message : "Failed to move leads to final list",
        variant: "destructive",
      });
    }
  };

  const toggleEnrichmentLead = (id: string) => {
    setEnrichmentSelectedLeads((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCollectDetailsLead = (id: string) => {
    setCollectDetailsSelectedLeads((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExportAndComplete = async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    const selectedLeadsData = collectDetailsLeads.filter((l) => leadIds.includes(l.id));
    const csv = generateFullLeadsCsv(selectedLeadsData);
    downloadCsv(csv, "final-list-leads");
    toast({ title: "Exported", description: `${leadIds.length} lead(s) exported as CSV` });
    try {
      await Promise.all(leadIds.map((id) => api.leads.updateStep(id, 8).catch(() => null)));
      setCollectDetailsLeads((prev) => prev.filter((l) => !leadIds.includes(l.id)));
      setCollectDetailsSelectedLeads((prev) => {
        const next = new Set(prev);
        leadIds.forEach((id) => next.delete(id));
        return next;
      });
      toast({ title: "Complete", description: `${leadIds.length} lead(s) marked as complete` });
      fetchSessions();
    } catch {
      toast({
        title: "Note",
        description: "Export succeeded. Some leads may not have been marked complete.",
        variant: "destructive",
      });
    }
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
    await runBulkCrmCheck(ids);
  };

  const handleMoveToCrmCheck = async () => {
    const ids = Array.from(selectedLeads);
    if (ids.length === 0) return;
    setIsSavingAndCheckDuplicate(true);
    setSelectedLeads(new Set());
    try {
      // 1) Move selected leads into the CRM Check stage
      const res = await api.leads.moveToCrmCheck(ids);
      toast({
        title: "Moved to CRM Check",
        description: `${res.moved} moved${res.skipped > 0 ? `, ${res.skipped} skipped` : ""}${res.failed > 0 ? `, ${res.failed} failed` : ""}.`,
      });

      // 2) Navigate to CRM Check view
      setViewMode("crm-check");
      setCurrentStep(3);
      setMaxStepReached((prev) => Math.max(prev, 3));

      // 3) Load CRM Check leads for this session
      await fetchCrmCheckLeads();

      // 4) Run bulk duplicate check for these moved leads
      await runBulkCrmCheck(ids);

      // 5) Auto-save checked leads to CRM (same rules as "Save to CRM" in CRM Check view)
      const saveableIds = crmCheckLeads
        .filter(
          (l) =>
            ids.includes(l.id) &&
            (l.crmStatus === "NEW" || l.crmStatus === "FOUND_SIMILAR") &&
            l.isNew !== false
        )
        .map((l) => l.id);

      if (saveableIds.length > 0) {
        await handleCrmCheckSaveToCrm(saveableIds);
      }

      fetchSessions();
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Could not move to CRM Check and run checks",
        variant: "destructive",
      });
    } finally {
      setIsSavingAndCheckDuplicate(false);
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
        email: lead.email,
        name: lead.name,
        address: lead.address,
        category: lead.category,
        contactPerson: lead.contactPerson,
      });
      setCrmCheckLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                crmStatus: res.crmStatus,
                checkMessage: res.message,
                duplicateOf: res.duplicateOf ?? undefined,
                similarMatches: res.similarMatches ?? [],
                isChecking: false,
                checkedAt: Date.now(),
              }
            : l
        )
      );
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

  const runBulkCrmCheck = async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    const idsSet = new Set(leadIds);
    setCrmCheckLeads((prev) =>
      prev.map((l) => (idsSet.has(l.id) ? { ...l, isChecking: true } : l))
    );
    try {
      const BULK_CHUNK = 100;
      const chunks = Array.from(
        { length: Math.ceil(leadIds.length / BULK_CHUNK) },
        (_, i) => leadIds.slice(i * BULK_CHUNK, (i + 1) * BULK_CHUNK)
      );
      let totalOk = 0;
      let totalFailed = 0;
      let dupCount = 0;
      for (const chunk of chunks) {
        const res = await api.leads.bulkCrmCheck(chunk);
        totalOk += res.ok;
        totalFailed += res.failed;
        dupCount += res.results.filter(
          (r) => r.status === "OK" && r.crmStatus === "DUPLICATE"
        ).length;
        const resultsById = new Map(
          res.results.filter((r) => r.status === "OK").map((r) => [r.leadId, r as BulkCrmCheckOkItem])
        );
        setCrmCheckLeads((prev) =>
          prev.map((l) => {
            if (!idsSet.has(l.id)) return l;
            const r = resultsById.get(l.id);
            if (!r) return { ...l, isChecking: false };
            return {
              ...l,
              crmStatus: r.crmStatus,
              checkMessage: r.message,
              duplicateOf: r.duplicateOf ?? undefined,
              similarMatches: r.similarMatches ?? [],
              isChecking: true,
              checkedAt: Date.now(),
            };
          })
        );
      }
      setCrmCheckLeads((prev) =>
        prev.map((l) => (idsSet.has(l.id) ? { ...l, isChecking: false } : l))
      );
      toast({
        title: "Bulk check complete",
        description: `${totalOk} checked${totalFailed > 0 ? `, ${totalFailed} failed` : ""}${dupCount > 0 ? ` · ${dupCount} duplicate(s)` : ""}.`,
      });
    } catch (err) {
      setCrmCheckLeads((prev) =>
        prev.map((l) => (idsSet.has(l.id) ? { ...l, isChecking: false } : l))
      );
      toast({
        title: "Bulk check failed",
        description: err instanceof Error ? err.message : "Failed to run bulk duplicate check",
        variant: "destructive",
      });
    }
  };

  const runAllCrmChecks = async () => {
    const allIds = crmCheckLeads.map((l) => l.id);
    if (allIds.length === 0) {
      toast({
        title: "No leads to check",
        description: "Add leads first.",
      });
      return;
    }
    await runBulkCrmCheck(allIds);
  };

  const handleCrmCheckSaveToCrm = async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    setCrmCheckSavingIds((prev) => new Set([...prev, ...leadIds]));
    try {
      const res = await api.leads.saveToCrm(leadIds);
      setCrmCheckLeads((prev) =>
        prev.map((l) =>
          leadIds.includes(l.id) ? { ...l, isNew: false } : l
        )
      );
      setCollectDetailsLeads((prev) => prev.filter((l) => !leadIds.includes(l.id)));
      setCollectDetailsSelectedLeads((prev) => {
        const next = new Set(prev);
        leadIds.forEach((id) => next.delete(id));
        return next;
      });
      setSessionCrmStats((prev) => ({
        ...prev,
        savedCount: (prev.savedCount ?? 0) + res.saved,
      }));
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

  const [isRemovingLeads, setIsRemovingLeads] = useState(false);

  const handleRemoveLeads = async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    setIsRemovingLeads(true);
    try {
      const REMOVE_CHUNK = 100;
      const chunks = Array.from(
        { length: Math.ceil(leadIds.length / REMOVE_CHUNK) },
        (_, i) => leadIds.slice(i * REMOVE_CHUNK, (i + 1) * REMOVE_CHUNK)
      );
      let totalRemoved = 0;
      for (const chunk of chunks) {
        const res = await api.leads.removeBulk(chunk);
        totalRemoved += res.removed;
      }
      const idsSet = new Set(leadIds);
      setLeads((prev) => prev.filter((l) => !idsSet.has(l.id)));
      setCrmCheckLeads((prev) => prev.filter((l) => !idsSet.has(l.id)));
      setEnrichmentLeads((prev) => prev.filter((l) => !idsSet.has(l.id)));
      setCollectDetailsLeads((prev) => prev.filter((l) => !idsSet.has(l.id)));
      setCollectDetailsSelectedLeads((prev) => {
        const next = new Set(prev);
        leadIds.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedLeads((prev) => {
        const next = new Set(prev);
        leadIds.forEach((id) => next.delete(id));
        return next;
      });
      setCrmCheckSelectedLeads((prev) => {
        const next = new Set(prev);
        leadIds.forEach((id) => next.delete(id));
        return next;
      });
      setEnrichmentSelectedLeads((prev) => {
        const next = new Set(prev);
        leadIds.forEach((id) => next.delete(id));
        return next;
      });
      if (activeLead && idsSet.has(activeLead.id)) setActiveLead(null);
      const failed = leadIds.length - totalRemoved;
      toast({
        title: "Removed",
        description: `${totalRemoved} lead(s) removed${failed > 0 ? `, ${failed} failed` : ""}.`,
      });
      fetchSessions();
    } catch (err) {
      toast({
        title: "Remove failed",
        description: err instanceof Error ? err.message : "Failed to remove leads",
        variant: "destructive",
      });
    } finally {
      setIsRemovingLeads(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* History sidebar — collapsible */}
      <div
        className="flex-shrink-0 flex flex-col border-r border-border bg-sidebar transition-[width] duration-250 ease-in-out relative"
        style={{ width: historyOpen ? 288 : 48 }}
      >
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          title={historyOpen ? "Close history" : "Open history"}
          className={cn(
            "flex items-center justify-center gap-2 py-3 transition-all flex-shrink-0 w-full",
            historyOpen
              ? "border-b border-sidebar-border text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/30 px-4"
              : "rounded-r-lg bg-primary/10 text-primary border-y border-r border-border hover:bg-primary/20"
          )}
        >
          {historyOpen ? (
            <>
              <PanelLeftClose className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium">History</span>
            </>
          ) : (
            <PanelLeftOpen className="w-5 h-5 flex-shrink-0" />
          )}
        </button>
        {historyOpen && (
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
            <Sidebar
              sessions={sessions}
              isLoading={isLoadingSessions}
              activeId={activeSessionId ?? ""}
              onSelect={(id) => {
                // Switch visible session; search may still be running for another session
                setActiveSessionId(id);
              }}
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
            />
          </div>
        )}
      </div>

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
                else if (stepId === 2) setViewMode("results");
                else if (stepId === 3) navigateToCrmCheck();
                else if (stepId === 4) {
                  setViewMode("enrichment");
                  setCurrentStep(4);
                  setMaxStepReached((prev) => Math.max(prev, 4));
                  fetchEnrichmentLeads();
                }
                else if (stepId === 5) {
                  setViewMode("collect-details");
                  setCurrentStep(5);
                  setMaxStepReached((prev) => Math.max(prev, 5));
                  fetchCollectDetailsLeads();
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

          {/* Main content */}
          <div className="flex-1 overflow-y-auto min-w-0">
            {viewMode === "dashboard" ? (
              <DashboardView
                onStatClick={navigateToLeadsList}
                onSearch={handleSearch}
                isSearching={isSearching}
                sessions={sessions}
                onSelectSession={(id) => setActiveSessionId(id)}
              />
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
                leads={enrichmentLeads}
                isLoading={isLoadingEnrichment}
                selectedLeads={enrichmentSelectedLeads}
                savingIds={crmCheckSavingIds}
                onToggle={toggleEnrichmentLead}
                onClearSelection={() => setEnrichmentSelectedLeads(new Set())}
                onSaveToCrm={handleCrmCheckSaveToCrm}
                onRemoveLeads={handleRemoveLeads}
                isRemoving={isRemovingLeads}
                onBack={() => { setViewMode("crm-check"); setCurrentStep(3); }}
                onMoveToCollectDetails={moveToCollectDetails}
                onViewLead={setActiveLead}
              />
            ) : viewMode === "collect-details" ? (
              <CollectDetailsView
                leads={collectDetailsLeads}
                isLoading={isLoadingCollectDetails}
                selectedLeads={collectDetailsSelectedLeads}
                onToggle={toggleCollectDetailsLead}
                onClearSelection={() => setCollectDetailsSelectedLeads(new Set())}
                onExportAndComplete={handleExportAndComplete}
                onRemoveLeads={handleRemoveLeads}
                isRemoving={isRemovingLeads}
                onBack={() => { setViewMode("enrichment"); setCurrentStep(4); fetchEnrichmentLeads(); }}
                onViewLead={setActiveLead}
              />
            ) : viewMode === "crm-check" ? (
              <CrmCheckView
                leads={crmCheckLeads}
                isLoading={isLoadingCrmCheck}
                savingIds={crmCheckSavingIds}
                selectedLeads={crmCheckSelectedLeads}
                sessionCrmStats={sessionCrmStats}
                onRunCheck={runCrmCheck}
                onRunAllChecks={runAllCrmChecks}
                onRunCheckForSelected={runCrmCheckForSelected}
                onSaveToCrm={handleCrmCheckSaveToCrm}
                onRemoveLeads={handleRemoveLeads}
                isRemoving={isRemovingLeads}
                onToggle={toggleCrmCheckLead}
                onClearSelection={() => setCrmCheckSelectedLeads(new Set())}
                onBack={() => { setViewMode("results"); setCurrentStep(2); }}
                onMoveToEnrichment={moveToEnrichment}
                onViewLead={(lead) => setActiveLead(lead)}
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
                isSearching={isSearching && (!searchingSessionId || activeSessionId === searchingSessionId)}
                isLoadingSession={isLoadingSession}
                searchError={searchError}
                onSaveToCrm={handleSaveToCrm}
                onMoveToCrmCheck={handleMoveToCrmCheck}
                isMovingToCrmCheck={isSavingAndCheckDuplicate}
                onExport={handleExport}
                onRemoveLeads={handleRemoveLeads}
                isRemoving={isRemovingLeads}
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
          onRemoveLead={() => handleRemoveLeads([activeLead.id])}
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

/** Check if lead is Lab Grown Diamond (store name or category) */
function isLabGrownDiamond(lead: { name?: string; category?: string }): boolean {
  const name = (lead.name ?? "").toLowerCase();
  const category = (lead.category ?? "").toLowerCase();
  const labGrown = "lab grown";
  return name.includes(labGrown) || category.includes(labGrown);
}

type CrmCheckFilter = "all" | "saved" | "duplicate" | "similar" | "labGrown";

/* ─── CRM Duplicate Check View ─── */
function CrmCheckView({
  leads,
  isLoading: isLoadingStage,
  savingIds,
  selectedLeads,
  sessionCrmStats,
  onRunCheck,
  onRunAllChecks,
  onRunCheckForSelected,
  onSaveToCrm,
  onRemoveLeads,
  isRemoving,
  onToggle,
  onClearSelection,
  onBack,
  onMoveToEnrichment,
  onViewLead,
}: {
  leads: CrmCheckLead[];
  isLoading?: boolean;
  savingIds: Set<string>;
  selectedLeads: Set<string>;
  sessionCrmStats: { savedCount?: number; duplicateCount?: number };
  onRunCheck: (lead: CrmCheckLead) => Promise<void>;
  onRunAllChecks: () => Promise<void>;
  onRunCheckForSelected: () => Promise<void>;
  onSaveToCrm: (leadIds: string[]) => Promise<void>;
  onRemoveLeads: (leadIds: string[]) => void;
  isRemoving?: boolean;
  onToggle: (id: string) => void;
  onClearSelection: () => void;
  onBack: () => void;
  onMoveToEnrichment: (leadIds: string[]) => void;
  onViewLead: (lead: CrmCheckLead) => void;
}) {
  const [filter, setFilter] = useState<CrmCheckFilter>("all");
  const [duplicateSimilarLead, setDuplicateSimilarLead] = useState<CrmCheckLead | null>(null);

  const isChecking = leads.some((l) => l.isChecking);
  const isSaving = savingIds.size > 0;
  const isCrmCheckLoading = isChecking || isSaving || isRemoving;

  const pendingCount = leads.filter(
    (l) => l.crmStatus === "PENDING" || !l.checkedAt || l.crmStatus === undefined
  ).length;
  const savedCount = leads.filter((l) => l.isNew === false).length;
  const duplicateCount = leads.filter((l) => l.crmStatus === "DUPLICATE").length;
  const similarCount = leads.filter(
    (l) => (l.similarMatches?.length ?? 0) > 0 && !l.duplicateOf
  ).length;
  const labGrownCount = leads.filter(isLabGrownDiamond).length;
  const saveableLeads = leads.filter(
    (l) => (l.crmStatus === "NEW" || l.crmStatus === "FOUND_SIMILAR") && l.isNew !== false && !savingIds.has(l.id)
  );
  const hasSaveable = saveableLeads.length > 0;

  const filteredLeads = (() => {
    switch (filter) {
      case "saved":
        return leads.filter((l) => l.isNew === false);
      case "duplicate":
        return leads.filter((l) => l.crmStatus === "DUPLICATE");
      case "similar":
        return leads.filter((l) => (l.similarMatches?.length ?? 0) > 0 && !l.duplicateOf);
      case "labGrown":
        return leads.filter(isLabGrownDiamond);
      default:
        return leads;
    }
  })();

  if (isLoadingStage) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
        <p className="text-sm font-medium text-foreground">Loading CRM Check leads...</p>
      </div>
    );
  }

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
    <div className="p-6 max-w-4xl mx-auto animate-slide-up relative">
      {/* Loading overlay */}
      {isCrmCheckLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl min-h-[200px]">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
          <p className="text-sm font-medium text-foreground">
            {isChecking ? "Checking for duplicates..." : "Saving to CRM..."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isChecking ? "Please wait" : `${savingIds.size} lead(s) being saved`}
          </p>
        </div>
      )}

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
            <>
              <span className="text-xs text-muted-foreground">{selectedLeads.size} selected</span>
              <button
                type="button"
                onClick={onClearSelection}
                className="text-xs text-destructive hover:underline font-semibold"
              >
                Deselect All
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              const filtered = (() => {
                switch (filter) {
                  case "saved": return leads.filter((l) => l.isNew === false);
                  case "duplicate": return leads.filter((l) => l.crmStatus === "DUPLICATE");
                  case "similar": return leads.filter((l) => (l.similarMatches?.length ?? 0) > 0 && !l.duplicateOf);
                  case "labGrown": return leads.filter(isLabGrownDiamond);
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
            { id: "saved" as const, label: "Saved", count: savedCount },
            { id: "duplicate" as const, label: "Duplicate", count: duplicateCount },
            { id: "similar" as const, label: "Found Similar", count: similarCount },
            { id: "labGrown" as const, label: "Lab Grown", count: labGrownCount },
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
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
        {filteredLeads.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? "No leads"
                : `No leads match "${
                    filter === "saved"
                      ? "Saved"
                      : filter === "duplicate"
                        ? "Duplicate"
                        : filter === "similar"
                          ? "Found Similar"
                          : "Lab Grown"
                  }" filter`}
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
          filteredLeads.map((lead) => {
            const wasChecked = !!(lead.checkedAt || lead.crmCheckedAt);
            const hasSimilar = wasChecked && (lead.similarMatches?.length ?? 0) > 0 && !lead.duplicateOf;
            const isDuplicate = !!lead.duplicateOf || lead.crmStatus === "DUPLICATE";
            const passedCheck =
              wasChecked && (lead.crmStatus === "NEW" || lead.crmStatus === "FOUND_SIMILAR") && !lead.duplicateOf;

            // Card accent color: green (OK), yellow (similar), red (duplicate)
            let crmColorClass = "";
            if (isDuplicate) {
              crmColorClass = "border-l-4 border-l-rose-500/80";
            } else if (hasSimilar) {
              crmColorClass = "border-l-4 border-l-amber-500/80";
            } else if (passedCheck) {
              crmColorClass = "border-l-4 border-l-emerald-500/80";
            }

            return (
              <ClickableLeadCard
                key={lead.id}
                lead={lead}
                selected={selectedLeads.has(lead.id)}
                onToggle={onToggle}
                onView={onViewLead}
                companyColor={crmColorClass}
                showViewButton={false}
              />
            );
          })
        )}

      {/* Duplicate / Similar leads popup */}
      <Dialog open={!!duplicateSimilarLead} onOpenChange={(open) => !open && setDuplicateSimilarLead(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {duplicateSimilarLead && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {duplicateSimilarLead.duplicateOf ? "Duplicate Found" : "Similar Leads Found"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {/* Lead being checked */}
                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Lead checked</p>
                  <h4 className="font-semibold text-foreground">{duplicateSimilarLead.name}</h4>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {duplicateSimilarLead.address && <p>{duplicateSimilarLead.address}</p>}
                    {duplicateSimilarLead.phone && <p>{duplicateSimilarLead.phone}</p>}
                    {duplicateSimilarLead.website && (
                      <a href={`https://${duplicateSimilarLead.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {duplicateSimilarLead.website}
                      </a>
                    )}
                  </div>
                  {duplicateSimilarLead.checkMessage && (
                    <p className="mt-2 text-xs text-muted-foreground">{duplicateSimilarLead.checkMessage}</p>
                  )}
                </div>

                {/* Duplicate of */}
                {duplicateSimilarLead.duplicateOf && (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">Duplicate of</p>
                    <h4 className="font-semibold text-foreground">{duplicateSimilarLead.duplicateOf.name}</h4>
                    {duplicateSimilarLead.duplicateOf.crmId && (
                      <p className="mt-1 text-xs text-muted-foreground">CRM ID: {duplicateSimilarLead.duplicateOf.crmId}</p>
                    )}
                  </div>
                )}

                {/* Similar matches */}
                {duplicateSimilarLead.similarMatches && duplicateSimilarLead.similarMatches.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Similar leads ({duplicateSimilarLead.similarMatches.length})
                    </p>
                    <div className="space-y-3">
                      {duplicateSimilarLead.similarMatches.map((m) => (
                        <div
                          key={m.id}
                          className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-medium text-foreground">{m.name}</h4>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium mt-1 inline-block">
                                Score: {m.score}%
                              </span>
                              {m.source === "duplicate_dummy" && (
                                <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  CRM record
                                </span>
                              )}
                            </div>
                          </div>
                          {m.reason && (
                            <p className="mt-2 text-xs text-muted-foreground">{m.reason}</p>
                          )}
                          {m.matchedFields && m.matchedFields.length > 0 && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              Matched: {m.matchedFields.join(", ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sticky bar when selected (CRM check actions) */}
      {selectedLeads.size > 0 && (
        <div className="col-span-2 xl:col-span-3 sticky bottom-4 mt-6 w-full flex items-center justify-between px-5 py-3.5 rounded-xl bg-card border border-primary/25 shadow-lg animate-slide-up z-20">
          <p className="text-sm font-medium text-foreground">
            <span className="text-primary font-bold">{selectedLeads.size}</span> selected
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemoveLeads(Array.from(selectedLeads))}
              disabled={isCrmCheckLoading || isRemoving}
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete Lead
            </Button>
            {(() => {
              const selectedEligible = leads.filter((l) => selectedLeads.has(l.id));
              return selectedEligible.length > 0 ? (
                <Button
                  size="sm"
                  onClick={() => onMoveToEnrichment(selectedEligible.map((l) => l.id))}
                  className="gap-2 bg-primary"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  Move to Enrichment
                </Button>
              ) : null;
            })()}
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

function CrmCheckStatusBadge({ lead }: { lead: CrmCheckLead }) {
  const wasChecked = !!(lead.checkedAt || lead.crmCheckedAt);
  const hasSimilar = wasChecked && (lead.similarMatches?.length ?? 0) > 0 && !lead.duplicateOf;
  const passedCheck = wasChecked && lead.crmStatus === "NEW" && !lead.duplicateOf;
  const effectiveStatus = lead.duplicateOf
    ? "DUPLICATE"
    : hasSimilar
      ? "FOUND_SIMILAR"
      : passedCheck
        ? "NOT_DUPLICATE"
        : (lead.crmStatus ?? "PENDING");
  const config: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-muted text-muted-foreground border-border" },
    NEW: { label: "New", className: "bg-primary/15 text-primary border-primary/30" },
    NOT_DUPLICATE: { label: "Not Duplicate", className: "bg-success/15 text-success border-success/30" },
    DUPLICATE: { label: "Duplicate", className: "bg-destructive/15 text-destructive border-destructive/30" },
    FOUND_SIMILAR: { label: "Found Similar", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    ALREADY_REACHED: { label: "Already Reached", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  };
  const c = config[effectiveStatus] ?? config.PENDING;
  const saved = lead.isNew === false;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", c.className)}>
        {c.label}
      </span>
      {saved && (
        <span className="text-xs px-2.5 py-1 rounded-full border font-medium bg-success/15 text-success border-success/30">
          Saved to CRM
        </span>
      )}
    </div>
  );
}

/* ─── Enrichment View (verified + no duplicate leads only) ─── */
function EnrichmentView({
  leads,
  isLoading: isLoadingStage,
  selectedLeads,
  savingIds,
  onToggle,
  onClearSelection,
  onSaveToCrm,
  onRemoveLeads,
  isRemoving,
  onBack,
  onMoveToCollectDetails,
  onViewLead,
}: {
  leads: Lead[];
  isLoading?: boolean;
  selectedLeads: Set<string>;
  savingIds: Set<string>;
  onToggle: (id: string) => void;
  onClearSelection: () => void;
  onSaveToCrm: (leadIds: string[]) => Promise<void>;
  onRemoveLeads: (leadIds: string[]) => void;
  isRemoving?: boolean;
  onBack: () => void;
  onMoveToCollectDetails: (leadIds: string[]) => void;
  onViewLead: (lead: Lead) => void;
}) {
  if (isLoadingStage) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
        <p className="text-sm font-medium text-foreground">Loading enrichment leads...</p>
      </div>
    );
  }

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
        <div className="flex items-center gap-3">
          {selectedLeads.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selectedLeads.size} selected</span>
              <button
                type="button"
                onClick={onClearSelection}
                className="text-xs text-destructive hover:underline font-semibold"
              >
                Deselect All
              </button>
            </>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemoveLeads(Array.from(selectedLeads))}
              disabled={isRemoving}
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete Selected
            </Button>
            {(() => {
              const selectedNew = leads.filter(
                (l) => selectedLeads.has(l.id) && (l.crmStatus === "NEW" || l.crmStatus === "FOUND_SIMILAR") && l.isNew !== false && !savingIds.has(l.id)
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
            <Button size="sm" onClick={() => onMoveToCollectDetails(Array.from(selectedLeads))} className="gap-2">
              <ChevronRight className="w-3.5 h-3.5" />
              Collect Details ({selectedLeads.size})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Collect Details / Final List View ─── */
function CollectDetailsView({
  leads,
  isLoading: isLoadingStage,
  selectedLeads,
  onToggle,
  onClearSelection,
  onExportAndComplete,
  onRemoveLeads,
  isRemoving,
  onBack,
  onViewLead,
}: {
  leads: Lead[];
  isLoading?: boolean;
  selectedLeads: Set<string>;
  onToggle: (id: string) => void;
  onClearSelection: () => void;
  onExportAndComplete: (leadIds: string[]) => void;
  onRemoveLeads: (leadIds: string[]) => void;
  isRemoving?: boolean;
  onBack: () => void;
  onViewLead: (lead: Lead) => void;
}) {
  if (isLoadingStage) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
        <p className="text-sm font-medium text-foreground">Loading final list...</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <FileCheck className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No leads in final list</h2>
        <p className="text-muted-foreground max-w-sm mb-6">
          Move leads from Enrichment to export and mark as complete.
        </p>
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Enrichment
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
          <FileCheck className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Final List</h1>
            <p className="text-xs text-muted-foreground">
              {leads.length} leads ready to export
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedLeads.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selectedLeads.size} selected</span>
              <button
                type="button"
                onClick={onClearSelection}
                className="text-xs text-destructive hover:underline font-semibold"
              >
                Deselect All
              </button>
            </>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemoveLeads(Array.from(selectedLeads))}
              disabled={isRemoving}
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete Selected
            </Button>
            <Button
              size="sm"
              onClick={() => onExportAndComplete(Array.from(selectedLeads))}
              className="gap-2 bg-primary"
            >
              <Download className="w-3.5 h-3.5" />
              Export to CSV ({selectedLeads.size})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Dashboard ─── */
function DashboardView({
  onStatClick,
  onSearch,
  isSearching,
  sessions,
  onSelectSession,
}: {
  onStatClick?: (key: "totalLeads" | "enriched" | "pendingReview") => void;
  onSearch: (params: SearchParams) => void;
  isSearching: boolean;
  sessions: ChatSession[];
  onSelectSession: (id: string) => void;
}) {
  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in space-y-8">
      {/* Hero + Search */}
      <div className="rounded-2xl border border-primary/15 p-6 md:p-8 relative"
        style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
          style={{ background: "radial-gradient(ellipse at 80% 40%, hsl(214 100% 58% / 0.1), transparent 60%)" }} />
        <div className="relative space-y-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Find New Leads</h1>
            <p className="text-muted-foreground mt-1 text-sm">Search for diamond &amp; jewellery businesses to add to your pipeline</p>
          </div>
          <SearchPanel onSearch={onSearch} isSearching={isSearching} compact />
        </div>
      </div>

      {/* Stats */}
      <StatsBar onStatClick={onStatClick} />

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
            Recent Searches
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessions.slice(0, 6).map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card text-left transition-all hover:border-primary/30 hover:bg-primary/5 group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Search className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{s.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{s.time}</span>
                    {typeof s.leadCount === "number" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {s.leadCount} leads
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary flex-shrink-0 mt-1 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}
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
  onMoveToCrmCheck,
  isMovingToCrmCheck,
  onExport,
  onRemoveLeads,
  isRemoving,
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
  onMoveToCrmCheck: () => void;
  isMovingToCrmCheck: boolean;
  onExport: () => void;
  onRemoveLeads: (leadIds: string[]) => void;
  isRemoving?: boolean;
  onClearSelection: () => void;
}) {
  const [labGrownFilter, setLabGrownFilter] = useState(false);
  const displayedLeads = useMemo(
    () => (labGrownFilter ? leads.filter(isLabGrownDiamond) : leads),
    [leads, labGrownFilter]
  );

  // Group leads by name (same company, different locations) — accent colors + sibling list
  const { companyColors, companySiblings } = useMemo(() => {
    const byName = new Map<string, Lead[]>();
    for (const l of leads) {
      const list = byName.get(l.name) ?? [];
      list.push(l);
      byName.set(l.name, list);
    }
    const leadToColor = new Map<string, string>();
    const leadToSiblings = new Map<string, Lead[]>();
    const BORDERS = [
      "border-l-4 border-l-blue-500/80",
      "border-l-4 border-l-emerald-500/80",
      "border-l-4 border-l-amber-500/80",
      "border-l-4 border-l-violet-500/80",
      "border-l-4 border-l-rose-500/80",
      "border-l-4 border-l-cyan-500/80",
    ];
    let idx = 0;
    for (const [, group] of byName) {
      if (group.length > 1) {
        const c = BORDERS[idx % BORDERS.length];
        for (const l of group) {
          leadToColor.set(l.id, c);
          leadToSiblings.set(l.id, group.filter((x) => x.id !== l.id));
        }
        idx++;
      }
    }
    return { companyColors: leadToColor, companySiblings: leadToSiblings };
  }, [displayedLeads]);

  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 min-h-[300px]">
        <div className="w-14 h-14 border-2 border-border border-t-primary rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Searching for leads...</p>
          <p className="text-xs text-muted-foreground mt-1">
            {searchMeta?.mode === "natural"
              ? searchMeta.query
              : searchMeta?.mode === "current_location"
                ? "Searching near your current location..."
                : searchMeta?.mode === "apify"
                  ? `Searching via Apify... ${searchMeta.searchStrings?.length ? searchMeta.searchStrings.join(", ") + " in " : ""}${searchMeta.location}`
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
    <div className="p-6 max-w-5xl mx-auto animate-slide-up relative">
      {isMovingToCrmCheck && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl min-h-[300px]">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-3" />
          <p className="text-sm font-semibold text-foreground">Moving to CRM Check...</p>
          <p className="text-xs text-muted-foreground mt-1">Please wait</p>
        </div>
      )}
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
        ) : searchMeta?.mode === "current_location" ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground font-medium">
            <MapPin className="w-3 h-3 text-primary" />Near Me &middot; {searchMeta.radiusKm} km radius
          </span>
        ) : searchMeta?.mode === "apify" ? (
          <>
            {(searchMeta.searchStrings ?? []).map((c) => (
              <span key={c} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground font-medium">
                <Search className="w-3 h-3 text-primary" />{c}
              </span>
            ))}
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground font-medium">
              <MapPin className="w-3 h-3 text-primary" />{searchMeta.location}
            </span>
          </>
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
          <Shield className="w-3 h-3" />{labGrownFilter ? `${displayedLeads.length} of ${leads.length}` : leads.length} leads found
        </span>
        <button
          type="button"
          onClick={() => setLabGrownFilter((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
            labGrownFilter
              ? "bg-primary/15 border-primary/30 text-primary"
              : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <Search className="w-3 h-3" />
          Lab Grown ({leads.filter(isLabGrownDiamond).length})
        </button>
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
            <>
              <span className="text-xs text-muted-foreground">{selectedLeads.size} selected</span>
              <button onClick={onClearSelection} className="text-xs text-destructive hover:underline font-semibold">
                Deselect All
              </button>
            </>
          )}
          <button onClick={onSelectAllNew} className="text-xs text-primary hover:underline font-semibold">
            Select All New
          </button>
        </div>
      </div>

      {/* Grid - items-stretch ensures equal height per row */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
        {displayedLeads.length === 0 ? (
          <div className="col-span-2 xl:col-span-3 py-12 text-center rounded-xl border border-dashed border-border bg-muted/30">
            {labGrownFilter ? (
              <>
                <p className="text-sm text-muted-foreground">No Lab Grown Diamond leads found</p>
                <button
                  type="button"
                  onClick={() => setLabGrownFilter(false)}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Show all leads
                </button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No leads</p>
            )}
          </div>
        ) : (
          displayedLeads.map((lead) => (
            <ClickableLeadCard
              key={lead.id}
              lead={lead}
              selected={selectedLeads.has(lead.id)}
              onToggle={onToggle}
              onView={onViewLead}
              companyColor={companyColors.get(lead.id)}
              siblingLeads={companySiblings.get(lead.id)}
              showViewButton={false}
            />
          ))
        )}
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
              onClick={() => onRemoveLeads(Array.from(selectedLeads))}
              disabled={isRemoving}
              className="text-xs px-4 py-2 rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 transition-all flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete Lead
            </button>
            <button
              type="button"
              onClick={() => onMoveToCrmCheck()}
              disabled={isMovingToCrmCheck}
              className="text-xs px-4 py-2 rounded-lg bg-primary/80 text-primary-foreground font-semibold hover:bg-primary transition-all flex items-center gap-1.5 border border-primary/50 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isMovingToCrmCheck ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Shield className="w-3.5 h-3.5" />
              )}
              {isMovingToCrmCheck ? "Moving to CRM Check..." : "Move to CRM Check"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Lead card with optional View button ─── */
function ClickableLeadCard({
  lead, selected, onToggle, onView, companyColor, siblingLeads, showViewButton = true,
}: {
  lead: Lead;
  selected: boolean;
  onToggle: (id: string) => void;
  onView: (lead: Lead) => void;
  companyColor?: string;
  siblingLeads?: Lead[];
  showViewButton?: boolean;
}) {
  return (
    <div className="relative group min-h-[220px] h-full flex flex-col">
      <LeadCard
        lead={lead}
        selected={selected}
        onToggle={onToggle}
        companyColor={companyColor}
        siblingLeads={siblingLeads}
        onViewSibling={onView}
      />
      {showViewButton && (
        <button
          onClick={(e) => { e.stopPropagation(); onView(lead); }}
          className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] px-2.5 py-1.5 rounded-md bg-primary/15 border border-primary/30 text-primary font-semibold hover:bg-primary/25 z-10"
        >
          View →
        </button>
      )}
    </div>
  );
}
