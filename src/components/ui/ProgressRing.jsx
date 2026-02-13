import React, { useMemo } from 'react';

/**
 * ProgressRing renders an SVG circular progress indicator following the
 * Fit Buddy Material 3 dark-mode design system.
 *
 * Two concentric circles are drawn:
 *   1. A "track" circle with a muted stroke (#1e1e2e) representing the
 *      full range (0 to max).
 *   2. A "progress" circle whose visible arc length corresponds to the
 *      ratio `value / max`, rendered with the configurable `color` prop.
 *
 * The progress arc is animated via a CSS transition on `stroke-dashoffset`,
 * so changes to `value` produce a smooth sweep. Both circles use round
 * line caps for a polished finish.
 *
 * Optionally, a centre label is displayed. When `showValue` is true the
 * numeric value is rendered in a large monospace font; when `label` is
 * provided it appears below the value in a smaller muted style. These
 * are positioned using an SVG `<foreignObject>` so that standard CSS
 * text styling applies.
 *
 * Mathematical note:
 *   The SVG circles are rotated -90 degrees so that the arc starts at the
 *   12-o'clock position (top centre) rather than the default 3-o'clock.
 *
 * Design tokens used:
 *   - Track stroke:    #1e1e2e
 *   - Default colour:  #06b6d4 (cyan)
 *   - Value text:      white, monospace, semibold
 *   - Label text:      white/40, xs
 *
 * @component
 *
 * @param {Object}  props                        - Component props.
 * @param {number}  props.value                  - The current progress value.
 *                                                 Clamped internally between 0
 *                                                 and `max`.
 * @param {number}  props.max                    - The maximum value representing
 *                                                 a full circle. Must be greater
 *                                                 than zero.
 * @param {number}  [props.size=100]             - The width and height of the
 *                                                 SVG viewBox in pixels.
 * @param {number}  [props.strokeWidth=6]        - The thickness of both the
 *                                                 track and progress strokes.
 * @param {string}  [props.color='#06b6d4']      - CSS colour for the progress
 *                                                 arc stroke.
 * @param {string}  [props.label]                - Optional text rendered below
 *                                                 the numeric value inside the
 *                                                 ring (e.g. "kcal", "steps").
 * @param {boolean} [props.showValue=false]      - When true, the numeric
 *                                                 `value` is displayed in the
 *                                                 centre of the ring.
 *
 * @returns {React.ReactElement} The rendered ProgressRing SVG component.
 *
 * @example
 * // Simple progress ring at 75%
 * <ProgressRing value={75} max={100} color="#3b82f6" showValue />
 *
 * @example
 * // Calories ring with label
 * <ProgressRing
 *   value={1800}
 *   max={2500}
 *   size={120}
 *   strokeWidth={8}
 *   color="#14b8a6"
 *   label="kcal"
 *   showValue
 * />
 *
 * @example
 * // Minimal ring without centre text
 * <ProgressRing value={30} max={60} size={60} strokeWidth={4} />
 */
const ProgressRing = ({
  value,
  max,
  size = 100,
  strokeWidth = 6,
  color = '#06b6d4',
  label,
  showValue = false,
}) => {
  /**
   * Derived geometry values computed once per render via useMemo.
   *
   * - radius:        The circle radius, inset by half the stroke width so
   *                  the stroke does not clip outside the viewBox.
   * - circumference: The full circumference of the circle (2 * PI * r),
   *                  used as the base for strokeDasharray.
   * - offset:        The strokeDashoffset that hides the unfilled portion
   *                  of the progress arc.
   * - clampedValue:  The value clamped between 0 and max to avoid visual
   *                  overflow or negative arcs.
   */
  const { radius, circumference, offset } = useMemo(() => {
    const r = (size - strokeWidth) / 2;
    const c = 2 * Math.PI * r;
    const clamped = Math.min(Math.max(value, 0), max);
    const ratio = max > 0 ? clamped / max : 0;
    const o = c - ratio * c;
    return { radius: r, circumference: c, offset: o };
  }, [value, max, size, strokeWidth]);

  const centre = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="block"
    >
      {/* ── Track circle ─────────────────────────────────────────── */}
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        fill="none"
        stroke="#1e1e2e"
        strokeWidth={strokeWidth}
      />

      {/* ── Progress arc ─────────────────────────────────────────── */}
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transition: 'stroke-dashoffset 0.6s ease',
          transform: 'rotate(-90deg)',
          transformOrigin: '50% 50%',
        }}
      />

      {/* ── Centre text ──────────────────────────────────────────── */}
      {(showValue || label) && (
        <foreignObject x={0} y={0} width={size} height={size}>
          <div
            className="flex flex-col items-center justify-center h-full"
            xmlns="http://www.w3.org/1999/xhtml"
          >
            {showValue && (
              <span
                className="font-mono font-semibold text-white leading-none"
                style={{ fontSize: size * 0.22 }}
              >
                {value}
              </span>
            )}
            {label && (
              <span
                className="text-white/40 leading-none mt-0.5"
                style={{ fontSize: size * 0.11 }}
              >
                {label}
              </span>
            )}
          </div>
        </foreignObject>
      )}
    </svg>
  );
};

export default ProgressRing;
