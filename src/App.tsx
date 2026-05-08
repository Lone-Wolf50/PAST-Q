import React from 'react';
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
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import InstallPrompt from './components/InstallPrompt';
import AdminNotificationsPage from './pages/AdminNotificationsPage';
import StudentSubscriptionPage from './pages/StudentSubscriptionPage';
import StudentNotificationsPage from './pages/StudentNotificationsPage';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
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

function AppRoutes() {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  const hideFooterRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
  const isAdminPath = location.pathname.startsWith('/hq-portal');
  const isLandingPage = location.pathname === '/';
  const shouldHideFooter = (isLoggedIn && !isLandingPage) || isAdminPath || hideFooterRoutes.includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col font-sans relative">
      <InstallPrompt />
      <Routes>
        <Route path="/hq-portal/*" element={null} />
        <Route path="*" element={<Navbar />} />
      </Routes>
      <main className={`flex-grow flex flex-col ${isLoggedIn ? 'pb-24 md:pb-0' : ''}`}>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* Guest-only Auth Routes */}
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
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
            <Routes>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="/subjects" element={<AdminSubjectsPage />} />
              <Route path="/papers" element={<AdminPapersPage />} />
              <Route path="/users" element={<AdminUsersPage />} />
              <Route path="/payments" element={<AdminPaymentsPage />} />
              <Route path="/notifications" element={<AdminNotificationsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          } />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Routes>
        <Route path="*" element={!shouldHideFooter ? <Footer /> : null} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
