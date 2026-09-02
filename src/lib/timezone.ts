/**
 * Timezone utilities to calculate correct date boundaries for UTC queries.
 */
const DEFAULT_TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Kolkata';

/**
 * Returns the exact UTC start and end Date objects for a given YYYY-MM-DD date string
 * in the specified timezone (e.g., 'Asia/Kolkata').
 */
export function getDateBoundaries(dateStr: string, timeZone: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format. Expected YYYY-MM-DD, got: ${dateStr}`);
  }
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // Construct a base Date in UTC representing 00:00:00
  const baseStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offsetStartMinutes = getTimezoneOffset(baseStart, timeZone);
  const start = new Date(baseStart.getTime() - offsetStartMinutes * 60000);

  // Construct a base Date in UTC representing 23:59:59.999
  const baseEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  const offsetEndMinutes = getTimezoneOffset(baseEnd, timeZone);
  const end = new Date(baseEnd.getTime() - offsetEndMinutes * 60000);

  return { start, end };
}

/**
 * Helper to get offset in minutes for a specific Date and Timezone.
 * Handles daylight saving transitions correctly.
 */
function getTimezoneOffset(date: Date, timeZone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(date);
    const tzNamePart = parts.find((part) => part.type === 'timeZoneName');
    if (!tzNamePart) return 0;

    const value = tzNamePart.value; // e.g., "GMT+5:30", "GMT-08:00", "GMT"
    if (value === 'GMT' || value === 'UTC') return 0;

    const match = value.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!match) return 0;

    const [, sign, hours, minutes = '0'] = match;
    const offsetMinutes = parseInt(hours, 10) * 60 + parseInt(minutes, 10);
    return (sign === '+' ? 1 : -1) * offsetMinutes;
  } catch (error) {
    console.error(`Failed to resolve timezone offset for ${timeZone}:`, error);
    return 0;
  }
}

/**
 * Returns today's date in YYYY-MM-DD format for a given timezone.
 */
export function getLocalDateString(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA outputs YYYY-MM-DD
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Formats a Date object into a readable time string in a specific timezone.
 */
export function formatLocalTime(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}
