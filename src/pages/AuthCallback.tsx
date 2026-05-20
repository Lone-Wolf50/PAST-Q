import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Connecting to Google...');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    
    let isMounted = true;

    const handleCallback = async () => {
      try {
        if (isMounted) setStatus('Verifying your identity...');

        // Get the session that Supabase set after the OAuth redirect
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error('Could not retrieve session from Google. Please try again.');
        }

        if (isMounted) setStatus('Setting up your account...');

        // Exchange the Supabase token for our own custom PastQ JWT
        const data = await apiFetch('/auth/google-login', {
          method: 'POST',
          body: { token: session.access_token },
        });

        if (isMounted) setStatus('All done! Redirecting...');

        // Log into the AuthContext (stores token in session/localStorage)
        login(data.token, data.user);

        // Small delay so the success state is visible
        setTimeout(() => {
          navigate('/papers', { replace: true });
        }, 600);
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        if (isMounted) {
          setError(err.message || 'Something went wrong. Please try again.');
        }
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="w-full flex-grow flex items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-sm p-10 relative overflow-hidden text-center">
        {/* Ambient glows */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-6">
          {error ? (
            <>
              {/* Error state */}
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">
                ✕
              </div>
              <div>
                <h1 className="text-xl font-bold text-theme-primary mb-2">Login Failed</h1>
                <p className="text-sm text-red-400">{error}</p>
              </div>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="w-full py-3 rounded-xl font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-all active:scale-[0.98]"
              >
                Back to Login
              </button>
            </>
          ) : (
            <>
              {/* Loading / success state */}
              <div className="relative w-16 h-16">
                {/* Spinning ring */}
                <svg
                  className="absolute inset-0 w-16 h-16 animate-spin"
                  viewBox="0 0 64 64"
                  fill="none"
                >
                  <circle
                    cx="32" cy="32" r="28"
                    stroke="url(#spinner-gradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="120 40"
                  />
                  <defs>
                    <linearGradient id="spinner-gradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Google G in center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-7 h-7" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                </div>
              </div>

              <div>
                <h1 className="text-xl font-bold text-theme-primary mb-1">Signing you in</h1>
                <p className="text-sm text-theme-muted transition-all duration-500">{status}</p>
              </div>

              {/* Progress dots */}
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-400 opacity-80"
                    style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
