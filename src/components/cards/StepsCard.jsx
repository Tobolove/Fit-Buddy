/**
 * @module components/cards/StepsCard
 *
 * @description
 * StepsCard is a dashboard card component that displays the user's daily step
 * activity data in a rich, multi-section layout following the Fit Buddy
 * Material 3 dark-mode design system.
 *
 * The card is divided into four visual sections (top to bottom):
 *
 *   1. **Progress ring** -- A circular progress indicator showing today's step
 *      count against the daily goal. The ring uses the cyan accent (#06b6d4)
 *      and is accompanied by the formatted step count in a large monospace
 *      font and a muted goal label below.
 *
 *   2. **Hourly bar chart** -- A Recharts BarChart (120px tall) that breaks
 *      down step activity hour-by-hour throughout the day. Each bar is colored
 *      cyan with 2px rounded top corners. The chart includes a minimal X-axis
 *      with hour labels and a dark-themed tooltip.
 *
 *   3. **Bottom stats row** -- Three compact MetricTile components showing
 *      Distance (formatted via `formatDistance`), Calories burned, and Floors
 *      climbed.
 *
 * Data is sourced from two places via the `useDashboardData` hook:
 *   - `historicData.steps.data`: An array of daily step record objects. Each
 *     record contains fields such as `date`, `total_steps`, `hourly_data`,
 *     `full_data`, `total_distance`, `total_calories`, etc. Today's data is
 *     typically the last element of this array.
 *   - `liveData.steps`: A flat object with real-time step data including
 *     `total_steps`, `daily_step_goal`, `hourly_data`, `total_distance`,
 *     and `total_calories`.
 *
 * When live data is available it takes precedence over historic data for the
 * current totals (steps, distance, calories), ensuring the display reflects
 * the most up-to-date values. Historic data is used as a fallback.
 *
 * The component handles null, undefined, and loading states gracefully using
 * optional chaining and fallback values throughout, so it never throws even
 * when data has not yet been fetched.
 *
 * Design tokens:
 *   - Card background:  #12121a  (via GlassCard)
 *   - Card border:      #1e1e2e  (via GlassCard)
 *   - Accent color:     #06b6d4  (cyan)
 *   - Chart bar fill:   #06b6d4
 *   - Tooltip bg:       #12121a
 *   - Tooltip border:   #1e1e2e
 *   - XAxis tick fill:  rgba(255,255,255,0.3)
 *
 * @example
 * // Used inside a dashboard grid layout
 * import StepsCard from './cards/StepsCard';
 *
 * function Dashboard() {
 *   return (
 *     <div className="grid grid-cols-2 gap-4">
 *       <StepsCard />
 *     </div>
 *   );
 * }
 */

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
import MetricTile from '../ui/MetricTile';
import ProgressRing from '../ui/ProgressRing';
import SparkBar from '../ui/SparkBar';
import { formatNumber, formatDistance } from '../../utils/formatters';
import { DEFAULT_STEP_GOAL } from '../../utils/constants';

/**
 * StepsCard renders a complete daily step activity card for the Fit Buddy
 * dashboard.
 *
 * @description
 * This functional component pulls step data from the `useDashboardData` hook,
 * resolves today's values from either live or historic sources, transforms
 * hourly step data into a chart-ready format, and renders all four visual
 * sections (progress ring, hourly bar chart, and bottom stats) within a
 * GlassCard wrapper.
 *
 * The hourly data transformation extracts the hour portion from each entry's
 * `startGMT` timestamp string and pairs it with the `steps` count, producing
 * an array of `{ hour, steps }` objects suitable for Recharts.
 *
 * @returns {React.ReactElement} The rendered StepsCard component wrapped in
 *   a GlassCard with title "Steps", icon, and cyan (#06b6d4) accent.
 *
 * @example
 * <StepsCard />
 */
const StepsCard = () => {
  const { historicData, liveData, thirtyDayData } = useDashboardData();

  /**
   * Resolve today's step record from historic data.
   *
   * The historic data array is ordered chronologically, so the last element
   * represents the most recent (typically today's) record. We use optional
   * chaining to safely handle cases where the data array is empty or
   * undefined.
   *
   * @type {Object|undefined}
   */
  const todayRecord = historicData?.steps?.data?.[
    (historicData?.steps?.data?.length ?? 1) - 1
  ];

  /**
   * The live step data object from the /api/live endpoint, if available.
   * Contains flat fields like total_steps, daily_step_goal, hourly_data, etc.
   *
   * @type {Object|undefined}
   */
  const live = liveData?.steps;

  /**
   * Resolved total step count for today. Prefers live data over historic.
   * Falls back to 0 if neither source is available.
   *
   * @type {number}
   */
  const totalSteps = live?.total_steps ?? todayRecord?.total_steps ?? 0;

  /**
   * The daily step goal. Sourced from live data if available, otherwise
   * falls back to the application-wide DEFAULT_STEP_GOAL constant (10,000).
   *
   * @type {number}
   */
  const stepGoal = live?.daily_step_goal ?? DEFAULT_STEP_GOAL;

  /**
   * Total distance covered today in meters. Used by MetricTile and
   * formatted via formatDistance.
   *
   * @type {number}
   */
  const totalDistance = live?.total_distance ?? todayRecord?.total_distance ?? 0;

  /**
   * Total calories burned today from step activity.
   *
   * @type {number}
   */
  const totalCalories = live?.total_calories ?? todayRecord?.total_calories ?? 0;

  /**
   * Total floors climbed today.
   *
   * @type {number}
   */
  const floors = live?.floors_ascended ?? live?.floors_climbed ?? todayRecord?.floors_climbed ?? 0;

  /**
   * Memoized transformation of raw hourly step data into a Recharts-ready
   * array of { hour, steps } objects.
   *
   * @description
   * The raw hourly_data is an array of objects, each containing at minimum
   * a `startGMT` timestamp string (e.g. "2024-01-15T14:00:00.0") and a
   * `steps` numeric field. This transformation:
   *
   *   1. Selects hourly_data from liveData first, then from the historic
   *      record, then from the historic record's full_data nested structure.
   *   2. Extracts the hour (0-23) from the startGMT timestamp by parsing
   *      the "T" separator and taking the hour portion.
   *   3. Returns an array of plain objects with `hour` (string) and `steps`
   *      (number) properties, suitable for Recharts BarChart consumption.
   *
   * If no hourly data is available, returns an empty array so the chart
   * renders nothing gracefully.
   *
   * @type {Array<{hour: string, steps: number}>}
   */
  const hourlyChartData = useMemo(() => {
    const rawHourly =
      live?.hourly_data ??
      todayRecord?.hourly_data ??
      todayRecord?.full_data?.steps?.hourly_data ??
      [];

    if (!Array.isArray(rawHourly) || rawHourly.length === 0) {
      return [];
    }

    return rawHourly.map((entry) => {
      let hour = '0';
      if (entry?.startGMT) {
        try {
          const date = new Date(entry.startGMT);
          hour = String(date.getHours());
        } catch {
          hour = '0';
        }
      }
      return {
        hour,
        steps: entry?.steps ?? 0,
      };
    });
  }, [live?.hourly_data, todayRecord]);

  return (
    <GlassCard title="Steps" icon="🚶" accentColor="#06b6d4">
      {/* ── Progress ring (centered) + Calories below ─────────────────── */}
      <div className="flex flex-col items-center mb-3">
        <ProgressRing
          value={totalSteps}
          max={10000}
          size={100}
          strokeWidth={7}
          color="#06b6d4"
          showValue
          label="steps"
        />
        <span className="font-mono text-lg font-semibold text-white mt-2">
          {formatNumber(totalCalories)} kcal
        </span>
        <span className="text-white/40 text-[10px] uppercase tracking-widest mt-0.5">
          Calories burned
        </span>
      </div>

      {/* ── Hourly bar chart ─────────────────────────────────────────── */}
      {hourlyChartData.length > 0 && (
        <div className="mb-3">
          <ResponsiveContainer width="100%" height={90}>
            <BarChart
              data={hourlyChartData}
              margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="hour"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#12121a',
                  border: '1px solid #1e1e2e',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                labelFormatter={(label) => `${label}:00`}
              />
              <Bar
                dataKey="steps"
                fill="#06b6d4"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Bottom stats row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <MetricTile
          label="Distance"
          value={formatDistance(totalDistance).split(' ')[0]}
          unit="km"
          color="#06b6d4"
        />
        <MetricTile
          label="Floors"
          value={floors}
          color="#06b6d4"
        />
      </div>

      {/* ── 30-day trend ───────────────────────────────────────────────── */}
      <SparkBar
        data={(thirtyDayData?.steps?.data ?? []).map((r) => ({
          date: r.date,
          value: r.total_steps ?? 0,
        }))}
        color="#06b6d4"
        label="Steps"
        unit="steps"
      />
    </GlassCard>
  );
};

export default StepsCard;
