import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, X, AtSign, Globe, ChevronDown, BookOpen, Shield, HelpCircle, Zap, FileText } from 'lucide-react';
import { clsx } from 'clsx';

// ── Data ──────────────────────────────────────────────────────────────────────
const FOOTER_SECTIONS = [
  {
    title: 'Platform',
    icon: Zap,
    links: [
      { label: 'Browse Papers', href: '/papers', desc: 'Search past questions by subject and year' },
      { label: 'Pricing & Plans', href: '/pricing', desc: 'Free, Basic, Plus, and Pro tiers' },
      { label: 'Ask AI Tutor', href: '/ask-ai', desc: 'Get instant explanations powered by Gemini' },
      { label: 'Create Account', href: '/register', desc: 'Join thousands of students today' },
    ],
  },
  {
    title: 'Resources',
    icon: BookOpen,
    links: [
      { label: 'How It Works', href: '/#how-it-works', desc: 'Step-by-step guide to using PastQ' },
      { label: 'Study Tips', href: '/#tips', desc: 'Evidence-based exam preparation strategies' },
      { label: 'Supported Schools', href: '/#schools', desc: 'Universities covered on the platform' },
      { label: 'Subject Categories', href: '/papers', desc: 'Business, Law, Engineering, and more' },
    ],
  },
  {
    title: 'Support',
    icon: HelpCircle,
    links: [
      { label: 'Help Centre', href: '/help', desc: 'FAQs and troubleshooting guides' },
      { label: 'Contact Us', href: 'mailto:support@pastq.com', desc: 'support@pastq.com' },
      { label: 'Report an Issue', href: '/report', desc: 'Flag a broken paper or wrong content' },
      { label: 'Feature Request', href: '/feedback', desc: 'Tell us what you need' },
    ],
  },
  {
    title: 'Legal',
    icon: Shield,
    links: [
      { label: 'Privacy Policy', href: '/privacy', desc: 'How we handle your personal data' },
      { label: 'Terms of Service', href: '/terms', desc: 'Your rights and responsibilities' },
      { label: 'Cookie Policy', href: '/cookies', desc: 'What cookies we use and why' },
      { label: 'Academic Integrity', href: '/integrity', desc: 'Ethical use of past questions' },
    ],
  },
];

// ── Accordion Item (mobile only) ───────────────────────────────────────────────
const AccordionSection = ({ section }: { section: typeof FOOTER_SECTIONS[0] }) => {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;

  return (
    <div className="border-b border-theme-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-theme-primary">{section.title}</span>
        </div>
        <ChevronDown
          className={clsx(
            'w-4 h-4 text-theme-muted transition-transform duration-300',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Animated accordion body */}
      <div
        className={clsx(
          'overflow-hidden transition-all duration-300 ease-in-out',
          open ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0'
        )}
      >
        <div className="flex flex-col gap-3 pl-6">
          {section.links.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="group flex flex-col gap-0.5"
            >
              <span className="text-sm text-theme-secondary group-hover:text-theme-primary transition-colors">{link.label}</span>
              <span className="text-xs text-theme-muted group-hover:text-theme-muted transition-colors">{link.desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main Footer ────────────────────────────────────────────────────────────────
const Footer = () => {
  return (
    <footer className="mt-20 px-4 md:px-8 pb-8 max-w-7xl mx-auto w-full">
      <div className="glass-card relative overflow-hidden border-theme-border">
        {/* Background glows */}
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Brand Band */}
        <div className="px-6 md:px-12 pt-10 md:pt-14 pb-8 border-b border-theme-border relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-md">
              <Link to="/" className="inline-block mb-3">
                <span className="text-2xl font-bold tracking-tight text-theme-primary">Past<span className="text-indigo-400">Q</span></span>
              </Link>
              <p className="text-theme-muted text-sm leading-relaxed">
                PastQ helps university students across Ghana access, study, and understand past exam questions. Powered by AI, designed for academic success.
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-6 mt-5">
                {[
                  { value: '10,000+', label: 'Students' },
                  { value: '1,200+', label: 'Papers' },
                  { value: '50+', label: 'Subjects' },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col">
                    <span className="text-lg font-bold text-theme-primary">{s.value}</span>
                    <span className="text-xs text-theme-muted">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Newsletter */}
            <div className="max-w-xs w-full">
              <p className="text-sm font-medium text-theme-primary mb-1">Stay updated</p>
              <p className="text-xs text-theme-muted mb-3">Get notified when new past papers are added for your subject.</p>
              <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className="w-full bg-theme-surface border border-theme-border rounded-xl py-2.5 pl-9 pr-3 text-sm text-theme-primary placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors shrink-0"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ── All Devices: Responsive Accordion Grid ── */}
        <div className="px-6 md:px-12 py-10 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            {FOOTER_SECTIONS.map((section) => (
              <AccordionSection key={section.title} section={section} />
            ))}
          </div>
        </div>

        {/* ── Highlight Info Bar ── */}
        <div className="mx-6 md:mx-12 mb-8 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-theme-primary">Free access to 5 papers every month</p>
              <p className="text-xs text-theme-muted mt-0.5">No credit card needed. Upgrade anytime to unlock unlimited access and AI tutoring.</p>
            </div>
          </div>
          <Link
            to="/register"
            className="shrink-0 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors"
          >
            Get Started Free
          </Link>
        </div>

        {/* ── Bottom Bar ── */}
        <div className="px-6 md:px-12 py-5 border-t border-theme-border flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
          <p className="text-xs text-theme-muted text-center sm:text-left">
            © {new Date().getFullYear()} PastQ. Built for students, by students. 🇬🇭
          </p>

          <div className="flex items-center gap-4">
            {/* Social Links */}
            {[
              { icon: X, href: '#', label: 'X (Twitter)' },
              { icon: AtSign, href: '#', label: 'Instagram' },
              { icon: Globe, href: '#', label: 'LinkedIn' },
              { icon: Mail, href: 'mailto:support@pastq.com', label: 'Email' },
            ].map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-theme-surface hover:bg-theme-surface-2 border border-theme-border hover:border-indigo-500/30 transition-all text-theme-muted hover:text-theme-primary"
              >
                <Icon className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <span className="text-xs font-medium text-theme-muted tracking-wider uppercase">All Systems Go</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
