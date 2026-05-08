import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch } from '../lib/api';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Email passed from ForgotPasswordPage via navigate state
  const email = (location.state as { email?: string })?.email || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 5-minute OTP expiry countdown
  const [timeLeft, setTimeLeft] = useState(300);
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    if (!email) navigate('/forgot-password', { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    let score = 0;
    if (password.length > 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    setStrength(score);
  }, [password]);

  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-400'];

  const handleOtpChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      if (value !== '' && index < 5) {
        document.getElementById(`reset-otp-${index + 1}`)?.focus();
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      document.getElementById(`reset-otp-${index - 1}`)?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (timeLeft <= 0) {
      setError('The code has expired. Please go back and request a new one.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { email, otp: otp.join(''), new_password: password },
      });
      navigate('/login', { state: { reset: true } });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex-grow flex items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-md p-8 md:p-10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-theme-primary mb-2">Create new password</h1>
            <p className="text-sm text-theme-muted">
              Enter the code sent to <span className="text-theme-primary font-medium">{email}</span> and your new password.
            </p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {/* OTP Input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-medium text-theme-secondary flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> Verification code
                </label>
                {timeLeft > 0 ? (
                  <span className="text-xs font-medium text-indigo-400">Expires in {formatTime(timeLeft)}</span>
                ) : (
                  <span className="text-xs font-medium text-red-400">Code expired</span>
                )}
              </div>
              <div className="flex justify-between gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`reset-otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-13 text-center text-xl font-semibold bg-theme-surface border border-theme-border rounded-xl text-theme-primary focus:outline-none focus:border-indigo-500/50 focus:bg-theme-surface-2 transition-colors py-3"
                  />
                ))}
              </div>
              {timeLeft <= 0 && (
                <Link to="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 ml-1">
                  Request a new code →
                </Link>
              )}
            </div>

            {/* New Password */}
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

              {password && (
                <div className="mt-1 flex flex-col gap-1">
                  <div className="flex gap-1 h-1.5 w-full">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={clsx(
                          'flex-1 rounded-full transition-colors duration-300',
                          strength >= level ? strengthColors[strength] : 'bg-theme-surface-2'
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-theme-muted">
                    <ShieldCheck className="w-3 h-3" />
                    <span>
                      Password strength:{' '}
                      <span className={clsx('font-medium', `text-${strengthColors[strength].split('-')[1]}-400`)}>
                        {strengthLabels[strength]}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
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
              disabled={loading || password !== confirmPassword || password.length === 0 || timeLeft <= 0}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:bg-theme-surface-2 disabled:text-theme-muted disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-[0.98]"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

