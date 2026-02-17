import { useState } from "react";
import { Sidebar, ChatSession } from "@/components/leads/Sidebar";
import { WorkflowStepper } from "@/components/leads/WorkflowStepper";
import { SearchPanel } from "@/components/leads/SearchPanel";
import { LeadCard, Lead } from "@/components/leads/LeadCard";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";
import { StatsBar } from "@/components/leads/StatsBar";
import {
  MapPin, Search, Shield, Download, X,
  ChevronDown, ChevronUp, Layers, Zap
} from "lucide-react";

const MOCK_SESSIONS: ChatSession[] = [
  { id: "1", title: "Jewellery stores", time: "13 min ago", leadCount: 10 },
  { id: "2", title: "Jewellery stores", time: "About 15 hrs ago", leadCount: 20 },
  { id: "3", title: "Jewellery stores", time: "About 14 hrs ago", leadCount: 10 },
  { id: "4", title: "Jewellery stores", time: "About 8 hrs ago", leadCount: 10 },
  { id: "5", title: "Give me 20 Jewellery Mfr...", time: "About 7 hrs ago", leadCount: 20 },
  { id: "6", title: "Jewellery stores", time: "About 1 hr ago", leadCount: 10 },
];

const MOCK_LEADS: Lead[] = [
  { id: "l1", rank: 1, name: "Joyalukkas Jewellery - Pune", category: "Chain Store", rating: 4.7, address: "1258, A/2, Jangali Maharaj Rd, Deccan Gymkhana, Pune 411004", phone: "+91 20 2553 7979", website: "www.joyalukkas.in", hours: "Closed · Opens 10:30 AM", isNew: true },
  { id: "l2", rank: 2, name: "Tanishq Jewellery - Pune - JM Road", category: "Chain Store", rating: 4.7, address: "Modern High School, 1318, opp. Jangali Maharaj Rd, Shivajinagar, Pune", phone: "+91 98231 96633", website: "stores.tanishq.co.in", hours: "Closed · Opens 10:30 AM", isNew: true },
  { id: "l3", rank: 3, name: "BlueStone Jewellery - Phoenix Marketcity", category: "Retailer", rating: 4.9, address: "Phoenix Marketcity Mall, Hadapsar, Pune 411028", phone: "+91 80 6912 5555", website: "www.bluestone.com", hours: "Opens at 11:00 AM", isNew: true },
  { id: "l4", rank: 4, name: "PNG Sons Aundh – P N Gadgil & Sons", category: "Retailer", rating: 4.8, address: "Aundh, Pune, Maharashtra 411007", phone: "+91 20 2588 9822", website: "www.pnggold.com", hours: "Closed · Opens 10:00 AM", isNew: false },
  { id: "l5", rank: 5, name: "Kalyan Jewellers - Pune", category: "Chain Store", rating: 4.6, address: "FC Road, Shivajinagar, Pune 411005", phone: "+91 80 4666 0000", website: "www.kalyanjewellers.net", hours: "Closed · Opens 10:00 AM", isNew: true },
  { id: "l6", rank: 6, name: "Malabar Gold & Diamonds", category: "Chain Store", rating: 4.5, address: "Kumar Pacific Mall, Swargate, Pune 411042", phone: "+91 80 4444 1111", website: "www.malabargold.com", hours: "Opens at 10:00 AM", isNew: false },
];

type ViewMode = "dashboard" | "results";

export default function Index() {
  const [sessions, setSessions] = useState<ChatSession[]>(MOCK_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState("1");
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState<{ location: string; categories: string[]; count: number } | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState(1);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [searchOpen, setSearchOpen] = useState(true);

  const handleSearch = (params: { location: string; categories: string[]; count: number }) => {
    setIsSearching(true);
    setSearchMeta(params);
    setCurrentStep(2);
    setSearchOpen(false);

    setTimeout(() => {
      setLeads(MOCK_LEADS);
      setIsSearching(false);
      setViewMode("results");
      setCurrentStep(3);
      const newSession: ChatSession = {
        id: String(Date.now()),
        title: `${params.categories[0]} in ${params.location}`,
        time: "just now",
        leadCount: params.count,
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    }, 2000);
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
    setSearchOpen(true);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Narrow sidebar */}
      <Sidebar
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={setActiveSessionId}
        onNew={handleNew}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Top bar: workflow stepper */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface-1 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto scrollbar-none">
            <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <WorkflowStepper currentStep={currentStep} />
          </div>
          {viewMode === "results" && selectedLeads.size > 0 && (
            <button className="flex-shrink-0 ml-4 flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-success/10 border border-success/30 text-success hover:bg-success/20 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Export {selectedLeads.size} leads
            </button>
          )}
        </div>

        {/* Content row */}
        <div className="flex flex-1 min-h-0">

          {/* Search sidebar — collapsible */}
          <div className="flex-shrink-0 border-r border-border bg-surface-1 flex flex-col"
            style={{ width: searchOpen ? 280 : 48, transition: "width 0.25s ease" }}
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
              />
            )}
          </div>
        </div>
      </div>

      {/* Lead detail slide-out */}
      {activeLead && (
        <LeadDetailPanel lead={activeLead} onClose={() => setActiveLead(null)} />
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

      {/* 7-step workflow */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-primary inline-block" />
          7-Step Lead Generation SOP
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { step: 1, title: "Define Lead Type", desc: "Chain Store, Retailer, Manufacturer, E-Commerce..." },
            { step: 2, title: "Search Google Maps", desc: "Use specific terms. Target priority cities & regions." },
            { step: 3, title: "Create Lead List", desc: "Company, Name, Phone, Website, Email" },
            { step: 4, title: "CRM Duplicate Check", desc: "Verify uniqueness. Request lead transfer if needed." },
            { step: 5, title: "Enrichment Prep", desc: "Move verified non-duplicate leads forward." },
            { step: 6, title: "Collect Details", desc: "Website → LinkedIn → Instagram → Google Maps" },
            { step: 7, title: "Finalize Outreach", desc: "Enriched list ready for sales team outreach." },
          ].map((s) => (
            <div key={s.step} className="bg-card border border-border rounded-xl p-4 card-hover">
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {s.step}
                </span>
                <h3 className="text-xs font-semibold text-foreground leading-tight">{s.title}</h3>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Results ─── */
function ResultsView({
  leads, selectedLeads, onToggle, onSelectAllNew, onViewLead, searchMeta, isSearching,
}: {
  leads: Lead[];
  selectedLeads: Set<string>;
  onToggle: (id: string) => void;
  onSelectAllNew: () => void;
  onViewLead: (lead: Lead) => void;
  searchMeta: { location: string; categories: string[]; count: number } | null;
  isSearching: boolean;
}) {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5">
        <div className="w-14 h-14 border-2 border-border border-t-primary rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Searching for leads...</p>
          <p className="text-xs text-muted-foreground mt-1">
            {searchMeta?.categories.join(", ")} in <span className="text-foreground">{searchMeta?.location}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto animate-slide-up">
      {/* Result chips */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {searchMeta?.categories.map((c) => (
          <span key={c} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground font-medium">
            <Search className="w-3 h-3 text-primary" />{c}
          </span>
        ))}
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground font-medium">
          <MapPin className="w-3 h-3 text-primary" />{searchMeta?.location}
        </span>
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
            <button className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
              Clear
            </button>
            <button className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-[0_0_16px_hsl(214_100%_58%/0.25)]">
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
