import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import OTPPage from './pages/OTPPage';
import AdminNotificationsPage from './pages/AdminNotificationsPage';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration failed: ', err);
    });
  });
}

// Mock state: change to true to test protected routes
const isAuthenticated = true;

// A mock ProtectedRoute component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // In a real app, this would check an auth context or token


  if (!isAuthenticated) {
    // Return the 404/Wrong Path page as requested
    return <NotFoundPage />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col font-sans relative">
        <InstallPrompt />
        <Routes>
          <Route path="/admin/*" element={null} />
          <Route path="*" element={<Navbar />} />
        </Routes>
        <main className="flex-grow flex flex-col">
          <Routes>
            <Route path="/" element={<LandingPage />} />

            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/otp" element={<OTPPage />} />
            <Route path="/pricing" element={<PricingPage />} />

            {/* Admin Login - Public, Standalone (no Navbar/Footer) */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Protected Routes */}
            <Route path="/papers" element={<ProtectedRoute><PapersPage /></ProtectedRoute>} />
            <Route path="/papers/:id" element={<ProtectedRoute><PaperViewerPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/ask-ai" element={<ProtectedRoute><AskAIPage /></ProtectedRoute>} />
            <Route path="/upgrade" element={<ProtectedRoute><UpgradePage /></ProtectedRoute>} />
            <Route path="/delete-account" element={<ProtectedRoute><DeleteAccountPage /></ProtectedRoute>} />

            {/* Admin Routes (Standalone Layout) */}
            <Route path="/admin/*" element={

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

            {/* Catch-all 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        {/* Only show Footer & Navbar on non-admin routes */}
        <Routes>
          <Route path="/admin/*" element={null} />
          <Route path="*" element={!isAuthenticated ? <Footer /> : null} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;







