/**
 * @module utils/formatters
 *
 * @description
 * A collection of pure formatting utility functions used throughout the
 * Fit Buddy dashboard to transform raw numeric and temporal data into
 * human-readable display strings. All functions are stateless and
 * side-effect-free, making them safe to use in React render paths,
 * memoized selectors, and unit tests.
 *
 * These formatters are designed to work with data returned by the Garmin
 * Connect API and the Fit Buddy backend, where durations are in seconds,
 * distances are in meters, and timestamps follow ISO 8601 conventions.
 *
 * @example
 * import { formatDuration, formatDistance } from './utils/formatters';
 *
 * formatDuration(5430);     // "1h 30m"
 * formatDistance(12345);     // "12.35 km"
 */

/**
 * Converts a duration in seconds to a human-readable "Xh Ym" string.
 *
 * @description
 * Takes a raw duration value in seconds (as commonly returned by fitness
 * APIs for activity durations, sleep time, etc.) and converts it into a
 * compact, readable format. The function handles edge cases including
 * zero values, durations under one hour (showing only minutes), and
 * durations of exactly N hours (showing only hours with no minutes).
 *
 * Fractional seconds are truncated (floored) during conversion. If the
 * input is null, undefined, or not a finite number, the function returns
 * "0m" as a safe fallback.
 *
 * @param {number} seconds - The duration in seconds to format. Expected
 *   to be a non-negative integer or float (e.g., 3661 for 1h 1m 1s).
 * @returns {string} A formatted duration string in "Xh Ym" format.
 *   Examples: "2h 15m", "45m", "1h", "0m".
 *
 * @example
 * formatDuration(0);        // "0m"
 * formatDuration(59);       // "0m"
 * formatDuration(60);       // "1m"
 * formatDuration(3600);     // "1h"
 * formatDuration(3661);     // "1h 1m"
 * formatDuration(7200);     // "2h"
 * formatDuration(5430);     // "1h 30m"
 * formatDuration(null);     // "0m"
 */
export function formatDuration(seconds) {
  if (seconds == null || !isFinite(seconds) || seconds < 0) {
    return '0m';
  }

  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Converts a distance in meters to a formatted "X.XX km" string.
 *
 * @description
 * Takes a raw distance value in meters (as commonly returned by fitness
 * APIs for activity distances, daily step distances, etc.) and converts
 * it into a kilometer-based string with exactly two decimal places.
 *
 * The conversion divides the input by 1000 and formats to two decimal
 * places using `toFixed(2)`. If the input is null, undefined, or not a
 * finite number, the function returns "0.00 km" as a safe fallback.
 *
 * @param {number} meters - The distance in meters to format. Expected
 *   to be a non-negative number (e.g., 5234.7 for about 5.23 km).
 * @returns {string} A formatted distance string in "X.XX km" format.
 *   Examples: "5.23 km", "0.00 km", "42.20 km".
 *
 * @example
 * formatDistance(0);          // "0.00 km"
 * formatDistance(1000);       // "1.00 km"
 * formatDistance(5234.7);     // "5.23 km"
 * formatDistance(42195);      // "42.20 km"
 * formatDistance(null);       // "0.00 km"
 */
export function formatDistance(meters) {
  if (meters == null || !isFinite(meters) || meters < 0) {
    return '0.00 km';
  }

  const km = meters / 1000;
  return `${km.toFixed(2)} km`;
}

/**
 * Formats a number with comma thousand separators for readability.
 *
 * @description
 * Takes a raw numeric value and returns a string with commas inserted
 * at every three-digit group (following US/international conventions).
 * This is essential for displaying large fitness metrics like step counts
 * (e.g., 12,345 steps) in a way that is easy to scan visually.
 *
 * The function uses `Number.toLocaleString('en-US')` for consistent
 * comma formatting regardless of the user's browser locale. If the
 * input is null, undefined, or not a finite number, the function
 * returns "0" as a safe fallback.
 *
 * @param {number} num - The number to format with comma separators.
 *   Can be an integer or float (e.g., 12345 or 12345.67).
 * @returns {string} A formatted number string with comma separators.
 *   Examples: "12,345", "1,234,567", "0", "999".
 *
 * @example
 * formatNumber(0);             // "0"
 * formatNumber(999);           // "999"
 * formatNumber(1000);          // "1,000"
 * formatNumber(12345);         // "12,345"
 * formatNumber(1234567.89);    // "1,234,567.89"
 * formatNumber(null);          // "0"
 */
export function formatNumber(num) {
  if (num == null || !isFinite(num)) {
    return '0';
  }

  return num.toLocaleString('en-US');
}

/**
 * Formats a timestamp into a "HH:MM" 24-hour time string.
 *
 * @description
 * Accepts a timestamp value (ISO 8601 string, Unix milliseconds, or
 * a Date object) and returns a zero-padded 24-hour time string in
 * "HH:MM" format. This is used for displaying activity start times,
 * heart rate measurement times, and other time-of-day values on the
 * dashboard.
 *
 * The function constructs a Date object from the input and extracts
 * the local hours and minutes, padding each to two digits. If the
 * input cannot be parsed into a valid date, the function returns
 * "--:--" as a fallback indicator.
 *
 * @param {string|number|Date} timestamp - The timestamp to format.
 *   Accepted formats include ISO 8601 strings (e.g., "2024-01-15T14:30:00Z"),
 *   Unix milliseconds (e.g., 1705312200000), or Date objects.
 * @returns {string} A formatted time string in "HH:MM" format.
 *   Examples: "14:30", "09:05", "00:00", "--:--" (for invalid input).
 *
 * @example
 * formatTime('2024-01-15T14:30:00Z');  // "14:30" (in UTC timezone)
 * formatTime(new Date(2024, 0, 15, 9, 5));  // "09:05"
 * formatTime(null);                     // "--:--"
 * formatTime('invalid');                // "--:--"
 */
export function formatTime(timestamp) {
  if (timestamp == null) {
    return '--:--';
  }

  const date = new Date(timestamp);

  if (isNaN(date.getTime())) {
    return '--:--';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Formats a date string into a compact "Mon 13" display format.
 *
 * @description
 * Takes a date string (typically in ISO 8601 "YYYY-MM-DD" format or any
 * format parseable by the Date constructor) and returns a compact
 * representation showing the abbreviated day name and the day-of-month
 * number. This format is used in chart axis labels, card headers, and
 * summary views where space is limited.
 *
 * The abbreviated day names follow the English three-letter convention:
 * "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat". The day-of-month
 * is displayed without leading zeros (e.g., "5" not "05").
 *
 * If the input cannot be parsed into a valid date, the function returns
 * "--" as a fallback.
 *
 * @param {string} dateStr - The date string to format. Typically in
 *   "YYYY-MM-DD" format (e.g., "2024-01-15"), but any Date-parseable
 *   string is accepted.
 * @returns {string} A formatted date string in "Mon 13" format.
 *   Examples: "Mon 15", "Fri 3", "Sun 28", "--" (for invalid input).
 *
 * @example
 * formatDate('2024-01-15');   // "Mon 15"
 * formatDate('2024-02-03');   // "Sat 3"
 * formatDate(null);           // "--"
 * formatDate('invalid');      // "--"
 */
export function formatDate(dateStr) {
  if (dateStr == null) {
    return '--';
  }

  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    return '--';
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = days[date.getDay()];
  const dayNumber = date.getDate();

  return `${dayName} ${dayNumber}`;
}

/**
 * Calculates the percentage change between two values and returns a
 * structured result with the formatted value and trend direction.
 *
 * @description
 * Computes the percentage change from a previous value to a current
 * value using the formula: ((current - previous) / previous) * 100.
 * Returns an object containing the absolute percentage value (formatted
 * to one decimal place) and a direction indicator ('up' or 'down').
 *
 * This is used throughout the dashboard to display trend arrows and
 * colored percentage badges next to metric values (e.g., "+12.5% up"
 * shown in green, or "-3.2% down" shown in red).
 *
 * Edge cases handled:
 * - If `previous` is 0 or falsy, returns { value: 0, direction: 'up' }
 *   to avoid division by zero.
 * - If `current` equals `previous`, returns { value: 0, direction: 'up' }.
 * - Negative results set direction to 'down'; positive results set 'up'.
 * - The `value` property is always the absolute (non-negative) percentage.
 *
 * @param {number} current - The current (most recent) metric value.
 * @param {number} previous - The previous (comparison) metric value.
 * @returns {{ value: number, direction: 'up' | 'down' }} An object with:
 *   - `value` {number}: The absolute percentage change, rounded to one
 *     decimal place (e.g., 12.5, 3.2, 0.0).
 *   - `direction` {'up' | 'down'}: The trend direction. 'up' if the
 *     current value is greater than or equal to the previous value,
 *     'down' if the current value is less.
 *
 * @example
 * formatPercentChange(112, 100);  // { value: 12.0, direction: 'up' }
 * formatPercentChange(85, 100);   // { value: 15.0, direction: 'down' }
 * formatPercentChange(100, 100);  // { value: 0.0, direction: 'up' }
 * formatPercentChange(50, 0);     // { value: 0, direction: 'up' }
 * formatPercentChange(0, 100);    // { value: 100.0, direction: 'down' }
 */
export function formatPercentChange(current, previous) {
  if (!previous || previous === 0) {
    return { value: 0, direction: 'up' };
  }

  const change = ((current - previous) / previous) * 100;
  const absChange = Math.abs(parseFloat(change.toFixed(1)));

  return {
    value: absChange,
    direction: change >= 0 ? 'up' : 'down',
  };
}
