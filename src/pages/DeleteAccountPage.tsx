import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Lock } from 'lucide-react';

const DeleteAccountPage = () => {
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');

  return (
    <div className="w-full flex-grow flex items-center justify-center px-4 py-12 mb-24 md:mb-0">
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
            This action is <strong className="text-red-400 font-semibold">permanent and cannot be undone</strong>. All your past papers history, AI conversations, and premium plan access will be permanently deleted.
          </p>

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
              <label className="text-sm font-medium text-theme-secondary ml-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password to confirm" 
                  className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-4 text-theme-primary placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:bg-theme-surface-2 transition-colors"
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
                type="submit" 
                disabled={!password}
                className="flex-1 py-3 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-theme-surface-2 disabled:text-theme-muted transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] active:scale-[0.98]"
              >
                Delete Account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountPage;
