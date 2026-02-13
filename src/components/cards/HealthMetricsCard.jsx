import React, { useMemo } from 'react';
import { useDashboardData } from '../../hooks/useDashboardData';
import GlassCard from '../ui/GlassCard';
import MetricTile from '../ui/MetricTile';
import { formatNumber } from '../../utils/formatters';

/**
 * HealthMetricsCard is a full-width dashboard card that presents a responsive
 * grid of health metric tiles covering Fitness Age, HRV, Training Readiness,
 * Floors Climbed, SpO2, Respiration, and Cardio Intensity Minutes.
 *
 * @description
 * This component consumes health-metric data from two sources via the
 * `useDashboardData` hook:
 *
 *   1. **historicData.healthmetrics.data** -- an array of daily health
 *      metric records. Each record contains:
 *      `fitness_age`, `hrv_value`, `training_readiness`,
 *      `training_readiness_level`, `floors_climbed`, `average_spo2`,
 *      `lowest_spo2`, `average_respiration`, `lowest_respiration`,
 *      `intensity_minutes_cardio`, `intensity_minutes_anaerobic`.
 *      The most recent record (last array element) is used when live data
 *      is unavailable.
 *
 *   2. **liveData.health_metrics** -- a flat object with the same field
 *      names, representing real-time data from `/api/live`. When available,
 *      this takes precedence over historic data.
 *
 * **Layout:**
 *
 * A CSS grid of `MetricTile` components that renders 3 columns on large
 * screens (`lg:grid-cols-3`) and 2 columns on smaller screens
 * (`grid-cols-2`). Each tile displays a labelled value with an optional
 * unit suffix and an accent colour drawn from the design system palette
 * (cyan, azure, teal, blue).
 *
 * All null / undefined values are handled gracefully -- tiles display "--"
 * when a metric is not available.
 *
 * Design tokens:
 *   - Card accent:  #06b6d4 (cyan)
 *   - Metric colours: cyan (#06b6d4), azure (#0ea5e9), teal (#14b8a6),
 *     blue (#3b82f6)
 *
 * @component
 *
 * @returns {React.ReactElement} A `GlassCard` containing a responsive grid
 *   of `MetricTile` components for each health metric.
 *
 * @example
 * // Placed inside a CSS grid with col-span-full
 * <div className="grid grid-cols-4 gap-4">
 *   <div className="col-span-full"><HealthMetricsCard /></div>
 * </div>
 */
const HealthMetricsCard = () => {
  const { historicData, liveData, loading } = useDashboardData();

  /**
   * Resolves the single health-metrics record to display on the card.
   *
   * @description
   * Prefers `liveData.health_metrics` (the real-time snapshot from the
   * live API endpoint) over the most recent entry in
   * `historicData.healthmetrics.data` (the last element of the persisted
   * daily array). Falls back to an empty object when neither source is
   * available so that downstream destructuring never throws.
   *
   * The result is memoised on referential identity of both data sources
   * to avoid unnecessary re-computation during React re-renders.
   *
   * @type {Object}
   */
  const metrics = useMemo(() => {
    if (liveData?.health_metrics) return liveData.health_metrics;
    const records = historicData?.healthmetrics?.data;
    if (Array.isArray(records) && records.length > 0) {
      return records[records.length - 1];
    }
    return {};
  }, [liveData?.health_metrics, historicData?.healthmetrics?.data]);

  /**
   * Safely formats a metric value for display inside a MetricTile.
   *
   * @description
   * Returns the numeric value formatted with locale-aware thousand
   * separators (via `formatNumber`) when the value is a finite number.
   * Returns "--" for null, undefined, NaN, or any other non-numeric value
   * so that the UI always shows a consistent placeholder for missing data.
   *
   * @param {*} val - The value to format. Expected to be a number, null,
   *   or undefined.
   * @returns {string} A formatted number string or "--".
   */
  const safe = (val) =>
    val != null && isFinite(val) ? formatNumber(val) : '--';

  return (
    <GlassCard title="Health Metrics" icon="" accentColor="#06b6d4" loading={loading}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* ── Fitness Age ─────────────────────────────────────────── */}
        <MetricTile
          label="Fitness Age"
          value={safe(metrics.fitness_age)}
          color="#38bdf8"
        />

        {/* ── HRV ─────────────────────────────────────────────────── */}
        <MetricTile
          label="HRV"
          value={safe(metrics.hrv_value)}
          unit="ms"
          color="#14b8a6"
        />

        {/* ── Training Status ────────────────────────────────────── */}
        <MetricTile
          label="Training Status"
          value={metrics.training_readiness_level || safe(metrics.training_readiness)}
          color="#818cf8"
        />

        {/* ── Floors Climbed ──────────────────────────────────────── */}
        <MetricTile
          label="Floors Climbed"
          value={safe(metrics.floors_climbed)}
          color="#06b6d4"
        />

        {/* ── SpO2 ────────────────────────────────────────────────── */}
        <MetricTile
          label="SpO2"
          value={safe(metrics.average_spo2)}
          unit="%"
          color="#f472b6"
        />

        {/* ── Respiration ─────────────────────────────────────────── */}
        <MetricTile
          label="Respiration"
          value={safe(metrics.average_respiration)}
          unit="br/min"
          color="#a78bfa"
        />

        {/* ── Cardio Minutes ──────────────────────────────────────── */}
        <MetricTile
          label="Cardio Minutes"
          value={safe(metrics.intensity_minutes_cardio)}
          color="#fb923c"
        />
      </div>
    </GlassCard>
  );
};

export default HealthMetricsCard;
