import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import InstallPrompt from './components/InstallPrompt';
import { AlertModal } from './components/ui/AlertModal';
import { GlobalBanner } from './components/GlobalBanner';

// Lazy load pages for premium performance and dynamic code splitting
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const PapersPage = React.lazy(() => import('./pages/PapersPage'));
const PaperViewerPage = React.lazy(() => import('./pages/PaperViewerPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const VerifyEmailPage = React.lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage'));
const PricingPage = React.lazy(() => import('./pages/PricingPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const AskAIPage = React.lazy(() => import('./pages/AskAIPage'));
const UpgradePage = React.lazy(() => import('./pages/UpgradePage'));
const DeleteAccountPage = React.lazy(() => import('./pages/DeleteAccountPage'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const AdminSubjectsPage = React.lazy(() => import('./pages/AdminSubjectsPage'));
const AdminPapersPage = React.lazy(() => import('./pages/AdminPapersPage'));
const AdminUsersPage = React.lazy(() => import('./pages/AdminUsersPage'));
const AdminPaymentsPage = React.lazy(() => import('./pages/AdminPaymentsPage'));
const AdminLoginPage = React.lazy(() => import('./pages/AdminLoginPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));
const AuthCallback = React.lazy(() => import('./pages/AuthCallback'));
const AdminNotificationsPage = React.lazy(() => import('./pages/AdminNotificationsPage'));
const StudentSubscriptionPage = React.lazy(() => import('./pages/StudentSubscriptionPage'));
const StudentNotificationsPage = React.lazy(() => import('./pages/StudentNotificationsPage'));

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
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);

  useEffect(() => {
    const handleSessionExpired = () => setSessionExpiredOpen(true);
    window.addEventListener('session_expired', handleSessionExpired);
    return () => window.removeEventListener('session_expired', handleSessionExpired);
  }, []);

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
      <main className={`flex-grow flex flex-col ${isLoggedIn ? 'pb-24 md:pb-0' : ''}`}>
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
            <Route path="/subscription" element={<ProtectedRoute><StudentSubscriptionPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><StudentNotificationsPage /></ProtectedRoute>} />
            <Route path="/ask-ai" element={<ProtectedRoute><AskAIPage /></ProtectedRoute>} />
            <Route path="/upgrade" element={<ProtectedRoute><UpgradePage /></ProtectedRoute>} />
            <Route path="/delete-account" element={<ProtectedRoute><DeleteAccountPage /></ProtectedRoute>} />

            {/* Admin Routes (Standalone Layout) */}
            <Route path="/hq-portal/*" element={
              <ProtectedAdminRoute>
                <React.Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<AdminDashboard />} />
                    <Route path="/subjects" element={<AdminSubjectsPage />} />
                    <Route path="/papers" element={<AdminPapersPage />} />
                    <Route path="/users" element={<AdminUsersPage />} />
                    <Route path="/payments" element={<AdminPaymentsPage />} />
                    <Route path="/notifications" element={<AdminNotificationsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </React.Suspense>
              </ProtectedAdminRoute>
            } />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </React.Suspense>
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
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
