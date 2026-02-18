/**
 * Lead Compass API Client
 * Base URL: VITE_API_URL or http://localhost:3000
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

const TOKEN_KEY = "lead-compass-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export interface ApiError {
  error: string;
  details?: Record<string, unknown>;
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

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as ApiError).error || "Request failed");
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
  count?: number;
}

export interface SearchParamsManual {
  mode: "manual";
  location: string;
  categories: string[];
  count?: number;
}

export type SearchParams = SearchParamsNatural | SearchParamsManual;

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
}

export interface SearchStatusResponse {
  id: string;
  title: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  leadCount: number;
  leads?: LeadResponse[];
}

export interface SessionListItem {
  id: string;
  title: string;
  leadCount: number;
  createdAt: string;
  time: string;
}

export interface SessionDetailResponse extends SessionListItem {
  mode: string;
  location: string | null;
  categories: string[];
  status: string;
  savedCount?: number;
  duplicateCount?: number;
  userId: string | null;
  user?: { id: string; email: string; name: string };
  leads: LeadResponse[];
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
    status: (searchSessionId: string) =>
      request<SearchStatusResponse>(`/api/v1/search/${searchSessionId}/status`),
  },

  sessions: {
    list: (limit = 20, offset = 0) =>
      request<{ sessions: SessionListItem[]; total: number }>(
        `/api/v1/sessions?limit=${limit}&offset=${offset}`
      ),
    get: (sessionId: string) =>
      request<SessionDetailResponse>(`/api/v1/sessions/${sessionId}`),
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
    history: (leadId: string) =>
      request<LeadHistoryItem[]>(`/api/v1/leads/${leadId}/history`),
    crmCheck: (leadId: string, body?: { phone?: string; website?: string }) =>
      request<{ leadId: string; crmStatus: string; message: string; duplicateOf: unknown }>(
        `/api/v1/leads/${leadId}/crm-check`,
        { method: "POST", body: JSON.stringify(body ?? {}) }
      ),
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
    isNew: lead.crmStatus === "NEW",
    crmStatus: lead.crmStatus,
    duplicateOf: lead.duplicateOf ?? undefined,
    email: lead.email ?? undefined,
    linkedin: lead.linkedin ?? undefined,
    instagram: lead.instagram ?? undefined,
    enrichmentStatus: lead.enrichmentStatus,
  };
}
