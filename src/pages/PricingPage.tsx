import { Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import { useState, useRef } from 'react';

const PLANS = [
  {
    name: 'Free',
    price: '0',
    description: 'Perfect to get started and explore the platform.',
    features: [
      { text: '4 PDF views / 3 days', included: true },
      { text: '4 PDF downloads / 3 days', included: true },
      { text: '3 AI queries / 10 hrs', included: true },
      { text: 'AI history tracking', included: false },
      { text: 'AI File Upload', included: false },
      { text: 'Standard AI Tutor', included: true },
    ],
    cta: 'Get Started',
    href: '/register',
    popular: false,
    gradient: 'from-gray-600 to-gray-500',
    accent: 'border-theme-border',
  },
  {
    name: 'Basic',
    price: '10',
    duration: 'month',
    description: 'Essential tools for active students.',
    features: [
      { text: 'Unlimited paper viewing', included: true },
      { text: '20 PDF downloads / cycle', included: true },
      { text: '10 AI queries / month', included: true },
      { text: 'Upload up to 5 files', included: true },
      { text: 'AI history tracking', included: false },
      { text: 'Standard AI Tutor', included: true },
    ],
    cta: 'Upgrade to Basic',
    href: '/upgrade?plan=basic',
    popular: false,
    gradient: 'from-blue-500 to-cyan-400',
    accent: 'border-blue-500/30',
  },
  {
    name: 'Plus',
    price: '25',
    duration: 'month',
    description: 'Unlock full AI capabilities. Study smarter.',
    features: [
      { text: 'Unlimited papers & downloads', included: true },
      { text: 'Unlimited AI queries', included: true },
      { text: 'Unlimited file uploads', included: true },
      { text: '7-day AI history', included: true },
      { text: 'Study plan generation', included: true },
      { text: 'Priority AI responses', included: true },
    ],
    cta: 'Upgrade to Plus',
    href: '/upgrade?plan=plus',
    popular: true,
    gradient: 'from-indigo-500 to-purple-500',
    accent: 'border-indigo-500/60',
  },
  {
    name: 'Pro',
    price: '50',
    duration: 'month',
    description: 'The ultimate toolkit for acing every exam.',
    features: [
      { text: 'Everything in Plus', included: true },
      { text: 'VIP AI history access', included: true },
      { text: 'Live AI Tutor Chat', included: true },
      { text: 'Personalized analytics', included: true },
      { text: 'Early access to features', included: true },
      { text: 'Dedicated support', included: true },
    ],
    cta: 'Get Pro',
    href: '/upgrade?plan=pro',
    popular: false,
    gradient: 'from-amber-500 to-orange-400',
    accent: 'border-amber-500/30',
  },
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
      const diff = Math.abs(child.offsetLeft - 16 - scrollLeft);
      if (diff < minDiff) { minDiff = diff; closestIndex = index; }
    });
    setActiveDot(closestIndex);
  };

  const scrollToCard = (index: number) => {
    if (!containerRef.current) return;
    const children = Array.from(containerRef.current.children) as HTMLElement[];
    const card = children[index];
    if (card) {
      containerRef.current.scrollTo({ left: card.offsetLeft - 16, behavior: 'smooth' });
    }
    setActiveDot(index);
  };

  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 md:px-8 max-w-7xl mx-auto py-12 md:py-16">

      {/* Header */}
      <div className="text-center max-w-2xl mb-12 md:mb-16">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-theme-primary mb-4 tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="text-sm md:text-base text-theme-muted leading-relaxed max-w-lg mx-auto">
          Choose the plan that fits your study needs. Upgrade anytime to unlock more powerful tools.
        </p>
      </div>

      {/* ── Cards: horizontal scroll on mobile, grid on desktop ── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex md:grid md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 w-full overflow-x-auto md:overflow-x-visible snap-x snap-mandatory px-0 pt-6 pb-8 md:pb-0 scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {PLANS.map((plan, index) => (
          <div
            key={plan.name}
            onClick={() => { setSelectedPlan(plan.name); scrollToCard(index); }}
            className={clsx(
              'relative glass-card flex flex-col transition-all duration-300 cursor-pointer snap-center shrink-0',
              /* mobile: take up most of the viewport width, leave a peek of next card */
              'w-[82vw] max-w-[320px] md:w-auto md:max-w-none md:shrink-0 xl:shrink',
              /* padding — smaller on mobile */
              'p-5 md:p-7',
              selectedPlan === plan.name
                ? 'border-indigo-500 shadow-[0_0_40px_rgba(99,102,241,0.25)] scale-[1.01] md:scale-105 z-10'
                : plan.popular
                  ? `${plan.accent} shadow-[0_0_25px_rgba(99,102,241,0.12)] md:scale-105 z-10`
                  : 'border-theme-border hover:border-theme-border/80'
            )}
          >
            {/* Popular badge */}
            {plan.popular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] font-black uppercase tracking-[0.15em] py-1.5 px-4 rounded-full shadow-lg whitespace-nowrap">
                Most Popular
              </div>
            )}

            {/* Plan name + description */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-lg font-black text-theme-primary">{plan.name}</h3>
                {/* colour dot */}
                <div className={clsx('w-2.5 h-2.5 rounded-full bg-gradient-to-br', plan.gradient)} />
              </div>
              <p className="text-xs text-theme-muted leading-relaxed">{plan.description}</p>
            </div>

            {/* Price */}
            <div className="mb-5 flex items-baseline gap-1">
              <span className="text-3xl md:text-4xl font-black text-theme-primary">GH₵{plan.price}</span>
              {plan.duration && (
                <span className="text-theme-muted font-semibold text-xs">/ mo</span>
              )}
            </div>

            {/* CTA button */}
            <Link
              to={plan.href}
              onClick={(e) => e.stopPropagation()}
              className={clsx(
                'w-full py-3 px-4 rounded-xl font-bold text-sm text-center transition-all mb-5 shadow-sm block',
                plan.popular
                  ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20'
                  : 'bg-theme-surface-2 hover:bg-indigo-500/10 hover:border-indigo-500/40 text-theme-primary border border-theme-border'
              )}
            >
              {plan.cta}
            </Link>

            {/* Feature list */}
            <div className="flex flex-col gap-3 mt-auto">
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  {feature.included ? (
                    <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-theme-surface text-theme-muted flex items-center justify-center shrink-0 mt-0.5 border border-theme-border">
                      <X className="w-2.5 h-2.5" />
                    </div>
                  )}
                  <span className={clsx(
                    'text-xs font-medium leading-snug',
                    feature.included ? 'text-theme-secondary' : 'text-theme-muted'
                  )}>
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Swipe dots — mobile only */}
      <div className="flex md:hidden justify-center gap-2 mt-3">
        {PLANS.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToCard(i)}
            aria-label={`Go to plan ${i + 1}`}
            className={clsx(
              'h-1.5 rounded-full transition-all duration-300',
              activeDot === i ? 'w-6 bg-indigo-500' : 'w-1.5 bg-theme-border'
            )}
          />
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-8 text-[11px] text-theme-muted text-center max-w-sm">
        All plans include access to the paper archive. Prices in GHS. Cancel or upgrade anytime.
      </p>
    </div>
  );
};

export default PricingPage;
