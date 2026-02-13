import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

import { useDashboardData } from '../../hooks/useDashboardData';
import GlassCard from '../ui/GlassCard';
import ProgressRing from '../ui/ProgressRing';
import SparkBar from '../ui/SparkBar';

/**
 * Determines the display color for a Body Battery value based on
 * threshold ranges.
 *
 * @param {number} value - The Body Battery charged value (0-100).
 * @returns {string} A CSS hex color string for the given energy level.
 */
function getBatteryColor(value) {
  if (value >= 60) return '#10b981';
  if (value >= 30) return '#f59e0b';
  return '#ef4444';
}

/**
 * Custom tooltip for the body battery intraday timeline chart.
 *
 * @param {Object} props - Recharts tooltip props.
 * @returns {React.ReactElement|null}
 */
const BatteryTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;
  const color = getBatteryColor(entry.value);
  return (
    <div
      className="rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg"
      style={{ backgroundColor: '#12121a', border: '1px solid #1e1e2e' }}
    >
      <div className="text-white/40 mb-0.5">{entry.time}</div>
      <div className="font-mono font-medium" style={{ color }}>
        {entry.value}
      </div>
    </div>
  );
};

/**
 * BodyBatteryCard renders a complete Body Battery energy card with a progress
 * ring, charged/drained stats, an intraday area chart showing battery level
 * throughout the day, and a 30-day trend.
 *
 * @returns {React.ReactElement}
 */
const BodyBatteryCard = () => {
  const { historicData, liveData, thirtyDayData } = useDashboardData();

  const todayRecord = historicData?.bodybattery?.data?.[
    (historicData?.bodybattery?.data?.length ?? 1) - 1
  ];
  const live = liveData?.body_battery;

  const charged = live?.charged ?? todayRecord?.charged ?? 0;
  const drained = live?.drained ?? todayRecord?.drained ?? 0;
  const gaugeColor = getBatteryColor(charged);

  /**
   * Transform the body battery intraday timeline (bodyBatteryValuesArray)
   * into Recharts-ready data. Each entry is [timestamp_ms, value].
   * Also merges sleepBodyBattery from sleep data for overnight detail.
   */
  const timelineData = useMemo(() => {
    // Primary source: body battery timeline from /api/live
    // Each entry is [timestamp_ms, value]
    const bbTimeline = live?.timeline ?? [];
    // Secondary source: overnight sleep body battery data
    // Each entry is { startGMT: "ISO string", value: number }
    const sleepBb = liveData?.sleep?.sleep_body_battery ?? [];

    // Merge both sources into a map keyed by epoch ms (numeric)
    const pointMap = new Map();

    // Add sleep body battery points (granular overnight data)
    if (Array.isArray(sleepBb)) {
      sleepBb.forEach((entry) => {
        if (entry && typeof entry.value === 'number' && entry.startGMT) {
          const d = new Date(entry.startGMT);
          const tsMs = d.getTime();
          if (!isNaN(tsMs)) {
            const key = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            pointMap.set(tsMs, { time: key, value: entry.value, ts: tsMs });
          }
        }
      });
    }

    // Add intraday body battery points (key transition points)
    if (Array.isArray(bbTimeline)) {
      bbTimeline.forEach((pair) => {
        if (Array.isArray(pair) && pair.length >= 2 && typeof pair[1] === 'number') {
          const tsMs = typeof pair[0] === 'number' ? pair[0] : new Date(pair[0]).getTime();
          if (!isNaN(tsMs)) {
            const d = new Date(tsMs);
            const key = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            pointMap.set(tsMs, { time: key, value: pair[1], ts: tsMs });
          }
        }
      });
    }

    if (pointMap.size === 0) return [];

    // Sort by numeric timestamp
    const sorted = Array.from(pointMap.values()).sort((a, b) => a.ts - b.ts);

    // If too many points (>100), sample every Nth
    if (sorted.length > 100) {
      const step = Math.ceil(sorted.length / 80);
      const sampled = sorted.filter((_, i) => i % step === 0);
      // Always include the last point
      if (sampled[sampled.length - 1] !== sorted[sorted.length - 1]) {
        sampled.push(sorted[sorted.length - 1]);
      }
      return sampled;
    }

    return sorted;
  }, [live?.timeline, liveData?.sleep?.sleep_body_battery]);

  return (
    <GlassCard title="Body Battery" icon="⚡" accentColor="#10b981">
      {/* ── Progress ring ─────────────────────────────────────────────── */}
      <div className="flex justify-center mb-3">
        <ProgressRing
          value={charged}
          max={100}
          size={100}
          strokeWidth={7}
          color={gaugeColor}
          label="Charged"
          showValue
        />
      </div>

      {/* ── Charged / Drained stats ──────────────────────────────────── */}
      <div className="flex justify-center gap-6 sm:gap-8 mb-3">
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm" style={{ color: '#10b981' }}>
              {'\u2191'}
            </span>
            <span className="text-[10px] text-white/30 uppercase tracking-widest">
              Charged
            </span>
          </div>
          <span
            className="font-mono text-lg font-semibold"
            style={{ color: '#10b981' }}
          >
            {charged}
          </span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm" style={{ color: '#f59e0b' }}>
              {'\u2193'}
            </span>
            <span className="text-[10px] text-white/30 uppercase tracking-widest">
              Drained
            </span>
          </div>
          <span
            className="font-mono text-lg font-semibold"
            style={{ color: '#f59e0b' }}
          >
            {drained}
          </span>
        </div>
      </div>

      {/* ── Intraday timeline chart ──────────────────────────────────── */}
      {timelineData.length > 0 && (
        <div className="mb-1">
          <span className="text-[9px] text-white/20 uppercase tracking-widest mb-1 block">
            Today
          </span>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart
              data={timelineData}
              margin={{ top: 4, right: 2, left: -12, bottom: 0 }}
            >
              <defs>
                <linearGradient id="bbGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                horizontal
                vertical={false}
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.18)', fontSize: 8, fontFamily: 'monospace' }}
                width={28}
              />
              <XAxis
                dataKey="time"
                tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 8 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip content={<BatteryTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={1.5}
                fill="url(#bbGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── 30-day trend ───────────────────────────────────────────────── */}
      <SparkBar
        data={(thirtyDayData?.bodybattery?.data ?? []).map((r) => ({
          date: r.date,
          value: r.charged ?? 0,
        }))}
        color="#10b981"
        label="Charged"
        fixedMax={100}
        fixedTicks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
      />
    </GlassCard>
  );
};

export default BodyBatteryCard;
