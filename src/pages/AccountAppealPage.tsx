import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageSquare, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

const AccountAppealPage = () => {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !reason.trim()) {
      setError('Please fill in both your email and your reason.');
      return;
    }

    if (reason.trim().length < 20) {
      setError('Please provide a more detailed reason (at least 20 characters).');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/auth/appeal', {
        method: 'POST',
        body: { email: email.trim(), reason: reason.trim() },
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit appeal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full flex-grow flex items-center justify-center px-4 py-12">
        <div className="glass-card w-full max-w-md p-8 md:p-10 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-theme-primary mb-3">Appeal Submitted</h1>
            <p className="text-sm text-theme-muted mb-6">
              Your account restoration request has been sent to our team. We'll review it and get back to you via email if approved.
            </p>
            <p className="text-xs text-theme-muted mb-8">
              This process may take up to 24–48 hours. Please be patient.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-grow flex items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-md p-8 md:p-10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="mb-6">
            <Link to="/login" className="flex items-center gap-2 text-sm text-theme-muted hover:text-theme-primary transition-colors w-fit">
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-theme-primary mb-2">Request Account Restoration</h1>
            <p className="text-sm text-theme-muted">
              If your account was previously deleted and you'd like it restored, submit an appeal below. Our team will review your request.
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-theme-secondary ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
                <input
                  type="email"
                  placeholder="your@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-4 text-theme-primary placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-theme-surface-2 transition-colors"
                  required
                />
              </div>
              <p className="text-xs text-theme-muted ml-1">Enter the email associated with your deleted account.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-theme-secondary ml-1">Reason for Restoration</label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-theme-muted" />
                <textarea
                  placeholder="Please explain why you'd like your account restored..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-4 text-theme-primary placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-theme-surface-2 transition-colors resize-none h-28"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Submitting...' : 'Submit Appeal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AccountAppealPage;
