import React, { useMemo } from 'react';

/**
 * GaugeChart renders a semicircular (180-degree) gauge indicator using SVG,
 * designed for the Fit Buddy Material 3 dark-mode aesthetic.
 *
 * The gauge consists of two arcs:
 *   1. A background arc (#1e1e2e) spanning the full 180 degrees.
 *   2. A foreground arc whose sweep angle is proportional to `value / 100`,
 *      rendered in the configurable `color`.
 *
 * Below the arcs, the numeric value is displayed in a large monospace font
 * at the centre of the semicircle, and the label text appears beneath it in
 * a muted white/40 style.
 *
 * The arcs are drawn as SVG `<path>` elements using the arc (`A`) command so
 * that stroke-linecap "round" produces clean rounded endpoints. The gauge
 * opens downward (like an upside-down "U") with the 0-point at the left and
 * the 100-point at the right.
 *
 * Design tokens used:
 *   - Background arc:  #1e1e2e
 *   - Default colour:  #06b6d4 (cyan)
 *   - Value text:      white, monospace, bold
 *   - Label text:      white/40, xs
 *
 * @component
 *
 * @param {Object}  props                   - Component props.
 * @param {number}  props.value             - A number between 0 and 100 representing
 *                                            the current gauge reading. Values outside
 *                                            this range are clamped internally.
 * @param {string}  [props.color='#06b6d4'] - CSS colour for the filled portion of
 *                                            the gauge arc.
 * @param {string}  [props.label]           - Descriptive text rendered below the
 *                                            numeric value (e.g. "Score", "Intensity").
 * @param {number}  [props.size=140]        - The overall width of the SVG in pixels.
 *                                            Height is automatically set to roughly
 *                                            60% of width to accommodate the
 *                                            semicircle plus the text area beneath.
 *
 * @returns {React.ReactElement} The rendered GaugeChart SVG component.
 *
 * @example
 * // Basic gauge at 72%
 * <GaugeChart value={72} label="Score" />
 *
 * @example
 * // Custom colour and size
 * <GaugeChart value={45} color="#3b82f6" label="Intensity" size={180} />
 *
 * @example
 * // Minimal gauge without label
 * <GaugeChart value={90} color="#14b8a6" size={100} />
 */
const GaugeChart = ({
  value,
  color = '#06b6d4',
  label,
  size = 140,
}) => {
  /**
   * Derived arc geometry. All calculations are memoised so they only
   * re-run when the inputs change.
   *
   * - clamped:        Value restricted to the [0, 100] range.
   * - strokeWidth:    Proportional to the overall size for visual balance.
   * - radius:         Arc radius inset so strokes do not clip.
   * - cx / cy:        Centre-point of the semicircle within the viewBox.
   * - backgroundArc:  SVG path "d" string for the full 180-degree track.
   * - valueArc:       SVG path "d" string for the filled sweep. When the
   *                   value is 0 this is an empty string (nothing drawn).
   *                   When the value is 100 the arc is nearly a full
   *                   semicircle (179.99 degrees to avoid SVG arc-flag
   *                   ambiguity).
   */
  const {
    clamped,
    strokeW,
    bgArcPath,
    valueArcPath,
    cx,
    cy,
    viewBoxWidth,
    viewBoxHeight,
  } = useMemo(() => {
    const c = Math.min(Math.max(value, 0), 100);
    const sw = size * 0.06;
    const r = (size - sw * 2) / 2;
    const centreX = size / 2;
    const centreY = size / 2;
    const vbW = size;
    const vbH = size * 0.6;

    /**
     * Converts a gauge percentage (0-100) into an (x, y) point on the
     * semicircular arc. The arc spans from 180 degrees (left) to
     * 0 degrees (right).
     *
     * @param {number} pct - Percentage along the arc (0 = left, 100 = right).
     * @returns {{x: number, y: number}} Cartesian coordinates.
     */
    const pointOnArc = (pct) => {
      const angleDeg = 180 - (pct / 100) * 180;
      const angleRad = (angleDeg * Math.PI) / 180;
      return {
        x: centreX + r * Math.cos(angleRad),
        y: centreY - r * Math.sin(angleRad),
      };
    };

    const start = pointOnArc(0);
    const end = pointOnArc(100);
    const bgPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;

    let valPath = '';
    if (c > 0) {
      const effectivePct = Math.min(c, 99.99);
      const valEnd = pointOnArc(effectivePct);
      const largeArc = effectivePct > 50 ? 1 : 0;
      valPath = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${valEnd.x} ${valEnd.y}`;
    }

    return {
      clamped: c,
      strokeW: sw,
      bgArcPath: bgPath,
      valueArcPath: valPath,
      cx: centreX,
      cy: centreY,
      viewBoxWidth: vbW,
      viewBoxHeight: vbH,
    };
  }, [value, size]);

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size * 0.6}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="block overflow-visible"
      >
        {/* ── Background arc (full semicircle) ───────────────────── */}
        <path
          d={bgArcPath}
          fill="none"
          stroke="#1e1e2e"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />

        {/* ── Value arc ──────────────────────────────────────────── */}
        {valueArcPath && (
          <path
            d={valueArcPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        )}

        {/* ── Centre value text ──────────────────────────────────── */}
        <text
          x={cx}
          y={cy - strokeW}
          textAnchor="middle"
          dominantBaseline="auto"
          className="font-mono font-bold fill-white"
          style={{ fontSize: size * 0.2 }}
        >
          {clamped}
        </text>

        {/* ── Label text below value ─────────────────────────────── */}
        {label && (
          <text
            x={cx}
            y={cy + size * 0.08}
            textAnchor="middle"
            dominantBaseline="hanging"
            className="fill-white/40"
            style={{ fontSize: size * 0.09 }}
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
};

export default GaugeChart;
