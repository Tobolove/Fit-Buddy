/**
 * @module contexts/DashboardContext
 *
 * @description
 * Central data store and state management provider for the Fit Buddy dashboard.
 * This module acts as the "brain" of the frontend, orchestrating all data
 * fetching, caching, and state distribution for the dashboard's health metrics.
 *
 * The DashboardContext manages three distinct data domains:
 *
 * 1. **Live Data**: Real-time health metrics fetched via periodic polling from
 *    the `/live` API endpoint. Updated every 60 seconds (configurable via
 *    `POLL_INTERVAL_MS`) to keep the dashboard current without overwhelming
 *    the backend. Contains the latest snapshot of the user's Garmin data.
 *
 * 2. **Historic Data (This Week)**: Aggregated health data for the current
 *    week (Monday through today). Fetched once on mount for all 7 supported
 *    data types (steps, heartrate, sleep, stress, bodybattery, activities,
 *    healthmetrics) using date-range queries against the `/db/{type}/range`
 *    API endpoints.
 *
 * 3. **Previous Week Data**: Aggregated health data for the prior full week
 *    (Monday through Sunday). Fetched alongside the current week data to
 *    enable week-over-week trend comparisons and percentage change badges
 *    displayed on metric cards.
 *
 * On mount, the provider calculates the appropriate date ranges, fires off
 * 14 parallel API requests (7 data types x 2 weeks) using `Promise.allSettled`
 * to ensure partial failures don't block the entire dashboard, and begins
 * the live data polling interval.
 *
 * All state updates are dispatched through granular setter calls to minimize
 * unnecessary re-renders. The context value is memoized to prevent downstream
 * consumers from re-rendering when unrelated state changes occur.
 *
 * @example
 * // Wrap dashboard content with the provider
 * import { DashboardProvider } from './contexts/DashboardContext';
 *
 * function App() {
 *   return (
 *     <DashboardProvider>
 *       <Dashboard />
 *     </DashboardProvider>
 *   );
 * }
 *
 * @example
 * // Consume context in a child component
 * import { useContext } from 'react';
 * import { DashboardContext } from './contexts/DashboardContext';
 *
 * function StepsCard() {
 *   const { historic } = useContext(DashboardContext);
 *   const stepsData = historic.steps.data;
 *   // ...render steps chart
 * }
 */

import React, { createContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../utils/api';
import { DATA_TYPES, POLL_INTERVAL_MS } from '../utils/constants';

/** Data types that need a 30-day trend fetch for SparkBar histograms. */
const THIRTY_DAY_TYPES = ['steps', 'heartrate', 'sleep', 'stress', 'bodybattery'];

/**
 * The React Context object for dashboard state.
 *
 * @description
 * This context provides the complete dashboard data state to all consumer
 * components in the tree. The context value includes:
 *
 * - `live` {Object}: Real-time health data with `data`, `lastUpdated`,
 *   `loading`, and `error` fields.
 * - `historic` {Object}: Current week's data keyed by data type, each
 *   containing `data` (array), `loading` (boolean), and `error` (string|null).
 * - `previousWeek` {Object}: Previous week's data with the same shape as
 *   `historic`, enabling week-over-week comparisons.
 * - `isLoading` {boolean}: Aggregate loading flag that is `true` when ANY
 *   data source is still loading.
 * - `lastUpdated` {number|null}: Timestamp of the most recent successful
 *   live data fetch.
 * - `refreshLive` {Function}: Callback to force an immediate live data
 *   refresh, bypassing the polling interval.
 *
 * Consumers should prefer using the `useDashboardData` hook for convenient
 * access rather than calling `useContext(DashboardContext)` directly.
 *
 * @type {React.Context}
 */
export const DashboardContext = createContext(null);

/**
 * Calculates the date ranges for the current week and previous week.
 *
 * @description
 * Determines the Monday-based week boundaries needed for fetching historic
 * health data. The function uses the following logic:
 *
 * 1. **This Week Start**: Finds the most recent Monday by subtracting the
 *    number of days since Monday from today's date. If today IS Monday,
 *    `thisWeekStart` is today. Uses `(day + 6) % 7` to handle the
 *    JavaScript `getDay()` convention where Sunday = 0.
 *
 * 2. **This Week End**: Always set to today's date, since the current week
 *    is still in progress.
 *
 * 3. **Last Week Start**: The Monday exactly 7 days before `thisWeekStart`.
 *
 * 4. **Last Week End**: The Sunday immediately before `thisWeekStart`
 *    (i.e., `thisWeekStart - 1 day`), representing the last day of the
 *    previous full week.
 *
 * All dates are returned as JavaScript `Date` objects set to midnight local
 * time with hours, minutes, seconds, and milliseconds zeroed out.
 *
 * @function getDateRanges
 * @returns {{
 *   thisWeek: { start: Date, end: Date },
 *   lastWeek: { start: Date, end: Date }
 * }} An object containing two date range objects:
 *   - `thisWeek.start` {Date}: Monday of the current week at 00:00:00.000.
 *   - `thisWeek.end` {Date}: Today's date at 00:00:00.000.
 *   - `lastWeek.start` {Date}: Monday of the previous week at 00:00:00.000.
 *   - `lastWeek.end` {Date}: Sunday of the previous week at 00:00:00.000.
 *
 * @example
 * // If today is Wednesday, 2024-01-17:
 * const ranges = getDateRanges();
 * // ranges.thisWeek.start  => Mon 2024-01-15
 * // ranges.thisWeek.end    => Wed 2024-01-17
 * // ranges.lastWeek.start  => Mon 2024-01-08
 * // ranges.lastWeek.end    => Sun 2024-01-14
 */
function getDateRanges() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const day = today.getDay();
  const diffToMonday = (day + 6) % 7;

  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - diffToMonday);

  const thisWeekEnd = new Date(today);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);

  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

  return {
    thisWeek: { start: thisWeekStart, end: thisWeekEnd },
    lastWeek: { start: lastWeekStart, end: lastWeekEnd },
  };
}

/**
 * Formats a JavaScript Date object into a "YYYY-MM-DD" string suitable
 * for API query parameters.
 *
 * @description
 * Converts a Date object into the ISO 8601 date-only format required by
 * the Fit Buddy backend's `/db/{type}/range` endpoint. The function
 * extracts the local year, month, and day values and zero-pads the month
 * and day to ensure a consistent 10-character string.
 *
 * This function uses local time (not UTC) to match the Garmin Connect
 * convention where dates correspond to the user's local calendar day.
 *
 * @function formatDateParam
 * @param {Date} date - The JavaScript Date object to format. Must be a
 *   valid Date instance (i.e., `date.getTime()` must not return `NaN`).
 * @returns {string} A date string in "YYYY-MM-DD" format.
 *   Examples: "2024-01-15", "2024-12-03", "2025-02-28".
 *
 * @example
 * formatDateParam(new Date(2024, 0, 15));  // "2024-01-15"
 * formatDateParam(new Date(2024, 11, 3));  // "2024-12-03"
 */
function formatDateParam(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * DashboardProvider component that wraps dashboard content and provides
 * centralized data fetching, state management, and live polling for all
 * health metrics displayed on the Fit Buddy dashboard.
 *
 * @description
 * This provider is the orchestration layer for the entire dashboard. It
 * manages three categories of state:
 *
 * ### Live Data State
 * ```javascript
 * {
 *   data: Object|null,     // Latest snapshot from /live endpoint
 *   lastUpdated: number|null, // Date.now() timestamp of last successful fetch
 *   loading: boolean,      // Whether a live fetch is in progress
 *   error: string|null     // Error message from the most recent failed fetch
 * }
 * ```
 *
 * ### Historic Data State (this week & previous week)
 * Each of the 7 data types has its own independent state slice:
 * ```javascript
 * {
 *   steps:         { data: [], loading: false, error: null },
 *   heartrate:     { data: [], loading: false, error: null },
 *   sleep:         { data: [], loading: false, error: null },
 *   stress:        { data: [], loading: false, error: null },
 *   bodybattery:   { data: [], loading: false, error: null },
 *   activities:    { data: [], loading: false, error: null },
 *   healthmetrics: { data: [], loading: false, error: null },
 * }
 * ```
 *
 * ### Initialization Sequence (on mount)
 * 1. Calculate date ranges via `getDateRanges()`.
 * 2. Set all 14 data type slots (7 types x 2 weeks) to `loading: true`.
 * 3. Fire 14 parallel `api.get('/db/{type}/range', { params })` requests
 *    wrapped in `Promise.allSettled` to ensure partial failures don't
 *    block the entire dashboard.
 * 4. Process results: fulfilled promises update `data`, rejected promises
 *    update `error` for their respective type/week slot.
 * 5. Set all 14 slots to `loading: false`.
 * 6. Start live data polling: immediate fetch + interval at `POLL_INTERVAL_MS`.
 *
 * ### Cleanup (on unmount)
 * The polling interval is cleared to prevent memory leaks and orphaned
 * network requests.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to render
 *   within the dashboard data context. Typically the entire dashboard UI
 *   tree including header, metric cards, charts, and activity lists.
 * @returns {React.ReactElement} The DashboardContext.Provider wrapping the
 *   children with the complete dashboard data state and control methods.
 *
 * @example
 * import { DashboardProvider } from './contexts/DashboardContext';
 * import DashboardHeader from './components/DashboardHeader';
 * import StepsCard from './components/StepsCard';
 *
 * function Dashboard() {
 *   return (
 *     <DashboardProvider>
 *       <DashboardHeader />
 *       <StepsCard />
 *     </DashboardProvider>
 *   );
 * }
 */
export function DashboardProvider({ children }) {
  /* ─────────────────────── Live Data State ─────────────────────── */

  /**
   * The current live data snapshot received from the `/live` API endpoint.
   *
   * @description
   * Contains the most recent real-time health metrics from the user's
   * Garmin device, or `null` if no live data has been fetched yet. The
   * exact shape of this data depends on the backend's `/live` response
   * format, which typically includes current heart rate, step count,
   * stress level, body battery, and other real-time readings.
   *
   * @type {[Object|null, Function]}
   */
  const [liveData, setLiveData] = useState(null);

  /**
   * Timestamp (in milliseconds since epoch) of the last successful live
   * data fetch, or `null` if no successful fetch has occurred.
   *
   * @description
   * Updated to `Date.now()` each time a live data fetch completes
   * successfully. Used by the DashboardHeader to display "Last updated X
   * ago" text and by the live indicator to show data freshness.
   *
   * @type {[number|null, Function]}
   */
  const [liveLastUpdated, setLiveLastUpdated] = useState(null);

  /**
   * Whether a live data fetch is currently in progress.
   *
   * @description
   * Set to `true` before each live data API request and back to `false`
   * when the request completes (regardless of success or failure). Used
   * to show loading indicators on the live data display.
   *
   * @type {[boolean, Function]}
   */
  const [liveLoading, setLiveLoading] = useState(false);

  /**
   * Error message from the most recent failed live data fetch, or `null`
   * if the last fetch succeeded.
   *
   * @description
   * Populated with the error message string when a live data API request
   * fails. Reset to `null` on the next successful fetch. Used to display
   * error banners or retry prompts in the dashboard header area.
   *
   * @type {[string|null, Function]}
   */
  const [liveError, setLiveError] = useState(null);

  /* ─────────────── Historic Data State (This Week) ─────────────── */

  /**
   * Historic health data for the current week, keyed by data type.
   *
   * @description
   * An object containing one state slice per supported data type (steps,
   * heartrate, sleep, stress, bodybattery, activities, healthmetrics).
   * Each slice has the shape `{ data: [], loading: false, error: null }`.
   *
   * The `data` array contains the raw records returned by the
   * `/db/{type}/range` endpoint for the date range from the most recent
   * Monday through today. This data powers the main metric cards, charts,
   * and the weekly overview section.
   *
   * @type {[Object, Function]}
   */
  const [historic, setHistoric] = useState(() => {
    const initial = {};
    DATA_TYPES.forEach((type) => {
      initial[type] = { data: [], loading: false, error: null };
    });
    return initial;
  });

  /* ────────────── Previous Week Data State ────────────── */

  /**
   * Historic health data for the previous full week, keyed by data type.
   *
   * @description
   * Has the identical shape as the `historic` state but contains data for
   * the previous Monday-through-Sunday week. Used exclusively for
   * week-over-week trend calculations (e.g., "steps up 12.5% vs last week")
   * displayed as percentage change badges on metric cards.
   *
   * @type {[Object, Function]}
   */
  const [previousWeek, setPreviousWeek] = useState(() => {
    const initial = {};
    DATA_TYPES.forEach((type) => {
      initial[type] = { data: [], loading: false, error: null };
    });
    return initial;
  });

  /* ──────────── 30-Day Trend Data State ──────────── */

  /**
   * Historic data covering the last 30 days for SparkBar histograms.
   *
   * @description
   * Stores 30 days of daily records for steps, heartrate, sleep, stress,
   * and bodybattery. Each type has `{ data: [], loading, error }`.
   * Populated on mount via parallel API requests to `/db/{type}/range`.
   *
   * @type {[Object, Function]}
   */
  const [thirtyDayData, setThirtyDayData] = useState(() => {
    const initial = {};
    THIRTY_DAY_TYPES.forEach((type) => {
      initial[type] = { data: [], loading: false, error: null };
    });
    return initial;
  });

  /* ──────────── Monthly Activities State ──────────── */

  /**
   * All activities for the current calendar month.
   *
   * @description
   * Stores activity records from the 1st of the current month through
   * today, fetched from `/db/activities/range`. This provides the full
   * month view for the ActivitiesCard instead of just the current week.
   * Live activities for today are merged in via the live data effect.
   *
   * @type {[{data: Array, loading: boolean, error: string|null}, Function]}
   */
  const [monthActivities, setMonthActivities] = useState({
    data: [],
    loading: false,
    error: null,
  });

  /**
   * Ref to hold the polling interval ID for cleanup on unmount.
   *
   * @description
   * Stores the return value of `setInterval` used for the live data
   * polling mechanism. Accessed during the cleanup phase of the
   * `useEffect` hook to call `clearInterval` and prevent orphaned
   * network requests after the dashboard is unmounted.
   *
   * @type {React.MutableRefObject<number|null>}
   */
  const pollIntervalRef = useRef(null);

  /* ───────────────────── Live Data Fetching ───────────────────── */

  /**
   * Fetches the latest live health data from the `/live` API endpoint.
   *
   * @description
   * Performs a GET request to the `/live` endpoint and updates the live
   * data state accordingly. The function manages its own loading and
   * error states:
   *
   * 1. Sets `liveLoading` to `true` before the request.
   * 2. On success: updates `liveData` with the response payload,
   *    sets `liveLastUpdated` to the current timestamp, and clears
   *    `liveError`.
   * 3. On failure: sets `liveError` with the error message while
   *    preserving the previously fetched `liveData` (so the dashboard
   *    continues showing stale data rather than blanking out).
   * 4. Sets `liveLoading` to `false` in all cases.
   *
   * This function is memoized with `useCallback` to maintain a stable
   * reference across renders, which is important because it is both
   * stored in the context value and used as an interval callback.
   *
   * @async
   * @function fetchLive
   * @returns {Promise<void>} Resolves when the fetch attempt completes
   *   (regardless of success or failure).
   */
  const fetchLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const response = await api.get('/live');
      setLiveData(response.data);
      setLiveLastUpdated(Date.now());
      setLiveError(null);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to fetch live data.';
      setLiveError(message);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  /**
   * Forces an immediate live data refresh, bypassing the polling interval.
   *
   * @description
   * Convenience wrapper around `fetchLive` that can be called by consumer
   * components (e.g., a "Refresh" button in the header) to trigger an
   * on-demand live data fetch without waiting for the next polling cycle.
   *
   * This function is included in the context value so any descendant
   * component can trigger a refresh.
   *
   * @function refreshLive
   * @returns {Promise<void>} Resolves when the live fetch completes.
   */
  const refreshLive = useCallback(() => {
    return fetchLive();
  }, [fetchLive]);

  /* ──── Merge live data into historic so WeeklyOverview includes today ──── */

  /**
   * Effect: inject today's live snapshot into the historic data arrays.
   *
   * @description
   * The historic data comes from the database which only has past records.
   * Today's data is only available from the live endpoint. This effect
   * creates synthetic DB-shaped records from the live response and
   * upserts them into the historic state so that the Weekly Overview
   * bar chart and summary stats include today's values.
   */
  useEffect(() => {
    if (!liveData || !liveData.date) return;
    const today = liveData.date;

    const mergeRecord = (existing, newRecord) => {
      const filtered = existing.filter((r) => r.date !== today);
      return [...filtered, newRecord];
    };

    setHistoric((prev) => {
      const next = { ...prev };

      if (liveData.steps && !liveData.steps.error) {
        next.steps = {
          ...next.steps,
          data: mergeRecord(next.steps.data, {
            date: today,
            total_steps: liveData.steps.total_steps || 0,
            total_distance: liveData.steps.total_distance || 0,
            total_calories: liveData.steps.total_calories || 0,
          }),
        };
      }

      if (liveData.heart_rate && !liveData.heart_rate.error) {
        next.heartrate = {
          ...next.heartrate,
          data: mergeRecord(next.heartrate.data, {
            date: today,
            resting_hr: liveData.heart_rate.resting_hr,
            average_hr: liveData.heart_rate.average_hr,
            max_hr: liveData.heart_rate.max_hr,
            min_hr: liveData.heart_rate.min_hr,
          }),
        };
      }

      if (liveData.sleep && !liveData.sleep.error) {
        next.sleep = {
          ...next.sleep,
          data: mergeRecord(next.sleep.data, {
            date: today,
            sleep_score: liveData.sleep.sleep_score,
            sleep_duration_seconds: liveData.sleep.sleep_duration_seconds,
            deep_sleep_seconds: liveData.sleep.deep_sleep_seconds,
            light_sleep_seconds: liveData.sleep.light_sleep_seconds,
            rem_sleep_seconds: liveData.sleep.rem_sleep_seconds,
            awake_seconds: liveData.sleep.awake_seconds,
          }),
        };
      }

      if (liveData.stress && !liveData.stress.error) {
        next.stress = {
          ...next.stress,
          data: mergeRecord(next.stress.data, {
            date: today,
            average_stress: liveData.stress.average_stress,
            max_stress: liveData.stress.max_stress,
          }),
        };
      }

      if (liveData.activities && !liveData.activities.error) {
        const acts = (liveData.activities.activities || []).map((a) => ({
          date: today,
          ...a,
        }));
        const filtered = (next.activities.data || []).filter((r) => r.date !== today);
        next.activities = {
          ...next.activities,
          data: [...filtered, ...acts],
        };
      }

      return next;
    });

    // Merge live activities into monthly activities
    if (liveData.activities && !liveData.activities.error) {
      const liveActs = (liveData.activities.activities || []).map((a) => ({
        date: today,
        ...a,
      }));
      setMonthActivities((prev) => {
        const filtered = (prev.data || []).filter((r) => r.date !== today);
        return {
          ...prev,
          data: [...filtered, ...liveActs].sort((a, b) =>
            (b.date || '').localeCompare(a.date || '')
          ),
        };
      });
    }

    // Also merge into 30-day trend data
    setThirtyDayData((prev) => {
      const next = { ...prev };
      const merge = (arr, rec) => {
        const filtered = (arr || []).filter((r) => r.date !== today);
        return [...filtered, rec].sort((a, b) => a.date.localeCompare(b.date));
      };
      if (liveData.steps && !liveData.steps.error) {
        next.steps = { ...next.steps, data: merge(next.steps.data, { date: today, total_steps: liveData.steps.total_steps || 0 }) };
      }
      if (liveData.heart_rate && !liveData.heart_rate.error) {
        next.heartrate = { ...next.heartrate, data: merge(next.heartrate.data, { date: today, min_hr: liveData.heart_rate.min_hr, resting_hr: liveData.heart_rate.resting_hr }) };
      }
      if (liveData.sleep && !liveData.sleep.error) {
        next.sleep = { ...next.sleep, data: merge(next.sleep.data, { date: today, sleep_score: liveData.sleep.sleep_score }) };
      }
      if (liveData.stress && !liveData.stress.error) {
        next.stress = { ...next.stress, data: merge(next.stress.data, { date: today, average_stress: liveData.stress.average_stress }) };
      }
      if (liveData.body_battery) {
        next.bodybattery = { ...next.bodybattery, data: merge(next.bodybattery.data, { date: today, charged: liveData.body_battery.charged }) };
      }
      return next;
    });
  }, [liveData]);

  /* ──────────────── Historic Data Fetching ──────────────── */

  /**
   * Effect: Fetch all historic data and start live polling on mount.
   *
   * @description
   * This is the primary initialization effect for the dashboard. It runs
   * once on mount and performs the following sequence:
   *
   * ### Step 1: Calculate Date Ranges
   * Calls `getDateRanges()` to determine the current week (Monday to today)
   * and previous week (last Monday to last Sunday) boundaries.
   *
   * ### Step 2: Set Loading States
   * Marks all 14 data type slots (7 types x 2 weeks) as `loading: true`
   * so that card components can display loading skeletons immediately.
   *
   * ### Step 3: Fire Parallel Requests
   * Builds an array of 14 API requests (one per type per week) and
   * executes them all simultaneously via `Promise.allSettled`. This
   * ensures that a failure in one request (e.g., heartrate data unavailable)
   * doesn't prevent other data types from loading successfully.
   *
   * Each request calls:
   * ```
   * GET /db/{type}/range?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
   * ```
   *
   * ### Step 4: Process Results
   * Iterates over the settled results and updates each type's state slice:
   * - **Fulfilled**: Sets `data` to the response payload and clears `error`.
   * - **Rejected**: Sets `error` to the error message and leaves `data` empty.
   * - In both cases, sets `loading` to `false`.
   *
   * ### Step 5: Start Live Polling
   * Calls `fetchLive()` immediately to get the first live data snapshot,
   * then starts a `setInterval` at `POLL_INTERVAL_MS` for subsequent
   * automatic refreshes.
   *
   * ### Cleanup
   * Clears the polling interval when the component unmounts.
   */
  useEffect(() => {
    const { thisWeek, lastWeek } = getDateRanges();

    const thisWeekStartStr = formatDateParam(thisWeek.start);
    const thisWeekEndStr = formatDateParam(thisWeek.end);
    const lastWeekStartStr = formatDateParam(lastWeek.start);
    const lastWeekEndStr = formatDateParam(lastWeek.end);

    /* ── Mark all historic slots as loading ── */
    setHistoric((prev) => {
      const next = { ...prev };
      DATA_TYPES.forEach((type) => {
        next[type] = { ...next[type], loading: true, error: null };
      });
      return next;
    });

    setPreviousWeek((prev) => {
      const next = { ...prev };
      DATA_TYPES.forEach((type) => {
        next[type] = { ...next[type], loading: true, error: null };
      });
      return next;
    });

    /* ── Build and fire all 14 requests in parallel ── */

    /**
     * Array of request descriptor objects used to map settled promise
     * results back to their corresponding state slice and week.
     *
     * @description
     * Each descriptor contains:
     * - `type` {string}: The data type key (e.g., 'steps', 'heartrate').
     * - `week` {'thisWeek'|'lastWeek'}: Which week the request targets.
     * - `promise` {Promise}: The Axios GET promise for this request.
     *
     * After `Promise.allSettled`, the index of each result corresponds
     * to the same index in this array, allowing us to route the result
     * to the correct state setter.
     *
     * @type {Array<{type: string, week: string, promise: Promise}>}
     */
    const requests = [];

    DATA_TYPES.forEach((type) => {
      requests.push({
        type,
        week: 'thisWeek',
        promise: api.get(`/db/${type}/range`, {
          params: { start_date: thisWeekStartStr, end_date: thisWeekEndStr },
        }),
      });

      requests.push({
        type,
        week: 'lastWeek',
        promise: api.get(`/db/${type}/range`, {
          params: { start_date: lastWeekStartStr, end_date: lastWeekEndStr },
        }),
      });
    });

    Promise.allSettled(requests.map((r) => r.promise)).then((results) => {
      results.forEach((result, index) => {
        const { type, week } = requests[index];
        const setter = week === 'thisWeek' ? setHistoric : setPreviousWeek;

        if (result.status === 'fulfilled') {
          const responseBody = result.value.data;
          const records = Array.isArray(responseBody?.data)
            ? responseBody.data
            : Array.isArray(responseBody)
              ? responseBody
              : [];
          setter((prev) => ({
            ...prev,
            [type]: {
              data: records,
              loading: false,
              error: null,
            },
          }));
        } else {
          const errorMessage =
            result.reason?.response?.data?.message ||
            result.reason?.response?.data?.error ||
            result.reason?.message ||
            `Failed to fetch ${type} data.`;

          setter((prev) => ({
            ...prev,
            [type]: {
              data: [],
              loading: false,
              error: errorMessage,
            },
          }));
        }
      });
    });

    /* ── Fetch 30-day trend data for SparkBar histograms ── */
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const thirtyDayStartStr = formatDateParam(thirtyDaysAgo);
    const todayStr = formatDateParam(new Date());

    setThirtyDayData((prev) => {
      const next = { ...prev };
      THIRTY_DAY_TYPES.forEach((type) => {
        next[type] = { ...next[type], loading: true, error: null };
      });
      return next;
    });

    const trendRequests = THIRTY_DAY_TYPES.map((type) => ({
      type,
      promise: api.get(`/db/${type}/range`, {
        params: { start_date: thirtyDayStartStr, end_date: todayStr },
      }),
    }));

    Promise.allSettled(trendRequests.map((r) => r.promise)).then((results) => {
      results.forEach((result, index) => {
        const { type } = trendRequests[index];
        if (result.status === 'fulfilled') {
          const responseBody = result.value.data;
          const records = Array.isArray(responseBody?.data)
            ? responseBody.data
            : Array.isArray(responseBody)
              ? responseBody
              : [];
          setThirtyDayData((prev) => ({
            ...prev,
            [type]: { data: records, loading: false, error: null },
          }));
        } else {
          setThirtyDayData((prev) => ({
            ...prev,
            [type]: { data: [], loading: false, error: result.reason?.message || `Failed to fetch ${type} trend.` },
          }));
        }
      });
    });

    /* ── Fetch full month of activities ── */
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartStr = formatDateParam(monthStart);

    setMonthActivities((prev) => ({ ...prev, loading: true, error: null }));

    api
      .get('/db/activities/range', {
        params: { start_date: monthStartStr, end_date: todayStr },
      })
      .then((res) => {
        const responseBody = res.data;
        const records = Array.isArray(responseBody?.data)
          ? responseBody.data
          : Array.isArray(responseBody)
            ? responseBody
            : [];
        setMonthActivities({ data: records, loading: false, error: null });
      })
      .catch((err) => {
        setMonthActivities({
          data: [],
          loading: false,
          error: err.message || 'Failed to fetch monthly activities.',
        });
      });

    /* ── Start live data polling ── */
    fetchLive();
    pollIntervalRef.current = setInterval(fetchLive, POLL_INTERVAL_MS);

    /* ── Cleanup: clear polling interval on unmount ── */
    return () => {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchLive]);

  /* ───────────────────── Context Value ───────────────────── */

  /**
   * Memoized context value provided to all consumer components.
   *
   * @description
   * Assembles the complete dashboard state into a single object that is
   * passed as the `value` prop to `DashboardContext.Provider`. The object
   * is memoized with `useMemo` to prevent unnecessary re-renders in
   * consumer components when unrelated parent state changes.
   *
   * The value is recalculated whenever any of the constituent state
   * values change (live data, live metadata, historic data, previous
   * week data, or the refreshLive callback).
   *
   * @type {Object}
   * @property {Object} live - Live data state container.
   * @property {Object|null} live.data - The latest live data snapshot.
   * @property {number|null} live.lastUpdated - Timestamp of last successful fetch.
   * @property {boolean} live.loading - Whether a live fetch is in progress.
   * @property {string|null} live.error - Error message from the last failed fetch.
   * @property {Object} historic - Current week data keyed by data type.
   * @property {Object} previousWeek - Previous week data keyed by data type.
   * @property {boolean} isLoading - True if ANY data source is currently loading.
   * @property {number|null} lastUpdated - Alias for live.lastUpdated.
   * @property {Function} refreshLive - Triggers an immediate live data fetch.
   */
  const value = useMemo(() => {
    /**
     * Aggregate loading flag computed from all data sources.
     *
     * @description
     * Iterates over all live, historic, and previousWeek loading flags
     * and returns `true` if any one of them is `true`. This provides a
     * single boolean that consumers can use to display a global loading
     * indicator or skeleton screen.
     *
     * @type {boolean}
     */
    const isLoading =
      (liveLoading && liveData === null) ||
      DATA_TYPES.some((type) => historic[type]?.loading) ||
      DATA_TYPES.some((type) => previousWeek[type]?.loading);

    return {
      live: {
        data: liveData,
        lastUpdated: liveLastUpdated,
        loading: liveLoading,
        error: liveError,
      },
      historic,
      previousWeek,
      thirtyDayData,
      monthActivities,
      isLoading,
      lastUpdated: liveLastUpdated,
      refreshLive,
    };
  }, [liveData, liveLastUpdated, liveLoading, liveError, historic, previousWeek, thirtyDayData, monthActivities, refreshLive]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
