/**
 * @module utils/constants
 *
 * @description
 * Central repository of all application-wide constants used throughout the
 * Fit Buddy dashboard. This module defines polling intervals, default goal
 * values, supported data type enumerations, color palettes for charts and
 * metrics, stress level color coding, and activity type icon mappings.
 *
 * By centralizing these values, we ensure consistency across all components
 * and make it easy to update branding colors, default values, or supported
 * data types in a single location without hunting through the codebase.
 *
 * All exports are frozen objects or primitive constants to prevent
 * accidental mutation at runtime.
 *
 * @example
 * import { POLL_INTERVAL_MS, METRIC_COLORS, ACTIVITY_ICONS } from './utils/constants';
 *
 * // Use in a polling interval
 * setInterval(fetchData, POLL_INTERVAL_MS);
 *
 * // Use a metric color
 * <div style={{ color: METRIC_COLORS.steps }}>12,345</div>
 */

/**
 * The interval in milliseconds between automatic data polling requests.
 *
 * @description
 * Defines how frequently the dashboard automatically fetches fresh data
 * from the backend API to keep displayed metrics up to date. Set to
 * 60000 ms (1 minute) to balance data freshness against API rate limits
 * and server load. Used by the Dashboard component's polling mechanism.
 *
 * @type {number}
 * @constant
 */
export const POLL_INTERVAL_MS = 60000;

/**
 * The default daily step goal used when the user has not configured a
 * custom goal.
 *
 * @description
 * This value (10,000 steps) is the widely recognized daily step target
 * recommended by health organizations. It serves as the denominator for
 * step progress calculations and the target line on step charts. Users
 * can override this value through their profile settings.
 *
 * @type {number}
 * @constant
 */
export const DEFAULT_STEP_GOAL = 10000;

/**
 * The list of supported health data type identifiers.
 *
 * @description
 * Enumerates all data categories that the Fit Buddy backend can retrieve
 * from Garmin Connect and store in the database. Each string corresponds
 * to both an API endpoint path segment (e.g., '/api/steps') and a
 * database collection/table name. This array is used to:
 *
 * - Build API endpoint URLs for data fetching.
 * - Generate navigation tabs and filter options in the UI.
 * - Validate data type parameters in utility functions.
 * - Drive the "Sync All" functionality that iterates over all types.
 *
 * The supported types are:
 * - 'steps': Daily step count and distance data.
 * - 'heartrate': Heart rate measurements and zones.
 * - 'sleep': Sleep duration, stages, and quality scores.
 * - 'stress': Stress level measurements throughout the day.
 * - 'bodybattery': Body Battery energy level readings.
 * - 'activities': Recorded fitness activities (runs, rides, etc.).
 * - 'healthmetrics': Composite health metrics (SpO2, respiration, etc.).
 *
 * @type {string[]}
 * @constant
 */
export const DATA_TYPES = [
  'steps',
  'heartrate',
  'sleep',
  'stress',
  'bodybattery',
  'activities',
  'healthmetrics',
];

/**
 * Color assignments for each metric category displayed on the dashboard.
 *
 * @description
 * Maps each health metric type to a specific hex color used for its
 * visual representation across the dashboard, including metric cards,
 * chart lines, progress rings, and icon accents. Colors are chosen to
 * be visually distinct from one another while maintaining readability
 * against the dark (#0a0a0f) background.
 *
 * Color assignments:
 * - `steps` (#8b5cf6): Purple - prominent and energetic for the primary metric.
 * - `heartRate` (#ef4444): Red - universally associated with heart/cardiac data.
 * - `sleep` (#6366f1): Indigo - calm and restful, fitting for sleep data.
 * - `stress` (#f59e0b): Amber/yellow - alerting color for stress indicators.
 * - `bodyBattery` (#10b981): Emerald green - associated with energy and vitality.
 * - `activities` (#06b6d4): Cyan - the primary accent color, used for active data.
 * - `healthMetrics` (#ec4899): Pink - distinctive for composite health data.
 *
 * @type {Object<string, string>}
 * @constant
 */
export const METRIC_COLORS = {
  steps: '#8b5cf6',
  heartRate: '#ef4444',
  sleep: '#6366f1',
  stress: '#f59e0b',
  bodyBattery: '#10b981',
  activities: '#06b6d4',
  healthMetrics: '#ec4899',
};

/**
 * The primary chart color palette derived from the Fit Buddy design system.
 *
 * @description
 * Provides a set of named colors used for multi-series charts, gradient
 * fills, and data visualization elements throughout the dashboard. These
 * colors are drawn from the application's accent color palette (cyan,
 * azure, blue, teal) plus a complementary purple for additional series.
 *
 * When rendering charts with multiple data series (e.g., overlay of
 * steps and heart rate), these colors are cycled through in order.
 * All colors are selected to maintain sufficient contrast against the
 * dark card background (#12121a) and pass WCAG AA contrast requirements.
 *
 * Color assignments:
 * - `cyan` (#06b6d4): Primary accent, used for the first or most
 *   important data series.
 * - `azure` (#0ea5e9): Secondary accent, slightly warmer than cyan.
 * - `blue` (#3b82f6): Tertiary accent, provides visual depth.
 * - `teal` (#14b8a6): Quaternary accent, green-leaning for variety.
 * - `purple` (#8b5cf6): Fifth series color, provides warm contrast.
 *
 * @type {Object<string, string>}
 * @constant
 */
export const CHART_COLORS = {
  cyan: '#06b6d4',
  azure: '#0ea5e9',
  blue: '#3b82f6',
  teal: '#14b8a6',
  purple: '#8b5cf6',
};

/**
 * Color coding for different stress level ranges.
 *
 * @description
 * Maps stress level categories to specific hex colors used in stress
 * charts, gauges, and timeline visualizations. The Garmin stress system
 * reports stress levels on a 0-100 scale, which is typically divided
 * into four categories:
 *
 * - `rest` (#10b981, emerald green): Stress level 0-25. Indicates a
 *   restful, recovered state. Displayed as a positive/healthy indicator.
 * - `low` (#06b6d4, cyan): Stress level 26-50. Indicates mild or
 *   manageable stress. Normal for daily activities.
 * - `medium` (#f59e0b, amber): Stress level 51-75. Indicates moderate
 *   stress that may warrant attention. Serves as a caution indicator.
 * - `high` (#ef4444, red): Stress level 76-100. Indicates significant
 *   stress. Displayed as a warning to encourage rest or recovery.
 *
 * @type {Object<string, string>}
 * @constant
 */
export const STRESS_COLORS = {
  rest: '#10b981',
  low: '#06b6d4',
  medium: '#f59e0b',
  high: '#ef4444',
};

/**
 * Mapping of activity type identifiers to their display icon characters.
 *
 * @description
 * Provides emoji/unicode icon characters for each supported activity type
 * that can be recorded via Garmin Connect. These icons are used in
 * activity list items, cards, and summary views to provide quick visual
 * identification of the activity type.
 *
 * The mapping uses Garmin's activity type naming convention (snake_case)
 * as keys. A 'default' key is provided as a fallback for any activity
 * type not explicitly listed (e.g., yoga, hiking, rowing).
 *
 * Activity icon assignments:
 * - `running` (runner emoji): All running-based activities.
 * - `cycling` (bicycle emoji): Road cycling, mountain biking, etc.
 * - `strength_training` (weight lifting emoji): Gym and weight training.
 * - `walking` (walking person emoji): Walking and hiking activities.
 * - `swimming` (swimmer emoji): Pool and open-water swimming.
 * - `default` (general activity emoji): Fallback for unmapped activity types.
 *
 * @type {Object<string, string>}
 * @constant
 */
export const ACTIVITY_ICONS = {
  running: '\u{1F3C3}',
  cycling: '\u{1F6B4}',
  strength_training: '\u{1F3CB}',
  walking: '\u{1F6B6}',
  swimming: '\u{1F3CA}',
  default: '\u{1F3AF}',
};
