import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import PapersPage from './pages/PapersPage';
import PaperViewerPage from './pages/PaperViewerPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PricingPage from './pages/PricingPage';
import ProfilePage from './pages/ProfilePage';
import AskAIPage from './pages/AskAIPage';
import UpgradePage from './pages/UpgradePage';
import DeleteAccountPage from './pages/DeleteAccountPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminSubjectsPage from './pages/AdminSubjectsPage';
import AdminPapersPage from './pages/AdminPapersPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminPaymentsPage from './pages/AdminPaymentsPage';
import AdminLoginPage from './pages/AdminLoginPage';
import NotFoundPage from './pages/NotFoundPage';
import AuthCallback from './pages/AuthCallback';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import InstallPrompt from './components/InstallPrompt';
import AdminNotificationsPage from './pages/AdminNotificationsPage';
import StudentSubscriptionPage from './pages/StudentSubscriptionPage';
import StudentNotificationsPage from './pages/StudentNotificationsPage';
import { AlertModal } from './components/ui/AlertModal';
import { GlobalBanner } from './components/GlobalBanner';

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
              <Routes>
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/subjects" element={<AdminSubjectsPage />} />
                <Route path="/papers" element={<AdminPapersPage />} />
                <Route path="/users" element={<AdminUsersPage />} />
                <Route path="/payments" element={<AdminPaymentsPage />} />
                <Route path="/notifications" element={<AdminNotificationsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </ProtectedAdminRoute>
          } />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
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
