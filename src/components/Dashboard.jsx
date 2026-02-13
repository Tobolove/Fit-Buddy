/**
 * @module components/Dashboard
 *
 * @description
 * The main dashboard layout component that serves as the top-level container
 * for the entire Fit Buddy health metrics dashboard. This component is
 * responsible for three key concerns:
 *
 * 1. **Data Provider Initialization**: Wraps the entire dashboard UI tree
 *    in the `DashboardProvider` context, which triggers all initial data
 *    fetching (14 parallel historic data requests + live data polling) the
 *    moment the dashboard mounts. This ensures that all descendant card
 *    components have access to the centralized data store.
 *
 * 2. **Layout Grid System**: Implements a responsive CSS Grid layout using
 *    Tailwind's grid utilities that adapts from a single-column layout on
 *    mobile devices to a full 4-column layout on extra-large screens:
 *    - `grid-cols-1`: Mobile (< 768px) - single column stack.
 *    - `md:grid-cols-2`: Tablet (768px+) - two columns.
 *    - `lg:grid-cols-3`: Desktop (1024px+) - three columns.
 *    - `xl:grid-cols-4`: Large desktop (1280px+) - four columns.
 *
 * 3. **Component Composition**: Arranges all dashboard card components in
 *    a structured visual hierarchy:
 *    - **Row 1** (full width): `WeeklyOverview` - a panoramic summary of
 *      the week's health data spanning all columns.
 *    - **Row 2** (4 equal cards): `StepsCard`, `HeartRateCard`, `SleepCard`,
 *      `BodyBatteryCard` - the primary health metric cards.
 *    - **Row 3** (2 wider cards): `StressCard` (2-col span) and
 *      `HealthMetricsCard` (2-col span) - secondary metrics that benefit
 *      from additional horizontal space for detailed charts.
 *    - **Row 4** (full width): `ActivitiesCard` - a full-width activity
 *      log spanning all columns.
 *
 * ### Design System
 * The dashboard follows the Material 3 dark mode aesthetic:
 * - Background: `#0a0a0f` (deep dark, near-black)
 * - Cards: `#12121a` (subtle elevation via color, not shadow)
 * - Borders: `#1e1e2e` (muted dividers)
 * - Accents: cyan `#06b6d4`, azure `#0ea5e9`, blue `#3b82f6`
 * - No shadows anywhere - clean, flat, techy appearance
 * - Monospace font for all numeric displays
 *
 * The maximum content width is capped at `1600px` and horizontally centered
 * to maintain readability on ultra-wide displays while still utilizing
 * screen real estate effectively.
 *
 * @example
 * // Used in App.jsx as the authenticated view
 * import Dashboard from './components/Dashboard';
 *
 * function App() {
 *   const { isAuthenticated } = useAuth();
 *   return isAuthenticated ? <Dashboard /> : <LoginPage />;
 * }
 */

import { DashboardProvider } from '../contexts/DashboardContext';
import DashboardHeader from './DashboardHeader';
import WeeklyOverview from './cards/WeeklyOverview';
import StepsCard from './cards/StepsCard';
import HeartRateCard from './cards/HeartRateCard';
import SleepCard from './cards/SleepCard';
import BodyBatteryCard from './cards/BodyBatteryCard';
import StressCard from './cards/StressCard';
import HealthMetricsCard from './cards/HealthMetricsCard';
import RunningGoalCard from './cards/RunningGoalCard';
import ActivitiesCard from './cards/ActivitiesCard';

/**
 * Dashboard component that renders the complete health metrics dashboard
 * wrapped in the DashboardProvider data context.
 *
 * @description
 * This is the primary view rendered for authenticated users. It composes
 * the full dashboard experience by:
 *
 * 1. Mounting the `DashboardProvider` at the top of the tree, which
 *    immediately begins fetching all historic and live data from the
 *    backend API. The provider makes this data available to every card
 *    component via the `useDashboardData` hook.
 *
 * 2. Rendering the `DashboardHeader` as a sticky top bar with the brand
 *    mark, live data indicator, user email, and logout button.
 *
 * 3. Rendering the main content area as a responsive grid that arranges
 *    the various health metric cards in an organized, visually balanced
 *    layout that scales gracefully from mobile to ultra-wide displays.
 *
 * ### Grid Layout Details
 *
 * The grid uses a `gap-3` (12px) gutter between all cards, with responsive
 * column counts:
 *
 * | Breakpoint | Columns | Card arrangement                        |
 * |------------|---------|----------------------------------------|
 * | < 768px    | 1       | All cards stacked vertically             |
 * | 768px+     | 2       | Cards pair up in two columns             |
 * | 1024px+    | 3       | Primary metrics fill 3 cols, wider cards span 2 |
 * | 1280px+    | 4       | Full 4-column layout as designed         |
 *
 * Cards that need more space use `col-span-full` (WeeklyOverview,
 * ActivitiesCard) or `lg:col-span-2` (StressCard, HealthMetricsCard)
 * to occupy multiple grid columns.
 *
 * ### Padding and Constraints
 * - Outer padding: `px-4` on mobile, `md:px-6` on tablet+.
 * - Vertical padding: `py-6` for breathing room below the header.
 * - Max width: `1600px` with auto horizontal margins for centering.
 * - Min height: `100vh` to ensure the background fills the viewport.
 *
 * @function Dashboard
 * @returns {React.ReactElement} The complete dashboard UI tree wrapped in
 *   the DashboardProvider context, containing the header and all metric
 *   card components arranged in a responsive grid layout.
 *
 * @example
 * // Direct usage (the provider is included internally)
 * <Dashboard />
 *
 * @example
 * // In the authentication gate pattern (App.jsx)
 * function App() {
 *   const { isAuthenticated } = useAuth();
 *   return isAuthenticated ? <Dashboard /> : <LoginPage />;
 * }
 */
function Dashboard() {
  return (
    <DashboardProvider>
      <div className="min-h-screen bg-[#0a0a0f]">
        <DashboardHeader />
        <main className="max-w-[1600px] mx-auto px-2 sm:px-4 md:px-6 py-3 sm:py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
            {/* Row 1: Weekly overview - full width */}
            <div className="col-span-full">
              <WeeklyOverview />
            </div>

            {/* Row 2: Primary metrics - one card per column */}
            <StepsCard />
            <HeartRateCard />
            <SleepCard />
            <BodyBatteryCard />

            {/* Row 3: Running Goal + Stress side by side */}
            <div className="sm:col-span-2 lg:col-span-2">
              <RunningGoalCard />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <StressCard />
            </div>

            {/* Row 4: Health Metrics - full width */}
            <div className="col-span-full">
              <HealthMetricsCard />
            </div>

            {/* Row 5: Activities - full width */}
            <div className="col-span-full">
              <ActivitiesCard />
            </div>
          </div>
        </main>
      </div>
    </DashboardProvider>
  );
}

export default Dashboard;
