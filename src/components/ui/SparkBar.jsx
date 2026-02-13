import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

/**
 * SparkBar is a sleek 30-day trend bar chart designed for the bottom of
 * dashboard cards. It features subtle horizontal guide lines, a minimal
 * Y-axis scale, and a hover tooltip showing the date and value.
 *
 * @component
 *
 * @param {Object}   props                - Component props.
 * @param {Array<{date: string, value: number}>} props.data
 *   Array of daily records sorted chronologically. Each entry must have
 *   a `date` (YYYY-MM-DD string) and a numeric `value` field.
 * @param {string}   [props.color='#06b6d4']
 *   CSS colour for the bars. Accepts any valid CSS colour string.
 * @param {number}   [props.height=90]
 *   Height of the chart in pixels.
 * @param {string}   [props.unit='']
 *   Unit suffix displayed in the tooltip after the value (e.g. "bpm",
 *   "steps", "%").
 * @param {string}   [props.label='Value']
 *   Label displayed in the tooltip before the value.
 *
 * @returns {React.ReactElement|null} A minimal bar chart visualisation,
 *   or null if no data is provided.
 */
const SparkBar = ({
  data = [],
  color = '#06b6d4',
  height = 90,
  unit = '',
  label = 'Value',
  fixedMax = null,
  fixedTicks = null,
}) => {
  if (!data || data.length === 0) return null;

  /**
   * Compute nice Y-axis domain and tick values based on the data range,
   * or use fixed overrides when provided via `fixedMax` / `fixedTicks`.
   *
   * @description
   * When `fixedMax` and `fixedTicks` are provided, those values are used
   * directly — useful for metrics with a known 0-100 range (sleep score,
   * body battery, heart rate min, etc.). Otherwise calculates a rounded
   * max value and generates evenly spaced tick marks. For values under
   * 100, rounds to nearest 10; for values under 1000, rounds to nearest
   * 50; otherwise rounds to nearest 500.
   *
   * @type {{ yMax: number, yTicks: number[] }}
   */
  const { yMax, yTicks } = useMemo(() => {
    if (fixedMax != null && fixedTicks != null) {
      return { yMax: fixedMax, yTicks: fixedTicks };
    }

    const maxVal = Math.max(...data.map((d) => d.value ?? 0), 0);

    let niceMax;
    if (maxVal <= 0) {
      niceMax = 100;
    } else if (maxVal <= 100) {
      niceMax = Math.ceil(maxVal / 10) * 10;
    } else if (maxVal <= 1000) {
      niceMax = Math.ceil(maxVal / 50) * 50;
    } else if (maxVal <= 10000) {
      niceMax = Math.ceil(maxVal / 1000) * 1000;
    } else {
      niceMax = Math.ceil(maxVal / 5000) * 5000;
    }

    const step = Math.round(niceMax / 4);
    return {
      yMax: niceMax,
      yTicks: [0, step, step * 2, step * 3, niceMax],
    };
  }, [data, fixedMax, fixedTicks]);

  /**
   * Formats large Y-axis tick values into compact labels (e.g. 10000 → "10k").
   *
   * @param {number} val - The raw tick value.
   * @returns {string} A compact string representation of the value.
   */
  const formatYTick = (val) => {
    if (val >= 1000) return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
    return String(val);
  };

  return (
    <div className="mt-auto pt-3 border-t border-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] text-white/20 uppercase tracking-widest">
          30-day trend
        </span>
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barCategoryGap="12%"
            margin={{ top: 4, right: 2, left: -12, bottom: 0 }}
          >
            <CartesianGrid
              horizontal
              vertical={false}
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <YAxis
              domain={[0, yMax]}
              ticks={yTicks}
              tickFormatter={formatYTick}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.18)', fontSize: 9, fontFamily: 'monospace' }}
              width={32}
            />
            <Tooltip
              content={<SparkBarTooltip label={label} unit={unit} />}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={color}
                  fillOpacity={index === data.length - 1 ? 1 : 0.45}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/**
 * Custom tooltip for SparkBar that displays the date and value in a
 * compact dark-themed popup matching the Fit Buddy design system.
 *
 * @component
 *
 * @param {Object}  props          - Recharts tooltip props.
 * @param {boolean} props.active   - Whether the tooltip is visible.
 * @param {Array}   props.payload  - Data payload from Recharts.
 * @param {string}  props.label    - Metric label (e.g. "Steps").
 * @param {string}  props.unit     - Unit suffix (e.g. "bpm").
 *
 * @returns {React.ReactElement|null} The tooltip element or null.
 */
const SparkBarTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;

  const entry = payload[0]?.payload;
  if (!entry) return null;

  const dateStr = entry.date
    ? new Date(entry.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div
      className="rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg"
      style={{
        backgroundColor: '#12121a',
        border: '1px solid #1e1e2e',
      }}
    >
      <div className="text-white/40 mb-0.5">{dateStr}</div>
      <div className="text-white font-mono font-medium">
        {label}: {entry.value != null ? entry.value.toLocaleString() : '--'}
        {unit ? ` ${unit}` : ''}
      </div>
    </div>
  );
};

export default SparkBar;
