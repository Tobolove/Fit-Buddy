import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { useDashboardData } from '../../hooks/useDashboardData';
import GlassCard from '../ui/GlassCard';
import MetricTile from '../ui/MetricTile';
import SparkBar from '../ui/SparkBar';
import { formatNumber } from '../../utils/formatters';
import { STRESS_COLORS } from '../../utils/constants';

/**
 * StressCard is a wide (2-column span) dashboard card that visualises the
 * user's daily stress distribution as a Recharts donut chart alongside
 * key stress metrics and a colour-coded minutes breakdown.
 *
 * @description
 * This component consumes stress data from two sources via the
 * `useDashboardData` hook:
 *
 *   1. **historicData.stress.data** -- an array of daily stress records, each
 *      containing `rest_minutes`, `low_stress_minutes`,
 *      `medium_stress_minutes`, `high_stress_minutes`, `average_stress`, and
 *      `max_stress`. The most recent record (last element) is used for display
 *      when live data is unavailable.
 *
 *   2. **liveData.stress** -- a flat object with the same fields, representing
 *      the current day's data streamed from `/api/live`. When present this
 *      takes precedence over historic data so the card always shows the
 *      freshest snapshot.
 *
 * **Layout** (responsive flex row / column):
 *
 * - **Left side** (`flex-1`): A `PieChart` rendered as a donut
 *   (`innerRadius=40`, `outerRadius=60`, `paddingAngle=2`). Four slices
 *   represent rest (green), low (cyan), medium (amber), and high (red)
 *   stress minutes. The average stress value is centred inside the donut
 *   using absolutely-positioned text. A custom horizontal legend sits below
 *   the chart with small coloured dots and category labels.
 *
 * - **Right side** (`flex-1`): Two `MetricTile` components for
 *   "Average Stress" and "Max Stress", followed by four horizontal
 *   colour-coded bars showing the minute breakdown for rest / low / medium /
 *   high categories. Each bar's width is proportional to its percentage
 *   share of total minutes.
 *
 * All null / undefined / zero values are handled gracefully -- the chart
 * renders an empty ring and text displays "--" when data is missing.
 *
 * Design tokens:
 *   - Card accent:  #f59e0b (amber, matching stress colour convention)
 *   - Rest colour:  #10b981 (emerald)
 *   - Low colour:   #06b6d4 (cyan)
 *   - Medium colour:#f59e0b (amber)
 *   - High colour:  #ef4444 (red)
 *   - Background:   #0a0a0f (page), #12121a (card via GlassCard)
 *   - Borders:      #1e1e2e
 *
 * @component
 *
 * @returns {React.ReactElement} A `GlassCard` containing the stress donut
 *   chart, metric tiles, and minute-breakdown bars.
 *
 * @example
 * // Rendered inside a CSS grid with col-span-2
 * <div className="grid grid-cols-2 gap-4">
 *   <StressCard />
 * </div>
 */
const StressCard = () => {
  const { historicData, liveData, thirtyDayData, loading } = useDashboardData();

  /**
   * Resolves the single stress data record to display.
   *
   * @description
   * Prefers `liveData.stress` (the real-time snapshot from the live API)
   * over the most recent entry in `historicData.stress.data` (the last
   * element of the persisted daily array). Falls back to an empty object
   * when neither source is available so that downstream destructuring
   * never throws.
   *
   * The result is memoised on referential identity of both data sources
   * to avoid unnecessary re-computation during React re-renders.
   *
   * @type {Object}
   */
  const stressData = useMemo(() => {
    if (liveData?.stress) return liveData.stress;
    const records = historicData?.stress?.data;
    if (Array.isArray(records) && records.length > 0) {
      return records[records.length - 1];
    }
    return {};
  }, [liveData?.stress, historicData?.stress?.data]);

  const {
    rest_minutes = 0,
    low_stress_minutes = 0,
    medium_stress_minutes = 0,
    high_stress_minutes = 0,
    average_stress = null,
    max_stress = null,
  } = stressData;

  /**
   * Constructs the Recharts-compatible pie data array and computes the
   * total minutes across all four stress categories.
   *
   * @description
   * Each element in the returned `pieData` array corresponds to one
   * stress category and carries a `name`, `value` (minutes), and `fill`
   * (hex colour) property. Categories with a value of zero are included
   * so that the Recharts `<Pie>` component retains a consistent data
   * shape; slices with zero width simply collapse.
   *
   * `totalMinutes` is the sum of all four categories and is used to
   * calculate percentage widths for the horizontal bar breakdown on the
   * right side of the card.
   *
   * Both values are memoised on the four minute fields to prevent
   * unnecessary recalculation.
   *
   * @type {{ pieData: Array<{name: string, value: number, fill: string}>, totalMinutes: number }}
   */
  const { pieData, totalMinutes } = useMemo(() => {
    const data = [
      { name: 'Rest', value: rest_minutes || 0, fill: STRESS_COLORS.rest },
      { name: 'Low', value: low_stress_minutes || 0, fill: STRESS_COLORS.low },
      { name: 'Medium', value: medium_stress_minutes || 0, fill: STRESS_COLORS.medium },
      { name: 'High', value: high_stress_minutes || 0, fill: STRESS_COLORS.high },
    ];
    const total = data.reduce((sum, d) => sum + d.value, 0);
    return { pieData: data, totalMinutes: total };
  }, [rest_minutes, low_stress_minutes, medium_stress_minutes, high_stress_minutes]);

  /**
   * Formats a raw minute value as a safe display string.
   *
   * @description
   * Returns the supplied value formatted with locale-aware thousand
   * separators via `formatNumber`, followed by the "min" suffix. If the
   * value is null or undefined the function returns "--" to indicate
   * missing data.
   *
   * @param {number|null|undefined} val - The minute value to format.
   * @returns {string} A display-ready string such as "120 min" or "--".
   */
  const safeVal = (val) => (val != null ? formatNumber(val) : '--');

  /**
   * Computes the percentage width of a stress category relative to the
   * total minutes, for use in the horizontal bar visualisation.
   *
   * @description
   * Returns a percentage string suitable for use as a CSS `width` value
   * (e.g., "42%"). When `totalMinutes` is zero (no data available) the
   * function returns "0%" to prevent division-by-zero errors and to
   * render all bars at zero width.
   *
   * @param {number} minutes - The number of minutes in the category.
   * @returns {string} A CSS-compatible percentage string.
   */
  const pct = (minutes) =>
    totalMinutes > 0 ? `${((minutes / totalMinutes) * 100).toFixed(0)}%` : '0%';

  return (
    <GlassCard title="Stress" icon="" accentColor="#f59e0b" loading={loading}>
      <div className="flex flex-col md:flex-row gap-4">
        {/* ── Left side: Donut chart ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center">
          <div className="relative w-full" style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* ── Centre label ──────────────────────────────────────── */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-mono text-2xl font-semibold text-white">
                {average_stress != null ? average_stress : '--'}
              </span>
              <span className="text-[10px] text-white/30 uppercase tracking-widest">
                avg stress
              </span>
            </div>
          </div>

          {/* ── Custom legend ──────────────────────────────────────── */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.fill }}
                />
                <span className="text-[10px] text-white/40">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right side: Metrics + bars ──────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Metric tiles */}
          <div className="grid grid-cols-2 gap-3">
            <MetricTile
              label="Average"
              value={average_stress != null ? average_stress : '--'}
              icon=""
              color="#f59e0b"
            />
            <MetricTile
              label="Max"
              value={max_stress != null ? max_stress : '--'}
              icon=""
              color="#ef4444"
            />
          </div>

          {/* Minute breakdown bars */}
          <div className="flex flex-col gap-2">
            <StressBar
              label="Rest"
              minutes={rest_minutes}
              color={STRESS_COLORS.rest}
              percentage={pct(rest_minutes)}
              displayValue={safeVal(rest_minutes)}
            />
            <StressBar
              label="Low"
              minutes={low_stress_minutes}
              color={STRESS_COLORS.low}
              percentage={pct(low_stress_minutes)}
              displayValue={safeVal(low_stress_minutes)}
            />
            <StressBar
              label="Medium"
              minutes={medium_stress_minutes}
              color={STRESS_COLORS.medium}
              percentage={pct(medium_stress_minutes)}
              displayValue={safeVal(medium_stress_minutes)}
            />
            <StressBar
              label="High"
              minutes={high_stress_minutes}
              color={STRESS_COLORS.high}
              percentage={pct(high_stress_minutes)}
              displayValue={safeVal(high_stress_minutes)}
            />
          </div>
        </div>
      </div>

      {/* ── 30-day trend ───────────────────────────────────────────────── */}
      <SparkBar
        data={(thirtyDayData?.stress?.data ?? []).map((r) => ({
          date: r.date,
          value: r.average_stress ?? 0,
        }))}
        color="#f59e0b"
        label="Avg Stress"
      />
    </GlassCard>
  );
};

/**
 * StressBar renders a single horizontal colour-coded progress bar with a
 * label on the left and a minute value on the right.
 *
 * @description
 * Used inside the StressCard's right-hand panel to visually represent how
 * many minutes were spent in each stress category (rest, low, medium,
 * high). The bar's filled width is driven by the `percentage` prop, and
 * its colour by the `color` prop, allowing each instance to match the
 * corresponding stress category's colour from `STRESS_COLORS`.
 *
 * The bar background uses `bg-white/5` for a subtle glass-like appearance
 * against the card's dark surface, while the filled portion uses a 20%
 * opacity variant of the category colour to maintain the muted dark-mode
 * aesthetic.
 *
 * @component
 *
 * @param {Object} props                 - Component props.
 * @param {string} props.label           - The stress category label (e.g.,
 *                                         "Rest", "Low", "Medium", "High").
 * @param {number} props.minutes         - Raw minute count (used only for
 *                                         key/identity; display uses
 *                                         `displayValue`).
 * @param {string} props.color           - CSS hex colour for the filled bar
 *                                         and label dot.
 * @param {string} props.percentage      - CSS-compatible width percentage
 *                                         string (e.g., "42%") for the
 *                                         filled portion.
 * @param {string} props.displayValue    - Pre-formatted minute string to
 *                                         show on the right side (e.g.,
 *                                         "120 min" or "--").
 *
 * @returns {React.ReactElement} A single horizontal stress bar row.
 *
 * @example
 * <StressBar
 *   label="Rest"
 *   minutes={420}
 *   color="#10b981"
 *   percentage="58%"
 *   displayValue="420 min"
 * />
 */
const StressBar = ({ label, minutes, color, percentage, displayValue }) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-[10px] text-white/40">{label}</span>
        </div>
        <span className="text-[10px] font-mono text-white/60">
          {displayValue} min
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: percentage,
            backgroundColor: color,
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
};

export default StressCard;
