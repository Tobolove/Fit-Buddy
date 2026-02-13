/**
 * @module contexts/AuthContext
 *
 * @description
 * Provides a React Context and Provider component for managing authentication
 * state throughout the Fit Buddy application. This module encapsulates all
 * authentication logic including login, logout, token management, and
 * automatic session expiration handling.
 *
 * The AuthContext stores the authenticated user object (containing email and
 * token), loading state for async operations, and any error messages from
 * failed authentication attempts. It integrates with the API module's
 * closure-based token storage for secure, memory-only JWT management.
 *
 * A key feature is the automatic logout listener: the AuthProvider registers
 * a window event listener for the custom 'auth:expired' event (dispatched
 * by the API response interceptor when a 401 TOKEN_EXPIRED response is
 * received). This ensures that expired sessions are handled gracefully
 * without requiring every component to check token validity.
 *
 * @example
 * // In main.jsx - wrap the app with AuthProvider
 * import { AuthProvider } from './contexts/AuthContext';
 *
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 *
 * @example
 * // In any child component - consume the context
 * import { useContext } from 'react';
 * import { AuthContext } from './contexts/AuthContext';
 *
 * const { user, login, logout, isAuthenticated } = useContext(AuthContext);
 */

import React, { createContext, useState, useEffect, useCallback } from 'react';
import api, { setAuthToken, clearAuthToken } from '../utils/api';

/**
 * The React Context object for authentication state.
 *
 * @description
 * This context provides the following shape to consumers:
 *
 * - `user` {Object|null}: The authenticated user object with `email` and
 *   `token` properties, or `null` if not authenticated.
 * - `loading` {boolean}: Whether an authentication operation (login) is
 *   currently in progress.
 * - `error` {string|null}: The most recent authentication error message,
 *   or `null` if no error has occurred.
 * - `isAuthenticated` {boolean}: Convenience boolean derived from whether
 *   `user` is non-null.
 * - `login` {Function}: Async function to authenticate with email/password.
 * - `logout` {Function}: Function to clear authentication state and token.
 *
 * Consumers should use the `useAuth` hook (from `hooks/useAuth.js`) for
 * type-safe access with automatic provider validation, rather than calling
 * `useContext(AuthContext)` directly.
 *
 * @type {React.Context}
 */
export const AuthContext = createContext(null);

/**
 * AuthProvider component that wraps the application and provides
 * authentication state and methods to all child components via React Context.
 *
 * @description
 * This provider component manages the complete authentication lifecycle:
 *
 * 1. **State Management**: Maintains `user`, `loading`, and `error` state
 *    using React's `useState` hook. The `user` object contains `email` and
 *    `token` properties when authenticated, or is `null` when logged out.
 *
 * 2. **Login Flow**: The `login` method sends credentials to the backend
 *    `POST /auth/login` endpoint. On success, it stores the JWT token in
 *    the API module's closure via `setAuthToken` and updates the user state.
 *    On failure, it sets the error state with the server's error message.
 *
 * 3. **Logout Flow**: The `logout` method clears the token from the API
 *    module's closure via `clearAuthToken` and resets the user state to null.
 *
 * 4. **Auto-Expiration Handling**: On mount, the provider registers a
 *    listener for the custom 'auth:expired' window event. When the API
 *    response interceptor detects a 401 TOKEN_EXPIRED response, it
 *    dispatches this event, which triggers an automatic logout. The
 *    listener is cleaned up on unmount to prevent memory leaks.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to render
 *   within the authentication context. Typically the entire application
 *   tree (e.g., `<App />`).
 * @returns {React.ReactElement} The AuthContext.Provider wrapping the children
 *   with the authentication state and methods as the context value.
 *
 * @example
 * // Typical usage in main.jsx
 * import { AuthProvider } from './contexts/AuthContext';
 * import App from './App';
 *
 * ReactDOM.createRoot(document.getElementById('root')).render(
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 * );
 */
export function AuthProvider({ children }) {
  /**
   * The authenticated user object, or null if not logged in.
   *
   * @description
   * When authenticated, this state contains an object with:
   * - `email` {string}: The user's email address used for login.
   * - `token` {string}: The JWT authentication token (also stored in
   *   the API module's closure for automatic request attachment).
   *
   * When not authenticated (initial state or after logout), this is null.
   *
   * @type {[{email: string, token: string}|null, Function]}
   */
  const [user, setUser] = useState(null);

  /**
   * Whether an authentication operation is currently in progress.
   *
   * @description
   * Set to `true` when a login request is initiated and back to `false`
   * when the request completes (either successfully or with an error).
   * Used by UI components to display loading indicators and disable
   * form inputs during authentication.
   *
   * @type {[boolean, Function]}
   */
  const [loading, setLoading] = useState(false);

  /**
   * The most recent authentication error message, or null if no error.
   *
   * @description
   * Populated when a login attempt fails (e.g., invalid credentials,
   * network error, server error). Cleared at the start of each new
   * login attempt. Displayed in the LoginPage component's error area.
   *
   * @type {[string|null, Function]}
   */
  const [error, setError] = useState(null);

  /**
   * Authenticates a user with email and password credentials.
   *
   * @description
   * Sends a POST request to the `/auth/login` endpoint with the provided
   * email and password. On a successful response (HTTP 200), the function:
   *
   * 1. Extracts the JWT token from the response data.
   * 2. Stores the token in the API module's closure via `setAuthToken`
   *    so all subsequent API requests include the Bearer token.
   * 3. Updates the user state with the email and token, which causes
   *    the application to transition from the login screen to the
   *    dashboard (via the auth gate in App.jsx).
   *
   * On failure, the function catches the error and sets the error state
   * with the server's error message (or a generic message if the server
   * response doesn't include one).
   *
   * The loading state is managed throughout the operation to enable
   * proper UI feedback (disabled inputs, spinner, etc.).
   *
   * @async
   * @param {string} email - The user's email address for authentication.
   * @param {string} password - The user's password for authentication.
   * @returns {Promise<void>} Resolves when the login attempt completes
   *   (regardless of success or failure). Check the `user` and `error`
   *   states to determine the outcome.
   *
   * @example
   * const { login, error } = useAuth();
   * await login('user@example.com', 'mypassword');
   * if (error) {
   *   console.error('Login failed:', error);
   * }
   */
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { token } = response.data;

      setAuthToken(token);
      setUser({ email, token });
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Authentication failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Logs the current user out by clearing all authentication state.
   *
   * @description
   * Performs a complete logout by:
   *
   * 1. Calling `clearAuthToken` to remove the JWT token from the API
   *    module's closure, preventing further authenticated requests.
   * 2. Setting the user state to `null`, which causes the App component's
   *    auth gate to render the LoginPage instead of the Dashboard.
   * 3. Clearing any lingering error messages from previous login attempts.
   *
   * This function is called both manually (via a logout button) and
   * automatically (when the 'auth:expired' event is received).
   *
   * @returns {void}
   *
   * @example
   * const { logout } = useAuth();
   *
   * <button onClick={logout}>Sign Out</button>
   */
  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setError(null);
  }, []);

  /**
   * Effect: Register and clean up the 'auth:expired' event listener.
   *
   * @description
   * On mount, attaches a listener to the window's 'auth:expired' custom
   * event. This event is dispatched by the API response interceptor when
   * a 401 response with a TOKEN_EXPIRED code is received from the server.
   *
   * When the event fires, the `logout` function is called automatically,
   * clearing the stored token and redirecting the user to the login screen.
   * This provides seamless session expiration handling without requiring
   * individual components to check token validity.
   *
   * The listener is cleaned up on unmount to prevent memory leaks and
   * stale closure references.
   */
  useEffect(() => {
    /**
     * Event handler for the 'auth:expired' custom event.
     *
     * @description
     * Invoked when the API response interceptor detects a 401
     * TOKEN_EXPIRED response. Triggers a full logout to clear
     * stale authentication state and return the user to the login screen.
     *
     * @returns {void}
     */
    const handleAuthExpired = () => {
      logout();
    };

    window.addEventListener('auth:expired', handleAuthExpired);

    return () => {
      window.removeEventListener('auth:expired', handleAuthExpired);
    };
  }, [logout]);

  /**
   * The context value object provided to all consumer components.
   *
   * @description
   * This object contains all authentication state and methods that child
   * components can access via `useContext(AuthContext)` or the `useAuth`
   * hook. The `isAuthenticated` property is a convenience boolean derived
   * from the `user` state to simplify conditional rendering logic.
   *
   * @type {Object}
   * @property {Object|null} user - The authenticated user or null.
   * @property {boolean} loading - Whether a login operation is in progress.
   * @property {string|null} error - The latest auth error message or null.
   * @property {boolean} isAuthenticated - Whether a user is currently logged in.
   * @property {Function} login - Async login function accepting (email, password).
   * @property {Function} logout - Synchronous logout function.
   */
  const value = {
    user,
    loading,
    error,
    isAuthenticated: user !== null,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
