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
