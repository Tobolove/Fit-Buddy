/**
 * @module hooks/useDashboardData
 *
 * @description
 * Provides a custom React hook for accessing the DashboardContext throughout
 * the Fit Buddy application. This hook is the recommended way to consume
 * dashboard data rather than calling `useContext(DashboardContext)` directly,
 * because it includes a runtime safety check that throws a descriptive error
 * if the hook is used outside of a `DashboardProvider`.
 *
 * The hook extracts and returns a flat, consumer-friendly interface from the
 * context value, making it easy for card components, charts, and other UI
 * elements to access exactly the data they need without understanding the
 * internal structure of the DashboardContext.
 *
 * This follows the "context with a guarded hook" pattern (consistent with
 * the project's `useAuth` hook) to prevent subtle bugs caused by components
 * silently receiving `undefined` or `null` context values when rendered
 * outside the provider tree.
 *
 * @example
 * import { useDashboardData } from '../hooks/useDashboardData';
 *
 * function StepsCard() {
 *   const { historicData, previousWeekData, isLoading } = useDashboardData();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   const steps = historicData.steps.data;
 *   const prevSteps = previousWeekData.steps.data;
 *   // ...render steps chart with week-over-week comparison
 * }
 *
 * @example
 * import { useDashboardData } from '../hooks/useDashboardData';
 *
 * function LiveIndicator() {
 *   const { liveData, lastUpdated, refreshLive } = useDashboardData();
 *
 *   return (
 *     <div>
 *       <span>Last updated: {new Date(lastUpdated).toLocaleTimeString()}</span>
 *       <button onClick={refreshLive}>Refresh</button>
 *     </div>
 *   );
 * }
 */

import { useContext } from 'react';
import { DashboardContext } from '../contexts/DashboardContext';

/**
 * Custom hook that returns the current dashboard data context value with
 * a consumer-friendly interface.
 *
 * @description
 * Retrieves the dashboard data context value from the nearest
 * `DashboardProvider` ancestor in the component tree and returns an object
 * with clearly named properties for each data domain:
 *
 * - `liveData` {Object}: The live data state container from the context.
 *   Contains `data` (the latest live snapshot or `null`), `lastUpdated`
 *   (timestamp of last successful fetch), `loading` (boolean indicating
 *   fetch in progress), and `error` (string message or `null`). This
 *   object is the raw `live` property from the DashboardContext.
 *
 * - `historicData` {Object}: The current week's health data, keyed by
 *   data type. Each key (steps, heartrate, sleep, stress, bodybattery,
 *   activities, healthmetrics) maps to an object with `data` (array of
 *   records), `loading` (boolean), and `error` (string or `null`).
 *   Corresponds to the `historic` property from the DashboardContext.
 *
 * - `previousWeekData` {Object}: The previous week's health data with
 *   the same shape as `historicData`. Used for week-over-week comparisons
 *   and trend percentage calculations. Corresponds to the `previousWeek`
 *   property from the DashboardContext.
 *
 * - `isLoading` {boolean}: Aggregate loading flag that is `true` when
 *   ANY data source (live, historic, or previous week) is still fetching.
 *   Useful for displaying global loading overlays or skeleton screens.
 *
 * - `lastUpdated` {number|null}: Timestamp (milliseconds since epoch) of
 *   the most recent successful live data fetch, or `null` if no live data
 *   has been fetched yet. Used for "last updated X ago" displays.
 *
 * - `refreshLive` {Function}: Callback function that triggers an immediate
 *   live data fetch, bypassing the regular polling interval. Returns a
 *   Promise that resolves when the fetch completes. Useful for manual
 *   refresh buttons and pull-to-refresh interactions.
 *
 * **Safety Check**: If this hook is called from a component that is NOT
 * a descendant of a `DashboardProvider`, it throws an error with a clear
 * message indicating the misconfiguration. This prevents silent failures
 * where components would receive `null` context values and produce
 * confusing runtime errors like "Cannot read properties of null".
 *
 * @function useDashboardData
 * @returns {{
 *   liveData: {
 *     data: Object|null,
 *     lastUpdated: number|null,
 *     loading: boolean,
 *     error: string|null
 *   },
 *   historicData: {
 *     steps: { data: Array, loading: boolean, error: string|null },
 *     heartrate: { data: Array, loading: boolean, error: string|null },
 *     sleep: { data: Array, loading: boolean, error: string|null },
 *     stress: { data: Array, loading: boolean, error: string|null },
 *     bodybattery: { data: Array, loading: boolean, error: string|null },
 *     activities: { data: Array, loading: boolean, error: string|null },
 *     healthmetrics: { data: Array, loading: boolean, error: string|null }
 *   },
 *   previousWeekData: {
 *     steps: { data: Array, loading: boolean, error: string|null },
 *     heartrate: { data: Array, loading: boolean, error: string|null },
 *     sleep: { data: Array, loading: boolean, error: string|null },
 *     stress: { data: Array, loading: boolean, error: string|null },
 *     bodybattery: { data: Array, loading: boolean, error: string|null },
 *     activities: { data: Array, loading: boolean, error: string|null },
 *     healthmetrics: { data: Array, loading: boolean, error: string|null }
 *   },
 *   isLoading: boolean,
 *   lastUpdated: number|null,
 *   refreshLive: () => Promise<void>
 * }} The dashboard data object containing all live, historic, and previous
 *   week data along with loading state and control methods.
 *
 * @throws {Error} Throws an error with the message "useDashboardData must
 *   be used within a DashboardProvider" if the hook is called outside the
 *   DashboardProvider component tree. This typically indicates a missing
 *   `<DashboardProvider>` wrapper around the dashboard component hierarchy.
 *
 * @example
 * // Access all data types for a weekly overview
 * function WeeklyOverview() {
 *   const { historicData, previousWeekData, isLoading } = useDashboardData();
 *
 *   if (isLoading) return <LoadingSkeleton />;
 *
 *   return (
 *     <div>
 *       {Object.entries(historicData).map(([type, { data }]) => (
 *         <MetricSummary key={type} type={type} data={data} />
 *       ))}
 *     </div>
 *   );
 * }
 *
 * @example
 * // Use live data with manual refresh
 * function DashboardHeader() {
 *   const { liveData, lastUpdated, refreshLive } = useDashboardData();
 *
 *   return (
 *     <header>
 *       <span>HR: {liveData?.data?.heartRate ?? '--'} bpm</span>
 *       <span>Updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}</span>
 *       <button onClick={refreshLive}>Refresh Now</button>
 *     </header>
 *   );
 * }
 */
export function useDashboardData() {
  const context = useContext(DashboardContext);

  if (context === null || context === undefined) {
    throw new Error(
      'useDashboardData must be used within a DashboardProvider. ' +
      'Ensure that your component tree is wrapped with <DashboardProvider> ' +
      'in the dashboard layout (typically in Dashboard.jsx).'
    );
  }

  return {
    liveData: context.live?.data ?? null,
    historicData: context.historic,
    previousWeekData: context.previousWeek,
    thirtyDayData: context.thirtyDayData,
    monthActivities: context.monthActivities,
    isLoading: context.isLoading,
    loading: context.isLoading,
    lastUpdated: context.lastUpdated,
    refreshLive: context.refreshLive,
  };
}
