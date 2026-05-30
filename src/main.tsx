import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'

// ── Google Translate & Browser Extension DOM Crash Patch ────────────────────────
// Prevents React from crashing when external tools (like Google Translate or extensions)
// modify, wrap, or remove DOM text/node structures outside React's Virtual DOM.
if (typeof Node !== 'undefined' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

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
