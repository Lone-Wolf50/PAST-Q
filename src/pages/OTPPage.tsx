import { useState, useEffect } from 'react';

import { KeyRound, ArrowRight } from 'lucide-react';

const OTPPage = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timerId = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResend = () => {
    // Add logic to actually call resend API if needed
    setTimeLeft(300);
  };

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    // Auto focus next
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-6">
            <KeyRound className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-theme-primary mb-2">Verify Your Email</h1>
          <p className="text-theme-muted">
            We've sent a 6-digit verification code to your email address.
          </p>
          {timeLeft > 0 ? (
            <p className="text-sm font-medium text-indigo-400 mt-3">
              Code expires in {formatTime(timeLeft)}
            </p>
          ) : (
            <p className="text-sm font-medium text-red-400 mt-3">
              Code has expired. Please request a new one.
            </p>
          )}
        </div>

        <div className="glass-card p-6 md:p-8">
          <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
            <div className="flex justify-between gap-2 sm:gap-4">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold bg-theme-surface border border-theme-border rounded-xl text-theme-primary focus:outline-none focus:border-indigo-500/50"
                  maxLength={1}
                />
              ))}
            </div>

            <button type="submit" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors">
              Verify Account
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-theme-muted">
              Didn't receive the code?{' '}
              <button onClick={handleResend} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Resend Code
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OTPPage;
