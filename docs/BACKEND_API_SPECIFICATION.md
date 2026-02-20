# Lead Compass — Backend API Specification

> Complete documentation for Node.js backend API with PostgreSQL and Prisma ORM

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Database Schema (Prisma)](#database-schema-prisma)
4. [Enums & Status Types](#enums--status-types)
5. [API Endpoints](#api-endpoints)
6. [User Management API](#user-management-api-admin-only)
7. [Request/Response Schemas](#requestresponse-schemas)
8. [7-Step Workflow Data Flow](#7-step-workflow-data-flow)
9. [Duplicate Check Logic](#duplicate-check-logic)
10. [History & Audit Trail](#history--audit-trail)
11. [Environment Variables](#environment-variables)

---

## Overview

The Lead Compass frontend is a lead generation portal for HK Exports (Jewellery Business). The backend must support:

- **Search**: Natural language or manual (location + categories + count)
- **Lead lifecycle**: From search → list creation → CRM duplicate check → enrichment → outreach
- **History**: Search sessions with timestamps and lead counts
- **Status tracking**: `new`, `pending`, `already_reached`, `duplicate`, `enriched`, etc.
- **Stats**: Total leads, saved this week, enriched, pending review

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Framework | Express.js or Fastify |
| ORM | Prisma |
| Database | PostgreSQL 15+ |
| Validation | Zod |
| Auth | JWT (optional for v1) |

---

## Database Schema (Prisma)

Create `prisma/schema.prisma`:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Users (optional for multi-tenant) ───
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  searchSessions SearchSession[]
}

// ─── Search Sessions (History) ───
model SearchSession {
  id        String   @id @default(cuid())
  title     String   // e.g. "Jewellery stores in Pune" or "Find jewelry shops in Dubai"
  mode      SearchMode
  query     String?  // natural language query (when mode = NATURAL)
  location  String?  // manual search location
  categories String[] // manual search categories
  leadCount Int      @default(0)
  status    SearchSessionStatus @default(PENDING)
  userId    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  leads  Lead[]

  @@index([userId, createdAt])
  @@index([status])
}

enum SearchMode {
  NATURAL
  MANUAL
}

enum SearchSessionStatus {
  PENDING    // search in progress
  COMPLETED  // leads fetched
  FAILED     // search failed
}

// ─── Leads ───
model Lead {
  id          String   @id @default(cuid())
  rank        Int      // display order in list
  name        String   // company/business name
  category    String   // Chain Store, Retailer, etc.
  rating      Float?   // Google Maps rating
  address     String
  phone       String?
  website     String?
  hours       String?  // opening hours
  email       String?  // enriched
  linkedin    String?  // enriched
  instagram   String?  // enriched
  contactPerson String?  // enriched
  designation  String?  // enriched

  // CRM & Status
  crmStatus       LeadCrmStatus   @default(NEW)
  duplicateOfId   String?         // if duplicate, reference original lead
  crmId           String?         // external CRM record ID
  crmSyncedAt     DateTime?

  // Workflow step tracking
  currentStep     Int             @default(3)  // 1-7
  enrichmentStatus LeadEnrichmentStatus @default(PENDING)

  searchSessionId String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  searchSession SearchSession @relation(fields: [searchSessionId], references: [id], onDelete: Cascade)
  duplicateOf   Lead?         @relation("LeadDuplicates", fields: [duplicateOfId], references: [id])
  duplicates   Lead[]        @relation("LeadDuplicates")
  history      LeadHistory[]
  enrichmentSources LeadEnrichmentSource[]

  @@unique([searchSessionId, rank])
  @@index([searchSessionId])
  @@index([crmStatus])
  @@index([phone, website])  // for duplicate detection
}

// CRM duplicate check status
enum LeadCrmStatus {
  NEW             // not in CRM, proceed to enrichment
  PENDING         // awaiting CRM check
  DUPLICATE       // exists in CRM, duplicate
  ALREADY_REACHED // contacted before
  TRANSFER_REQUIRED // in CRM but under different owner

  // After save
  SAVED           // saved to CRM
  SKIPPED         // user skipped
}

// Enrichment step (Step 6) status
enum LeadEnrichmentStatus {
  PENDING   // not started
  IN_PROGRESS
  WEBSITE_DONE
  LINKEDIN_DONE
  INSTAGRAM_DONE
  COMPLETE  // all sources collected
}

// ─── Lead History (Audit Trail) ───
model LeadHistory {
  id        String   @id @default(cuid())
  leadId    String
  action    LeadHistoryAction
  step      Int?     // workflow step when action occurred
  fromStatus String? // previous status
  toStatus   String? // new status
  metadata  Json?    // extra context
  createdAt DateTime @default(now())

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([leadId])
  @@index([createdAt])
}

enum LeadHistoryAction {
  CREATED
  CRM_CHECK_PENDING
  CRM_DUPLICATE_FOUND
  CRM_NEW_CONFIRMED
  CRM_ALREADY_REACHED
  ENRICHMENT_STARTED
  ENRICHMENT_UPDATED
  SAVED_TO_CRM
  SKIPPED
  EXPORTED
  STATUS_CHANGED
}

// ─── Enrichment Source Checklist (Step 6) ───
model LeadEnrichmentSource {
  id        String   @id @default(cuid())
  leadId    String
  source    EnrichmentSource  // WEBSITE, LINKEDIN, INSTAGRAM, GOOGLE_MAPS
  done      Boolean  @default(false)
  data      Json?    // scraped/enriched data
  doneAt    DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@unique([leadId, source])
  @@index([leadId])
}

enum EnrichmentSource {
  WEBSITE
  LINKEDIN
  INSTAGRAM
  GOOGLE_MAPS
}

// ─── Stats Cache (optional, for dashboard) ───
model StatsSnapshot {
  id        String   @id @default(cuid())
  totalLeads      Int
  savedThisWeek   Int
  enriched        Int
  pendingReview   Int
  snapshotAt      DateTime @default(now())
}
```

---

## Enums & Status Types

### Lead CRM Status (Duplicate Check - Step 4)

| Status | Description |
|--------|-------------|
| `NEW` | Not in CRM, proceed to enrichment |
| `PENDING` | Awaiting CRM duplicate check |
| `DUPLICATE` | Exists in CRM, duplicate of another lead |
| `ALREADY_REACHED` | Contacted before, skip |
| `TRANSFER_REQUIRED` | In CRM under different owner, request transfer |
| `SAVED` | Successfully saved to CRM |
| `SKIPPED` | User chose to skip |

### Lead Enrichment Status (Step 6)

| Status | Description |
|--------|-------------|
| `PENDING` | Not started |
| `IN_PROGRESS` | Enrichment in progress |
| `WEBSITE_DONE` | Website data collected |
| `LINKEDIN_DONE` | LinkedIn data collected |
| `INSTAGRAM_DONE` | Instagram data collected |
| `COMPLETE` | All sources done |

### Search Session Status

| Status | Description |
|--------|-------------|
| `PENDING` | Search in progress |
| `COMPLETED` | Leads fetched successfully |
| `FAILED` | Search failed |

---

## API Endpoints

### Base URL

```
/api/v1
```

### 1. Search — Find Leads

**POST** `/search`

Initiates a lead search (natural language or manual). Returns a `searchSessionId` and triggers async lead fetching.

**Request Body:**

```json
// Natural language
{
  "mode": "natural",
  "query": "Find jewelry shops in Dubai",
  "count": 20
}

// Manual
{
  "mode": "manual",
  "location": "Pune, India",
  "categories": ["Chain Store", "Retailer"],
  "count": 10
}
```

**Response (202 Accepted):**

```json
{
  "searchSessionId": "clx...",
  "status": "PENDING",
  "message": "Search started. Poll /search/:id/status for results."
}
```

**Error responses:**

- **400 Invalid query:** `{ "valid": false, "error": "Invalid or empty query" }`
- **400 Schema validation:** `{ "valid": false, "error": "Invalid request", "details": { "query": ["Required"], "count": ["Must be between 10 and 100"] } }`

---

### 2. Optional: AI Query Enhancement (Natural Language)

**POST** `/search/enhance-query`

Enhances a natural language search query for better results.

**Request Body:**

```json
{
  "query": "jewelry shops dubai"
}
```

**Response (200):**

```json
{
  "enhancedQuery": "Find jewellery shops and gold retailers in Dubai, UAE"
}
```

---

### 3. Search Status — Poll for Results

**GET** `/search/:searchSessionId/status`

Poll until `status === "COMPLETED"` or `FAILED`.

**Response:**

```json
{
  "id": "clx...",
  "title": "Jewellery stores in Pune",
  "status": "COMPLETED",
  "leadCount": 10,
  "leads": [ /* Lead[] when COMPLETED */ ]
}
```

---

### 3. List Search Sessions (History)

**GET** `/sessions`

**Query params:** `?limit=20&offset=0`

**Response:**

```json
{
  "sessions": [
    {
      "id": "clx...",
      "title": "Jewellery stores in Pune",
      "time": "13 min ago",
      "leadCount": 10,
      "createdAt": "2025-02-18T12:00:00Z"
    }
  ],
  "total": 42
}
```

---

### 4. Get Session with Leads

**GET** `/sessions/:sessionId`

**Response:**

```json
{
  "id": "clx...",
  "title": "Jewellery stores in Pune",
  "mode": "manual",
  "location": "Pune, India",
  "categories": ["Chain Store", "Retailer"],
  "leadCount": 10,
  "status": "COMPLETED",
  "createdAt": "2025-02-18T12:00:00Z",
  "leads": [
    {
      "id": "clx...",
      "rank": 1,
      "name": "Joyalukkas Jewellery - Pune",
      "category": "Chain Store",
      "rating": 4.7,
      "address": "1258, A/2, Jangali Maharaj Rd...",
      "phone": "+91 20 2553 7979",
      "website": "www.joyalukkas.in",
      "hours": "Closed · Opens 10:30 AM",
      "crmStatus": "NEW",
      "isNew": true
    }
  ]
}
```

---

### 5. Get Single Lead (Detail Panel)

**GET** `/leads/:leadId`

**Response:**

```json
{
  "id": "clx...",
  "rank": 1,
  "name": "Joyalukkas Jewellery - Pune",
  "category": "Chain Store",
  "rating": 4.7,
  "address": "1258, A/2, Jangali Maharaj Rd, Deccan Gymkhana, Pune 411004",
  "phone": "+91 20 2553 7979",
  "website": "www.joyalukkas.in",
  "hours": "Closed · Opens 10:30 AM",
  "email": null,
  "linkedin": null,
  "instagram": null,
  "contactPerson": null,
  "designation": null,
  "crmStatus": "NEW",
  "currentStep": 4,
  "enrichmentStatus": "PENDING",
  "enrichmentSources": [
    { "source": "GOOGLE_MAPS", "done": true },
    { "source": "WEBSITE", "done": false },
    { "source": "LINKEDIN", "done": false },
    { "source": "INSTAGRAM", "done": false }
  ]
}
```

---

### 6. CRM Duplicate Check (Step 4)

**POST** `/leads/:leadId/crm-check`

Check if lead exists in CRM (by phone, website, or name+address).

**Request Body (optional):**

```json
{
  "phone": "+91 20 2553 7979",
  "website": "www.joyalukkas.in"
}
```

**Response:**

```json
{
  "leadId": "clx...",
  "crmStatus": "NEW",
  "message": "Not in CRM — proceed to enrichment",
  "duplicateOf": null
}
```

Or if duplicate:

```json
{
  "leadId": "clx...",
  "crmStatus": "DUPLICATE",
  "message": "Lead exists in CRM",
  "duplicateOf": {
    "id": "clx...",
    "name": "Joyalukkas Jewellery",
    "crmId": "crm-123"
  }
}
```

---

### 7. Update Lead Status

**PATCH** `/leads/:leadId/status`

**Request Body:**

```json
{
  "crmStatus": "ALREADY_REACHED"
}
```

---

### 8. Save Leads to CRM

**POST** `/leads/save-to-crm`

**Request Body:**

```json
{
  "leadIds": ["clx...", "clx..."]
}
```

**Response:**

```json
{
  "saved": 2,
  "failed": 0,
  "results": [
    { "leadId": "clx...", "crmId": "crm-456", "status": "SAVED" },
    { "leadId": "clx...", "crmId": "crm-457", "status": "SAVED" }
  ]
}
```

---

### 9. Skip Lead

**POST** `/leads/:leadId/skip`

**Response:**

```json
{
  "leadId": "clx...",
  "crmStatus": "SKIPPED"
}
```

---

### 10. Update Enrichment (Step 6)

**PATCH** `/leads/:leadId/enrichment`

**Request Body:**

```json
{
  "source": "WEBSITE",
  "done": true,
  "data": {
    "email": "contact@joyalukkas.in",
    "contactPerson": "John Doe"
  }
}
```

---

### 11. Export Leads

**POST** `/leads/export`

**Request Body:**

```json
{
  "leadIds": ["clx...", "clx..."],
  "format": "csv"
}
```

**Response:** File download (CSV/Excel) or presigned URL.

---

### 12. Dashboard Stats

**GET** `/stats`

**Response:**

```json
{
  "totalLeads": 1248,
  "savedThisWeek": 86,
  "enriched": 934,
  "pendingReview": 314,
  "change": {
    "totalLeads": "+12.5%",
    "savedThisWeek": "+8.2%",
    "enriched": "+5.1%",
    "pendingReview": "-2.3%"
  }
}
```

---

## User Management API (Admin Only)

All user management endpoints require **Admin** role. Returns `403 Forbidden` for non-admin users.

**Auth:** Required — `Authorization: Bearer <jwt_token>` with `role: ADMIN`

---

### 13. List Users (Fetch)

**GET** `/users`

Returns all users in the system. **Admin only.**

**Request Body:** None

**Success Response (200):**

```json
{
  "users": [
    {
      "id": "clx...",
      "email": "admin@gmail.com",
      "name": "Manager",
      "role": "ADMIN",
      "createdAt": "2025-02-18T12:00:00.000Z"
    },
    {
      "id": "clx...",
      "email": "user@example.com",
      "name": "Sales Rep",
      "role": "USER",
      "createdAt": "2025-02-18T14:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401` — Missing or invalid token
```json
{ "error": "Unauthorized" }
```
- `403` — Admin role required
```json
{ "error": "Admin required" }
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/users" \
  -H "Authorization: Bearer <token>"
```

---

### 14. Create User

**POST** `/users`

Create a new user. **Admin only.**

**Request Body:**

```json
{
  "email": "string (required)",
  "password": "string (required, min 6 chars)",
  "name": "string (optional)",
  "role": "ADMIN | USER (optional, default: USER)"
}
```

**Success Response (201):**

```json
{
  "id": "clx...",
  "email": "manager@example.com",
  "name": "Test Manager",
  "role": "USER",
  "createdAt": "2025-02-18T12:00:00.000Z"
}
```

**Error Responses:**
- `400` — Invalid request
```json
{ "error": "Invalid request", "details": { ... } }
```
- `401` — Unauthorized
```json
{ "error": "Unauthorized" }
```
- `403` — Admin required
```json
{ "error": "Admin required" }
```
- `409` — Email already exists
```json
{ "error": "Email already exists" }
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/v1/users" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123","name":"John","role":"USER"}'
```

---

### 15. Update User (Edit)

**PATCH** `/users/:userId`

Update a user (e.g. change role or name). **Admin only.**

**Path Params:** `userId` — User ID to update

**Request Body:**

```json
{
  "name": "string (optional)",
  "role": "ADMIN | USER (optional)"
}
```

**Success Response (200):**

```json
{
  "id": "clx...",
  "email": "user@example.com",
  "name": "Updated Name",
  "role": "ADMIN",
  "createdAt": "2025-02-18T12:00:00.000Z"
}
```

**Error Responses:**
- `400` — Invalid request
```json
{ "error": "Invalid request", "details": { ... } }
```
- `401` — Unauthorized
```json
{ "error": "Unauthorized" }
```
- `403` — Admin required
```json
{ "error": "Admin required" }
```
- `404` — User not found
```json
{ "error": "User not found" }
```

**Example:**
```bash
curl -X PATCH "http://localhost:3000/api/v1/users/clx..." \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role":"ADMIN"}'
```

---

### 16. Delete User

**DELETE** `/users/:userId`

Permanently delete a user. **Admin only.** Prevents deleting the current user (self).

**Path Params:** `userId` — User ID to delete

**Request Body:** None

**Success Response (200):**

```json
{
  "success": true,
  "message": "User deleted"
}
```

**Error Responses:**
- `401` — Unauthorized
```json
{ "error": "Unauthorized" }
```
- `403` — Admin required, or attempting to delete yourself
```json
{ "error": "Admin required" }
```
```json
{ "error": "Cannot delete your own account" }
```
- `404` — User not found
```json
{ "error": "User not found" }
```

**Example:**
```bash
curl -X DELETE "http://localhost:3000/api/v1/users/clx..." \
  -H "Authorization: Bearer <token>"
```

---

### User Management Enums

| Field | Values |
|-------|--------|
| `role` | `ADMIN` — Can manage users; `USER` — Can manage leads only |

---

## Request/Response Schemas

### SearchParams (Zod)

```typescript
const NaturalSearchSchema = z.object({
  mode: z.literal("natural"),
  query: z.string().min(1),
  count: z.number().min(1).max(100),
});

const ManualSearchSchema = z.object({
  mode: z.literal("manual"),
  location: z.string().min(1),
  categories: z.array(z.string()).min(1),
  count: z.number().min(1).max(100),
});

const SearchParamsSchema = z.discriminatedUnion("mode", [
  NaturalSearchSchema,
  ManualSearchSchema,
]);
```

### Lead (API response)

```typescript
interface LeadResponse {
  id: string;
  rank: number;
  name: string;
  category: string;
  rating?: number;
  address: string;
  phone?: string;
  website?: string;
  hours?: string;
  email?: string;
  linkedin?: string;
  instagram?: string;
  contactPerson?: string;
  designation?: string;
  crmStatus: LeadCrmStatus;
  isNew: boolean;  // derived: crmStatus === "NEW"
  currentStep: number;
  enrichmentStatus: LeadEnrichmentStatus;
  enrichmentSources?: { source: string; done: boolean }[];
}
```

---

## 7-Step Workflow Data Flow

| Step | Name | DB Tables | API |
|------|------|-----------|-----|
| 1 | Define Lead Type | — | Part of search params (categories) |
| 2 | Search Maps | SearchSession, Lead | POST /search |
| 3 | Create List | Lead | GET /sessions/:id (leads) |
| 4 | CRM Check | Lead.crmStatus, LeadHistory | POST /leads/:id/crm-check |
| 5 | Enrichment Prep | Lead.currentStep | PATCH /leads/:id |
| 6 | Collect Details | LeadEnrichmentSource | PATCH /leads/:id/enrichment |
| 7 | Finalize Outreach | Lead.crmStatus = SAVED | POST /leads/save-to-crm |

---

## Duplicate Check Logic

1. **Input**: `phone`, `website`, or `name` + `address`
2. **Lookup**: Query existing leads/CRM by normalized phone, domain, or fuzzy name+address
3. **Result**:
   - No match → `NEW`
   - Match with same owner → `DUPLICATE`, set `duplicateOfId`
   - Match with different owner → `TRANSFER_REQUIRED`
   - Match with "contacted" flag → `ALREADY_REACHED`

```sql
-- Example: find duplicate by phone
SELECT * FROM "Lead"
WHERE normalized_phone = normalize_phone($1)
  AND "crmStatus" IN ('SAVED', 'DUPLICATE', 'ALREADY_REACHED');
```

---

## History & Audit Trail

Every status change is logged in `LeadHistory`:

```typescript
await prisma.leadHistory.create({
  data: {
    leadId,
    action: "CRM_DUPLICATE_FOUND",
    step: 4,
    fromStatus: "PENDING",
    toStatus: "DUPLICATE",
    metadata: { duplicateOfId: "clx..." },
  },
});
```

**GET** `/leads/:leadId/history` — returns audit log for a lead.

---

## Environment Variables

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/lead_compass"
NODE_ENV=development
PORT=3000

# Optional: Google Maps / Places API for lead fetching
GOOGLE_MAPS_API_KEY=...

# Optional: CRM integration (e.g. Salesforce, HubSpot)
CRM_API_URL=...
CRM_API_KEY=...
```

---

## Project Structure (Backend)

```
backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── search.ts
│   │   ├── sessions.ts
│   │   ├── leads.ts
│   │   └── stats.ts
│   ├── services/
│   │   ├── searchService.ts
│   │   ├── leadService.ts
│   │   ├── crmCheckService.ts
│   │   └── enrichmentService.ts
│   ├── lib/
│   │   ├── prisma.ts
│   │   └── validation.ts
│   └── middleware/
│       └── auth.ts
├── package.json
└── tsconfig.json
```

---

## Quick Start (Backend)

```bash
mkdir backend && cd backend
npm init -y
npm i express prisma @prisma/client zod
npm i -D typescript @types/node tsx

npx prisma init
# Paste schema from above into prisma/schema.prisma
npx prisma migrate dev --name init
npx prisma generate
```

---

*Generated from Lead Compass frontend analysis. Last updated: Feb 2025.*
