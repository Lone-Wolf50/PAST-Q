import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, ShieldCheck } from 'lucide-react';

const VerifyEmailPage = () => {
  const [code, setCode] = useState(['', '', '', '', '', '']);

  const handleChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
      
      // Auto-focus next input
      if (value !== '' && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        if (nextInput) nextInput.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && code[index] === '' && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  return (
    <div className="w-full flex-grow flex items-center justify-center px-4 py-12 mb-24 md:mb-0">
      <div className="glass-card w-full max-w-md p-8 md:p-10 relative overflow-hidden">
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
              We sent a 6-digit verification code to <span className="text-theme-primary font-medium">name@university.edu</span>
            </p>
          </div>

          <form className="flex flex-col gap-6">
            <div className="flex justify-between gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 md:w-14 md:h-16 text-center text-2xl font-semibold bg-theme-surface border border-theme-border rounded-xl text-theme-primary focus:outline-none focus:border-indigo-500/50 focus:bg-theme-surface-2 transition-colors"
                />
              ))}
            </div>

            <button 
              type="submit" 
              className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] active:scale-[0.98]"
            >
              <ShieldCheck className="w-5 h-5" />
              Verify Email
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-theme-muted mb-2">
              Didn't receive the code?
            </p>
            <button className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
              Resend code (0:59)
            </button>
          </div>
          
          <div className="mt-6 text-center">
             <Link to="/login" className="text-sm text-theme-muted hover:text-theme-secondary transition-colors">
               Back to sign in
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
