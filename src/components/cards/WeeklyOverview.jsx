import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useDashboardData } from '../../hooks/useDashboardData';
import GlassCard from '../ui/GlassCard';
import { formatNumber, formatPercentChange } from '../../utils/formatters';

/**
 * WeeklyOverview is a full-width dashboard card placed at the top of the
 * page that provides a high-level comparison between the current week and
 * the previous week across five key metrics, plus a grouped bar chart of
 * daily step counts.
 *
 * @description
 * This component consumes data from the `useDashboardData` hook, reading
 * both `historicData` (all types for the current week) and
 * `previousWeekData` (all types for the prior week). It computes averages
 * and totals across each week's records and renders percentage-change
 * trend indicators so the user can quickly see whether their health
 * metrics are improving or declining week-over-week.
 *
 * **Data sources:**
 *
 * - `historicData.steps.data` -- current week daily step records.
 * - `historicData.sleep.data` -- current week daily sleep records.
 * - `historicData.heartrate.data` -- current week daily heart rate records.
 * - `historicData.stress.data` -- current week daily stress records.
 * - `historicData.activities.data` -- current week activity records.
 * - `previousWeekData.steps.data` -- prior week daily step records.
 * - `previousWeekData.sleep.data` -- prior week daily sleep records.
 * - `previousWeekData.heartrate.data` -- prior week heart rate records.
 * - `previousWeekData.stress.data` -- prior week daily stress records.
 * - `previousWeekData.activities.data` -- prior week activity records.
 *
 * **Layout (top to bottom):**
 *
 * 1. **Summary stat row** -- five evenly-spaced stat cells, each showing
 *    a label, a large monospace value, and a coloured trend arrow with
 *    percentage change:
 *      - Avg Steps (current vs previous week average `total_steps`)
 *      - Avg Sleep Score (current vs previous week average `sleep_score`)
 *      - Avg Resting HR (current vs previous week average `resting_hr`)
 *      - Avg Stress (current vs previous week average `average_stress`)
 *      - Total Activities (count of activities this week vs last week)
 *
 * 2. **Grouped bar chart** -- a Recharts `<BarChart>` (height 140)
 *    comparing daily step counts for each day of the week (Mon--Sun).
 *    Two bars per day: current week in solid cyan (#06b6d4) and previous
 *    week in a muted border colour (#1e1e2e).
 *
 * **Helper functions** (defined inside the module):
 *   - `calcAverage(dataArray, field)` -- arithmetic mean of a field.
 *   - `calcTotal(dataArray, field)` -- sum of a field.
 *   - `getDayLabel(dateStr)` -- short 3-letter English day name.
 *
 * All null / undefined / empty data arrays are handled gracefully, with
 * metrics falling back to 0 and the chart rendering empty bars.
 *
 * Design tokens:
 *   - Card accent:       #0ea5e9 (azure)
 *   - This-week bar:     #06b6d4 (cyan)
 *   - Last-week bar:     #1e1e2e (border colour)
 *   - Trend up:          #22c55e (green)
 *   - Trend down:        #ef4444 (red)
 *   - Tooltip bg:        #12121a
 *   - Tooltip border:    #1e1e2e
 *
 * @component
 *
 * @returns {React.ReactElement} A `GlassCard` containing the weekly
 *   comparison stats row and daily steps bar chart.
 *
 * @example
 * // Placed as the first item in the dashboard grid (full width)
 * <div className="grid grid-cols-2 gap-4">
 *   <div className="col-span-2">
 *     <WeeklyOverview />
 *   </div>
 * </div>
 */
const WeeklyOverview = () => {
  const { historicData, previousWeekData, loading } = useDashboardData();

  /* ──────────────────────────────────────────────────────────────────
   * Computed summary metrics
   * ────────────────────────────────────────────────────────────────── */

  /**
   * Computes the five summary statistics for the current and previous
   * weeks, along with their trend indicators.
   *
   * @description
   * Each statistic is built by calling `calcAverage` or `calcTotal` on
   * the relevant data array and field, then passing the current and
   * previous values through `formatPercentChange` to derive a trend
   * direction and percentage magnitude.
   *
   * The result is an array of five objects, each containing:
   * - `label` {string}: Uppercase label for the stat.
   * - `value` {string}: Formatted display value.
   * - `trend` {{ value: number, direction: 'up'|'down' }}: Trend data
   *   suitable for the TrendIndicator rendering below the value.
   *
   * Memoised on the full `historicData` and `previousWeekData` references
   * to avoid expensive recomputation.
   *
   * @type {Array<{ label: string, value: string, trend: { value: number, direction: 'up'|'down' } }>}
   */
  const summaryStats = useMemo(() => {
    const thisSteps = safeArray(historicData?.steps?.data);
    const prevSteps = safeArray(previousWeekData?.steps?.data);

    const thisSleep = safeArray(historicData?.sleep?.data);
    const prevSleep = safeArray(previousWeekData?.sleep?.data);

    const thisHR = safeArray(historicData?.heartrate?.data);
    const prevHR = safeArray(previousWeekData?.heartrate?.data);

    const thisStress = safeArray(historicData?.stress?.data);
    const prevStress = safeArray(previousWeekData?.stress?.data);

    const thisActivities = safeArray(historicData?.activities?.data);
    const prevActivities = safeArray(previousWeekData?.activities?.data);

    const avgStepsCurr = calcAverage(thisSteps, 'total_steps');
    const avgStepsPrev = calcAverage(prevSteps, 'total_steps');

    const avgSleepCurr = calcAverage(thisSleep, 'sleep_score');
    const avgSleepPrev = calcAverage(prevSleep, 'sleep_score');

    const avgHRCurr = calcAverage(thisHR, 'resting_hr');
    const avgHRPrev = calcAverage(prevHR, 'resting_hr');

    const avgStressCurr = calcAverage(thisStress, 'average_stress');
    const avgStressPrev = calcAverage(prevStress, 'average_stress');

    const totalActCurr = thisActivities.length;
    const totalActPrev = prevActivities.length;

    return [
      {
        label: 'Avg Steps',
        value: formatNumber(Math.round(avgStepsCurr)),
        trend: formatPercentChange(avgStepsCurr, avgStepsPrev),
      },
      {
        label: 'Avg Sleep Score',
        value: formatNumber(Math.round(avgSleepCurr)),
        trend: formatPercentChange(avgSleepCurr, avgSleepPrev),
      },
      {
        label: 'Avg Resting HR',
        value: formatNumber(Math.round(avgHRCurr)),
        trend: formatPercentChange(avgHRCurr, avgHRPrev),
      },
      {
        label: 'Avg Stress',
        value: formatNumber(Math.round(avgStressCurr)),
        trend: formatPercentChange(avgStressCurr, avgStressPrev),
      },
      {
        label: 'Total Activities',
        value: formatNumber(totalActCurr),
        trend: formatPercentChange(totalActCurr, totalActPrev),
      },
    ];
  }, [historicData, previousWeekData]);

  /* ──────────────────────────────────────────────────────────────────
   * Bar chart data
   * ────────────────────────────────────────────────────────────────── */

  /**
   * Builds the Recharts-compatible data array for the grouped daily
   * steps bar chart comparing the current week against the previous week.
   *
   * @description
   * Creates a 7-element array (Mon through Sun). For each day index:
   *
   * 1. Derives the expected day label using a fixed day-name array.
   * 2. Looks up the matching record from `thisSteps` and `prevSteps`
   *    by converting each record's `date` to a day-of-week index and
   *    matching it to the current iteration.
   * 3. Falls back to 0 when no matching record exists (e.g., future
   *    days in an incomplete week).
   *
   * The result is an array of objects shaped for Recharts:
   *   `{ day: string, thisWeek: number, lastWeek: number }`
   *
   * Memoised on both step data sources.
   *
   * @type {Array<{ day: string, thisWeek: number, lastWeek: number }>}
   */
  const chartData = useMemo(() => {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const thisSteps = safeArray(historicData?.steps?.data);
    const prevSteps = safeArray(previousWeekData?.steps?.data);

    /**
     * Maps an array of step records into a lookup keyed by short day name.
     *
     * @description
     * Iterates over the records, converts each `date` field into a short
     * day name via `getDayLabel`, and stores the `total_steps` value.
     * If multiple records share the same day name (unlikely but possible
     * with duplicate data), the later record wins.
     *
     * @param {Array<Object>} records - Array of step record objects,
     *   each expected to have `date` and `total_steps` fields.
     * @returns {Object<string, number>} A map from day name (e.g., "Mon")
     *   to step count.
     */
    const buildDayMap = (records) => {
      const map = {};
      records.forEach((r) => {
        if (r.date) {
          const dayLabel = getDayLabel(r.date);
          map[dayLabel] = r.total_steps || 0;
        }
      });
      return map;
    };

    const thisMap = buildDayMap(thisSteps);
    const prevMap = buildDayMap(prevSteps);

    return dayNames.map((day) => ({
      day,
      thisWeek: thisMap[day] || 0,
      lastWeek: prevMap[day] || 0,
    }));
  }, [historicData?.steps?.data, previousWeekData?.steps?.data]);

  return (
    <GlassCard title="Weekly Overview" icon="" accentColor="#0ea5e9" loading={loading}>
      {/* ── Summary stat row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {summaryStats.map((stat) => (
          <SummaryStat
            key={stat.label}
            label={stat.label}
            value={stat.value}
            trend={stat.trend}
          />
        ))}
      </div>

      {/* ── Daily steps bar chart ─────────────────────────────────── */}
      <div style={{ width: '100%', height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2} barCategoryGap="20%">
            <XAxis
              dataKey="day"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                backgroundColor: '#12121a',
                border: '1px solid #1e1e2e',
                borderRadius: 8,
                fontSize: 12,
                color: '#ffffff',
              }}
              itemStyle={{ color: '#ffffff' }}
              labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar
              dataKey="thisWeek"
              name="This Week"
              fill="#06b6d4"
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="lastWeek"
              name="Last Week"
              fill="#1e1e2e"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
};

/* ════════════════════════════════════════════════════════════════════════
 * Helper sub-components
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * SummaryStat renders a single summary metric cell within the
 * WeeklyOverview's top stat row.
 *
 * @description
 * Each cell displays three vertically-stacked elements:
 *   1. A tiny uppercase label (10px, white/30, widest tracking).
 *   2. A large monospace value (xl, semibold, white).
 *   3. A coloured trend arrow with percentage (green for up, red for down).
 *
 * The cell is centred (`text-center`, `flex-1`) so that five cells
 * distribute evenly across the card width. On narrow screens the flex
 * container wraps, and each cell retains its centre alignment.
 *
 * @component
 *
 * @param {Object}  props            - Component props.
 * @param {string}  props.label      - The stat label (e.g., "Avg Steps").
 * @param {string}  props.value      - The formatted display value.
 * @param {Object}  props.trend      - Trend data from `formatPercentChange`.
 * @param {number}  props.trend.value     - Absolute percentage change.
 * @param {'up'|'down'} props.trend.direction - Trend direction.
 *
 * @returns {React.ReactElement} A single stat cell element.
 *
 * @example
 * <SummaryStat
 *   label="Avg Steps"
 *   value="8,432"
 *   trend={{ value: 12.5, direction: 'up' }}
 * />
 */
const SummaryStat = ({ label, value, trend }) => {
  const isUp = trend?.direction === 'up';
  const trendColor = isUp ? '#22c55e' : '#ef4444';
  const arrow = isUp ? '\u2191' : '\u2193';

  return (
    <div className="text-center">
      <span className="text-[10px] text-white/30 uppercase tracking-widest block">
        {label}
      </span>
      <span className="font-mono text-lg sm:text-xl font-semibold text-white block mt-1">
        {value}
      </span>
      {trend && (
        <span
          className="text-[10px] font-mono font-medium inline-flex items-center gap-0.5 mt-1"
          style={{ color: trendColor }}
        >
          {arrow} {trend.value}%
        </span>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
 * Pure helper functions
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * Safely coerces a value into an array.
 *
 * @description
 * Returns the input unchanged if it is already an `Array`. Otherwise
 * returns an empty array. This is used as a guard before calling array
 * methods (`reduce`, `length`, `forEach`) on data that may be null,
 * undefined, or an unexpected type when the API response is incomplete
 * or the hook has not yet resolved.
 *
 * @param {*} val - The value to coerce.
 * @returns {Array} The original array, or an empty array.
 *
 * @example
 * safeArray([1, 2, 3]);   // [1, 2, 3]
 * safeArray(null);         // []
 * safeArray(undefined);    // []
 * safeArray("string");     // []
 */
function safeArray(val) {
  return Array.isArray(val) ? val : [];
}

/**
 * Calculates the arithmetic mean of a numeric field across an array of
 * record objects.
 *
 * @description
 * Iterates over `dataArray`, extracts the value at `field` from each
 * record, filters out null / undefined / NaN entries, and returns the
 * mean of the remaining values. Returns 0 when the array is empty or
 * contains no valid values for the requested field.
 *
 * This function is used to compute weekly averages for steps, sleep
 * scores, resting heart rate, and stress levels.
 *
 * @param {Array<Object>} dataArray - Array of record objects. Each record
 *   is expected to have a numeric property matching `field`.
 * @param {string} field - The property name to average (e.g.,
 *   "total_steps", "sleep_score", "resting_hr", "average_stress").
 * @returns {number} The arithmetic mean of valid values, or 0.
 *
 * @example
 * calcAverage([{ steps: 10000 }, { steps: 8000 }], 'steps'); // 9000
 * calcAverage([], 'steps');                                   // 0
 * calcAverage([{ steps: null }], 'steps');                    // 0
 */
function calcAverage(dataArray, field) {
  if (!dataArray || dataArray.length === 0) return 0;
  const valid = dataArray.filter(
    (r) => r[field] != null && isFinite(r[field])
  );
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, r) => acc + Number(r[field]), 0);
  return sum / valid.length;
}

/**
 * Calculates the sum of a numeric field across an array of record objects.
 *
 * @description
 * Iterates over `dataArray`, extracts the value at `field` from each
 * record, and returns the cumulative sum. Null, undefined, and NaN values
 * are treated as 0 to prevent the total from becoming NaN.
 *
 * This function is used to compute weekly totals for metrics like
 * calories burned or total active minutes.
 *
 * @param {Array<Object>} dataArray - Array of record objects. Each record
 *   is expected to have a numeric property matching `field`.
 * @param {string} field - The property name to sum (e.g., "calories",
 *   "intensity_minutes_cardio").
 * @returns {number} The sum of all valid values, or 0.
 *
 * @example
 * calcTotal([{ cal: 300 }, { cal: 450 }], 'cal'); // 750
 * calcTotal([], 'cal');                            // 0
 * calcTotal([{ cal: null }, { cal: 200 }], 'cal'); // 200
 */
function calcTotal(dataArray, field) {
  if (!dataArray || dataArray.length === 0) return 0;
  return dataArray.reduce((acc, r) => {
    const val = r[field];
    return acc + (val != null && isFinite(val) ? Number(val) : 0);
  }, 0);
}

/**
 * Converts a date string into a short 3-letter English day name.
 *
 * @description
 * Parses the input `dateStr` using the `Date` constructor, extracts the
 * day-of-week index (0 = Sunday through 6 = Saturday), and maps it to
 * the corresponding 3-letter abbreviation ("Sun", "Mon", "Tue", etc.).
 *
 * Returns "--" if the input is null, undefined, or cannot be parsed into
 * a valid date.
 *
 * This function uses the **ISO week convention** where Monday is the
 * first day of the week, matching the bar chart's XAxis layout.
 *
 * @param {string} dateStr - A date string parseable by the `Date`
 *   constructor (typically "YYYY-MM-DD" format).
 * @returns {string} A 3-letter day name (e.g., "Mon", "Tue") or "--".
 *
 * @example
 * getDayLabel('2024-01-15'); // "Mon"
 * getDayLabel('2024-01-20'); // "Sat"
 * getDayLabel(null);         // "--"
 * getDayLabel('invalid');    // "--"
 */
function getDayLabel(dateStr) {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '--';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

export default WeeklyOverview;
