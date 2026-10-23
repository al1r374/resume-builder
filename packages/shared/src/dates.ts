import type { DateCalendar, Profile } from "./schemas.js";

/**
 * Detect likely Jalali dates without converting them.
 * Pattern YYYY/MM or YYYY/MM/DD where year is typically 1300–1499.
 */
export function detectLikelyCalendar(raw: string): DateCalendar {
  const trimmed = raw.trim();
  if (/^present$/i.test(trimmed) || /^current$/i.test(trimmed)) {
    return "gregorian";
  }
  const m = trimmed.match(/^(\d{4})([/-]\d{1,2})?([/-]\d{1,2})?$/);
  if (!m) return "unknown";
  const year = Number(m[1]);
  if (year >= 1300 && year <= 1499) return "jalali";
  if (year >= 1900 && year <= 2100) return "gregorian";
  return "unknown";
}

export function formatProfileDate(
  raw: string | null | undefined,
  options?: { calendar?: DateCalendar; convert?: boolean },
): string {
  if (!raw) return "";
  const value = String(raw).trim();
  if (!value) return "";
  if (/^present$/i.test(value)) return "Present";

  const calendar = options?.calendar ?? detectLikelyCalendar(value);
  // Never silently convert calendars. Display raw with an optional hint.
  if (calendar === "jalali") {
    return `${value} (Jalali)`;
  }
  return value;
}

export function resolveProfileDateCalendar(profile: Profile): DateCalendar {
  if (profile.preferences?.date_calendar) {
    return profile.preferences.date_calendar;
  }
  const sample = profile.experience[0]?.start_date;
  if (sample) return detectLikelyCalendar(sample);
  return "unknown";
}

export function buildDateCalendarNote(profile: Profile): string | null {
  const calendar = resolveProfileDateCalendar(profile);
  if (calendar === "jalali") {
    return "Employment and education dates are shown in the Jalali (Persian) calendar as stored in the profile. They were not converted to Gregorian.";
  }
  if (calendar === "unknown") {
    return "Some dates could not be classified as Jalali or Gregorian; values are shown exactly as stored in the profile.";
  }
  return null;
}
