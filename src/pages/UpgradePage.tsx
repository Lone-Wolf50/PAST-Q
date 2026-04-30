import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, ShieldCheck, CheckCircle2 } from 'lucide-react';

const UpgradePage = () => {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan') || 'plus';

  const planDetails = {
    basic: { name: 'Basic', price: '10', color: 'text-cyan-400' },
    plus: { name: 'Plus', price: '25', color: 'text-indigo-400' },
    pro: { name: 'Pro', price: '50', color: 'text-orange-400' }
  }[plan] || { name: 'Plus', price: '25', color: 'text-indigo-400' };

  return (
    <div className="w-full flex-grow flex items-center justify-center px-4 py-12 mb-24 md:mb-0">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left: Summary */}
        <div className="flex flex-col justify-center">
          <Link to="/pricing" className="flex items-center gap-2 text-sm text-theme-muted hover:text-theme-primary transition-colors mb-8 w-fit">
            <ArrowLeft className="w-4 h-4" />
            Back to Pricing
          </Link>

          <h1 className="text-3xl font-bold text-theme-primary mb-4">Complete your upgrade</h1>
          <p className="text-theme-muted mb-8">
            You're upgrading to the <span className={`font-semibold ${planDetails.color}`}>{planDetails.name}</span> plan. Get ready to supercharge your studies.
          </p>

          <div className="glass-card p-6 border-theme-border mb-6">
            <h3 className="text-lg font-medium text-theme-primary mb-4">Order Summary</h3>
            <div className="flex justify-between items-center mb-3">
              <span className="text-theme-muted">PastQ {planDetails.name} Plan (Monthly)</span>
              <span className="text-theme-primary font-medium">GH₵{planDetails.price}.00</span>
            </div>
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-theme-border">
              <span className="text-theme-muted">Taxes</span>
              <span className="text-theme-primary font-medium">GH₵0.00</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-theme-primary font-semibold">Total Due Today</span>
              <span className="text-2xl font-bold text-theme-primary">GH₵{planDetails.price}.00</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-theme-muted">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <p>Payments are securely processed by Paystack. Cancel anytime from your profile.</p>
          </div>
        </div>

        {/* Right: Payment Form Mockup */}
        <div className="glass-card p-8 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <h2 className="text-xl font-semibold text-theme-primary mb-6 relative z-10">Payment Details</h2>
          
          <form className="flex flex-col gap-5 relative z-10" onSubmit={(e) => e.preventDefault()}>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-theme-secondary ml-1">Email Address</label>
              <input 
                type="email" 
                value="john.doe@university.edu"
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

            <button 
              type="submit" 
              className="mt-4 w-full py-4 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-[0.98]"
            >
              Pay GH₵{planDetails.price}.00
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UpgradePage;
