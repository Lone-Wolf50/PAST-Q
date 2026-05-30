import { Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import { useState, useRef } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollLeft = containerRef.current.scrollLeft;
    const children = Array.from(containerRef.current.children) as HTMLElement[];
    let closestIndex = 0;
    let minDiff = Infinity;
    
    children.forEach((child, index) => {
      const diff = Math.abs(child.offsetLeft - 24 - scrollLeft);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });
    setActiveDot(closestIndex);
  };

  const handleCardClick = (planName: string, index: number) => {
    setSelectedPlan(planName);
    if (window.innerWidth < 768 && containerRef.current) {
      const children = Array.from(containerRef.current.children) as HTMLElement[];
      const cardElement = children[index];
      if (cardElement) {
        containerRef.current.scrollTo({
          left: cardElement.offsetLeft - 24,
          behavior: 'smooth'
        });
      }
    }
  };

  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 md:px-8 max-w-7xl mx-auto py-12">
      <div className="text-center max-w-2xl mb-12 md:mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-theme-primary mb-4 tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="text-base md:text-lg text-theme-muted">
          Choose the plan that best fits your study needs. Upgrade anytime to unlock more powerful tools.
        </p>
      </div>

      {/* Plans Container: Snap-scrollable flex on mobile, grid on tablet/desktop */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex md:grid md:grid-cols-2 xl:grid-cols-4 gap-6 w-[calc(100%+2rem)] md:w-full overflow-x-auto md:overflow-x-visible snap-x snap-mandatory px-4 md:px-0 pb-8 md:pb-0 scrollbar-hide -mx-4 md:mx-0"
      >
        {PLANS.map((plan, index) => (
          <div 
            key={plan.name} 
            onClick={() => handleCardClick(plan.name, index)}
            className={clsx(
              "relative glass-card flex flex-col p-8 transition-all duration-300 cursor-pointer snap-center shrink-0 w-[85vw] md:w-auto md:shrink-0 xl:shrink",
              selectedPlan === plan.name ? "border-indigo-500 shadow-[0_0_35px_rgba(99,102,241,0.25)] scale-100 xl:scale-105 z-10" :
              plan.popular ? "border-indigo-500/50 shadow-[0_0_25px_rgba(99,102,241,0.12)] scale-100 xl:scale-105 z-10" : "border-theme-border hover:border-theme-border/80"
            )}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full shadow-md">
                Most Popular
              </div>
            )}
            
            <div className="mb-6">
              <h3 className="text-xl font-bold text-theme-primary mb-2 flex items-center justify-between">
                {plan.name}
                {plan.popular && <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded font-black uppercase tracking-tight md:hidden">POPULAR</span>}
              </h3>
              <p className="text-sm text-theme-muted min-h-[40px] leading-relaxed">{plan.description}</p>
            </div>

            <div className="mb-8">
              <span className="text-4xl font-black text-theme-primary">GH₵{plan.price}</span>
              {plan.name !== 'Free' && (
                <span className="text-theme-muted font-semibold text-sm">
                  /{plan.duration === 'week' ? 'wk' : 'mo'}
                </span>
              )}
            </div>

            <Link 
              to={plan.href}
              className={clsx(
                "w-full py-3.5 px-4 rounded-xl font-bold text-sm text-center transition-all mb-8 shadow-sm",
                plan.popular 
                  ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20" 
                  : "bg-theme-surface-2 hover:bg-indigo-500/10 hover:border-indigo-500/40 text-theme-primary border border-theme-border"
              )}
            >
              {plan.cta}
            </Link>

            <div className="flex flex-col gap-3.5 mt-auto">
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  {feature.included ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                      <Check className="w-3 h-3" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-theme-surface text-theme-muted flex items-center justify-center shrink-0 mt-0.5 border border-theme-border">
                      <X className="w-3 h-3" />
                    </div>
                  )}
                  <span className={clsx("text-sm font-medium leading-tight", feature.included ? "text-theme-secondary" : "text-theme-muted")}>
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Swipe dots for mobile */}
      <div className="flex md:hidden justify-center gap-2 mt-4">
        {PLANS.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              if (containerRef.current) {
                const children = Array.from(containerRef.current.children) as HTMLElement[];
                const cardElement = children[i];
                if (cardElement) {
                  containerRef.current.scrollTo({
                    left: cardElement.offsetLeft - 24,
                    behavior: 'smooth'
                  });
                }
              }
              setActiveDot(i);
            }}
            className={clsx(
              "h-1.5 rounded-full transition-all duration-300",
              activeDot === i ? "w-6 bg-indigo-500" : "w-1.5 bg-theme-border"
            )}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default PricingPage;
