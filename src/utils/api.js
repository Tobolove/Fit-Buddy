/**
 * @module utils/api
 *
 * @description
 * Configures and exports an Axios HTTP client instance pre-configured for
 * the Fit Buddy backend API. Authentication is managed through a JWT token
 * stored in a module-level closure (never persisted to localStorage) for
 * improved security against XSS attacks.
 *
 * The module provides:
 * - A pre-configured Axios instance with base URL and timeout.
 * - A request interceptor that attaches the JWT Bearer token to every
 *   outgoing request when a token is available.
 * - A response interceptor that detects 401 responses with a
 *   TOKEN_EXPIRED error code and dispatches a custom 'auth:expired'
 *   event on the window object so that the AuthContext can react and
 *   log the user out automatically.
 * - Helper functions to set, clear, and retrieve the current auth token.
 *
 * @example
 * import api, { setAuthToken } from './utils/api';
 *
 * // After login, store the token
 * setAuthToken(response.data.token);
 *
 * // All subsequent requests carry the Authorization header automatically
 * const { data } = await api.get('/steps');
 */

import axios from 'axios';

/**
 * The JWT authentication token held in a module-level closure.
 *
 * Storing the token here instead of localStorage prevents it from being
 * accessible via `window.localStorage` in the event of an XSS vulnerability.
 * The token is only readable through the exported `getAuthToken` function
 * and is automatically attached to requests by the request interceptor.
 *
 * @type {string|null}
 * @private
 */
let _authToken = null;

/**
 * Pre-configured Axios instance for all Fit Buddy API communication.
 *
 * @description
 * Creates an Axios instance with the following configuration:
 * - `baseURL` set to '/api' so that all request paths are relative to
 *   the API root (e.g., `api.get('/steps')` hits '/api/steps').
 * - `timeout` set to 30 000 ms (30 seconds) to prevent hanging requests
 *   on slow or unresponsive network connections.
 * - `Content-Type` header defaulting to 'application/json' for all requests.
 *
 * @type {import('axios').AxiosInstance}
 */
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor that attaches the JWT Bearer token to outgoing requests.
 *
 * @description
 * Before every request leaves the client, this interceptor checks whether
 * a JWT token is currently stored in the module closure (`_authToken`).
 * If a token exists, the interceptor adds an `Authorization` header with
 * the value `Bearer <token>` to the request config. If no token is stored,
 * the request proceeds without modification.
 *
 * This approach ensures that once a user is authenticated and the token is
 * set via `setAuthToken`, all subsequent API calls are automatically
 * authenticated without requiring each call site to manually attach headers.
 *
 * @param {import('axios').InternalAxiosRequestConfig} config - The Axios
 *   request configuration object that will be sent to the server.
 * @returns {import('axios').InternalAxiosRequestConfig} The (possibly
 *   modified) request configuration with the Authorization header attached.
 */
api.interceptors.request.use(
  (config) => {
    if (_authToken) {
      config.headers.Authorization = `Bearer ${_authToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor that handles 401 TOKEN_EXPIRED errors.
 *
 * @description
 * After every response is received, this interceptor inspects failed
 * responses for a 401 status code combined with a `TOKEN_EXPIRED` error
 * code in the response body. When this specific combination is detected,
 * it dispatches a custom 'auth:expired' event on the window object.
 *
 * The AuthContext listens for this event and performs an automatic logout,
 * clearing the stored token and redirecting the user to the login screen.
 * This decoupled approach avoids circular dependencies between the API
 * layer and the authentication context.
 *
 * All other errors (including non-TOKEN_EXPIRED 401 errors) are passed
 * through as rejected promises for the calling code to handle.
 *
 * @param {import('axios').AxiosResponse} response - The successful Axios
 *   response object (passed through unchanged).
 * @param {import('axios').AxiosError} error - The Axios error object
 *   containing response status and data for inspection.
 * @returns {import('axios').AxiosResponse} The original response for
 *   successful requests.
 * @throws {import('axios').AxiosError} Re-throws the error after
 *   dispatching the event (if applicable) so callers can still handle it.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response &&
      error.response.status === 401 &&
      error.response.data?.code === 'TOKEN_EXPIRED'
    ) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    return Promise.reject(error);
  }
);

/**
 * Stores a JWT authentication token in the module closure.
 *
 * @description
 * Call this function after a successful login to persist the JWT token
 * for the duration of the current browser session. The token is stored
 * in a module-level variable (`_authToken`) and will be automatically
 * attached to all subsequent API requests via the request interceptor.
 *
 * The token is intentionally NOT stored in localStorage or sessionStorage
 * to reduce the attack surface for XSS-based token theft. The token only
 * lives in JavaScript memory and is lost on page refresh.
 *
 * @param {string} token - The JWT token string received from the
 *   authentication endpoint (e.g., 'eyJhbGciOiJIUzI1NiIs...').
 * @returns {void}
 *
 * @example
 * import { setAuthToken } from './utils/api';
 *
 * const response = await api.post('/auth/login', { email, password });
 * setAuthToken(response.data.token);
 */
export function setAuthToken(token) {
  _authToken = token;
}

/**
 * Clears the stored JWT authentication token from the module closure.
 *
 * @description
 * Call this function during logout or when the token has expired. It sets
 * the module-level `_authToken` variable to `null`, which causes the
 * request interceptor to stop attaching the Authorization header to
 * subsequent API requests.
 *
 * After calling this function, any API request that requires authentication
 * will be sent without a token and will likely receive a 401 Unauthorized
 * response from the server.
 *
 * @returns {void}
 *
 * @example
 * import { clearAuthToken } from './utils/api';
 *
 * function handleLogout() {
 *   clearAuthToken();
 *   // Redirect to login page...
 * }
 */
export function clearAuthToken() {
  _authToken = null;
}

/**
 * Retrieves the currently stored JWT authentication token.
 *
 * @description
 * Returns the JWT token currently held in the module closure, or `null`
 * if no token has been set (i.e., the user is not authenticated or the
 * token has been cleared). This is useful for checking authentication
 * state without making an API call.
 *
 * @returns {string|null} The current JWT token string, or `null` if no
 *   token is stored.
 *
 * @example
 * import { getAuthToken } from './utils/api';
 *
 * if (getAuthToken()) {
 *   console.log('User is authenticated');
 * }
 */
export function getAuthToken() {
  return _authToken;
}

export default api;
