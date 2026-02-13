/**
 * @module components/LoginPage
 *
 * @description
 * A sleek Material 3 dark-themed login page component for the Fit Buddy
 * health dashboard. This component presents a centered authentication card
 * on a deep black background, styled with the application's design system:
 *
 * - **Background**: Pure dark (#0a0a0f) filling the entire viewport.
 * - **Card**: Elevated card (#12121a) with subtle border (#1e1e2e),
 *   rounded corners (2xl), and generous padding. No shadows are used,
 *   relying solely on border contrast for visual separation.
 * - **Accent**: A thin horizontal gradient line (cyan to blue) beneath
 *   the title provides a striking visual separator.
 * - **Inputs**: Dark-styled text inputs with matching background (#0a0a0f)
 *   and border (#1e1e2e), using focus ring accents in cyan.
 * - **Button**: A gradient button (cyan-500 to blue-500) with rounded
 *   corners, providing the primary call-to-action.
 * - **Typography**: White title, muted subtitle (white/40), and clean
 *   label text following the Inter font family.
 *
 * The component integrates with the AuthContext via the `useAuth` hook to
 * handle login submission, display loading states, and show error messages.
 * Form state (email and password) is managed locally via useState.
 *
 * @example
 * // Rendered by App.jsx when the user is not authenticated
 * import LoginPage from './components/LoginPage';
 *
 * function App() {
 *   const { isAuthenticated } = useAuth();
 *   return isAuthenticated ? <Dashboard /> : <LoginPage />;
 * }
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * LoginPage component rendering a Material 3 dark-themed authentication form.
 *
 * @description
 * Renders a full-viewport login screen with a centered card containing:
 *
 * 1. **Header Section**: The "Fit Buddy" title in bold white text with a
 *    "Health Dashboard" subtitle in muted white/40. Below the subtitle,
 *    a thin gradient accent line (cyan-500 to blue-500 fading to
 *    transparent) provides visual separation from the form fields.
 *
 * 2. **Form Section**: Two input fields (email and password) styled with
 *    the dark input theme. Each input has:
 *    - A label in small, muted text (white/50).
 *    - Dark background (#0a0a0f) matching the page background.
 *    - Subtle border (#1e1e2e) that transitions to cyan (#06b6d4) on focus.
 *    - Rounded corners (lg) and appropriate padding for touch targets.
 *    - Placeholder text in white/20 for subtle guidance.
 *
 * 3. **Submit Button**: A full-width gradient button (from cyan-500 to
 *    blue-500) with white text. The button:
 *    - Shows "Sign In" in its default state.
 *    - Shows "Signing in..." with reduced opacity when loading.
 *    - Is disabled during loading to prevent duplicate submissions.
 *    - Has hover brightness scaling for interactive feedback.
 *
 * 4. **Error Display**: When an authentication error occurs, a compact
 *    error message appears above the submit button with red text on a
 *    subtle red-tinted background (red-500/10 with red-500/20 border).
 *
 * **State Management**:
 * - `email` (local state): The email input value, controlled component.
 * - `password` (local state): The password input value, controlled component.
 * - `login`, `loading`, `error` (from AuthContext): Authentication methods
 *   and state provided by the useAuth hook.
 *
 * **Form Submission**:
 * The form's `onSubmit` handler calls `event.preventDefault()` to prevent
 * page reload, then invokes the `login(email, password)` async method
 * from the AuthContext. On success, the AuthContext updates `isAuthenticated`
 * to `true`, which causes the App component to swap this LoginPage for the
 * Dashboard. On failure, the `error` state is populated and displayed.
 *
 * @function LoginPage
 * @returns {React.ReactElement} The full-viewport login page with centered
 *   authentication card.
 */
function LoginPage() {
  /**
   * Local state for the email input field.
   *
   * @description
   * Stores the current value of the email text input as a controlled
   * component. Initialized to an empty string. Updated on every
   * keystroke via the input's onChange handler. Passed to the
   * `login()` function on form submission.
   *
   * @type {[string, Function]}
   */
  const [email, setEmail] = useState('');

  /**
   * Local state for the password input field.
   *
   * @description
   * Stores the current value of the password text input as a controlled
   * component. Initialized to an empty string. Updated on every
   * keystroke via the input's onChange handler. The input renders with
   * `type="password"` to mask characters. Passed to the `login()`
   * function on form submission.
   *
   * @type {[string, Function]}
   */
  const [password, setPassword] = useState('');

  /**
   * Authentication state and methods from the AuthContext.
   *
   * @description
   * Destructures the following from the useAuth hook:
   * - `login`: Async function to authenticate with the backend.
   * - `loading`: Boolean indicating if a login request is in flight.
   * - `error`: String with the latest error message, or null.
   */
  const { login, loading, error } = useAuth();

  /**
   * Handles the login form submission.
   *
   * @description
   * Called when the user submits the login form (by clicking the "Sign In"
   * button or pressing Enter). The handler:
   *
   * 1. Calls `event.preventDefault()` to prevent the default HTML form
   *    submission behavior (which would cause a full page reload).
   * 2. Invokes the `login(email, password)` async method from the
   *    AuthContext, which sends a POST request to `/auth/login`.
   *
   * The `login` method handles all state updates internally:
   * - Sets `loading` to true, then false when complete.
   * - Sets `error` if authentication fails.
   * - Sets `user` and `isAuthenticated` on success, which triggers the
   *   App component to swap to the Dashboard view.
   *
   * @async
   * @param {React.FormEvent<HTMLFormElement>} e - The form submission event.
   * @returns {Promise<void>} Resolves when the login attempt completes.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-8 w-full max-w-sm">

        {/* ── Header: Title, subtitle, and accent line ── */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Fit Buddy
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Health Dashboard
          </p>
          <div className="mt-4 h-px bg-gradient-to-r from-cyan-500 via-blue-500 to-transparent" />
        </div>

        {/* ── Login Form ── */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email input */}
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3.5 py-2.5
                         text-sm text-white placeholder-white/20
                         focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30
                         transition-colors duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Password input */}
          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3.5 py-2.5
                         text-sm text-white placeholder-white/20
                         focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30
                         transition-colors duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg px-4 py-2.5
                       text-sm font-medium text-white
                       hover:brightness-110 active:brightness-95
                       transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
