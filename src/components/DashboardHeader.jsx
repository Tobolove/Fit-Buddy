/**
 * @module components/DashboardHeader
 *
 * @description
 * Renders the top navigation bar of the Fit Buddy dashboard. This component
 * serves as the persistent header that remains visible at all times via
 * sticky positioning, providing the user with brand identity, live data
 * status, account information, and a logout control.
 *
 * The header follows the Material 3 dark mode design system with the
 * application's signature color palette:
 * - Background: #0a0a0f (deep dark)
 * - Borders: #1e1e2e (subtle dark dividers)
 * - Accents: cyan (#06b6d4), azure (#0ea5e9), blue (#3b82f6)
 * - No shadows (clean, flat aesthetic)
 * - Monospace numbers for data readability
 *
 * The header is divided into two main sections:
 *
 * **Left Section**: The Fit Buddy brand mark consisting of the application
 * name in semibold white text accompanied by a small cyan accent dot,
 * creating a minimal but distinctive logo treatment.
 *
 * **Right Section**: Three functional elements arranged horizontally:
 * 1. A live data indicator with an animated pulsing dot (green/cyan) that
 *    shows real-time connection status, the word "Live", and the timestamp
 *    of the most recent data update.
 * 2. The authenticated user's email address displayed in subdued text.
 * 3. A logout button with a subtle border treatment and hover effect.
 *
 * Below the header content, a thin gradient accent line (cyan to blue to
 * transparent) provides a clean visual separator from the dashboard content
 * below.
 *
 * @example
 * import DashboardHeader from './components/DashboardHeader';
 *
 * function Dashboard() {
 *   return (
 *     <div>
 *       <DashboardHeader />
 *       <main>...</main>
 *     </div>
 *   );
 * }
 */

import { useAuth } from '../hooks/useAuth';
import { useDashboardData } from '../hooks/useDashboardData';

/**
 * Formats a millisecond timestamp into a human-readable relative time string.
 *
 * @description
 * Takes a timestamp (milliseconds since epoch) and calculates the elapsed
 * time between that timestamp and the current moment. Returns a compact
 * string describing how long ago the event occurred.
 *
 * The function uses the following thresholds:
 * - Less than 60 seconds: "just now"
 * - 1-59 minutes: "{n}m ago" (e.g., "3m ago")
 * - 60+ minutes: "{n}h ago" (e.g., "2h ago")
 *
 * If the input is `null`, `undefined`, or otherwise falsy, the function
 * returns the string "never" to indicate that no update has occurred.
 *
 * @function formatLastUpdated
 * @param {number|null} timestamp - The timestamp in milliseconds since
 *   epoch (e.g., from `Date.now()`). Pass `null` if no update has occurred.
 * @returns {string} A human-readable relative time string.
 *   Examples: "just now", "3m ago", "1h ago", "never".
 *
 * @example
 * formatLastUpdated(Date.now());           // "just now"
 * formatLastUpdated(Date.now() - 180000);  // "3m ago"
 * formatLastUpdated(Date.now() - 7200000); // "2h ago"
 * formatLastUpdated(null);                 // "never"
 */
function formatLastUpdated(timestamp) {
  if (!timestamp) return 'never';

  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * DashboardHeader component that renders the top navigation bar of the
 * Fit Buddy dashboard with brand identity, live status, user info, and
 * logout functionality.
 *
 * @description
 * This component consumes two hooks:
 * - `useAuth()`: Provides the authenticated user object (for email display)
 *   and the `logout` function (for the sign-out button).
 * - `useDashboardData()`: Provides the `lastUpdated` timestamp for the
 *   live data indicator display.
 *
 * ### Layout Structure
 * The header uses a horizontal flexbox layout with `justify-between` to
 * push the left (brand) and right (controls) sections to opposite edges.
 * The right section uses `items-center` with `gap-4` for consistent spacing.
 *
 * ### Styling Details
 * - **Container**: Full-width, `px-6 py-4`, `bg-[#0a0a0f]`, `sticky top-0`,
 *   `z-10` for persistent visibility during scroll.
 * - **Brand Text**: `text-lg font-semibold text-white` with a `w-2 h-2`
 *   cyan (`bg-cyan-400`) rounded dot adjacent to the text.
 * - **Live Indicator**: Features a pulsing green/cyan dot using CSS
 *   animation (`animate-pulse`), the text "Live" in small cyan text, and
 *   the last-updated timestamp in `text-white/40` (40% opacity white).
 * - **User Email**: Displayed in `text-xs text-white/30` for minimal
 *   visual presence.
 * - **Logout Button**: `text-xs text-white/30` with `hover:text-white`
 *   transition, bordered with `border border-[#1e1e2e]`, `rounded-lg`,
 *   `px-3 py-1.5`.
 * - **Accent Line**: A `h-px` div below the header with a gradient from
 *   `cyan-500/50` through `blue-500/30` to `transparent`, creating a
 *   sleek separator effect.
 *
 * ### Accessibility
 * The logout button uses a native `<button>` element for keyboard
 * accessibility and screen reader compatibility. The live status dot
 * is purely decorative and does not require alt text.
 *
 * @function DashboardHeader
 * @returns {React.ReactElement} The rendered header element containing
 *   the brand mark, live indicator, user email, logout button, and
 *   accent line separator.
 *
 * @example
 * // Used within the Dashboard component (inside DashboardProvider)
 * import DashboardHeader from './components/DashboardHeader';
 *
 * <DashboardProvider>
 *   <DashboardHeader />
 *   <main>...dashboard content...</main>
 * </DashboardProvider>
 */
function DashboardHeader() {
  const { user, logout } = useAuth();
  const { lastUpdated } = useDashboardData();

  return (
    <header className="sticky top-0 z-10 bg-[#0a0a0f]">
      {/* ── Main header row ── */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4">
        {/* ── Left: Brand mark ── */}
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg font-semibold text-white">Fit Buddy</span>
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
        </div>

        {/* ── Right: Live indicator, user email, logout ── */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Live status indicator */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            <span className="text-xs text-cyan-400 font-medium">Live</span>
            <span className="text-xs text-white/40 font-mono hidden sm:inline">
              {formatLastUpdated(lastUpdated)}
            </span>
          </div>

          {/* User email - hidden on mobile */}
          <span className="text-xs text-white/30 hidden md:inline">
            {user?.email}
          </span>

          {/* Logout button */}
          <button
            onClick={logout}
            className="text-xs text-white/30 hover:text-white border border-[#1e1e2e] rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 transition-colors duration-200"
          >
            Logout
          </button>
        </div>
      </div>

      {/* ── Accent line separator ── */}
      <div className="h-px bg-gradient-to-r from-cyan-500/50 via-blue-500/30 to-transparent" />
    </header>
  );
}

export default DashboardHeader;
