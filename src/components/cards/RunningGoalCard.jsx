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

import { useDashboardData } from '../../hooks/useDashboardData';
import GlassCard from '../ui/GlassCard';
import ProgressRing from '../ui/ProgressRing';
import MetricTile from '../ui/MetricTile';

/**
 * Determines the accent colour for the running goal progress based on how
 * close the user is to being on-track for their monthly target.
 *
 * @param {number} pct - The percentage of the goal completed (0-100+).
 * @param {number} dayPct - The percentage of the month elapsed (0-100).
 * @returns {string} A CSS hex colour string: green if ahead/on-track,
 *   amber if slightly behind, red if significantly behind.
 */
function getGoalColor(pct, dayPct) {
  if (pct >= dayPct) return '#10b981';
  if (pct >= dayPct * 0.7) return '#f59e0b';
  return '#ef4444';
}

/**
 * Custom tooltip for the daily running distance bar chart.
 *
 * @param {Object} props - Recharts tooltip props.
 * @param {boolean} props.active - Whether the tooltip is active.
 * @param {Array} props.payload - Data payload from Recharts.
 * @returns {React.ReactElement|null} The tooltip or null.
 */
const RunTooltip = ({ active, payload }) => {
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
      style={{ backgroundColor: '#12121a', border: '1px solid #1e1e2e' }}
    >
      <div className="text-white/40 mb-0.5">{dateStr}</div>
      <div className="text-white font-mono font-medium">
        {entry.km.toFixed(1)} km
      </div>
      {entry.pace && (
        <div className="text-white/40 font-mono">
          {entry.pace} min/km
        </div>
      )}
    </div>
  );
};

/**
 * RunningGoalCard renders a monthly running distance tracker card that shows:
 *
 * - A progress ring visualising total km vs. the 100 km monthly goal.
 * - Key stats: km remaining, km/day needed, runs completed, avg pace.
 * - A bar chart of daily running distances throughout the month with a
 *   reference line showing the daily target to stay on track.
 * - An on-track / behind indicator so the user knows at a glance whether
 *   they need to ramp up or can cruise.
 *
 * Data is sourced from the `running_goal` section of the `/api/live`
 * endpoint, which fetches all running activities for the current month,
 * filters by type (road, trail, treadmill), and computes aggregates.
 *
 * @component
 * @returns {React.ReactElement} A GlassCard with the running goal tracker.
 */
const RunningGoalCard = () => {
  const { liveData } = useDashboardData();

  const rg = liveData?.running_goal;
  if (!rg || rg.error) return null;

  const {
    goal_km = 100,
    total_km = 0,
    remaining_km = 0,
    days_elapsed = 0,
    days_remaining = 0,
    days_in_month = 28,
    km_per_day_needed = 0,
    runs_count = 0,
    total_duration_seconds = 0,
    on_track = false,
    avg_km_per_run = 0,
    runs = [],
  } = rg;

  const pct = goal_km > 0 ? (total_km / goal_km) * 100 : 0;
  const dayPct = days_in_month > 0 ? (days_elapsed / days_in_month) * 100 : 0;
  const ringColor = getGoalColor(pct, dayPct);

  /**
   * Aggregate runs by date for the daily distance bar chart.
   * Multiple runs on the same date are summed.
   *
   * @type {Array<{date: string, km: number, pace: string|null}>}
   */
  const dailyData = useMemo(() => {
    if (!Array.isArray(runs) || runs.length === 0) return [];

    const byDate = {};
    runs.forEach((r) => {
      const d = r.date;
      if (!d) return;
      if (!byDate[d]) {
        byDate[d] = { date: d, km: 0, totalSec: 0, totalDist: 0 };
      }
      byDate[d].km += r.distance_km || 0;
      byDate[d].totalSec += r.duration_seconds || 0;
      byDate[d].totalDist += (r.distance_km || 0);
    });

    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        km: Math.round(d.km * 10) / 10,
        pace:
          d.totalDist > 0
            ? (d.totalSec / 60 / d.totalDist).toFixed(1)
            : null,
      }));
  }, [runs]);

  /** Daily target line: goal_km / days_in_month */
  const dailyTarget = goal_km > 0 && days_in_month > 0
    ? Math.round((goal_km / days_in_month) * 10) / 10
    : 0;

  /**
   * Average pace across all runs, formatted as min:sec per km.
   *
   * @type {string|null}
   */
  const avgPace = useMemo(() => {
    const totalDist = runs.reduce((s, r) => s + (r.distance_km || 0), 0);
    const totalSec = runs.reduce((s, r) => s + (r.duration_seconds || 0), 0);
    if (totalDist <= 0) return null;
    const paceMin = totalSec / 60 / totalDist;
    const mins = Math.floor(paceMin);
    const secs = Math.round((paceMin - mins) * 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, [runs]);

  return (
    <GlassCard title="Running Goal" icon={'\u{1F3C3}'} accentColor="#8b5cf6">
      <div className="flex flex-col md:flex-row gap-4 flex-1">
        {/* ── Left side: Progress ring + status ────────────────────────── */}
        <div className="flex-1 flex flex-col items-center">
          <ProgressRing
            value={Math.round(pct)}
            max={100}
            size={120}
            strokeWidth={8}
            color={ringColor}
            showValue
            label={`${total_km} km`}
          />
          <div className="flex items-center gap-2 mt-3">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: on_track ? '#10b981' : '#ef4444' }}
            />
            <span className="text-xs text-white/60 font-medium">
              {on_track ? 'On track' : 'Behind pace'}
            </span>
          </div>
          <span className="font-mono text-lg font-semibold text-white mt-1">
            {remaining_km.toFixed(1)} km left
          </span>
          <span className="text-white/40 text-xs">
            {days_remaining} days remaining
          </span>
        </div>

        {/* ── Right side: Metrics ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <MetricTile
              label="Need/day"
              value={km_per_day_needed.toFixed(1)}
              unit="km"
              color="#8b5cf6"
            />
            <MetricTile
              label="Runs"
              value={runs_count}
              color="#a78bfa"
            />
            <MetricTile
              label="Avg/run"
              value={avg_km_per_run.toFixed(1)}
              unit="km"
              color="#6366f1"
            />
            {avgPace && (
              <MetricTile
                label="Avg pace"
                value={avgPace}
                unit="/km"
                color="#818cf8"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Daily distance bar chart ──────────────────────────────────── */}
      {dailyData.length > 0 && (
        <div className="mt-auto pt-3 border-t border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] text-white/20 uppercase tracking-widest">
              Daily runs this month
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0 border-t border-dashed" style={{ borderColor: '#8b5cf6' }} />
              <span className="text-[9px] text-white/20">
                {dailyTarget} km/day
              </span>
            </div>
          </div>
          <div style={{ width: '100%', height: 100 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dailyData}
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
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: 'rgba(255,255,255,0.18)',
                    fontSize: 9,
                    fontFamily: 'monospace',
                  }}
                  width={28}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => {
                    const day = new Date(d).getDate();
                    return String(day);
                  }}
                  tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 8 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<RunTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <ReferenceLine
                  y={dailyTarget}
                  stroke="#8b5cf6"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  label={false}
                />
                <Bar dataKey="km" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {dailyData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.km >= dailyTarget ? '#8b5cf6' : '#6366f1'}
                      fillOpacity={index === dailyData.length - 1 ? 1 : 0.6}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </GlassCard>
  );
};

export default RunningGoalCard;
