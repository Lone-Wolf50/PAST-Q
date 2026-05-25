import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Email is passed via navigate state from RegisterPage
  const email = (location.state as { email?: string })?.email || '';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // If no email in state (e.g. direct navigation), redirect to register
  useEffect(() => {
    if (!email) navigate('/register', { replace: true });
  }, [email, navigate]);

  const [expiresIn, setExpiresIn] = useState(300); // 5 minutes

  // Expiry timer countdown
  useEffect(() => {
    if (expiresIn <= 0) return;
    const timer = setInterval(() => setExpiresIn((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [expiresIn]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
      if (value !== '' && index < 5) {
        document.getElementById(`otp-${index + 1}`)?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && code[index] === '' && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const otp = code.join('');
    if (otp.length < 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/auth/verify-email', {
        method: 'POST',
        body: { email, otp },
      });
      if (res.token && res.user) {
        login(res.token, res.user);
        navigate('/papers', { replace: true });
      } else {
        navigate('/login', { state: { verified: true } });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setError('');
    setSuccess('');
    try {
      await apiFetch('/auth/resend-otp', {
        method: 'POST',
        body: { email },
      });
      setSuccess('A new code has been sent to your email.');
      setCanResend(false);
      setResendCooldown(60);
      setExpiresIn(300);
      setCode(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full flex-grow flex items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-md p-6 sm:p-8 md:p-10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-theme-surface border border-theme-border flex items-center justify-center text-emerald-400">
              <Mail className="w-8 h-8" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-theme-primary mb-2">Check your email</h1>
            <p className="text-sm text-theme-muted">
              We sent a 6-digit verification code to{' '}
              <span className="text-theme-primary font-medium">{email}</span>
            </p>
            {expiresIn > 0 ? (
              <p className="text-xs font-medium text-orange-400 mt-2">
                Code expires in: {Math.floor(expiresIn / 60).toString().padStart(2, '0')}:{(expiresIn % 60).toString().padStart(2, '0')}
              </p>
            ) : (
              <p className="text-xs font-medium text-red-500 mt-2">Code has expired. Please resend.</p>
            )}
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
              {success}
            </div>
          )}

          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex justify-between gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="flex-1 min-w-0 max-w-[3rem] sm:max-w-[3.5rem] h-12 sm:h-14 md:h-16 text-center text-xl sm:text-2xl font-semibold bg-theme-surface border border-theme-border rounded-xl text-theme-primary focus:outline-none focus:border-indigo-500/50 focus:bg-theme-surface-2 transition-colors"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-[0.98]"
            >
              <ShieldCheck className="w-5 h-5" />
              {loading ? 'Verifying...' : 'Verify Email'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-theme-muted mb-2">Didn't receive the code?</p>
            <button
              onClick={handleResend}
              disabled={!canResend}
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300 disabled:text-theme-muted disabled:cursor-not-allowed transition-colors"
            >
              {canResend ? 'Resend code' : `Resend in ${resendCooldown}s`}
            </button>
          </div>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-theme-muted hover:text-theme-secondary transition-colors">
              Back to log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;

