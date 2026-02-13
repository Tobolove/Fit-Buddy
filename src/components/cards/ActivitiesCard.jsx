import React, { useMemo } from 'react';
import { useDashboardData } from '../../hooks/useDashboardData';
import GlassCard from '../ui/GlassCard';
import { formatDuration, formatDistance } from '../../utils/formatters';
import { ACTIVITY_ICONS } from '../../utils/constants';

/**
 * ActivitiesCard is a full-width dashboard card that displays a horizontally
 * scrollable row of individual activity cards for the current week.
 *
 * @description
 * This component consumes activity data from two sources via the
 * `useDashboardData` hook:
 *
 *   1. **historicData.activities.data** -- an array of activity records for
 *      the current week. Each record contains:
 *      `date`, `activity_id`, `activity_name`, `activity_type`,
 *      `duration_seconds`, `distance_meters`, `calories`, `average_hr`,
 *      `max_hr`.
 *
 *   2. **liveData.activities** -- an object with `activity_count` (number)
 *      and `activities` (array of activity objects with the same fields).
 *      When present, live activities for today replace any historic
 *      activities from the same date, ensuring the freshest data is shown.
 *
 * **Merging strategy:**
 *
 * Historic activities are combined with live activities using a date-based
 * merge. Activities from `liveData.activities.activities` replace any
 * historic entries sharing the same `date` value (i.e., today's date).
 * The merged list is then sorted by `date` descending so that the most
 * recent activities appear first in the scroll row.
 *
 * **Layout:**
 *
 * A `flex gap-3 overflow-x-auto pb-2` container with a thin custom
 * scrollbar. Each activity is rendered as a compact card (`min-w-[240px]`,
 * `flex-shrink-0`) with:
 *   - Activity type icon (from `ACTIVITY_ICONS` constant) + name
 *   - Activity type badge in uppercase
 *   - 2-column stats grid: duration, distance (if > 0), calories, avg HR
 *     (if available)
 *
 * When no activities are available, an empty state message is displayed
 * in `text-white/30`.
 *
 * Design tokens:
 *   - Card accent:      #06b6d4 (cyan)
 *   - Activity card bg: #0a0a0f
 *   - Activity card border: #1e1e2e
 *   - Stats labels:     text-white/30
 *   - Stats values:     text-white, font-mono
 *
 * @component
 *
 * @returns {React.ReactElement} A `GlassCard` containing a horizontally
 *   scrollable row of activity cards or an empty state message.
 *
 * @example
 * // Full-width placement in a dashboard grid
 * <div className="grid grid-cols-2 gap-4">
 *   <div className="col-span-2">
 *     <ActivitiesCard />
 *   </div>
 * </div>
 */
const ActivitiesCard = () => {
  const { monthActivities, liveData, loading } = useDashboardData();

  /**
   * Merges monthly and live activity data into a single sorted array.
   *
   * @description
   * Builds the final activity list by combining the full month's
   * database records with today's live records:
   *
   * 1. Collects all monthly activities from
   *    `monthActivities.data` (defaults to an empty array).
   * 2. Collects all live activities from
   *    `liveData.activities.activities` (defaults to an empty array).
   * 3. Determines the set of dates present in the live data. Any monthly
   *    activities with a `date` value found in the live set are excluded
   *    (replaced by their live equivalents).
   * 4. Concatenates the filtered monthly activities with the live
   *    activities.
   * 5. Sorts the merged array by `date` descending so that the most
   *    recent activities appear first.
   *
   * The result is memoised on both data sources to avoid unnecessary
   * recalculation during React re-renders.
   *
   * @type {Array<Object>}
   */
  const activities = useMemo(() => {
    const monthly = Array.isArray(monthActivities?.data)
      ? monthActivities.data
      : [];
    const live = Array.isArray(liveData?.activities?.activities)
      ? liveData.activities.activities
      : [];

    /* Build a set of dates covered by live data so we can replace
       monthly entries for those dates with the live versions. */
    const liveDates = new Set(live.map((a) => a.date));
    const filteredMonthly = monthly.filter((a) => !liveDates.has(a.date));

    const merged = [...filteredMonthly, ...live];
    merged.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return b.date.localeCompare(a.date);
    });

    return merged;
  }, [monthActivities?.data, liveData?.activities?.activities]);

  return (
    <GlassCard title="Activities This Month" icon="" accentColor="#06b6d4" loading={loading}>
      {activities.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {activities.map((activity, index) => (
            <ActivityCard
              key={activity.activity_id || `activity-${index}`}
              activity={activity}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
};

/**
 * ActivityCard renders a single compact activity tile within the horizontal
 * scroll row of the ActivitiesCard.
 *
 * @description
 * Each tile displays the activity's type icon, name, type badge, and a
 * 2-column stats grid showing duration, distance (when > 0), calories,
 * and average heart rate (when available).
 *
 * The component determines the appropriate icon by looking up the
 * `activity_type` (lower-cased) in the `ACTIVITY_ICONS` constant map,
 * falling back to the `default` icon for unrecognised types.
 *
 * All numeric values are formatted using the shared utility functions
 * (`formatDuration`, `formatDistance`) and rendered in a monospace font
 * (`font-mono`) for consistent digit alignment.
 *
 * The tile is sized with `min-w-[240px]` and `flex-shrink-0` so that it
 * maintains a consistent width and triggers horizontal scrolling when
 * multiple activities overflow the container.
 *
 * Design tokens:
 *   - Tile background: #0a0a0f (page background)
 *   - Tile border:     #1e1e2e
 *   - Badge text:      text-white/30, 10px, uppercase
 *   - Stat labels:     text-white/30
 *   - Stat values:     text-white, font-mono
 *
 * @component
 *
 * @param {Object} props               - Component props.
 * @param {Object} props.activity      - A single activity record object.
 * @param {string} [props.activity.activity_name]   - Display name of the
 *   activity (e.g., "Morning Run").
 * @param {string} [props.activity.activity_type]   - Type identifier used
 *   to look up the icon (e.g., "running", "cycling").
 * @param {number} [props.activity.duration_seconds] - Duration in seconds.
 * @param {number} [props.activity.distance_meters]  - Distance in meters.
 * @param {number} [props.activity.calories]         - Energy expenditure.
 * @param {number} [props.activity.average_hr]       - Average heart rate
 *   in beats per minute.
 *
 * @returns {React.ReactElement} A compact card tile for one activity.
 *
 * @example
 * <ActivityCard
 *   activity={{
 *     activity_name: 'Morning Run',
 *     activity_type: 'running',
 *     duration_seconds: 1800,
 *     distance_meters: 5000,
 *     calories: 350,
 *     average_hr: 152,
 *   }}
 * />
 */
const ActivityCard = ({ activity }) => {
  const {
    activity_name,
    activity_type,
    duration_seconds,
    distance_meters,
    calories,
    average_hr,
    date,
    start_time,
    max_hr,
  } = activity;

  /**
   * Resolves the emoji icon for the given activity type.
   *
   * @description
   * Looks up the lower-cased `activity_type` string in the
   * `ACTIVITY_ICONS` constant map. If no match is found, returns the
   * `default` icon entry to ensure every activity always has a visual
   * identifier.
   *
   * @type {string}
   */
  const icon =
    ACTIVITY_ICONS[(activity_type || '').toLowerCase()] ||
    ACTIVITY_ICONS.default;

  /**
   * Formats the activity date into a readable string like "Feb 13" or
   * "Feb 13, 08:30" if start_time is available.
   *
   * @type {string}
   */
  const dateLabel = (() => {
    if (!date) return '';
    try {
      const d = new Date(date);
      const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (start_time) {
        const t = new Date(start_time);
        const time = t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${formatted}, ${time}`;
      }
      return formatted;
    } catch {
      return date;
    }
  })();

  return (
    <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 sm:p-4">
      {/* ── Header: icon + name + date ────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{icon}</span>
          <span className="text-sm text-white font-medium truncate">
            {activity_name || 'Activity'}
          </span>
        </div>
        {dateLabel && (
          <span className="text-[10px] text-white/30 font-mono whitespace-nowrap ml-2">
            {dateLabel}
          </span>
        )}
      </div>

      {/* ── Type badge ────────────────────────────────────────────── */}
      <span className="text-[10px] text-white/30 uppercase">
        {activity_type || 'unknown'}
      </span>

      {/* ── Stats grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
        {/* Duration */}
        <StatItem label="Duration" value={formatDuration(duration_seconds)} />

        {/* Distance (only if > 0) */}
        {distance_meters != null && distance_meters > 0 && (
          <StatItem label="Distance" value={formatDistance(distance_meters)} />
        )}

        {/* Calories */}
        <StatItem
          label="Calories"
          value={
            calories != null ? `${calories.toLocaleString('en-US')} cal` : '--'
          }
        />

        {/* Average HR (only if available) */}
        {average_hr != null && average_hr > 0 && (
          <StatItem label="Avg HR" value={`${average_hr} bpm`} />
        )}

        {/* Max HR (only if available) */}
        {max_hr != null && max_hr > 0 && (
          <StatItem label="Max HR" value={`${max_hr} bpm`} />
        )}
      </div>
    </div>
  );
};

/**
 * StatItem renders a single labelled stat value inside an ActivityCard's
 * 2-column stats grid.
 *
 * @description
 * A minimal helper component that displays a very small uppercase label
 * above a monospace value. It is used exclusively inside `ActivityCard`
 * to maintain consistent visual hierarchy for duration, distance, calories,
 * and heart rate statistics.
 *
 * @component
 *
 * @param {Object} props        - Component props.
 * @param {string} props.label  - The stat label text (e.g., "Duration",
 *                                "Calories"). Rendered in 10px uppercase
 *                                with white/30 colour.
 * @param {string} props.value  - The pre-formatted stat value string
 *                                (e.g., "1h 30m", "5.23 km", "350 cal").
 *                                Rendered in font-mono for digit alignment.
 *
 * @returns {React.ReactElement} A label-value pair element.
 *
 * @example
 * <StatItem label="Duration" value="1h 30m" />
 */
const StatItem = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-[10px] text-white/30 uppercase tracking-widest">
      {label}
    </span>
    <span className="text-sm font-mono text-white">{value}</span>
  </div>
);

/**
 * EmptyState renders a centred placeholder message when no activities
 * are available for the current week.
 *
 * @description
 * Displayed inside the ActivitiesCard when both historic and live
 * activity data arrays are empty. The message uses a muted `text-white/30`
 * style and generous padding to maintain the card's minimum height and
 * visual balance.
 *
 * @component
 *
 * @returns {React.ReactElement} A centred "No activities recorded" message.
 *
 * @example
 * // Used internally by ActivitiesCard
 * {activities.length === 0 ? <EmptyState /> : <ScrollRow />}
 */
const EmptyState = () => (
  <div className="flex items-center justify-center py-8">
    <span className="text-sm text-white/30">No activities recorded this month</span>
  </div>
);

export default ActivitiesCard;
