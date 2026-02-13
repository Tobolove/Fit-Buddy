/**
 * @module hooks/useAuth
 *
 * @description
 * Provides a custom React hook for accessing the authentication context
 * throughout the Fit Buddy application. This hook is the recommended way
 * to consume the AuthContext rather than calling `useContext(AuthContext)`
 * directly, because it includes a runtime safety check that throws a
 * descriptive error if the hook is used outside of an AuthProvider.
 *
 * This pattern ("context with a guarded hook") is a widely-adopted
 * React best practice that prevents subtle bugs caused by components
 * silently receiving `undefined` context values when they are
 * accidentally rendered outside the provider tree.
 *
 * @example
 * import { useAuth } from '../hooks/useAuth';
 *
 * function ProfileButton() {
 *   const { user, logout, isAuthenticated } = useAuth();
 *
 *   if (!isAuthenticated) return null;
 *
 *   return (
 *     <button onClick={logout}>
 *       Sign out ({user.email})
 *     </button>
 *   );
 * }
 */

import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

/**
 * Custom hook that returns the current authentication context value.
 *
 * @description
 * Retrieves and returns the authentication context value from the nearest
 * `AuthProvider` ancestor in the component tree. The returned object
 * includes all authentication state and methods:
 *
 * - `user` {Object|null}: The authenticated user object containing `email`
 *   and `token` properties, or `null` if no user is logged in.
 * - `loading` {boolean}: Whether an authentication operation (such as
 *   login) is currently in progress. Use this to show loading spinners
 *   and disable form inputs.
 * - `error` {string|null}: The most recent authentication error message
 *   (e.g., "Invalid credentials"), or `null` if no error has occurred.
 * - `isAuthenticated` {boolean}: Convenience boolean that is `true` when
 *   a user is logged in (`user !== null`) and `false` otherwise. Use
 *   this for conditional rendering of authenticated vs. guest content.
 * - `login` {Function}: Async function that accepts `(email, password)`
 *   and attempts to authenticate the user against the backend API.
 * - `logout` {Function}: Synchronous function that clears all
 *   authentication state and the stored JWT token.
 *
 * **Safety Check**: If this hook is called from a component that is NOT
 * a descendant of an `AuthProvider`, it throws an error with a clear
 * message indicating the misconfiguration. This prevents silent failures
 * where components would otherwise receive `null` or `undefined` context
 * values and produce confusing runtime errors.
 *
 * @function useAuth
 * @returns {{
 *   user: {email: string, token: string} | null,
 *   loading: boolean,
 *   error: string | null,
 *   isAuthenticated: boolean,
 *   login: (email: string, password: string) => Promise<void>,
 *   logout: () => void
 * }} The authentication context value object containing all auth state
 *   and methods.
 *
 * @throws {Error} Throws an error with the message "useAuth must be used
 *   within an AuthProvider" if the hook is called outside the AuthProvider
 *   component tree. This typically indicates a missing `<AuthProvider>`
 *   wrapper in the application's root component hierarchy.
 *
 * @example
 * // Basic usage in a component
 * function Dashboard() {
 *   const { user, isAuthenticated, logout } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <Navigate to="/login" />;
 *   }
 *
 *   return (
 *     <div>
 *       <p>Welcome, {user.email}!</p>
 *       <button onClick={logout}>Logout</button>
 *     </div>
 *   );
 * }
 *
 * @example
 * // Usage in a login form
 * function LoginForm() {
 *   const { login, loading, error } = useAuth();
 *
 *   const handleSubmit = async (e) => {
 *     e.preventDefault();
 *     await login(email, password);
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {error && <p className="error">{error}</p>}
 *       <button disabled={loading}>
 *         {loading ? 'Signing in...' : 'Sign In'}
 *       </button>
 *     </form>
 *   );
 * }
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null || context === undefined) {
    throw new Error(
      'useAuth must be used within an AuthProvider. ' +
      'Ensure that your component tree is wrapped with <AuthProvider> ' +
      'in the application root (typically in main.jsx).'
    );
  }

  return context;
}
