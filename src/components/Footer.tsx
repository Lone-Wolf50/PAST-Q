import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Mail, BookOpen, Shield, HelpCircle, Zap, FileText, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import ContactModal from './ContactModal';
import { Modal } from './ui/Modal';
import { useAuth } from '../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FooterLink {
  label: string;
  href?: string;
  onClick?: () => void;
  desc: string;
  popover: { title: string; content: string };
}

interface FooterSection {
  title: string;
  icon: React.ElementType;
  links: FooterLink[];
}

// ── Data ──────────────────────────────────────────────────────────────────────
const buildSections = (openContact: (s?: string) => void): FooterSection[] => [
  {
    title: 'Platform',
    icon: Zap,
    links: [
      { label: 'Browse Papers', href: '/papers', desc: 'Search UPSA questions',
        popover: { title: 'UPSA Database', content: 'Access past exam questions from UPSA, organized by level, semester, and department.' } },
      { label: 'Pricing & Plans', href: '/pricing', desc: 'Flexible study tiers',
        popover: { title: 'Student Plans', content: 'Affordable plans for UPSA students. Get unlimited PDF downloads and AI tutoring.' } },
      { label: 'Ask AI Tutor', href: '/ask-ai', desc: 'Instant AI explanations',
        popover: { title: 'Advanced AI Tutor', content: 'Get instant step-by-step explanations on any past paper question, 24/7.' } },
      { label: 'Join Today', href: '/register', desc: 'Join 10,000+ students',
        popover: { title: 'Start Free', content: 'Create an account in seconds. 5 free papers every month, no credit card needed.' } },
    ],
  },
  {
    title: 'Resources',
    icon: BookOpen,
    links: [
      { label: 'How It Works', href: '/#how-it-works', desc: 'Quick start guide',
        popover: { title: 'Easy Navigation', content: 'Search by course code, download the PDF, and use the AI sidebar while you study.' } },
      { label: 'Study Tips', href: '/#tips', desc: 'Preparation strategies',
        popover: { title: 'Exam Success', content: 'Use active recall and spaced repetition with our past papers to maximize your GPA.' } },
      { label: 'Departments', href: '/papers', desc: 'IT, Law, Business…',
        popover: { title: 'UPSA Departments', content: 'We cover IT, Business Admin, Marketing, Accounting, Logistics, Law, PR, and Actuarial Science.' } },
      { label: 'All Subjects', href: '/papers', desc: 'View all courses',
        popover: { title: 'Course Coverage', content: 'Every department from Level 100 foundations to Level 400 and professional programs.' } },
    ],
  },
  {
    title: 'Support',
    icon: HelpCircle,
    links: [
      { label: 'Help Centre', href: '/#faq', desc: 'FAQs and guides',
        popover: { title: 'Self-Service', content: 'Answers to common questions about your account, billing, and AI features.' } },
      { label: 'Contact Us', onClick: () => openContact('General Support'), desc: 'Get in touch',
        popover: { title: 'Talk to Us', content: 'Message our support team. We respond to UPSA students within 24 hours.' } },
      { label: 'Report an Issue', onClick: () => openContact('Technical Issue'), desc: 'Flag broken content',
        popover: { title: 'Fix Content', content: 'Found a typo or broken PDF? Report it and our team will fix it immediately.' } },
      { label: 'Feature Request', onClick: () => openContact('Feature Request'), desc: 'Tell us what you need',
        popover: { title: 'Your Voice', content: 'Want a new feature or subject added? We read every request and act on them.' } },
    ],
  },
  {
    title: 'Legal',
    icon: Shield,
    links: [
      { label: 'Privacy Policy', href: '/privacy', desc: 'Your data safety',
        popover: { title: 'Privacy Matters', content: 'We never sell your data or UPSA study history to third parties.' } },
      { label: 'Terms & Conditions', href: '/terms', desc: 'Platform rules',
        popover: { title: 'User Agreement', content: 'Our terms ensure fair usage of AI resources and a safe environment for all.' } },
      { label: 'Cookie Policy', href: '/cookies', desc: 'Browser cookies',
        popover: { title: 'Cookie Usage', content: 'Essential cookies for login sessions and theme preferences only.' } },
      { label: 'Academic Integrity', href: '/integrity', desc: 'Ethical studying',
        popover: { title: 'Our Pledge', content: 'PastQ is a study aid. Use past papers to understand concepts, not just memorize.' } },
    ],
  },
];

// ── Single Link Row ────────────────────────────────────────────────────────────
// Clicking the label text opens an info modal explaining what it is.
function LinkRow({ link }: { link: FooterLink }) {
  const [infoOpen, setInfoOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setInfoOpen(true);
  };

  const label = (
    <span className="text-[13px] font-medium text-theme-muted hover:text-indigo-400 transition-colors cursor-pointer underline-offset-2 hover:underline decoration-indigo-400/40">
      {link.label}
    </span>
  );

  return (
    <>
      {/* The text itself triggers the info modal */}
      {link.href ? (
        <Link to={link.href} onClick={handleClick}>{label}</Link>
      ) : (
        <button
          type="button"
          onClick={(e) => { handleClick(e); link.onClick?.(); }}
          className="text-left"
        >
          {label}
        </button>
      )}

      <Modal isOpen={infoOpen} onClose={() => setInfoOpen(false)} title={link.popover.title} maxWidth="max-w-xs">
        <p className="text-sm text-theme-muted leading-relaxed">{link.popover.content}</p>
      </Modal>
    </>
  );
}

// ── Accordion Section (mobile) ─────────────────────────────────────────────────
function AccordionSection({
  section,
  isOpen,
  onToggle,
}: {
  section: FooterSection;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = section.icon;
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <div className="border-b border-theme-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3.5 text-left focus:outline-none group"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
            <Icon className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <span className="text-sm font-semibold text-theme-primary">{section.title}</span>
        </div>
        <ChevronDown
          className={clsx(
            'w-4 h-4 text-theme-muted transition-transform duration-300',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Animated body — grid-rows trick is reliable across all browsers */}
      <div
        className={clsx(
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div ref={bodyRef} className="pb-4 flex flex-col gap-3 pl-1">
            {section.links.map((link) => (
              <LinkRow key={link.label} link={link} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}




// ── Main Footer ────────────────────────────────────────────────────────────────
const Footer = () => {
  const { isLoggedIn } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSubject, setContactSubject] = useState('General Support');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);

  const toggleAccordion = (idx: number) =>
    setOpenAccordion((prev) => (prev === idx ? null : idx));

  const openContact = (subj?: string) => {
    if (subj) setContactSubject(subj);
    setContactOpen(true);
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    setEmail('');
    setTimeout(() => setSubscribed(false), 3000);
  };

  const sections = buildSections(openContact);

  return (
    <footer className="mt-16 px-4 md:px-8 pb-28 md:pb-6 max-w-7xl mx-auto w-full">
      <ContactModal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
        initialSubject={contactSubject}
      />

      <div className="glass-card relative overflow-hidden border-theme-border">
        {/* Subtle glow accents */}
        <div className="absolute bottom-0 right-0 w-56 h-56 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* ── Brand + Newsletter ── */}
        <div className="px-5 md:px-10 pt-8 pb-6 border-b border-theme-border relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            {/* Brand */}
            <div>
              <Link to="/" className="inline-block mb-1.5">
                <span className="text-xl font-bold tracking-tight text-theme-primary">
                  Past<span className="text-indigo-400">Q</span>
                </span>
              </Link>
              <p className="text-xs text-theme-muted max-w-xs leading-relaxed">
                20 years of UPSA past papers — powered by AI, built for academic success.
              </p>
              {/* Mini stats */}
              <div className="flex items-center gap-4 mt-3">
                {[
                  { v: '10k+', l: 'Students' },
                  { v: '1,200+', l: 'Papers' },
                  { v: '50+', l: 'Subjects' },
                ].map((s) => (
                  <div key={s.l} className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-theme-primary">{s.v}</span>
                    <span className="text-[10px] text-theme-muted">{s.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Newsletter */}
            <div className="sm:max-w-[240px] w-full shrink-0">
              <p className="text-xs font-semibold text-theme-primary mb-0.5">Stay in the loop</p>
              <p className="text-[11px] text-theme-muted mb-2.5">New papers drop weekly — be first to know.</p>
              <form className="flex gap-2" onSubmit={handleSubscribe}>
                <div className="relative flex-1">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    disabled={subscribed}
                    className="w-full bg-theme-surface border border-theme-border rounded-lg py-2 pl-8 pr-2 text-xs text-theme-primary placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={subscribed}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-xs font-semibold transition-all shrink-0',
                    subscribed
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                  )}
                >
                  {subscribed ? '✓ Done' : 'Go'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ── CTA Banner ── */}
        <div className="mx-5 md:mx-10 mt-5 mb-1 relative z-10">
          {!isLoggedIn ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-theme-primary">5 free papers every month</p>
                  <p className="text-[10px] text-theme-muted">No card needed. Upgrade anytime.</p>
                </div>
              </div>
              <Link
                to="/register"
                className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-bold transition-colors shadow-lg shadow-indigo-500/20"
              >
                Get Started
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                <div>
                  <p className="text-xs font-semibold text-theme-primary">Your Study Hub is Active</p>
                  <p className="text-[10px] text-theme-muted">Keep your streak alive.</p>
                </div>
              </div>
              <Link
                to="/papers"
                className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white text-[11px] font-bold transition-all"
              >
                Continue
              </Link>
            </div>
          )}
        </div>

        {/* ── Links Grid — Desktop/Tablet ── */}
        <div className="hidden md:block px-5 md:px-10 pt-6 pb-5 relative z-10">
          <div className="grid grid-cols-4 gap-6">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <div key={section.title}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="p-1 rounded-md bg-indigo-500/10">
                      <Icon className="w-3 h-3 text-indigo-400" />
                    </div>
                    <span className="text-xs font-bold text-theme-primary uppercase tracking-wider">
                      {section.title}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {section.links.map((link) => (
                      <LinkRow key={link.label} link={link} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Accordion — Mobile only ── */}
        <div className="md:hidden px-5 pt-4 pb-2 relative z-10">
          {sections.map((section, idx) => (
            <AccordionSection
              key={section.title}
              section={section}
              isOpen={openAccordion === idx}
              onToggle={() => toggleAccordion(idx)}
            />
          ))}
        </div>

        {/* ── Bottom Bar ── */}
        <div className="px-5 md:px-10 py-4 border-t border-theme-border flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
          <p className="text-[11px] text-theme-muted text-center sm:text-left flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-0.5">
            <span>© {new Date().getFullYear()} PastQ — Built for students, by students. 🇬🇭</span>
            <span className="text-theme-border hidden sm:inline">·</span>
            <span className="text-[10px] font-black tracking-widest text-indigo-400/60 uppercase">
              Wolf Team 🐺
            </span>
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
            <span className="text-[10px] font-semibold text-theme-muted tracking-widest uppercase">
              All Systems Go
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
