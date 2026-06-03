import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Type, CheckCircle, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const DeleteAccountPage = () => {
  const { token: authToken, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmationWord, setConfirmationWord] = useState('');
  const [targetWord, setTargetWord] = useState('');
  const [token, setToken] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    const fetchWord = async () => {
      try {
        const data = await apiFetch('/profile/delete-word', { token: authToken! });
        setTargetWord(data.word);
        setToken(data.token);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch confirmation word.');
      }
    };
    fetchWord();
  }, [authToken]);

  const handleDelete = async () => {
    setError('');
    setLoading(true);
    try {
      await apiFetch('/profile/me', {
        method: 'DELETE',
        token: authToken!,
        body: { confirmation_word: confirmationWord, token }
      });
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to delete account.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="w-full flex-grow flex items-center justify-center px-4 py-12">
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card max-w-md w-full p-8 text-center relative animate-fade-in">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-theme-primary mb-2">Account Deleted</h2>
            <p className="text-theme-muted mb-6">
              Your account has been successfully deleted. Your personal data and activity have been removed. We’re sorry to see you go!
            </p>
            <button
              onClick={handleCloseModal}
              className="w-full py-3 rounded-xl font-medium text-white bg-theme-surface-2 hover:bg-theme-surface transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      <div className="glass-card w-full max-w-lg p-8 md:p-10 relative overflow-hidden border-red-500/20">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="mb-6">
            <Link to="/profile" className="flex items-center gap-2 text-sm text-theme-muted hover:text-theme-primary transition-colors w-fit">
              <ArrowLeft className="w-4 h-4" />
              Back to Profile
            </Link>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-theme-primary">Delete Account</h1>
          </div>
          
          <p className="text-sm text-theme-secondary mb-6 bg-red-500/5 p-4 rounded-xl border border-red-500/10">
            This action is <strong className="text-red-400 font-semibold">permanent and cannot be undone</strong>. Your history, AI conversations, and premium plan access will be removed. Note: your email address will be retained to prevent re-registration and preserve platform integrity.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
            </div>
          )}

          <form className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-theme-secondary ml-1">Why are you leaving? (Optional)</label>
              <textarea 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Let us know how we can improve..."
                className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 px-4 text-theme-primary placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:bg-theme-surface-2 transition-colors resize-none h-24"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-theme-secondary ml-1">
                Type <span className="font-bold text-red-400 select-all">{targetWord || '...'}</span> to confirm
              </label>
              <div className="relative">
                <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
                <input 
                  type="text" 
                  value={confirmationWord}
                  onChange={(e) => setConfirmationWord(e.target.value)}
                  onBlur={(e) => setConfirmationWord(e.target.value.toUpperCase())}
                  placeholder={`Enter ${targetWord}`} 
                  className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-4 text-theme-primary placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:bg-theme-surface-2 transition-colors uppercase"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <Link 
                to="/profile"
                className="flex-1 py-3 rounded-xl font-medium text-center text-theme-primary bg-theme-surface-2 hover:bg-theme-surface-2 transition-colors"
              >
                Cancel
              </Link>
              <button 
                type="button" 
                onClick={handleDelete}
                disabled={confirmationWord !== targetWord || !targetWord || loading}
                className="flex-1 py-3 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-theme-surface-2 disabled:text-theme-muted transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] active:scale-[0.98]"
              >
                {loading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountPage;

