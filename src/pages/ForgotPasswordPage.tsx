import { Link } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';

const ForgotPasswordPage = () => {
  return (
    <div className="w-full flex-grow flex items-center justify-center px-4 py-12 mb-24 md:mb-0">
      <div className="glass-card w-full max-w-md p-8 md:p-10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="mb-6">
            <Link to="/login" className="flex items-center gap-2 text-sm text-theme-muted hover:text-theme-primary transition-colors w-fit">
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-theme-primary mb-2">Reset password</h1>
            <p className="text-sm text-theme-muted">
              Enter the email address associated with your account and we'll send you a verification code.
            </p>
          </div>

          <form className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-theme-secondary ml-1">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
                <input 
                  type="email" 
                  placeholder="name@university.edu" 
                  className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-4 text-theme-primary placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-theme-surface-2 transition-colors"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] active:scale-[0.98]"
            >
              Send Code
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
