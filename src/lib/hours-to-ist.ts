/**
 * Utility to convert business hours to IST when the lead is outside India.
 * Parses free-text hours (e.g. "Closed · Opens 10 AM", "9:00 AM – 6:00 PM")
 * and appends IST equivalents for non-India addresses.
 */

const INDIA_INDICATORS =
  /\bindia\b|mumbai|delhi|pune|bangalore|bengaluru|chennai|kolkata|hyderabad|ahmedabad|surat|jaipur|lucknow|kochi|indore|nagpur|bhopal|maharashtra|gujarat|karnataka|tamil nadu|telangana/i;

/** Address patterns -> IANA timezone (checked in order of specificity) */
const ADDRESS_TO_TZ: { pattern: RegExp; tz: string }[] = [
  { pattern: /dubai|abu dhabi|sharjah|ajman|uae|united arab emirates/i, tz: "Asia/Dubai" },
  { pattern: /new york|new york city|nyc|manhattan/i, tz: "America/New_York" },
  { pattern: /los angeles|la\s|california/i, tz: "America/Los_Angeles" },
  { pattern: /chicago|illinois/i, tz: "America/Chicago" },
  { pattern: /london|uk|united kingdom|england/i, tz: "Europe/London" },
  { pattern: /paris|france/i, tz: "Europe/Paris" },
  { pattern: /berlin|germany/i, tz: "Europe/Berlin" },
  { pattern: /singapore/i, tz: "Asia/Singapore" },
  { pattern: /hong kong|hongkong/i, tz: "Asia/Hong_Kong" },
  { pattern: /tokyo|japan/i, tz: "Asia/Tokyo" },
  { pattern: /sydney|australia/i, tz: "Australia/Sydney" },
  { pattern: /toronto|canada/i, tz: "America/Toronto" },
  { pattern: /usa|united states|u\.s\./i, tz: "America/New_York" },
  { pattern: /saudi|riyadh|jeddah|ksa/i, tz: "Asia/Riyadh" },
  { pattern: /doha|qatar/i, tz: "Asia/Qatar" },
  { pattern: /kuwait/i, tz: "Asia/Kuwait" },
  { pattern: /bahrain/i, tz: "Asia/Bahrain" },
  { pattern: /oman/i, tz: "Asia/Muscat" },
];

function inferTimezone(address: string): string | null {
  if (!address || INDIA_INDICATORS.test(address)) return null;
  for (const { pattern, tz } of ADDRESS_TO_TZ) {
    if (pattern.test(address)) return tz;
  }
  return null;
}

function getTimezoneOffsetHours(tz: string, date: Date = new Date()): number {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const tzMinutes = hour * 60 + minute;
  let offsetHours = (tzMinutes - utcMinutes) / 60;
  if (offsetHours > 12) offsetHours -= 24;
  if (offsetHours < -12) offsetHours += 24;
  return offsetHours;
}

function getTodayInTimezone(tz: string): { year: number; month: number; day: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === "year")?.value ?? "0", 10);
  const month = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10);
  const day = parseInt(parts.find((p) => p.type === "day")?.value ?? "1", 10);
  return { year, month, day };
}

/** Parse "10 AM", "9:00 AM", "6:00 PM" etc. Returns { hour, minute } or null */
function parseTime(match: string): { hour: number; minute: number } | null {
  const m = match.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2] ?? "0", 10);
  const isPm = /pm/i.test(m[3] ?? "");
  if (isPm && hour !== 12) hour += 12;
  if (!isPm && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Convert a time in source TZ to IST and format as "1:30 PM" */
function toISTFormatted(
  hour: number,
  minute: number,
  sourceTz: string
): string {
  const { year, month, day } = getTodayInTimezone(sourceTz);
  const offsetHours = getTimezoneOffsetHours(sourceTz, new Date());
  const utcHour = hour - offsetHours;
  const utcDate = new Date(Date.UTC(year, month - 1, day, utcHour, minute, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(utcDate);
}

/** Find all time-like patterns in the hours string */
const TIME_PATTERN = /\d{1,2}(?::\d{2})?\s*(?:am|pm)/gi;

/**
 * Convert hours string to include IST times when address is outside India.
 * e.g. "Closed · Opens 10 AM" + Dubai -> "Closed · Opens 10 AM (IST: 11:30 AM)"
 */
export function formatHoursWithIST(hours: string, address: string): string {
  if (!hours?.trim()) return hours;
  const tz = inferTimezone(address ?? "");
  if (!tz) return hours;

  const istParts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(TIME_PATTERN.source, "gi");
  while ((match = regex.exec(hours)) !== null) {
    const parsed = parseTime(match[0]);
    if (parsed) {
      const istTime = toISTFormatted(parsed.hour, parsed.minute, tz);
      istParts.push(`${match[0]} (IST: ${istTime})`);
    }
  }

  if (istParts.length === 0) return hours;

  let result = hours;
  const matches = hours.matchAll(new RegExp(TIME_PATTERN.source, "gi"));
  const allMatches = [...matches];
  if (allMatches.length !== istParts.length) return hours;

  for (let i = allMatches.length - 1; i >= 0; i--) {
    const m = allMatches[i];
    if (!m) continue;
    const replacement = istParts[i];
    if (replacement) {
      result = result.slice(0, m.index) + replacement + result.slice(m.index! + m[0].length);
    }
  }
  return result;
}


/**
 * formatHours utility
 * -------------------
 * Handles TWO formats that can appear in lead.hours:
 *
 * Format A — Raw Google Maps snippet (unenriched lead, Apify not run yet):
 *   "· Closes 4:30 pm"   → "Closes 4:30 PM"
 *   "· Opens 9 am"       → "Opens 9:00 AM"
 *   "· Open 24 hours"    → "Open 24 hours"
 *   "· Closed"           → "Closed today"
 *
 * Format B — Full IST enriched string (after Apify enrichment):
 *   "Mon: 10:00 am - 7:30 pm IST; Tue: 10:00 am - 7:30 pm IST; ..."
 *   → "Mon–Sat: 10:00 am - 7:30 pm IST; Sun: Closed"   (grouped)
 */

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─────────────────────────────────────────────
// FORMAT A — Raw Google Maps snippet handling
// ─────────────────────────────────────────────

/** Format h, m, ampm into "4:30 PM" */
function formatTimeToken(h: string, m: string, ampm: string): string {
  const min = m.padStart(2, "0");
  return `${h}:${min} ${ampm.toUpperCase()}`;
}

/**
 * Detects raw Google Maps hour snippets and formats them cleanly.
 * Returns null if the string is NOT a raw snippet (i.e. already fully formatted).
 *
 * Examples:
 *   "· Closes 4:30 pm"  → "Closes 4:30 PM"
 *   "· Open 24 hours"   → "Open 24 hours"
 *   "· Closed"          → "Closed today"
 *   "Mon: 10:00 am IST" → null  (not a raw snippet, let Format B handle it)
 */
function formatRawGoogleHours(hours: string): string | null {
  // Strip leading bullet/dot characters Google Maps adds
  const cleaned = hours.replace(/^[\s·•\-–]+/, "").trim();

  // Already fully formatted — contains proper "Mon:", "Tue:" etc day prefixes
  const hasProperDay = DAY_ORDER.some((d) =>
    cleaned.toLowerCase().startsWith(d.toLowerCase() + ":")
  );
  if (hasProperDay) return null;

  // "Closed" or "Closed today"
  if (/^closed$/i.test(cleaned)) return "Closed today";

  // "Open 24 hours"
  if (/open\s+24\s+hours/i.test(cleaned)) return "Open 24 hours";

  // "Open now"
  if (/^open\s+now$/i.test(cleaned)) return "Open now";

  // "Closes soon"
  if (/^closes\s+soon$/i.test(cleaned)) return "Closes soon";

  // "Closes 4:30 pm" or "Closes 4 pm"
  const closesMatch = cleaned.match(/closes?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (closesMatch) {
    const time = formatTimeToken(closesMatch[1], closesMatch[2] ?? "00", closesMatch[3]);
    return `Closes ${time}`;
  }

  // "Opens 9:00 am" or "Opens at 9 am"
  const opensMatch = cleaned.match(/opens?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (opensMatch) {
    const time = formatTimeToken(opensMatch[1], opensMatch[2] ?? "00", opensMatch[3]);
    return `Opens ${time}`;
  }

  // Unknown raw format — return cleaned (at least strip the bullet)
  return cleaned || null;
}

// ─────────────────────────────────────────────
// FORMAT B — Full IST enriched string grouping
// ─────────────────────────────────────────────

interface DayEntry {
  day: string;   // "Mon", "Tue", etc.
  hours: string; // "10:00 am - 7:30 pm IST" or "Closed"
}

/**
 * Parse "Mon: 10:00 am - 7:30 pm IST; Tue: ..." into [{ day, hours }].
 * Skips any segment whose prefix is not a valid 3-letter day abbrev.
 */
function parseHoursString(hours: string): DayEntry[] {
  return hours
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((segment) => {
      const colonIdx = segment.indexOf(":");
      if (colonIdx === -1) return null;
      const rawDay = segment.slice(0, colonIdx).trim();
      const hoursVal = segment.slice(colonIdx + 1).trim();
      const dayPrefix = rawDay.slice(0, 3).toLowerCase();
      // Only accept valid day abbreviations — rejects "Closes:", "Open:", etc.
      if (!DAY_ORDER.map((d) => d.toLowerCase()).includes(dayPrefix)) return null;
      return { day: rawDay.slice(0, 3), hours: hoursVal };
    })
    .filter((e): e is DayEntry => e !== null);
}

/**
 * Group consecutive days that share the same hours into ranges.
 *   [Mon 10-7, Tue 10-7, Wed 10-7] → "Mon–Wed: 10:00 am - 7:30 pm IST"
 */
function groupConsecutiveDays(entries: DayEntry[]): { label: string; hours: string }[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
  );

  const groups: { start: string; end: string; hours: string }[] = [];
  let current = { start: sorted[0].day, end: sorted[0].day, hours: sorted[0].hours };

  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i];
    const prevIdx = DAY_ORDER.indexOf(current.end);
    const currIdx = DAY_ORDER.indexOf(entry.day);

    if (entry.hours === current.hours && currIdx === prevIdx + 1) {
      current.end = entry.day;
    } else {
      groups.push({ ...current });
      current = { start: entry.day, end: entry.day, hours: entry.hours };
    }
  }
  groups.push({ ...current });

  return groups.map((g) => ({
    label: g.start === g.end ? g.start : `${g.start}–${g.end}`,
    hours: g.hours,
  }));
}

// ─────────────────────────────────────────────
// MAIN EXPORTS
// ─────────────────────────────────────────────

/**
 * Primary function — use this in your <ContactField> for hours.
 *
 * Automatically detects which format the string is in and handles it:
 *   - Raw Google Maps snippet → cleaned human-readable string
 *   - Full IST enriched string → grouped by day ranges
 *
 * @param hours    lead.hours from DB (either format)
 * @param address  kept for API compatibility with formatHoursWithIST
 */
export function formatHoursWithISTGrouped(hours: string, address: string): string {
  if (!hours?.trim()) return "—";

  // Try Format A first — raw Google Maps snippet
  const raw = formatRawGoogleHours(hours);
  if (raw !== null) return raw;

  // Format B — full enriched "Mon: ... IST" string → group consecutive days
  const entries = parseHoursString(hours);
  if (entries.length === 0) return hours.replace(/^[\s·•\-–]+/, "").trim();

  const groups = groupConsecutiveDays(entries);
  return groups.map((g) => `${g.label}: ${g.hours}`).join("; ");
}

/**
 * Standalone grouping only (no raw snippet detection).
 * Use when you know the string is already in full IST format.
 */
export function formatHoursGrouped(hours: string): string {
  if (!hours?.trim()) return hours;
  const entries = parseHoursString(hours);
  if (entries.length === 0) return hours;
  const groups = groupConsecutiveDays(entries);
  return groups.map((g) => `${g.label}: ${g.hours}`).join("; ");
}