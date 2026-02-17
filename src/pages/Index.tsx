import { useState } from "react";
import { Sidebar, ChatSession } from "@/components/leads/Sidebar";
import { StepsPanel } from "@/components/leads/StepsPanel";
import { SearchPanel } from "@/components/leads/SearchPanel";
import { LeadCard, Lead } from "@/components/leads/LeadCard";
import { StatsBar } from "@/components/leads/StatsBar";
import {
  MapPin,
  Search,
  Shield,
  Download,
  BookOpen,
  ChevronRight,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_SESSIONS: ChatSession[] = [
  { id: "1", title: "Jewellery stores", time: "13 min ago", leadCount: 10 },
  { id: "2", title: "Jewellery stores", time: "About 15 hrs ago", leadCount: 20 },
  { id: "3", title: "Jewellery stores", time: "About 14 hrs ago", leadCount: 10 },
  { id: "4", title: "Jewellery stores", time: "About 8 hrs ago", leadCount: 10 },
  { id: "5", title: "Give me 20 Jewellery Mfr...", time: "About 7 hrs ago", leadCount: 20 },
  { id: "6", title: "Jewellery stores", time: "About 1 hr ago", leadCount: 10 },
];

const MOCK_LEADS: Lead[] = [
  {
    id: "l1", rank: 1, name: "Joyalukkas Jewellery - Pune", category: "Chain Store",
    rating: 4.7, address: "1258, A/2, Jangali Maharaj Rd, Deccan Gymkhana, Pune",
    phone: "+91 20 2553 7979", website: "www.joyalukkas.in", hours: "Closed · Opens 10:30 AM", isNew: true,
  },
  {
    id: "l2", rank: 2, name: "Tanishq Jewellery - Pune - JM Road", category: "Chain Store",
    rating: 4.7, address: "Modern High School, 1318, opp. Jangali Maharaj...",
    phone: "+91 98231 96633", website: "stores.tanishq.co.in", hours: "Closed · Opens 10:30 AM", isNew: true,
  },
  {
    id: "l3", rank: 3, name: "BlueStone Jewellery - Phoenix Marketcity", category: "Retailer",
    rating: 4.9, address: "Phoenix Marketcity, Hadapsar, Pune",
    phone: "+91 80 6912 5555", website: "www.bluestone.com", hours: "Opens at 11:00 AM", isNew: true,
  },
  {
    id: "l4", rank: 4, name: "PNG Sons Aundh P N Gadgil & Sons Ltd", category: "Retailer",
    rating: 4.8, address: "Aundh, Pune, Maharashtra 411007",
    phone: "+91 20 2588 9822", website: "www.pnggold.com", hours: "Closed · Opens 10:00 AM", isNew: false,
  },
  {
    id: "l5", rank: 5, name: "Kalyan Jewellers - Pune", category: "Chain Store",
    rating: 4.6, address: "FC Road, Shivajinagar, Pune 411005",
    phone: "+91 80 4666 0000", website: "www.kalyanjewellers.net", hours: "Closed · Opens 10:00 AM", isNew: true,
  },
  {
    id: "l6", rank: 6, name: "Malabar Gold & Diamonds", category: "Chain Store",
    rating: 4.5, address: "Kumar Pacific Mall, Swargate, Pune",
    phone: "+91 80 4444 1111", website: "www.malabargold.com", hours: "Opens at 10:00 AM", isNew: false,
  },
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
  const [currentStep, setCurrentStep] = useState(2);

  const handleSearch = (params: { location: string; categories: string[]; count: number }) => {
    setIsSearching(true);
    setSearchMeta(params);
    setCurrentStep(2);

    setTimeout(() => {
      setLeads(MOCK_LEADS.slice(0, params.count > 6 ? 6 : params.count));
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
    const newLeadIds = leads.filter((l) => l.isNew).map((l) => l.id);
    setSelectedLeads(new Set(newLeadIds));
  };

  const handleNew = () => {
    setViewMode("dashboard");
    setLeads([]);
    setSelectedLeads(new Set());
    setSearchMeta(null);
    setCurrentStep(1);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={setActiveSessionId}
        onNew={handleNew}
      />

      {/* Main content */}
      <div className="flex flex-1 min-w-0">
        {/* Left panel - Steps + Search */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col overflow-y-auto bg-surface-1">
          <StepsPanel currentStep={currentStep} />
          <div className="border-t border-border">
            <SearchPanel onSearch={handleSearch} isSearching={isSearching} />
          </div>
        </div>

        {/* Right content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-surface-1/50 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="w-4 h-4" />
              <span>Dashboard</span>
              {viewMode === "results" && searchMeta && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="text-foreground font-medium">
                    {searchMeta.categories[0]} · {searchMeta.location}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {viewMode === "results" && selectedLeads.size > 0 && (
                <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-success/10 border border-success/30 text-success hover:bg-success/20 transition-colors">
                  <Download className="w-3.5 h-3.5" />
                  Export {selectedLeads.size} leads
                </button>
              )}
              <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors">
                <BookOpen className="w-3.5 h-3.5" />
                SOP Guide
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {viewMode === "dashboard" ? (
              <DashboardView onStartSearch={() => setViewMode("dashboard")} />
            ) : (
              <ResultsView
                leads={leads}
                selectedLeads={selectedLeads}
                onToggle={toggleLead}
                onSelectAllNew={selectAllNew}
                searchMeta={searchMeta}
                isSearching={isSearching}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Dashboard View ─────────────── */
function DashboardView({ onStartSearch }: { onStartSearch: () => void }) {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="rounded-2xl border border-primary/15 overflow-hidden relative" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 80% 50%, hsl(214 100% 58% / 0.08), transparent 60%)" }} />
        <div className="relative p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground font-space">Lead Generation Portal</h1>
              <p className="text-sm text-muted-foreground mt-1">HK Exports · Jewellery Business Lead Finder</p>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  Search by location
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Search className="w-3.5 h-3.5 text-primary" />
                  6 business categories
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  CRM duplicate check
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatsBar />

      {/* SOP Steps overview */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-primary inline-block" />
          Lead Generation Workflow (7 Steps)
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { step: 1, title: "Define Lead Type", desc: "Chain Store, Retailer, Manufacturer..." },
            { step: 2, title: "Search Google Maps", desc: "Target cities & use specific terms" },
            { step: 3, title: "Create Lead List", desc: "Name, Phone, Website, Email" },
            { step: 4, title: "CRM Duplicate Check", desc: "Verify & request lead transfer" },
            { step: 5, title: "Enrichment Prep", desc: "Move verified leads forward" },
            { step: 6, title: "Collect Details", desc: "Website, LinkedIn, Instagram, Maps" },
            { step: 7, title: "Finalize Outreach", desc: "Ready for sales team" },
          ].map((s) => (
            <div
              key={s.step}
              className={cn(
                "bg-card border border-border rounded-xl p-3.5 card-hover",
                s.step === 1 && "col-span-1"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {s.step}
                </span>
                <h3 className="text-xs font-semibold text-foreground leading-tight">{s.title}</h3>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Ready to find leads?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Enter a location and select a category in the left panel to begin</p>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <kbd className="px-2 py-1 rounded bg-secondary border border-border font-mono">Location</kbd>
          <span className="self-center">+</span>
          <kbd className="px-2 py-1 rounded bg-secondary border border-border font-mono">Category</kbd>
          <ChevronRight className="w-4 h-4 self-center text-primary" />
          <kbd className="px-2 py-1 rounded bg-primary/15 border border-primary/30 text-primary font-mono">Find Leads</kbd>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Results View ─────────────── */
function ResultsView({
  leads,
  selectedLeads,
  onToggle,
  onSelectAllNew,
  searchMeta,
  isSearching,
}: {
  leads: Lead[];
  selectedLeads: Set<string>;
  onToggle: (id: string) => void;
  onSelectAllNew: () => void;
  searchMeta: { location: string; categories: string[]; count: number } | null;
  isSearching: boolean;
}) {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 border-2 border-border border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Searching for leads in <span className="text-foreground font-medium">{searchMeta?.location}</span>...</p>
        <div className="flex gap-2">
          {searchMeta?.categories.map((c) => (
            <span key={c} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">{c}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 animate-slide-up">
      {/* Result summary bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {searchMeta?.categories.map((c) => (
          <div key={c} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground font-medium">
            <Search className="w-3 h-3 text-primary" />
            {c}
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground font-medium">
          <MapPin className="w-3 h-3 text-primary" />
          {searchMeta?.location}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
          <Shield className="w-3 h-3" />
          {leads.length} leads found
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {selectedLeads.size} selected
          </span>
          <button
            onClick={onSelectAllNew}
            className="text-xs text-primary hover:underline font-medium"
          >
            Select All New
          </button>
        </div>
      </div>

      {/* Lead grid */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            selected={selectedLeads.has(lead.id)}
            onToggle={onToggle}
          />
        ))}
      </div>

      {/* Save bar */}
      {selectedLeads.size > 0 && (
        <div className="sticky bottom-6 mt-6 flex items-center justify-between px-5 py-3.5 rounded-xl bg-primary/10 border border-primary/30 backdrop-blur-sm animate-slide-up">
          <p className="text-sm font-medium text-foreground">
            <span className="text-primary font-bold">{selectedLeads.size}</span> leads selected for save
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {}}
              className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Clear
            </button>
            <button className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-[0_0_16px_hsl(214_100%_58%/0.25)] flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Save to CRM
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
