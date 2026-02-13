import React from 'react';

/**
 * LoadingSpinner renders a lightweight, CSS-only spinning circle indicator
 * for the Fit Buddy Material 3 dark-mode design system.
 *
 * The spinner is a transparent circle with a single visible top border
 * segment coloured in cyan (#06b6d4). The Tailwind `animate-spin` utility
 * rotates it continuously. The component accepts an optional `size` prop
 * to control its dimensions, defaulting to 24px.
 *
 * Because it uses only CSS borders and a Tailwind animation keyframe, the
 * spinner is extremely lightweight -- no SVG, no JavaScript timers, and no
 * external dependencies.
 *
 * Design tokens used:
 *   - Spinner colour: border-cyan-400 (#22d3ee / approx #06b6d4 family)
 *   - Animation:      animate-spin (360-degree linear infinite)
 *
 * @component
 *
 * @param {Object}  props              - Component props.
 * @param {number}  [props.size=24]    - The width and height of the spinner in
 *                                       pixels. Controls both the element
 *                                       dimensions and the border radius.
 * @param {string}  [props.className]  - Additional CSS class names appended to
 *                                       the spinner element for layout or
 *                                       spacing overrides.
 *
 * @returns {React.ReactElement} The rendered LoadingSpinner component.
 *
 * @example
 * // Default 24px spinner
 * <LoadingSpinner />
 *
 * @example
 * // Larger spinner with extra margin
 * <LoadingSpinner size={40} className="mx-auto my-8" />
 *
 * @example
 * // Tiny inline spinner next to text
 * <span className="flex items-center gap-2">
 *   <LoadingSpinner size={14} />
 *   Loading...
 * </span>
 */
const LoadingSpinner = ({ size = 24, className = '' }) => {
  return (
    <div
      className={`rounded-full border-2 border-transparent border-t-cyan-400 animate-spin ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
};

export default LoadingSpinner;
