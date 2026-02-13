import React from 'react';

/**
 * ErrorBanner displays a prominent but non-intrusive error message banner
 * designed for the Fit Buddy Material 3 dark-mode design system.
 *
 * The banner features a translucent red background (red-500 at 10% opacity),
 * a subtle red border (red-500 at 20% opacity), rounded corners, and red
 * text. An optional retry button can be displayed alongside the message to
 * let the user re-attempt a failed operation.
 *
 * The component is suitable for inline placement within cards, pages, or
 * modals. It does not manage its own visibility -- the parent component
 * should conditionally render it when an error state exists.
 *
 * Design tokens used:
 *   - Background:   bg-red-500/10
 *   - Border:       border-red-500/20
 *   - Text colour:  text-red-400
 *   - Button:       text-red-300 hover:text-white, underline
 *
 * @component
 *
 * @param {Object}    props                - Component props.
 * @param {string}    props.message        - The error message text to display.
 *                                           Should be a human-readable string
 *                                           that describes what went wrong.
 * @param {Function}  [props.onRetry]      - Optional callback invoked when the
 *                                           user clicks the "Retry" button. When
 *                                           omitted, the retry button is hidden.
 * @param {string}    [props.className]    - Additional CSS class names appended
 *                                           to the outermost wrapper for layout
 *                                           or spacing overrides.
 *
 * @returns {React.ReactElement} The rendered ErrorBanner component.
 *
 * @example
 * // Simple error message without retry
 * <ErrorBanner message="Failed to load workout data." />
 *
 * @example
 * // Error with retry action
 * <ErrorBanner
 *   message="Network request timed out. Please try again."
 *   onRetry={() => fetchData()}
 * />
 *
 * @example
 * // With additional spacing class
 * <ErrorBanner
 *   message="Unable to sync with server."
 *   onRetry={handleRetry}
 *   className="mt-4"
 * />
 */
const ErrorBanner = ({ message, onRetry, className = '' }) => {
  return (
    <div
      className={`bg-red-500/10 border border-red-500/20 rounded-lg p-3 ${className}`}
      role="alert"
    >
      <div className="flex items-center justify-between gap-3">
        {/* ── Error message ──────────────────────────────────────── */}
        <div className="flex items-center gap-2 min-w-0">
          <ErrorIcon />
          <p className="text-sm text-red-400 leading-snug">{message}</p>
        </div>

        {/* ── Retry button ───────────────────────────────────────── */}
        {onRetry && (
          <button
            onClick={onRetry}
            type="button"
            className="shrink-0 text-xs text-red-300 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * ErrorIcon renders a small SVG exclamation-circle icon used as a visual
 * indicator alongside the error message inside ErrorBanner.
 *
 * The icon is sized at 16x16 pixels and coloured with the current text
 * colour (currentColor), allowing it to inherit the red hue from the
 * parent element. It uses a filled circle with an exclamation mark (line
 * and dot) to clearly communicate an error or warning state.
 *
 * @component
 * @returns {React.ReactElement} A 16x16 SVG exclamation-circle icon.
 */
const ErrorIcon = () => {
  return (
    <svg
      className="shrink-0 w-4 h-4 text-red-400"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
};

export default ErrorBanner;
