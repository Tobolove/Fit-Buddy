/**
 * @module components/cards/HeartRateCard
 *
 * @description
 * HeartRateCard is a dashboard card component that visualizes the user's
 * heart rate data throughout the day, following the Fit Buddy Material 3
 * dark-mode design system.
 *
 * The card is divided into two main visual sections:
 *
 *   1. **Heart rate timeline chart** -- A Recharts AreaChart (130px tall)
 *      that plots heart rate values over the course of the day. The area
 *      uses a red gradient fill (20% opacity fading to transparent) with a
 *      thin red stroke (#ef4444). Invalid readings (-1, 0) are filtered out,
 *      and only every 5th data point is plotted to reduce visual clutter and
 *      improve rendering performance on high-frequency HR data. The chart
 *      includes a minimal X-axis with time labels and a dark-themed tooltip.
 *
 *   2. **Metric tiles grid** -- A 2x2 grid of four MetricTile components
 *      displaying Resting HR, Average HR, Max HR, and Min HR, each with a
 *      red-family color for visual consistency with the heart rate theme.
 *
 * Data is sourced from two places via the `useDashboardData` hook:
 *   - `historicData.heartrate.data`: An array of daily heart rate records.
 *     Each record contains `date`, `resting_hr`, `average_hr`, `max_hr`,
 *     `min_hr`, and `full_data` (which nests `heart_rate.heartRateValues`).
 *   - `liveData.heart_rate`: A flat object with `resting_hr`, `average_hr`,
 *     `max_hr`, `min_hr`, and `heart_rate_values` (an array of
 *     [timestamp_ms, hr_value] pairs).
 *
 * Live data takes precedence over historic data for both the chart timeline
 * and the summary metrics.
 *
 * The component gracefully handles null, undefined, and loading states using
 * optional chaining and fallback values throughout. When no HR values are
 * available, the chart section is simply not rendered.
 *
 * Design tokens:
 *   - Card background:   #12121a  (via GlassCard)
 *   - Card border:       #1e1e2e  (via GlassCard)
 *   - Accent color:      #ef4444  (red)
 *   - Area stroke:       #ef4444
 *   - Area gradient:     #ef4444 at 20% to transparent
 *   - Tooltip bg:        #12121a
 *   - Tooltip border:    #1e1e2e
 *   - XAxis tick fill:   rgba(255,255,255,0.3)
 *
 * @example
 * import HeartRateCard from './cards/HeartRateCard';
 *
 * function Dashboard() {
 *   return (
 *     <div className="grid grid-cols-2 gap-4">
 *       <HeartRateCard />
 *     </div>
 *   );
 * }
 */

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { useDashboardData } from '../../hooks/useDashboardData';
import GlassCard from '../ui/GlassCard';
import ProgressRing from '../ui/ProgressRing';
import MetricTile from '../ui/MetricTile';
import SparkBar from '../ui/SparkBar';

/**
 * HeartRateCard renders a complete daily heart rate card for the Fit Buddy
 * dashboard, including an area chart timeline and summary metric tiles.
 *
 * @description
 * This functional component pulls heart rate data from the `useDashboardData`
 * hook, resolves today's values from either live or historic sources,
 * transforms heart rate value pairs into a chart-ready format (with sampling
 * and filtering), and renders the timeline chart and 2x2 metric grid within
 * a GlassCard wrapper.
 *
 * The heart rate values transformation pipeline:
 *   1. Select raw values from liveData or historicData's full_data.
 *   2. Filter out invalid entries where the HR value is -1 or 0.
 *   3. Sample every 5th data point to reduce density.
 *   4. Convert each [timestamp_ms, hr_value] pair to a { time, hr } object
 *      where `time` is formatted as "HH:MM".
 *
 * @returns {React.ReactElement} The rendered HeartRateCard component wrapped
 *   in a GlassCard with title "Heart Rate", icon, and red (#ef4444) accent.
 *
 * @example
 * <HeartRateCard />
 */
const HeartRateCard = () => {
  const { historicData, liveData, thirtyDayData } = useDashboardData();

  /**
   * Resolve today's heart rate record from historic data.
   *
   * The historic data array is ordered chronologically so the last element
   * represents the most recent (typically today's) record.
   *
   * @type {Object|undefined}
   */
  const todayRecord = historicData?.heartrate?.data?.[
    (historicData?.heartrate?.data?.length ?? 1) - 1
  ];

  /**
   * The live heart rate data object from the /api/live endpoint.
   *
   * @type {Object|undefined}
   */
  const live = liveData?.heart_rate;

  /**
   * Resting heart rate for today in beats per minute.
   * Prefers live data, falls back to historic, then to '--'.
   *
   * @type {number|string}
   */
  const restingHr = live?.resting_hr ?? todayRecord?.resting_hr ?? '--';

  /**
   * Average heart rate for today in beats per minute.
   *
   * @type {number|string}
   */
  const averageHr = live?.average_hr ?? todayRecord?.average_hr ?? '--';

  /**
   * Maximum heart rate recorded today in beats per minute.
   *
   * @type {number|string}
   */
  const maxHr = live?.max_hr ?? todayRecord?.max_hr ?? '--';

  /**
   * Minimum heart rate recorded today in beats per minute.
   *
   * @type {number|string}
   */
  const minHr = live?.min_hr ?? todayRecord?.min_hr ?? '--';

  /**
   * Determines the ProgressRing colour for the resting/min heart rate.
   * Lower resting HR is generally better for fitness, so green for low
   * values and red for high values.
   *
   * @param {number} hr - The heart rate value.
   * @returns {string} A CSS hex colour string.
   */
  const getHrColor = (hr) => {
    if (typeof hr !== 'number') return '#ef4444';
    if (hr <= 60) return '#10b981';
    if (hr <= 75) return '#f59e0b';
    return '#ef4444';
  };

  const ringColor = getHrColor(typeof minHr === 'number' ? minHr : 0);

  /**
   * Memoized transformation of raw heart rate value pairs into a
   * Recharts-ready array of { time, hr } objects.
   *
   * @description
   * The raw heart rate values can come from two sources:
   *   - `liveData.heart_rate.heart_rate_values`: Array of [timestamp_ms, hr_value].
   *   - `historicData full_data.heart_rate.heartRateValues`: Same format.
   *
   * The transformation pipeline:
   *   1. Selects the first available data source using nullish coalescing.
   *   2. Filters out invalid readings where the HR value is less than or
   *      equal to 0 (Garmin uses -1 to indicate no reading).
   *   3. Samples every 5th point to reduce chart density. High-frequency
   *      HR data (every 15 seconds) produces thousands of points per day,
   *      which would overwhelm the SVG renderer. Sampling every 5th point
   *      retains the visual trend while keeping the DOM light.
   *   4. Maps each surviving [timestamp_ms, hr_value] pair to a plain
   *      object with:
   *      - `time` {string}: Formatted as "HH:MM" using zero-padded hours
   *        and minutes extracted from the timestamp.
   *      - `hr` {number}: The heart rate value in beats per minute.
   *
   * Returns an empty array if no heart rate data is available, causing the
   * chart to not render.
   *
   * @type {Array<{time: string, hr: number}>}
   */
  const hrChartData = useMemo(() => {
    const rawValues =
      live?.heart_rate_values ??
      todayRecord?.full_data?.heart_rate?.heartRateValues ??
      [];

    if (!Array.isArray(rawValues) || rawValues.length === 0) {
      return [];
    }

    return rawValues
      .filter((pair) => {
        const hrValue = Array.isArray(pair) ? pair[1] : pair?.hr ?? pair?.value;
        return hrValue != null && hrValue > 0;
      })
      .filter((_, index) => index % 5 === 0)
      .map((pair) => {
        const timestamp = Array.isArray(pair) ? pair[0] : pair?.timestamp;
        const hrValue = Array.isArray(pair) ? pair[1] : pair?.hr ?? pair?.value;
        const date = new Date(timestamp);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return {
          time: `${hours}:${minutes}`,
          hr: hrValue,
        };
      });
  }, [live?.heart_rate_values, todayRecord]);

  /**
   * Unique identifier for the SVG gradient definition used by the area fill.
   * This avoids conflicts if multiple HeartRateCards are rendered on the page.
   *
   * @type {string}
   */
  const gradientId = 'hrGradient';

  return (
    <GlassCard title="Heart Rate" icon={'\u2764\uFE0F'} accentColor="#ef4444">
      {/* ── Progress ring (centered) + Average HR below ─────────────── */}
      <div className="flex flex-col items-center mb-3">
        <ProgressRing
          value={typeof minHr === 'number' ? minHr : 0}
          max={100}
          size={100}
          strokeWidth={7}
          color={ringColor}
          showValue
          label="Min HR"
        />
        <span className="font-mono text-lg font-semibold text-white mt-2">
          {averageHr} bpm
        </span>
        <span className="text-white/40 text-[10px] uppercase tracking-widest mt-0.5">
          Average HR
        </span>
      </div>

      {/* ── Heart rate timeline area chart ────────────────────────────── */}
      {hrChartData.length > 0 && (
        <div className="mb-3">
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart
              data={hrChartData}
              margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
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
                cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                formatter={(value) => [`${value} bpm`, 'Heart Rate']}
              />
              <Area
                type="monotone"
                dataKey="hr"
                stroke="#ef4444"
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Metric tiles ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <MetricTile
          label="Resting HR"
          value={restingHr}
          unit="bpm"
          color="#ef4444"
        />
        <MetricTile
          label="Max HR"
          value={maxHr}
          unit="bpm"
          color="#f87171"
        />
      </div>

      {/* ── 30-day trend ───────────────────────────────────────────────── */}
      <SparkBar
        data={(thirtyDayData?.heartrate?.data ?? []).map((r) => ({
          date: r.date,
          value: r.min_hr ?? 0,
        }))}
        color="#ef4444"
        label="Min HR"
        unit="bpm"
        fixedMax={100}
        fixedTicks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
      />
    </GlassCard>
  );
};

export default HeartRateCard;
