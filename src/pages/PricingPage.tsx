import { Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const PLANS = [
  {
    name: 'Free',
    price: '0',
    description: 'Perfect to get started and try out the platform.',
    features: [
      { text: '4 PDF views / 3 days', included: true },
      { text: '4 PDF downloads / 3 days', included: true },
      { text: '3 AI queries / 10 hrs', included: true },
      { text: 'No AI history tracking', included: false },
      { text: 'No AI File Upload', included: false },
      { text: 'Standard AI Tutor', included: true }
    ],
    cta: 'Get Started',
    href: '/register',
    popular: false,
    color: 'from-gray-500 to-gray-400'
  },
  {
    name: 'Basic',
    price: '10',
    duration: 'month',
    description: 'Essential tools for active students.',
    features: [
      { text: 'Unlimited viewing', included: true },
      { text: '20 PDF downloads / cycle', included: true },
      { text: '10 AI queries / month', included: true },
      { text: 'Upload up to 5 files', included: true },
      { text: 'No AI history tracking', included: false },
      { text: 'Standard AI Tutor', included: true }
    ],
    cta: 'Upgrade to Basic',
    href: '/upgrade?plan=basic',
    popular: false,
    color: 'from-blue-500 to-cyan-400'
  },
  {
    name: 'Plus',
    price: '25',
    duration: 'month',
    description: 'Unlock AI capabilities to study smarter.',
    features: [
      { text: 'Unlimited papers & downloads', included: true },
      { text: 'Unlimited AI queries', included: true },
      { text: 'Unlimited File Uploads', included: true },
      { text: '7-day AI history', included: true },
      { text: 'Study Plan Generation', included: true }
    ],
    cta: 'Upgrade to Plus',
    href: '/upgrade?plan=plus',
    popular: true,
    color: 'from-indigo-500 to-purple-500'
  },
  {
    name: 'Pro',
    price: '50',
    duration: 'month',
    description: 'The ultimate toolkit for acing your exams.',
    features: [
      { text: 'Everything in Plus', included: true },
      { text: 'Unlimited AI queries', included: true },
      { text: 'VIP AI history access', included: true },
      { text: 'AI Tutor Chat (Live)', included: true },
      { text: 'Personalized Study Analytics', included: true }
    ],
    cta: 'Get Pro',
    href: '/upgrade?plan=pro',
    popular: false,
    color: 'from-amber-500 to-orange-400'
  }
];

const PricingPage = () => {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 md:px-8 max-w-7xl mx-auto py-12">
      <div className="text-center max-w-2xl mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-theme-primary mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-theme-muted">
          Choose the plan that best fits your study needs. Upgrade anytime to unlock more powerful tools.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full">
        {PLANS.map((plan) => (
          <div 
            key={plan.name} 
            onClick={() => setSelectedPlan(plan.name)}
            className={clsx(
              "relative glass-card flex flex-col p-8 transition-all duration-300 cursor-pointer",
              selectedPlan === plan.name ? "border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.3)] scale-100 xl:scale-105 z-10" :
              plan.popular ? "border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-100 xl:scale-105 z-10" : "border-theme-border hover:border-theme-border"
            )}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-4 rounded-full">
                Most Popular
              </div>
            )}
            
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-theme-primary mb-2">{plan.name}</h3>
              <p className="text-sm text-theme-muted min-h-[40px]">{plan.description}</p>
            </div>

            <div className="mb-8">
                <span className="text-4xl font-bold text-theme-primary">GH₵{plan.price}</span>
                {plan.name !== 'Free' && (
                  <span className="text-theme-muted mb-1">
                    /{plan.duration === 'week' ? 'wk' : 'mo'}
                  </span>
                )}
            </div>

            <Link 
              to={plan.href}
              className={clsx(
                "w-full py-3 px-4 rounded-xl font-medium text-sm text-center transition-all mb-8",
                plan.popular 
                  ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]" 
                  : "bg-theme-surface-2 hover:bg-indigo-500/10 hover:border-indigo-500/50 text-theme-primary border border-theme-border"
              )}
            >
              {plan.cta}
            </Link>

            <div className="flex flex-col gap-3 mt-auto">
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  {feature.included ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-theme-surface text-theme-muted flex items-center justify-center shrink-0 mt-0.5">
                      <X className="w-3 h-3" />
                    </div>
                  )}
                  <span className={clsx("text-sm", feature.included ? "text-theme-secondary" : "text-theme-muted")}>
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingPage;

