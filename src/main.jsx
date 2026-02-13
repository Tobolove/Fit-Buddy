/**
 * @module main
 *
 * @description
 * The application entry point that bootstraps the Fit Buddy React application.
 * This module is responsible for:
 *
 * 1. Creating the React root attached to the DOM element with id 'root'.
 * 2. Wrapping the application in React.StrictMode for development-time
 *    checks (double-rendering to detect side effects, deprecation warnings).
 * 3. Wrapping the App component in the AuthProvider so that authentication
 *    state is available to every component in the tree via the useAuth hook.
 * 4. Importing the global stylesheet (index.css) which includes Tailwind CSS
 *    directives, custom fonts (Inter, JetBrains Mono), and component-layer
 *    utility classes for the Material 3 dark design system.
 *
 * The component hierarchy established here is:
 *   React.StrictMode > AuthProvider > App > (LoginPage | Dashboard)
 *
 * This ensures that the auth gate in App.jsx can access `useAuth()` to
 * determine whether to render the login screen or the main dashboard.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import App from './App.jsx';
import './index.css';

/**
 * Bootstrap the React application into the DOM.
 *
 * @description
 * Uses React 18's `createRoot` API to mount the application into the
 * HTML element with id 'root' (defined in index.html). The render call
 * wraps the component tree in:
 *
 * - `React.StrictMode`: Enables additional development-time checks
 *   including detecting unexpected side effects, deprecated APIs, and
 *   legacy context usage. Components are intentionally double-rendered
 *   in development to surface impure render logic.
 *
 * - `AuthProvider`: The authentication context provider that manages
 *   user state, JWT token storage, login/logout methods, and automatic
 *   session expiration handling. Must wrap the App component so that
 *   the useAuth hook works in App and all its descendants.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
