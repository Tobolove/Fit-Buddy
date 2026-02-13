import React from 'react';

/**
 * GlassCard is a reusable card wrapper component designed for the Fit Buddy
 * application's Material 3 dark-mode design system.
 *
 * It renders a dark card container (#12121a) with a subtle border (#1e1e2e),
 * a configurable 1px accent line along the top edge, an optional header row
 * with icon + title on the left and an arbitrary ReactNode on the right, and
 * a body area that renders children. When the `loading` prop is true the body
 * is replaced with three animated skeleton bars that pulse to indicate data
 * is being fetched.
 *
 * Design tokens used:
 *   - Card background:  #12121a
 *   - Card border:      #1e1e2e
 *   - Default accent:   #06b6d4 (cyan)
 *   - Skeleton bars:    bg-white/5 with animate-pulse
 *
 * @component
 *
 * @param {Object}    props                - Component props.
 * @param {string}    [props.title]        - Header text displayed in uppercase
 *                                           with letter-spacing. If omitted the
 *                                           header row is not rendered.
 * @param {string}    [props.icon]         - An emoji or short string rendered to
 *                                           the left of the title.
 * @param {string}    [props.accentColor='#06b6d4'] - CSS colour value applied as
 *                                           the background of the 1px top accent
 *                                           line. Accepts any valid CSS colour
 *                                           string (hex, rgb, hsl, named, etc.).
 * @param {string}    [props.className]    - Additional CSS class names appended
 *                                           to the outermost wrapper div for
 *                                           layout or spacing overrides.
 * @param {React.ReactNode} props.children - The content rendered inside the card
 *                                           body area beneath the header.
 * @param {boolean}   [props.loading=false] - When true, replaces children with
 *                                            three animated skeleton placeholder
 *                                            bars to communicate a loading state.
 * @param {React.ReactNode} [props.headerRight] - Optional ReactNode rendered on
 *                                           the right side of the header row.
 *                                           Useful for action buttons, badges, or
 *                                           secondary info.
 *
 * @returns {React.ReactElement} The rendered GlassCard component.
 *
 * @example
 * // Basic usage with title and icon
 * <GlassCard title="Heart Rate" icon="❤️">
 *   <p>72 bpm</p>
 * </GlassCard>
 *
 * @example
 * // Custom accent colour and header-right action
 * <GlassCard
 *   title="Steps"
 *   icon="🚶"
 *   accentColor="#3b82f6"
 *   headerRight={<button>Details</button>}
 * >
 *   <p>8,432 steps</p>
 * </GlassCard>
 *
 * @example
 * // Loading skeleton state
 * <GlassCard title="Sleep" icon="🌙" loading>
 *   {/* children are replaced by skeleton bars *\/}
 * </GlassCard>
 */
const GlassCard = ({
  title,
  icon,
  accentColor = '#06b6d4',
  className = '',
  children,
  loading = false,
  headerRight,
}) => {
  return (
    <div
      className={`bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden flex flex-col h-full ${className}`}
    >
      {/* ── Top accent line ─────────────────────────────────────────── */}
      <div
        className="h-[1px] w-full"
        style={{ backgroundColor: accentColor }}
      />

      {/* ── Header row ──────────────────────────────────────────────── */}
      {title && (
        <div className="flex justify-between items-center px-3 sm:px-5 pt-3 sm:pt-4 pb-1">
          <div className="flex items-center gap-2">
            {icon && <span className="text-sm">{icon}</span>}
            <span className="text-xs sm:text-sm text-white/60 uppercase tracking-wider">
              {title}
            </span>
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-5 pt-2 sm:pt-3 flex-1 flex flex-col">
        {loading ? (
          <SkeletonBody />
        ) : (
          children
        )}
      </div>
    </div>
  );
};

/**
 * SkeletonBody renders three horizontal bars with a pulsing animation to
 * serve as a placeholder while card content is loading.
 *
 * Each bar is slightly shorter than the previous one to give a natural,
 * staggered look that hints at textual content being loaded.
 *
 * @component
 * @returns {React.ReactElement} Three animated skeleton bars.
 */
const SkeletonBody = () => {
  return (
    <div className="space-y-3">
      <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
      <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
      <div className="h-4 bg-white/5 rounded animate-pulse w-1/2" />
    </div>
  );
};

export default GlassCard;
