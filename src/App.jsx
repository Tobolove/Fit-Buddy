/**
 * @module App
 *
 * @description
 * The root application component that serves as the authentication gate for
 * the Fit Buddy dashboard. This component consumes the authentication context
 * via the `useAuth` hook and conditionally renders either the LoginPage
 * (for unauthenticated users) or the Dashboard (for authenticated users).
 *
 * This pattern provides a clean separation of concerns: the App component
 * is solely responsible for routing between the authenticated and guest
 * experiences, while the actual authentication logic lives in AuthContext
 * and the UI logic lives in the respective page components.
 *
 * The component does not manage any local state or side effects; it is a
 * pure function of the authentication state provided by the context.
 *
 * @example
 * // Used in main.jsx (wrapped by AuthProvider)
 * import App from './App';
 *
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 */

import { useAuth } from './hooks/useAuth';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

/**
 * Root application component implementing the authentication gate pattern.
 *
 * @description
 * Reads the `isAuthenticated` boolean from the AuthContext via the `useAuth`
 * hook and renders the appropriate top-level component:
 *
 * - **Authenticated** (`isAuthenticated === true`): Renders the `<Dashboard />`
 *   component, which displays the full health data dashboard with charts,
 *   metrics, and activity data fetched from the Garmin Connect API.
 *
 * - **Not authenticated** (`isAuthenticated === false`): Renders the
 *   `<LoginPage />` component, which presents the Material 3 dark-themed
 *   login form where users enter their credentials.
 *
 * The transition between these two states happens automatically when the
 * AuthContext's `user` state changes (e.g., after a successful `login()`
 * call or after `logout()` / session expiration).
 *
 * @function App
 * @returns {React.ReactElement} Either the Dashboard or LoginPage component
 *   depending on the current authentication state.
 */
function App() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <Dashboard /> : <LoginPage />;
}

export default App;
