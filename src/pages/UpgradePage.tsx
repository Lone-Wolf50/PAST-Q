import { useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, ShieldCheck, CheckCircle2, Loader2, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

const UpgradePage = () => {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan') || 'plus';
  const { user, token } = useAuth();  // use token from context, not localStorage
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProcessing = useRef(false);

  const handlePayment = async () => {
    if (success || isProcessing.current) return;
    isProcessing.current = true;
    setLoading(true);
    setError(null);

    // Guard: make sure we have an email before proceeding
    const emailToUse = user?.email || '';
    if (!emailToUse) {
      setError('Could not read your email address. Please log out and log back in.');
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch('/payments/initialize', {
        method: 'POST',
        body: { plan },
        token: token || undefined
      });

      if ((window as any).PaystackPop) {
        const handler = (window as any).PaystackPop.setup({
          key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
          email: res.email,
          amount: res.totalInKobo,
          currency: 'GHS',
          ref: res.reference,
          // No metadata here — prevents Paystack from using it for receipt display
          callback: function (response: any) {
            // Close the Paystack iframe immediately so their receipt screen never shows
            try { handler.close(); } catch (_) { /* ignore */ }

            // Verify payment on the server
            (async () => {
              try {
                const ref = response.reference || res.reference;
                await apiFetch(`/payments/verify/${ref}`, { token: token || undefined });
                setSuccess(true);
                setLoading(false);
                isProcessing.current = false;
              } catch (err: any) {
                console.error('Payment verification failed:', err?.message || 'Unknown error');
                isProcessing.current = false;
                window.location.href = '/profile?error=verification_failed';
              }
            })();
          },
          onClose: function () {
            setLoading(false);
            isProcessing.current = false;
          }
        });
        handler.openIframe();
      } else if (res.authorization_url) {
        // Fallback: redirect to hosted checkout page
        window.location.href = res.authorization_url;
      } else {
        setError('Failed to get payment URL from server.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Payment initialization failed. Please try again.');
      setLoading(false);
      isProcessing.current = false;
    }
  };

  // ── Fee calculation (mirrors backend exactly) ─────────────────────────────
  const planPrices: Record<string, number> = { basic: 10, plus: 25, pro: 50 };
  const baseAmount = planPrices[plan] || 25;
  const percentageFee = 0.0195;
  const flatFee = 0.50;
  const grossed = (baseAmount + flatFee) / (1 - percentageFee);
  const fee = parseFloat(Math.min(grossed - baseAmount, 2000).toFixed(2));
  const totalCharged = parseFloat((baseAmount + fee).toFixed(2));

  const planDetails: Record<string, { name: string; color: string; duration: string }> = {
    basic: { name: 'Basic', color: 'text-cyan-400', duration: 'week' },
    plus:  { name: 'Plus',  color: 'text-indigo-400', duration: 'month' },
    pro:   { name: 'Pro',   color: 'text-orange-400', duration: 'month' },
  };
  const details = planDetails[plan] || planDetails['plus'];

  return (
    <div className="w-full flex-grow flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Left: Order Summary */}
        <div className="flex flex-col justify-center">
          <Link to="/pricing" className="flex items-center gap-2 text-sm text-theme-muted hover:text-theme-primary transition-colors mb-8 w-fit">
            <ArrowLeft className="w-4 h-4" />
            Back to Pricing
          </Link>

          <h1 className="text-3xl font-bold text-theme-primary mb-4">Complete your upgrade</h1>
          <p className="text-theme-muted mb-8">
            You're upgrading to the <span className={`font-semibold ${details.color}`}>{details.name}</span> plan. Get ready to supercharge your studies.
          </p>

          <div className="glass-card p-6 border-theme-border mb-6">
            <h3 className="text-lg font-medium text-theme-primary mb-4">Order Summary</h3>

            <div className="flex justify-between items-center mb-3">
              <span className="text-theme-muted">PastQ {details.name} Plan (per {details.duration})</span>
              <span className="text-theme-primary font-medium">GH₵{baseAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center mb-4 pb-4 border-b border-theme-border">
              <span className="flex items-center gap-1.5 text-theme-muted text-sm">
                Paystack processing fee
                <span title="Paystack charges 1.95% + GH₵0.50 per transaction. This fee is passed on so you receive the full plan value." className="cursor-help">
                  <Info className="w-3.5 h-3.5 text-theme-muted opacity-70" />
                </span>
              </span>
              <span className="text-amber-400 font-medium text-sm">+ GH₵{fee.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-theme-primary font-semibold">Total Due Today</span>
              <span className="text-2xl font-bold text-theme-primary">GH₵{totalCharged.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-theme-muted">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <p>Payments are securely processed by Paystack. Cancel anytime from your profile.</p>
          </div>
        </div>

        {/* Right: Payment form */}
        <div className="glass-card p-8 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-xl font-semibold text-theme-primary mb-6 relative z-10">Payment Details</h2>

          {success ? (
            <div className="flex flex-col items-center text-center py-8 relative z-10 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6 ring-4 ring-emerald-500/10">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-theme-primary mb-3">Upgrade Successful!</h2>
              <p className="text-theme-muted mb-8 max-w-xs">
                Your account has been upgraded to the <strong>{details.name}</strong> plan. You now have full access to all features.
              </p>
              <Link
                to="/profile"
                className="w-full py-4 rounded-xl font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] flex items-center justify-center gap-2"
              >
                Go to Profile
              </Link>
            </div>
          ) : (
            <form className="flex flex-col gap-5 relative z-10" onSubmit={(e) => { e.preventDefault(); handlePayment(); }}>
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-theme-secondary ml-1">Email Address</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 px-4 text-theme-muted opacity-70 cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-theme-secondary ml-1">Mobile Money / Card via Paystack</label>
                <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm font-medium text-theme-primary">Paystack Secure Checkout</span>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                </div>
              </div>

              {/* Fee breakdown before paying */}
              <div className="rounded-xl bg-theme-surface border border-theme-border p-4 text-sm flex flex-col gap-2">
                <div className="flex justify-between text-theme-muted">
                  <span>Plan price</span>
                  <span>GH₵{baseAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-400">
                  <span>Processing fee (1.95% + GH₵0.50)</span>
                  <span>+ GH₵{fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-theme-primary font-bold border-t border-theme-border pt-2 mt-1">
                  <span>You will be charged</span>
                  <span>GH₵{totalCharged.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !user?.email}
                className="mt-2 w-full py-4 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Opening Paystack...
                  </>
                ) : (
                  `Pay GH₵${totalCharged.toFixed(2)} →`
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradePage;
