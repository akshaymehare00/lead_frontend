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

/**
 * formatHours utility
 * -------------------
 * Handles TWO formats that can appear in lead.hours:
 *
 * Format A — Raw Google Maps snippet (unenriched lead):
 *   "· Closes 4:30 pm"   → "Closes 4:30 PM"
 *
 * Format B — Full IST enriched string (after Apify enrichment):
 *   "Mon: 10:00 am - 7:30 pm IST; Tue: ..."
 *   → grouped + optionally converted to any timezone
 */

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─────────────────────────────────────────────
// TIMEZONE DEFINITIONS
// Add more as needed
// ─────────────────────────────────────────────
export interface TimezoneOption {
  label: string;       // shown in UI dropdown
  iana: string;        // IANA timezone string
  abbrev: string;      // short label shown after time
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { label: "IST — India",              iana: "Asia/Kolkata",        abbrev: "IST"  },
  { label: "UTC — Universal",          iana: "UTC",                 abbrev: "UTC"  },
  { label: "EST — New York (US East)", iana: "America/New_York",    abbrev: "EST"  },
  { label: "PST — Los Angeles (US West)", iana: "America/Los_Angeles", abbrev: "PST" },
  { label: "CST — Chicago",            iana: "America/Chicago",     abbrev: "CST"  },
  { label: "GMT — London",             iana: "Europe/London",       abbrev: "GMT"  },
  { label: "CET — Paris / Dubai",      iana: "Europe/Paris",        abbrev: "CET"  },
  { label: "GST — Dubai",              iana: "Asia/Dubai",          abbrev: "GST"  },
  { label: "SGT — Singapore",          iana: "Asia/Singapore",      abbrev: "SGT"  },
  { label: "HKT — Hong Kong",          iana: "Asia/Hong_Kong",      abbrev: "HKT"  },
  { label: "JST — Tokyo",              iana: "Asia/Tokyo",          abbrev: "JST"  },
  { label: "AEST — Sydney",            iana: "Australia/Sydney",    abbrev: "AEST" },
];

const IST_IANA = "Asia/Kolkata";

// ─────────────────────────────────────────────
// FORMAT A — Raw Google Maps snippet handling
// ─────────────────────────────────────────────

function formatTimeToken(h: string, m: string, ampm: string): string {
  return `${h}:${m.padStart(2, "0")} ${ampm.toUpperCase()}`;
}

function formatRawGoogleHours(hours: string): string | null {
  const cleaned = hours.replace(/^[\s·•\-–]+/, "").trim();
  const hasProperDay = DAY_ORDER.some((d) =>
    cleaned.toLowerCase().startsWith(d.toLowerCase() + ":")
  );
  if (hasProperDay) return null;
  if (/^closed$/i.test(cleaned)) return "Closed today";
  if (/open\s+24\s+hours/i.test(cleaned)) return "Open 24 hours";
  if (/^open\s+now$/i.test(cleaned)) return "Open now";
  if (/^closes\s+soon$/i.test(cleaned)) return "Closes soon";
  const closesMatch = cleaned.match(/closes?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (closesMatch) return `Closes ${formatTimeToken(closesMatch[1], closesMatch[2] ?? "00", closesMatch[3])}`;
  const opensMatch = cleaned.match(/opens?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (opensMatch) return `Opens ${formatTimeToken(opensMatch[1], opensMatch[2] ?? "00", opensMatch[3])}`;
  return cleaned || null;
}

// ─────────────────────────────────────────────
// FORMAT B — IST time conversion
// ─────────────────────────────────────────────

interface DayEntry {
  day: string;
  hours: string;
}

/**
 * Parse a single time string like "10:00 am" or "7:30 PM" into { hour, minute }.
 * Returns null if unparseable.
 */
function parseTimeStr(t: string): { hour: number; minute: number } | null {
  const m = t.trim().match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const ampm = m[3].toLowerCase();
  if (ampm === "pm" && hour !== 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

/**
 * Convert a single IST time "10:00 am" → target timezone formatted string.
 * Uses the browser's built-in Intl API — no external library needed.
 */
function convertISTTime(timeStr: string, targetIana: string, targetAbbrev: string): string {
  if (timeStr.toLowerCase() === "closed") return "Closed";

  const parsed = parseTimeStr(timeStr);
  if (!parsed) return timeStr;

  // Build a Date in IST using a fixed reference date (today's date doesn't matter for time conversion)
  const refDate = new Date();
  refDate.setFullYear(2024, 0, 1); // Jan 1 2024 — stable reference

  // Format as IST time string, then parse back
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_IANA,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });

  // Create a UTC date that represents the given IST time
  const istOffset = getTimezoneOffsetMinutes(IST_IANA); // +330 for IST
  const utcMs = Date.UTC(2024, 0, 1, parsed.hour, parsed.minute, 0) - istOffset * 60000;
  const utcDate = new Date(utcMs);

  // Format in target timezone
  const targetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: targetIana,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const converted = targetFormatter.format(utcDate);
  return `${converted} ${targetAbbrev}`;
}

/**
 * Get timezone offset in minutes from UTC for a given IANA timezone.
 * e.g. Asia/Kolkata → 330 (UTC+5:30)
 */
function getTimezoneOffsetMinutes(iana: string): number {
  const ref = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: iana,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(ref);

  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  const localHour = get("hour") === 24 ? 0 : get("hour");
  const localMin = get("minute");
  const localDay = get("day");

  // Minutes from midnight in local time
  const localMinutes = localDay === 1
    ? localHour * 60 + localMin
    : localHour * 60 + localMin + (localDay === 31 ? -24 * 60 : 24 * 60); // handle day boundary

  return localMinutes; // this IS the offset from UTC
}

/**
 * Convert a full hours value string like "10:00 am - 7:30 pm IST"
 * to target timezone: "11:30 PM UTC - 2:00 PM UTC" (example)
 */
function convertHoursValue(hoursValue: string, targetIana: string, targetAbbrev: string): string {
  // "Closed" days
  if (/^closed$/i.test(hoursValue.trim())) return "Closed";

  // Strip existing timezone suffix (IST, UTC, etc.)
  const stripped = hoursValue.replace(/\s+[A-Z]{2,5}$/, "").trim();

  // Match "10:00 am - 7:30 pm" pattern
  const rangeMatch = stripped.match(
    /(\d{1,2}:\d{2}\s*(?:am|pm))\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:am|pm))/i
  );
  if (!rangeMatch) return hoursValue; // can't parse — return as-is

  const openConverted = convertISTTime(rangeMatch[1].trim(), targetIana, targetAbbrev);
  const closeConverted = convertISTTime(rangeMatch[2].trim(), targetIana, targetAbbrev);
  return `${openConverted} - ${closeConverted}`;
}

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
      if (!DAY_ORDER.map((d) => d.toLowerCase()).includes(dayPrefix)) return null;
      return { day: rawDay.slice(0, 3), hours: hoursVal };
    })
    .filter((e): e is DayEntry => e !== null);
}

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
 * @param hours       lead.hours from DB (either raw or full IST format)
 * @param address     kept for API compatibility
 * @param targetIana  IANA timezone to convert to (default: "Asia/Kolkata" = IST, no conversion)
 * @param targetAbbrev Short label shown after time e.g. "UTC", "EST"
 *
 * Usage:
 *   formatHoursWithISTGrouped(lead.hours, lead.address)
 *   formatHoursWithISTGrouped(lead.hours, lead.address, "UTC", "UTC")
 *   formatHoursWithISTGrouped(lead.hours, lead.address, "America/New_York", "EST")
 */
export function formatHoursWithISTGrouped(
  hours: string,
  address: string,
  targetIana: string = IST_IANA,
  targetAbbrev: string = "IST"
): string {
  if (!hours?.trim()) return "—";

  // Format A — raw Google Maps snippet, no conversion possible
  const raw = formatRawGoogleHours(hours);
  if (raw !== null) return raw;

  // Format B — full enriched string
  const entries = parseHoursString(hours);
  if (entries.length === 0) return hours.replace(/^[\s·•\-–]+/, "").trim();

  // Convert each entry's hours to target timezone if needed
  const converted: DayEntry[] = targetIana === IST_IANA
    ? entries  // no conversion needed, already IST
    : entries.map((e) => ({
        day: e.day,
        hours: convertHoursValue(e.hours, targetIana, targetAbbrev),
      }));

  const groups = groupConsecutiveDays(converted);
  return groups.map((g) => `${g.label}: ${g.hours}`).join("; ");
}

export function formatHoursGrouped(hours: string): string {
  return formatHoursWithISTGrouped(hours, "");
}