import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const StudentSubscriptionPage = () => {
  const { user } = useAuth();
  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 md:px-8 max-w-4xl mx-auto py-12">
      <div className="w-full mb-6">
        <Link to="/profile" className="flex items-center gap-2 text-sm text-theme-muted hover:text-theme-primary transition-colors w-fit mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Profile
        </Link>
        <h1 className="text-3xl font-bold text-theme-primary mb-2">Subscription Plan</h1>
        <p className="text-theme-muted">Manage your billing and subscription details.</p>
      </div>

      <div className="w-full flex flex-col gap-6">
        <div className="glass-card p-6 md:p-8 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-theme-primary capitalize">{user?.plan || 'Free'} Plan</h2>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider border border-emerald-500/20">Active</span>
              </div>
              <p className="text-theme-muted">
                {user?.plan === 'free' 
                  ? 'You are on the free tier. Upgrade for more AI queries and features.' 
                  : 'You have an active premium subscription.'}
              </p>
            </div>
            <div className="text-left md:text-right">
              {user?.plan === 'free' && <p className="text-3xl font-bold text-theme-primary">GH₵0<span className="text-lg text-theme-muted font-normal">/mo</span></p>}
              {user?.plan === 'basic' && <p className="text-3xl font-bold text-theme-primary">GH₵10<span className="text-lg text-theme-muted font-normal">/mo</span></p>}
              {user?.plan === 'plus' && <p className="text-3xl font-bold text-theme-primary">GH₵25<span className="text-lg text-theme-muted font-normal">/mo</span></p>}
              {user?.plan === 'pro' && <p className="text-3xl font-bold text-theme-primary">GH₵50<span className="text-lg text-theme-muted font-normal">/mo</span></p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {user?.plan === 'free' && ['Access to standard past papers', '2 AI queries per day', 'Community support'].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                <span className="text-theme-secondary">{feature}</span>
              </div>
            ))}
            {user?.plan === 'basic' && ['Access to all past papers', '10 AI queries per day', 'Basic performance stats', 'Standard support'].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                <span className="text-theme-secondary">{feature}</span>
              </div>
            ))}
            {user?.plan === 'plus' && ['Access to all past papers', '50 AI queries per day', 'Advanced stats', 'Priority support', 'Download PDFs'].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                <span className="text-theme-secondary">{feature}</span>
              </div>
            ))}
            {user?.plan === 'pro' && ['Access to all past papers', 'Unlimited AI queries', '1-on-1 AI Tutoring', 'Premium support', 'Download PDFs'].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                <span className="text-theme-secondary">{feature}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/pricing" className="flex-1 py-3 rounded-xl font-medium text-center text-white bg-indigo-500 hover:bg-indigo-600 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              {user?.plan === 'free' ? 'Upgrade Plan' : 'Change Plan'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentSubscriptionPage;

