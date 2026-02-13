import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

import { useDashboardData } from '../../hooks/useDashboardData';
import GlassCard from '../ui/GlassCard';
import ProgressRing from '../ui/ProgressRing';
import MetricTile from '../ui/MetricTile';
import SparkBar from '../ui/SparkBar';
import { formatDuration } from '../../utils/formatters';

/**
 * Sleep stage color and label configuration.
 * activityLevel mapping from Garmin: 0 = deep, 1 = light, 2 = REM, 3 = awake.
 *
 * @type {Object}
 * @constant
 */
const STAGE_CONFIG = {
  0: { label: 'Deep', color: '#312e81' },
  1: { label: 'Light', color: '#818cf8' },
  2: { label: 'REM', color: '#a78bfa' },
  3: { label: 'Awake', color: '#f59e0b' },
};

/**
 * Stage duration breakdown config for the stacked bar and legend.
 *
 * @type {Array<{key: string, label: string, color: string}>}
 * @constant
 */
const SLEEP_STAGES = [
  { key: 'deep_sleep_seconds', label: 'Deep', color: '#312e81' },
  { key: 'light_sleep_seconds', label: 'Light', color: '#818cf8' },
  { key: 'rem_sleep_seconds', label: 'REM', color: '#a78bfa' },
  { key: 'awake_seconds', label: 'Awake', color: '#f59e0b' },
];

/**
 * Determines the ProgressRing color based on the sleep score value.
 *
 * @param {number} score - The sleep score (0-100).
 * @returns {string} A CSS hex color string.
 */
function getSleepScoreColor(score) {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

/**
 * Custom tooltip for the sleep stages hypnogram.
 *
 * @param {Object} props - Recharts tooltip props.
 * @returns {React.ReactElement|null}
 */
const HypnogramTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;
  const stage = STAGE_CONFIG[entry.stage] || { label: '?', color: '#fff' };
  return (
    <div
      className="rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg"
      style={{ backgroundColor: '#12121a', border: '1px solid #1e1e2e' }}
    >
      <div className="text-white/40 mb-0.5">{entry.time}</div>
      <div className="font-mono font-medium" style={{ color: stage.color }}>
        {stage.label}
      </div>
    </div>
  );
};

/**
 * SleepCard renders a comprehensive sleep card with a hypnogram (sleep stages
 * timeline), sleep score, duration, stacked bar, additional metrics (HRV,
 * SpO2, respiration, body battery change), and a 30-day trend.
 *
 * @returns {React.ReactElement}
 */
const SleepCard = () => {
  const { historicData, liveData, thirtyDayData } = useDashboardData();

  const todayRecord = historicData?.sleep?.data?.[
    (historicData?.sleep?.data?.length ?? 1) - 1
  ];
  const live = liveData?.sleep;

  const sleepScore = live?.sleep_score ?? todayRecord?.sleep_score ?? 0;
  const sleepDurationSeconds =
    live?.sleep_duration_seconds ?? todayRecord?.sleep_duration_seconds ?? 0;

  const stages = useMemo(
    () => ({
      deep_sleep_seconds:
        live?.deep_sleep_seconds ?? todayRecord?.deep_sleep_seconds ?? 0,
      light_sleep_seconds:
        live?.light_sleep_seconds ?? todayRecord?.light_sleep_seconds ?? 0,
      rem_sleep_seconds:
        live?.rem_sleep_seconds ?? todayRecord?.rem_sleep_seconds ?? 0,
      awake_seconds:
        live?.awake_seconds ?? todayRecord?.awake_seconds ?? 0,
    }),
    [live, todayRecord]
  );

  const totalStageSeconds =
    stages.deep_sleep_seconds +
    stages.light_sleep_seconds +
    stages.rem_sleep_seconds +
    stages.awake_seconds;

  const ringColor = getSleepScoreColor(sleepScore);

  // Extra metrics from the enhanced live data
  const avgHrv = live?.avg_overnight_hrv ?? null;
  const hrvStatus = live?.hrv_status ?? null;
  const avgSpO2 = live?.average_spo2 ?? null;
  const avgRespiration = live?.average_respiration ?? null;
  const bbChange = live?.body_battery_change ?? null;
  const restingHr = live?.resting_heart_rate ?? null;

  /**
   * Transform sleepLevels into a hypnogram-ready dataset.
   * Garmin activityLevel: 0=deep, 1=light, 2=REM, 3=awake.
   * We invert for display: deep at bottom (0), awake at top (3).
   */
  const hypnogramData = useMemo(() => {
    const levels = live?.sleep_levels ?? [];
    if (!Array.isArray(levels) || levels.length === 0) return [];

    return levels.map((lvl) => {
      const startDate = new Date(lvl.startGMT);
      const hours = String(startDate.getHours()).padStart(2, '0');
      const mins = String(startDate.getMinutes()).padStart(2, '0');
      return {
        time: `${hours}:${mins}`,
        stage: lvl.activityLevel,
        // Invert: deep=3 (top visually means bottom of sleep), awake=0
        // Actually for sleep hypnogram, we show deep at bottom, awake at top
        // So stage value 0 (deep) should map to lowest, 3 (awake) to highest
        displayStage: lvl.activityLevel,
      };
    });
  }, [live?.sleep_levels]);

  /**
   * Custom Y-axis tick renderer for the hypnogram.
   */
  const stageTickFormatter = (val) => {
    const labels = { 0: 'Deep', 1: 'Light', 2: 'REM', 3: 'Awake' };
    return labels[val] ?? '';
  };

  return (
    <GlassCard title="Sleep" icon="🌙" accentColor="#6366f1">
      {/* ── Score ring (centered) + Duration below ──────────────────── */}
      <div className="flex flex-col items-center mb-3">
        <ProgressRing
          value={sleepScore}
          max={100}
          size={100}
          strokeWidth={7}
          color={ringColor}
          showValue
          label="score"
        />
        <span className="font-mono text-lg font-semibold text-white mt-2">
          {formatDuration(sleepDurationSeconds)}
        </span>
        <span className="text-white/40 text-[10px] uppercase tracking-widest mt-0.5">
          Total sleep
        </span>
      </div>

      {/* ── Sleep stages hypnogram ──────────────────────────────────── */}
      {hypnogramData.length > 0 && (
        <div className="mb-3">
          <span className="text-[9px] text-white/20 uppercase tracking-widest mb-1 block">
            Sleep stages
          </span>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart
              data={hypnogramData}
              margin={{ top: 4, right: 0, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="sleepStageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="33%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="66%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#312e81" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <YAxis
                domain={[0, 3]}
                ticks={[0, 1, 2, 3]}
                tickFormatter={stageTickFormatter}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 8 }}
                width={38}
              />
              <XAxis
                dataKey="time"
                tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 8 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip content={<HypnogramTooltip />} />
              <Area
                type="stepAfter"
                dataKey="displayStage"
                stroke="#818cf8"
                strokeWidth={1}
                fill="url(#sleepStageGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Horizontal stacked bar ────────────────────────────────────── */}
      <div className="h-3 rounded-full overflow-hidden flex bg-[#1e1e2e] mb-3">
        {SLEEP_STAGES.map((stage) => {
          const seconds = stages[stage.key] ?? 0;
          const widthPct =
            totalStageSeconds > 0
              ? (seconds / totalStageSeconds) * 100
              : 0;
          if (widthPct <= 0) return null;
          return (
            <div
              key={stage.key}
              className="h-full transition-all duration-500"
              style={{ width: `${widthPct}%`, backgroundColor: stage.color }}
            />
          );
        })}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
        {SLEEP_STAGES.map((stage) => {
          const seconds = stages[stage.key] ?? 0;
          return (
            <div key={stage.key} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-white/50 text-xs">{stage.label}</span>
              <span className="font-mono text-xs text-white/70 ml-auto">
                {formatDuration(seconds)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Extra metrics ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 mb-1">
        {avgHrv != null && (
          <MetricTile
            label="HRV"
            value={Math.round(avgHrv)}
            unit="ms"
            color="#38bdf8"
          />
        )}
        {avgSpO2 != null && (
          <MetricTile
            label="SpO2"
            value={Math.round(avgSpO2)}
            unit="%"
            color="#6366f1"
          />
        )}
        {avgRespiration != null && (
          <MetricTile
            label="Respiration"
            value={Math.round(avgRespiration)}
            unit="brpm"
            color="#14b8a6"
          />
        )}
      </div>

      {/* ── 30-day trend ───────────────────────────────────────────────── */}
      <SparkBar
        data={(thirtyDayData?.sleep?.data ?? []).map((r) => ({
          date: r.date,
          value: r.sleep_score ?? 0,
        }))}
        color="#6366f1"
        label="Score"
        fixedMax={100}
        fixedTicks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
      />
    </GlassCard>
  );
};

export default SleepCard;
