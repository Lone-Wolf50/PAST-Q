import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'

// ── Sentry Error Monitoring ────────────────────────────────────────────────────
// Initialize only when VITE_SENTRY_DSN is provided in the environment.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,

    // Capture 100% of transactions for now; tune down once traffic grows.
    tracesSampleRate: 1.0,

    // Capture replays for 10% of sessions (requires @sentry/replay if needed).
    // replaysSessionSampleRate: 0.1,

    integrations: [
      Sentry.browserTracingIntegration(),
    ],
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
