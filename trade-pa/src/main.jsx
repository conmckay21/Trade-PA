import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'

// ============================================================================
// Sentry error monitoring
// ----------------------------------------------------------------------------
// Reports runtime errors from production users to Sentry so we can see what's
// breaking in the wild. DSN is injected at build time from VITE_SENTRY_DSN.
//
// Intentionally minimal config for launch — no performance monitoring, no
// session replay, no profiling. These can be turned on later if needed.
// ============================================================================
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE, // 'production' | 'development' | 'preview'
    release: import.meta.env.VITE_APP_VERSION || '0.1.0',

    // Error monitoring only — no performance/replay/profiling overhead
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Filter out noise that's not actionable
    ignoreErrors: [
      // Browser extension injected errors
      /extension\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Network failures — user-side connectivity, not our bug
      'Network request failed',
      'NetworkError',
      'Load failed',
      'Failed to fetch',
      // Safari/iOS quirks
      'Non-Error promise rejection captured',
      // Ad blockers cancelling requests
      'AbortError',
    ],

    // Drop events before sending
    beforeSend(event) {
      // Don't send dev errors — they're noisy and skew metrics
      if (import.meta.env.MODE === 'development') {
        return null
      }
      return event
    },
  })
}

// ============================================================================
// Fallback UI shown when React's render tree crashes
// ----------------------------------------------------------------------------
// Without this, a crash would leave users staring at a blank white screen.
// With this, they see a message and a reload button, and Sentry gets a full
// stack trace of what broke.
// ============================================================================
function FallbackUI({ resetError }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#fafafa',
      }}
    >
      <div style={{ maxWidth: '420px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '12px', color: '#111' }}>
          Something went wrong
        </h1>
        <p style={{ color: '#666', marginBottom: '24px', lineHeight: 1.5 }}>
          Trade PA hit an unexpected error. We've been notified and will look into it.
          Try reloading — if it keeps happening, email{' '}
          <a href="mailto:support@tradespa.co.uk" style={{ color: '#111' }}>
            support@tradespa.co.uk
          </a>
          .
        </p>
        <button
          onClick={() => {
            resetError()
            window.location.reload()
          }}
          style={{
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '12px 28px',
            fontSize: '16px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Reload app
        </button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={FallbackUI}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
