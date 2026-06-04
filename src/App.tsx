import React, { useState, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import InstallPrompt from './components/InstallPrompt';
import { AlertModal } from './components/ui/AlertModal';
import { GlobalBanner } from './components/GlobalBanner';


// ─── Chunk Load Error Recovery ────────────────────────────────────────────────
// When a new build is deployed, old cached HTML references OLD chunk filenames.
// React.lazy() dynamic imports then get a 404/parse error ("Importing a module
// script failed"). This helper catches that, reloads once, and prevents loops.
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    factory().catch((err: unknown) => {
      const RELOAD_KEY = 'pq_chunk_reload';
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
        // Never resolves — reload takes over
        return new Promise<{ default: T }>(() => {});
      }
      // Already reloaded once; bubble up so ErrorBoundary catches it
      throw err;
    })
  );
}

// ─── Error Boundary for persistent chunk failures ─────────────────────────────
class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { crashed: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: Error) {
    const isChunkError =
      error.message?.includes('Importing a module') ||
      error.message?.includes('dynamically imported') ||
      error.name === 'TypeError';

    const RELOAD_KEY = 'pq_chunk_reload';
    if (isChunkError && !sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, '1');
      window.location.reload();
    }
  }

  render() {
    if (this.state.crashed) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', gap: '1rem', padding: '2rem'
        }}>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center' }}>
            A new version of PastQ is available. Please reload to continue.
          </p>
          <button
            onClick={() => { sessionStorage.removeItem('pq_chunk_reload'); window.location.reload(); }}
            style={{
              padding: '0.625rem 1.5rem', borderRadius: '0.75rem', background: '#6366f1',
              color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '0.875rem'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Lazy Pages (with auto-retry on stale chunk errors) ───────────────────────
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));
const PapersPage = lazyWithRetry(() => import('./pages/PapersPage'));
const PaperViewerPage = lazyWithRetry(() => import('./pages/PaperViewerPage'));
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'));
const RegisterPage = lazyWithRetry(() => import('./pages/RegisterPage'));
const VerifyEmailPage = lazyWithRetry(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('./pages/ResetPasswordPage'));
const PricingPage = lazyWithRetry(() => import('./pages/PricingPage'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'));
const AskAIPage = lazyWithRetry(() => import('./pages/AskAIPage'));
const UpgradePage = lazyWithRetry(() => import('./pages/UpgradePage'));
const DeleteAccountPage = lazyWithRetry(() => import('./pages/DeleteAccountPage'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));
const AdminSubjectsPage = lazyWithRetry(() => import('./pages/AdminSubjectsPage'));
const AdminPapersPage = lazyWithRetry(() => import('./pages/AdminPapersPage'));
const AdminUsersPage = lazyWithRetry(() => import('./pages/AdminUsersPage'));
const AdminPaymentsPage = lazyWithRetry(() => import('./pages/AdminPaymentsPage'));
const AdminLoginPage = lazyWithRetry(() => import('./pages/AdminLoginPage'));
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'));
const AuthCallback = lazyWithRetry(() => import('./pages/AuthCallback'));
const AdminNotificationsPage = lazyWithRetry(() => import('./pages/AdminNotificationsPage'));
const AdminFallbacksPage = lazyWithRetry(() => import('./pages/AdminFallbacksPage'));
const AdminBroadcastPage = lazyWithRetry(() => import('./pages/AdminBroadcastPage'));
const StudentSubscriptionPage = lazyWithRetry(() => import('./pages/StudentSubscriptionPage'));
const StudentNotificationsPage = lazyWithRetry(() => import('./pages/StudentNotificationsPage'));
const QuizPage = lazyWithRetry(() => import('./pages/QuizPage'));
const LeaderboardPage = lazyWithRetry(() => import('./pages/LeaderboardPage'));

const PageLoader = () => (
  <div className="w-full flex-grow flex items-center justify-center min-h-[60vh]">
    <div className="relative w-12 h-12">
      <svg className="absolute inset-0 w-12 h-12 animate-spin text-indigo-500" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="120 40" className="opacity-10" />
        <circle cx="32" cy="32" r="28" stroke="indigo" strokeWidth="4" strokeLinecap="round" strokeDasharray="40 120" />
      </svg>
    </div>
  </div>
);


// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered successfully with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Automatically scrolls to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Redirects to /login if not authenticated
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Redirects logged-in users away from auth pages
const GuestRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn } = useAuth();
  if (isLoggedIn) return <Navigate to="/papers" replace />;
  return <>{children}</>;
};

// Redirects to /hq-portal/login if not authenticated as admin
const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('admin_token');
  if (!token) return <Navigate to="/hq-portal/login" replace />;
  return <>{children}</>;
};

function AppRoutes() {
  const { isLoggedIn, logout, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);
  const [accountSuspendedOpen, setAccountSuspendedOpen] = useState(false);
  const [accountDeactivatedOpen, setAccountDeactivatedOpen] = useState(false);

  useEffect(() => {
    const handleSessionExpired = () => setSessionExpiredOpen(true);
    const handleAccountSuspended = () => {
      logout();
      setAccountSuspendedOpen(true);
    };
    const handleAccountDeactivated = () => {
      logout();
      setAccountDeactivatedOpen(true);
    };
    window.addEventListener('session_expired', handleSessionExpired);
    window.addEventListener('account_suspended', handleAccountSuspended);
    window.addEventListener('account_deactivated', handleAccountDeactivated);
    return () => {
      window.removeEventListener('session_expired', handleSessionExpired);
      window.removeEventListener('account_suspended', handleAccountSuspended);
      window.removeEventListener('account_deactivated', handleAccountDeactivated);
    };
  }, [logout]);

  const hideFooterRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/auth/callback'];
  const isAdminPath = location.pathname.startsWith('/hq-portal');
  const isLandingPage = location.pathname === '/';
  const shouldHideFooter = (isLoggedIn && !isLandingPage) || isAdminPath || hideFooterRoutes.includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col font-sans relative">
      {!isAdminPath && location.pathname !== '/auth/callback' && <GlobalBanner />}
      <InstallPrompt />
      <Routes>
        <Route path="/hq-portal/*" element={null} />
        <Route path="/auth/callback" element={null} />
        <Route path="*" element={<Navbar />} />
      </Routes>
      <main className={`flex-grow flex flex-col ${isLoggedIn && location.pathname !== '/ask-ai' ? 'pb-24 md:pb-0' : ''}`}>
        <ChunkErrorBoundary>
        <React.Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            {/* Guest-only Auth Routes */}
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
            <Route path="/reset-password" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
            <Route path="/pricing" element={<PricingPage />} />

            {/* Admin Login - Public, Standalone */}
            <Route path="/hq-portal/login" element={<AdminLoginPage />} />

            {/* Protected Routes */}
            <Route path="/papers" element={<ProtectedRoute><PapersPage /></ProtectedRoute>} />
            <Route path="/papers/:id" element={<ProtectedRoute><PaperViewerPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
            <Route path="/subscription" element={<ProtectedRoute><StudentSubscriptionPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><StudentNotificationsPage /></ProtectedRoute>} />
            <Route path="/ask-ai" element={<ProtectedRoute><AskAIPage /></ProtectedRoute>} />
            <Route path="/upgrade" element={<ProtectedRoute><UpgradePage /></ProtectedRoute>} />
            <Route path="/delete-account" element={<ProtectedRoute><DeleteAccountPage /></ProtectedRoute>} />

            {/* Admin Routes (Standalone Layout) */}
            <Route path="/hq-portal/*" element={
              <ProtectedAdminRoute>
                <ChunkErrorBoundary>
                <React.Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<AdminDashboard />} />
                    <Route path="/subjects" element={<AdminSubjectsPage />} />
                    <Route path="/papers" element={<AdminPapersPage />} />
                    <Route path="/users" element={<AdminUsersPage />} />
                    <Route path="/payments" element={<AdminPaymentsPage />} />
                    <Route path="/notifications" element={<AdminNotificationsPage />} />
                    <Route path="/fallbacks" element={<AdminFallbacksPage />} />
                    <Route path="/broadcast" element={<AdminBroadcastPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </React.Suspense>
                </ChunkErrorBoundary>
              </ProtectedAdminRoute>
            } />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </React.Suspense>
        </ChunkErrorBoundary>
      </main>

      <Routes>
        <Route path="*" element={!shouldHideFooter ? <Footer /> : null} />
      </Routes>

      <AlertModal
        isOpen={sessionExpiredOpen}
        onClose={() => setSessionExpiredOpen(false)}
        title="Session Expired"
        message="You have been logged out because your account was accessed from another device."
        variant="error"
      />

      <AlertModal
        isOpen={accountSuspendedOpen}
        onClose={() => setAccountSuspendedOpen(false)}
        title="Account Suspended"
        message="Your account has been suspended by an administrator. Please contact support if you believe this is a mistake."
        variant="error"
      />

      <AlertModal
        isOpen={accountDeactivatedOpen}
        onClose={() => setAccountDeactivatedOpen(false)}
        title="Account Deactivated"
        message="Your account has been deactivated. Please contact support for more information."
        variant="error"
      />
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <>
        <ScrollToTop />
        <AppRoutes />
      </>
    )
  }
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
