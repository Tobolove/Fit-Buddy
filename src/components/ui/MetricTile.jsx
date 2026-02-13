import React from 'react';

/**
 * MetricTile is a compact, single-stat display component built for the
 * Fit Buddy Material 3 dark-mode design system.
 *
 * It presents a labelled numeric value with an optional unit suffix and an
 * optional trend indicator (up/down arrow with percentage). The value is
 * rendered in a monospace font to ensure consistent digit alignment when
 * multiple MetricTiles are placed side-by-side.
 *
 * Visual hierarchy (top to bottom):
 *   1. Small icon (emoji) + uppercase label in a very muted colour.
 *   2. Large monospace value with a smaller, muted unit suffix.
 *   3. Optional trend row showing a coloured arrow and a percentage.
 *
 * Design tokens used:
 *   - Label text:   text-white/30, 10px, uppercase, widest tracking
 *   - Value text:   text-white, monospace, xl, semibold (colour overridable)
 *   - Unit text:    text-white/40, smaller
 *   - Trend up:     #22c55e (green) with "↑"
 *   - Trend down:   #ef4444 (red) with "↓"
 *
 * @component
 *
 * @param {Object}          props                    - Component props.
 * @param {string}          props.label              - Short metric name displayed
 *                                                     above the value (e.g. "heart
 *                                                     rate", "distance").
 * @param {string|number}   props.value              - The primary numeric or string
 *                                                     value to display prominently.
 * @param {string}          [props.unit]             - An optional suffix rendered
 *                                                     next to the value in a
 *                                                     smaller, muted style (e.g.
 *                                                     "bpm", "km", "%").
 * @param {Object|null}     [props.trend=null]       - Optional trend indicator
 *                                                     object. When provided, a
 *                                                     coloured arrow and percentage
 *                                                     are rendered below the value.
 * @param {number}          props.trend.value        - The trend magnitude as a
 *                                                     number (displayed with a "%"
 *                                                     suffix).
 * @param {'up'|'down'}     props.trend.direction    - Determines the arrow glyph
 *                                                     and colour. "up" renders a
 *                                                     green "↑", "down" renders a
 *                                                     red "↓".
 * @param {string}          [props.icon]             - A small emoji or symbol
 *                                                     displayed before the label.
 * @param {string}          [props.color='#ffffff']  - CSS colour applied to the
 *                                                     large value text. Accepts any
 *                                                     valid CSS colour string.
 *
 * @returns {React.ReactElement} The rendered MetricTile component.
 *
 * @example
 * // Basic heart-rate metric
 * <MetricTile label="Heart Rate" value={72} unit="bpm" icon="❤️" color="#ef4444" />
 *
 * @example
 * // With upward trend
 * <MetricTile
 *   label="Steps"
 *   value="8,432"
 *   icon="🚶"
 *   trend={{ value: 12, direction: 'up' }}
 * />
 *
 * @example
 * // With downward trend
 * <MetricTile
 *   label="Resting HR"
 *   value={58}
 *   unit="bpm"
 *   icon="💓"
 *   color="#06b6d4"
 *   trend={{ value: 3, direction: 'down' }}
 * />
 */
const MetricTile = ({
  label,
  value,
  unit,
  trend = null,
  icon,
  color = '#ffffff',
}) => {
  return (
    <div className="flex flex-col gap-1">
      {/* ── Label row ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-xs">{icon}</span>}
        <span className="text-[10px] text-white/30 uppercase tracking-widest">
          {label}
        </span>
      </div>

      {/* ── Value + unit ────────────────────────────────────────────── */}
      <div className="flex items-baseline gap-1">
        <span
          className="font-mono text-base sm:text-xl font-semibold"
          style={{ color }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-white/40">{unit}</span>
        )}
      </div>

      {/* ── Trend indicator ─────────────────────────────────────────── */}
      {trend && <TrendIndicator trend={trend} />}
    </div>
  );
};

/**
 * TrendIndicator renders a small coloured arrow and percentage value to
 * communicate an upward or downward trend for a given metric.
 *
 * - Direction "up" uses green (#22c55e) with an upward arrow glyph "↑".
 * - Direction "down" uses red (#ef4444) with a downward arrow glyph "↓".
 *
 * The component is intentionally minimal so it can sit beneath the value
 * row inside a MetricTile without adding visual noise.
 *
 * @component
 *
 * @param {Object}        props                  - Component props.
 * @param {Object}        props.trend            - The trend data object.
 * @param {number}        props.trend.value      - Trend magnitude displayed with
 *                                                  a "%" suffix.
 * @param {'up'|'down'}   props.trend.direction  - Determines glyph and colour.
 *
 * @returns {React.ReactElement} A compact trend indicator row.
 */
const TrendIndicator = ({ trend }) => {
  const isUp = trend.direction === 'up';
  const trendColor = isUp ? '#22c55e' : '#ef4444';
  const arrow = isUp ? '↑' : '↓';

  return (
    <div className="flex items-center gap-1" style={{ color: trendColor }}>
      <span className="text-xs font-medium">{arrow}</span>
      <span className="text-[10px] font-mono font-medium">
        {trend.value}%
      </span>
    </div>
  );
};

export default MetricTile;
