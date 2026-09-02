/**
 * Helper utilities to resolve Shift 1 (7 AM - 7 PM) and Shift 2 (7 PM - 7 AM)
 * based on local time.
 */

const DEFAULT_TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Kolkata';

export interface ShiftInfo {
  shiftNumber: 1 | 2;
  shiftLabel: string; // "Shift 1" or "Shift 2"
  shiftName: string;  // "Shift 1 (7 AM - 7 PM)" or "Shift 2 (7 PM - 7 AM)"
}

/**
 * Resolves the shift for a given Date in the specified timezone.
 * Shift 1: 07:00:00 to 18:59:59 (7:00 AM - 7:00 PM)
 * Shift 2: 19:00:00 to 06:59:59 (7:00 PM - 7:00 AM next day)
 */
export function getShiftInfo(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): ShiftInfo {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(formatter.format(date), 10);

    // 7 AM (7) up to 6:59 PM (18) => Shift 1
    if (hour >= 7 && hour < 19) {
      return {
        shiftNumber: 1,
        shiftLabel: 'Shift 1',
        shiftName: 'Shift 1 (7 AM - 7 PM)',
      };
    } else {
      return {
        shiftNumber: 2,
        shiftLabel: 'Shift 2',
        shiftName: 'Shift 2 (7 PM - 7 AM)',
      };
    }
  } catch (error) {
    console.error('Failed to format shift info:', error);
    return {
      shiftNumber: 1,
      shiftLabel: 'Shift 1',
      shiftName: 'Shift 1 (7 AM - 7 PM)',
    };
  }
}
