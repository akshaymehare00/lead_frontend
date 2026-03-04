/**
 * Lead Compass API Client
 * Base URL: VITE_API_URL or http://localhost:3000
 */

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://lead-backend-ehky.onrender.com" : "http://localhost:3000");

const TOKEN_KEY = "lead-compass-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export interface ApiError {
  valid?: boolean;
  error: string;
  details?: Record<string, unknown>;
}

/** Parse 400 error: { valid: false, error: "..." } or { valid: false, error: "Invalid request", details: {...} } */
function parseApiError(err: unknown): string {
  const obj = err as ApiError & { message?: string };
  if (obj?.error) return obj.error;
  if (obj?.message) return obj.message;
  return "Request failed";
}

/** Get validation details for display */
export function getApiErrorDetails(err: unknown): Record<string, unknown> | undefined {
  const obj = err as ApiError;
  return obj?.details;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    cache: "no-store",
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = parseApiError(err);
    const e = new Error(msg) as Error & { details?: Record<string, unknown> };
    e.details = (err as ApiError).details;
    throw e;
  }

  const contentType = res.headers.get("Content-Type");
  if (contentType?.includes("text/csv") || contentType?.includes("application/vnd.openxmlformats")) {
    return res.blob() as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ─── Types ───

export interface LoginResponse {
  token: string;
  user: { id: string; email: string; name: string; role: "ADMIN" | "USER" };
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  createdAt: string;
}

export interface SearchParamsNatural {
  mode: "natural";
  query: string;
  maxLead?: number;
}

export interface SearchParamsManual {
  mode: "manual";
  location: string;
  categories: string[];
  maxLead?: number;
}

export interface SearchParamsCurrentLocation {
  mode: "current_location";
  latitude: number;
  longitude: number;
  radiusKm?: number;
  maxLead?: number;
}

export interface SearchParamsApify {
  mode: "apify";
  location: string;
  searchStrings?: string[];
  maxLead?: number;
}

export type SearchParams = SearchParamsNatural | SearchParamsManual | SearchParamsCurrentLocation | SearchParamsApify;

export interface PlaceSuggestion {
  id: string;
  name: string;
  canonicalName: string;
  countryCode: string;
  targetType: string;
}

export interface SearchStartResponse {
  searchSessionId: string;
  status: string;
  message: string;
}

/** CRM check match from session/API (same shape as CrmCheckSimilarMatch) */
export interface CrmCheckMatch {
  id: string;
  source: "lead" | "duplicate_dummy";
  name: string;
  score?: number;
  matchedFields: string[];
  reason: string;
  crmId?: string | null;
}

export interface LeadResponse {
  id: string;
  rank: number;
  name: string;
  category: string;
  rating: number | null;
  address: string;
  phone: string | null;
  website: string | null;
  hours: string | null;
  email: string | null;
  linkedin: string | null;
  instagram: string | null;
  contactPerson: string | null;
  designation: string | null;
  crmStatus: string;
  currentStep: number;
  enrichmentStatus: string;
  enrichmentSources?: { source: string; done: boolean }[];
  duplicateOf: { id: string; name: string; crmId: string } | null;
  searchSessionId: string;
  createdAt: string;
  updatedAt: string;
  /** When duplicate check was last performed. null = not yet checked */
  crmCheckedAt?: string | null;
  /** Duplicate/similar matches from last check. null when no matches */
  crmCheckMatches?: CrmCheckMatch[] | null;
  /** True when crmStatus is NEW or FOUND_SIMILAR (proceed to enrichment) */
  isNew?: boolean;
}

export interface SearchStatusResponse {
  id: string;
  title: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  leadCount: number;
  leads?: LeadResponse[];
  errorMessage?: string;
}

export interface SessionListItem {
  id: string;
  title: string;
  leadCount: number;
  createdAt: string;
  time: string;
}

export interface SessionStagesInfo {
  count: number;
  unlocked: boolean;
}

export interface SessionDetailResponse extends SessionListItem {
  mode: string;
  location: string | null;
  categories: string[];
  status: string;
  savedCount?: number;
  duplicateCount?: number;
  crmCheckCount?: number;
  enrichmentCount?: number;
  stages?: {
    create_list?: SessionStagesInfo;
    crm_check?: SessionStagesInfo;
    enrichment?: SessionStagesInfo;
    saved?: SessionStagesInfo;
    duplicate?: SessionStagesInfo;
  };
  userId: string | null;
  user?: { id: string; email: string; name: string };
  leads: LeadResponse[];
}

/** POST /api/v1/leads/:leadId/crm-check — Request body (all optional) */
export interface CrmCheckRequestBody {
  phone?: string;
  website?: string;
  email?: string;
  name?: string;
  address?: string;
  category?: string;
  contactPerson?: string;
}

/** Similar match item in CRM check response */
export interface CrmCheckSimilarMatch {
  id: string;
  source: "lead" | "duplicate_dummy";
  name: string;
  score: number;
  matchedFields: string[];
  reason: string;
}

/** POST /api/v1/leads/:leadId/crm-check — Response */
export interface CrmCheckResponse {
  leadId: string;
  crmStatus: "NEW" | "DUPLICATE";
  message: string;
  duplicateOf: {
    id: string;
    name: string;
    crmId: string | null;
  } | null;
  similarMatches?: CrmCheckSimilarMatch[];
  aiUsed?: boolean;
}

/** GET /api/v1/leads/:leadId/duplicate-check — Match item */
export interface DuplicateCheckMatch {
  id: string;
  source: "lead" | "duplicate_dummy";
  name: string;
  category: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  contactPerson: string | null;
  crmId?: string | null;
  score: number;
  matchedFields: string[];
  reason: string;
}

/** GET /api/v1/leads/:leadId/duplicate-check — Response (preview only, no status update) */
export interface DuplicateCheckResponse {
  direct: DuplicateCheckMatch | null;
  similar: DuplicateCheckMatch[];
  aiUsed: boolean;
}

/** DELETE /api/v1/leads/:leadId — Success response */
export interface RemoveLeadResponse {
  leadId: string;
  searchSessionId: string;
}

/** POST /api/v1/leads/remove — Request */
export interface RemoveLeadsRequest {
  leadIds: string[];
}

/** POST /api/v1/leads/move-to-collect-details — Response */
export interface MoveToCollectDetailsResponse {
  moved: number;
  skipped: number;
  failed: number;
  results: Array<
    | { leadId: string; status: "MOVED"; previousStep: number }
    | { leadId: string; status: "SKIPPED"; reason: string }
    | { leadId: string; status: "FAILED"; error: string }
  >;
}

export interface MoveToEnrichmentResponse {
  moved: number;
  skipped: number;
  failed: number;
  results: Array<
    | { leadId: string; status: "MOVED"; previousStep: number }
    | { leadId: string; status: "SKIPPED"; reason: string }
    | { leadId: string; status: "FAILED"; error: string }
  >;
}

/** POST /api/v1/leads/remove — Response */
export interface RemoveLeadsResponse {
  removed: number;
  failed: number;
  results: Array<
    | { leadId: string; searchSessionId: string; status: "REMOVED" }
    | { leadId: string; status: "FAILED"; error: string }
  >;
}

/** POST /api/v1/leads/bulk-crm-check — Request */
export interface BulkCrmCheckRequest {
  leadIds: string[];
}

/** POST /api/v1/leads/bulk-crm-check — Success item */
export interface BulkCrmCheckOkItem {
  status: "OK";
  leadId: string;
  crmStatus: "NEW" | "FOUND_SIMILAR" | "DUPLICATE";
  message: string;
  duplicateOf: { id: string; name: string; crmId: string | null } | null;
  similarMatches?: CrmCheckSimilarMatch[];
  aiUsed?: boolean;
}

/** POST /api/v1/leads/bulk-crm-check — Failure item */
export interface BulkCrmCheckFailedItem {
  status: "FAILED";
  leadId: string;
  error: string;
}

/** POST /api/v1/leads/bulk-crm-check — Response */
export interface BulkCrmCheckResponse {
  results: Array<BulkCrmCheckOkItem | BulkCrmCheckFailedItem>;
  total: number;
  ok: number;
  failed: number;
}

export interface LeadHistoryItem {
  id: string;
  leadId: string;
  action: string;
  step: number | null;
  fromStatus: string | null;
  toStatus: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface StatsResponse {
  totalLeads: number;
  savedThisWeek: number;
  enriched: number;
  pendingReview: number;
  change: {
    totalLeads: string;
    savedThisWeek: string;
    enriched: string;
    pendingReview: string;
  };
}

// ─── API ───

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<LoginResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
  },

  users: {
    create: (data: { email: string; password: string; name?: string; role?: "ADMIN" | "USER" }) =>
      request<UserResponse>("/api/v1/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    list: () => request<{ users: UserResponse[] }>("/api/v1/users"),
    delete: (userId: string) =>
      request<{ success: boolean; message: string }>(`/api/v1/users/${userId}`, {
        method: "DELETE",
      }),
    updateRole: (userId: string, role: "ADMIN" | "USER") =>
      request<UserResponse>(`/api/v1/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
  },

  places: {
    autocomplete: (q: string, limit = 5) =>
      request<{ suggestions: PlaceSuggestion[] }>(
        `/api/v1/places/autocomplete?q=${encodeURIComponent(q)}&limit=${limit}`
      ),
  },

  search: {
    start: (params: SearchParams) =>
      request<SearchStartResponse>("/api/v1/search", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    /** Apify Google Maps Scraper — raw results, no AI filter */
    apify: (params: { location: string; searchStrings?: string[]; maxLead?: number }) =>
      request<SearchStartResponse>("/api/v1/search/apify", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    status: (searchSessionId: string) =>
      request<SearchStatusResponse>(`/api/v1/search/${searchSessionId}/status`),
    /** Optional AI query enhancement for natural language search */
    enhanceQuery: (query: string) =>
      request<{ enhancedQuery: string }>("/api/v1/search/enhance-query", {
        method: "POST",
        body: JSON.stringify({ query }),
      }),
  },

  sessions: {
    list: (limit = 20, offset = 0) =>
      request<{ sessions: SessionListItem[]; total: number }>(
        `/api/v1/sessions?limit=${limit}&offset=${offset}`
      ),
    get: (sessionId: string, stage?: "crm_check" | "enrichment" | "collect_details" | "saved" | "duplicate") =>
      request<SessionDetailResponse>(
        `/api/v1/sessions/${sessionId}${stage ? `?stage=${stage}` : ""}`
      ),
    rename: (sessionId: string, title: string) =>
      request<SessionListItem>(`/api/v1/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
    delete: (sessionId: string) =>
      request<{ success: boolean; message: string }>(`/api/v1/sessions/${sessionId}`, {
        method: "DELETE",
      }),
  },

  leads: {
    list: (params?: { filter?: "all" | "enriched" | "pending"; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.filter) q.set("filter", params.filter);
      if (params?.limit) q.set("limit", String(params.limit));
      const query = q.toString();
      return request<{ leads: LeadResponse[] }>(
        `/api/v1/leads${query ? `?${query}` : ""}`
      );
    },
    get: (leadId: string) => request<LeadResponse>(`/api/v1/leads/${leadId}`),
    /** Remove a single lead (DELETE) */
    remove: (leadId: string) =>
      request<RemoveLeadResponse>(`/api/v1/leads/${leadId}`, { method: "DELETE" }),
    /** Remove multiple leads (bulk POST) */
    removeBulk: (leadIds: string[]) =>
      request<RemoveLeadsResponse>("/api/v1/leads/remove", {
        method: "POST",
        body: JSON.stringify({ leadIds }),
      }),
    moveToCrmCheck: (leadIds: string[]) =>
      request<MoveToEnrichmentResponse>("/api/v1/leads/move-to-crm-check", {
        method: "POST",
        body: JSON.stringify({ leadIds }),
      }),
    moveToEnrichment: (leadIds: string[]) =>
      request<MoveToEnrichmentResponse>("/api/v1/leads/move-to-enrichment", {
        method: "POST",
        body: JSON.stringify({ leadIds }),
      }),
    moveToCollectDetails: (leadIds: string[]) =>
      request<MoveToCollectDetailsResponse>("/api/v1/leads/move-to-collect-details", {
        method: "POST",
        body: JSON.stringify({ leadIds }),
      }),
    history: (leadId: string) =>
      request<LeadHistoryItem[]>(`/api/v1/leads/${leadId}/history`),
    /** CRM Check — duplicate detection with status update (POST) */
    crmCheck: (leadId: string, body?: CrmCheckRequestBody) =>
      request<CrmCheckResponse>(`/api/v1/leads/${leadId}/crm-check`, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    /** Duplicate Check — preview only, no status update (GET) */
    duplicateCheck: (leadId: string) =>
      request<DuplicateCheckResponse>(`/api/v1/leads/${leadId}/duplicate-check`),
    /** Bulk CRM Check — run duplicate check on multiple leads in one request */
    bulkCrmCheck: (leadIds: string[]) =>
      request<BulkCrmCheckResponse>("/api/v1/leads/bulk-crm-check", {
        method: "POST",
        body: JSON.stringify({ leadIds }),
      }),
    /** Confirm proceed — persist "proceed for enrichment" when user confirmed after GET preview */
    confirmProceed: (leadId: string) =>
      request<{ leadId: string; crmStatus: string }>(`/api/v1/leads/${leadId}/confirm-proceed`, {
        method: "POST",
      }),
    updateStatus: (leadId: string, crmStatus: string) =>
      request<{ leadId: string; crmStatus: string }>(`/api/v1/leads/${leadId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ crmStatus }),
      }),
    updateStep: (leadId: string, currentStep: number) =>
      request<LeadResponse>(`/api/v1/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ currentStep }),
      }),
    skip: (leadId: string) =>
      request<{ leadId: string; crmStatus: string }>(`/api/v1/leads/${leadId}/skip`, {
        method: "POST",
      }),
    enrichment: (
      leadId: string,
      data: {
        source: "WEBSITE" | "LINKEDIN" | "INSTAGRAM" | "GOOGLE_MAPS";
        done: boolean;
        data?: Record<string, string>;
      }
    ) =>
      request<LeadResponse>(`/api/v1/leads/${leadId}/enrichment`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    saveToCrm: (leadIds: string[]) =>
      request<{
        saved: number;
        failed: number;
        results: { leadId: string; crmId: string; status: string }[];
      }>("/api/v1/leads/save-to-crm", {
        method: "POST",
        body: JSON.stringify({ leadIds }),
      }),
    export: async (leadIds: string[], format: "csv" | "xlsx" = "csv") => {
      const blob = await request<Blob>("/api/v1/leads/export", {
        method: "POST",
        body: JSON.stringify({ leadIds, format }),
      });
      const disp = "attachment; filename=";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-export-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    },
  },

  stats: () => request<StatsResponse>("/api/v1/stats"),
};

// ─── Helpers ───

/** Convert API LeadResponse to frontend Lead shape */
export function toLead(lead: LeadResponse) {
  const crmCheckedAt = lead.crmCheckedAt ?? null;
  const checkedAt = crmCheckedAt ? (Date.parse(crmCheckedAt) || undefined) : undefined;
  const similarMatches = (lead.crmCheckMatches ?? []).map((m) => ({
    id: m.id,
    source: m.source as "lead" | "duplicate_dummy",
    name: m.name,
    score: m.score ?? 0,
    matchedFields: m.matchedFields ?? [],
    reason: m.reason ?? "",
  }));
  return {
    id: lead.id,
    rank: lead.rank,
    name: lead.name,
    category: lead.category,
    rating: lead.rating ?? 0,
    address: lead.address,
    phone: lead.phone ?? undefined,
    website: lead.website ?? undefined,
    hours: lead.hours ?? undefined,
    isNew: (!!lead.crmCheckedAt || lead.crmStatus === "SAVED") ? false : (lead.isNew ?? undefined),
    crmStatus: lead.crmStatus === "SAVED" ? "NEW" : lead.crmStatus,
    duplicateOf: lead.duplicateOf ?? undefined,
    email: lead.email ?? undefined,
    linkedin: lead.linkedin ?? undefined,
    instagram: lead.instagram ?? undefined,
    enrichmentStatus: lead.enrichmentStatus,
    enrichmentSources: lead.enrichmentSources,
    contactPerson: lead.contactPerson ?? undefined,
    crmCheckedAt: crmCheckedAt ?? undefined,
    checkedAt,
    similarMatches: similarMatches.length > 0 ? similarMatches : undefined,
    currentStep: lead.currentStep,
  };
}
