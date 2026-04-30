import { useState, useEffect } from 'react';

import { Lock, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

const ResetPasswordPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [strength, setStrength] = useState(0);

  // Simple password strength calculator
  useEffect(() => {
    let score = 0;
    if (password.length > 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    setStrength(score);
  }, [password]);

  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const strengthColors = [
    'bg-red-500', 
    'bg-orange-500', 
    'bg-yellow-500', 
    'bg-emerald-500', 
    'bg-emerald-400'
  ];

  return (
    <div className="w-full flex-grow flex items-center justify-center px-4 py-12 mb-24 md:mb-0">
      <div className="glass-card w-full max-w-md p-8 md:p-10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-theme-primary mb-2">Create new password</h1>
            <p className="text-sm text-theme-muted">
              Your new password must be different from previous used passwords.
            </p>
          </div>

          <form className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-theme-secondary ml-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-10 text-theme-primary placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-theme-surface-2 transition-colors"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-theme-muted hover:text-theme-secondary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password && (
                <div className="mt-1 flex flex-col gap-1">
                  <div className="flex gap-1 h-1.5 w-full">
                    {[1, 2, 3, 4].map((level) => (
                      <div 
                        key={level} 
                        className={clsx(
                          "flex-1 rounded-full transition-colors duration-300",
                          strength >= level ? strengthColors[strength] : "bg-theme-surface-2"
                        )} 
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-theme-muted">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Password strength: <span className={clsx("font-medium", `text-${strengthColors[strength].split('-')[1]}-400`)}>{strengthLabels[strength]}</span></span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-theme-secondary ml-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-10 text-theme-primary placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-theme-surface-2 transition-colors"
                  required
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 ml-1 mt-1">Passwords do not match</p>
              )}
            </div>

            <button 
              type="submit" 
              disabled={password !== confirmPassword || password.length === 0}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:bg-theme-surface-2 disabled:text-theme-muted transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] active:scale-[0.98]"
            >
              Reset Password
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
