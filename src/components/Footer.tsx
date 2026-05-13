import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, BookOpen, Shield, HelpCircle, Zap, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import ContactModal from './ContactModal';
import { useAuth } from '../context/AuthContext';

// ── Data ──────────────────────────────────────────────────────────────────────
const FOOTER_SECTIONS = (openContact: (subj?: string) => void) => [
  {
    title: 'Platform',
    icon: Zap,
    links: [
      { 
        label: 'Browse Papers', 
        href: '/papers', 
        desc: 'Search UPSA questions',
        popover: {
          title: 'UPSA Database',
          content: 'Access a specialized collection of past exam questions specifically from UPSA, organized by level, semester, and department.'
        }
      },
      { 
        label: 'Pricing & Plans', 
        href: '/pricing', 
        desc: 'Flexible study tiers',
        popover: {
          title: 'Student Plans',
          content: 'Affordable plans designed for UPSA students. Get unlimited PDF downloads and AI tutoring to ace your end-of-semester exams.'
        }
      },
      { 
        label: 'Ask AI Tutor', 
        href: '/ask-ai', 
        desc: 'Instant AI explanations',
        popover: {
          title: 'Advanced AI Tutor',
          content: 'Stuck on a difficult question? Our AI tutor explains concepts instantly, helping you understand the "why" behind every answer.'
        }
      },
      { 
        label: 'Join Today', 
        href: '/register', 
        desc: 'Join 10,000+ students',
        popover: {
          title: 'Start Free',
          content: 'Creating an account is instant. Start with 5 free papers every month and upgrade whenever you need more power.'
        }
      },
    ],
  },
  {
    title: 'Resources',
    icon: BookOpen,
    links: [
      { 
        label: 'How It Works', 
        href: '/#how-it-works', 
        desc: 'Quick start guide',
        popover: {
          title: 'Easy Navigation',
          content: 'Search for your course code, download the PDF, and use the AI sidebar to get explanations while you study.'
        }
      },
      { 
        label: 'Study Tips', 
        href: '/#tips', 
        desc: 'Preparation strategies',
        popover: {
          title: 'Exam Success',
          content: 'Learn how to use active recall and spaced repetition with our past papers to maximize your GPA.'
        }
      },
      { 
        label: 'Supported Depts', 
        href: '/papers', 
        desc: 'IT, Law, Business...',
        popover: {
          title: 'UPSA Departments',
          content: 'We cover IT, Business Admin, Marketing, Accounting, Logistics & Transport, Law, Public Relations, and Actuarial Science.'
        }
      },
      { 
        label: 'Subject Categories', 
        href: '/papers', 
        desc: 'View all courses',
        popover: {
          title: 'Course Coverage',
          content: 'Every department at UPSA is covered, from basic level 100 courses to advanced level 400 and professional programs.'
        }
      },
    ],
  },
  {
    title: 'Support',
    icon: HelpCircle,
    links: [
      { 
        label: 'Help Centre', 
        href: '/#faq', 
        desc: 'FAQs and guides',
        popover: {
          title: 'Self-Service',
          content: 'Find answers to common questions about your account, billing, and how to use the AI features.'
        }
      },
      { 
        label: 'Contact Us', 
        onClick: () => openContact('General Support'), 
        desc: 'Get in touch',
        popover: {
          title: 'Talk to Us',
          content: 'Send a message directly to our support team. We usually respond to UPSA students within 24 hours.'
        }
      },
      { 
        label: 'Report an Issue', 
        onClick: () => openContact('Technical Issue'), 
        desc: 'Flag broken content',
        popover: {
          title: 'Fix Content',
          content: 'Found a typo or a broken PDF? Report it here and our team will fix it immediately for the community.'
        }
      },
      { 
        label: 'Feature Request', 
        onClick: () => openContact('Feature Request'), 
        desc: 'Tell us what you need',
        popover: {
          title: 'Your Voice',
          content: 'Want a new feature or a specific subject added? Tell us and we will put it on our development roadmap.'
        }
      },
    ],
  },
  {
    title: 'Legal',
    icon: Shield,
    links: [
      { 
        label: 'Privacy Policy', 
        href: '/privacy', 
        desc: 'Your data safety',
        popover: {
          title: 'Privacy Matters',
          content: 'We prioritize your data security. We never sell your personal information or UPSA study history to third parties.'
        }
      },
      { 
        label: 'Terms & Conditions', 
        href: '/terms', 
        desc: 'Platform rules',
        popover: {
          title: 'User Agreement',
          content: 'Our terms ensure a fair and safe environment. This includes fair usage of AI resources and subscription rules.'
        }
      },
      { 
        label: 'Cookie Policy', 
        href: '/cookies', 
        desc: 'Browser cookies',
        popover: {
          title: 'Cookie Usage',
          content: 'We use essential cookies to keep you logged in and session-specific cookies to save your theme preferences.'
        }
      },
      { 
        label: 'Academic Integrity', 
        href: '/integrity', 
        desc: 'Ethical studying',
        popover: {
          title: 'Our Pledge',
          content: 'PastQ is a study aid, not a cheating tool. Use papers to understand concepts, not just to memorize answers.'
        }
      },
    ],
  },
];

// ── Main Footer ────────────────────────────────────────────────────────────────
const Footer = () => {
  const { isLoggedIn } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSubject, setContactSubject] = useState('General Support');
  const [subscriberEmail, setSubscriberEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const openContact = (subj?: string) => {
    if (subj) setContactSubject(subj);
    setContactOpen(true);
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriberEmail) return;
    
    setIsSubscribed(true);
    setSubscriberEmail('');
    
    // Reset after 3 seconds
    setTimeout(() => {
      setIsSubscribed(false);
    }, 3000);
  };

  return (
    <footer className="mt-20 px-4 md:px-8 pb-32 md:pb-8 max-w-7xl mx-auto w-full">
      <ContactModal 
        isOpen={contactOpen} 
        onClose={() => setContactOpen(false)} 
        initialSubject={contactSubject}
      />

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
              <form className="flex gap-2" onSubmit={handleSubscribe}>
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                  <input
                    type="email"
                    value={subscriberEmail}
                    onChange={(e) => setSubscriberEmail(e.target.value)}
                    placeholder="your@email.com"
                    disabled={isSubscribed}
                    className="w-full bg-theme-surface border border-theme-border rounded-xl py-2.5 pl-9 pr-3 text-sm text-theme-primary placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubscribed}
                  className={clsx(
                    "px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0",
                    isSubscribed 
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                      : "bg-indigo-500 hover:bg-indigo-600 text-white"
                  )}
                >
                  {isSubscribed ? 'Subscribed!' : 'Subscribe'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ── Highlight Info Bar (Moved Above Grid) ── */}
        {!isLoggedIn ? (
          <div className="mx-6 md:mx-12 mt-8 mb-2 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-theme-primary">Free access to 5 papers every month</p>
                <p className="text-xs text-theme-muted mt-0.5">No credit card needed. Upgrade anytime to unlock unlimited access and AI tutoring.</p>
              </div>
            </div>
            <Link
              to="/register"
              className="shrink-0 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-500/20"
            >
              Get Started Free
            </Link>
          </div>
        ) : (
          <div className="mx-6 md:mx-12 mt-8 mb-2 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <p className="text-sm font-medium text-theme-primary">Your Study Hub is Active</p>
                <p className="text-xs text-theme-muted mt-0.5">Keep your streak alive. Dive into past papers and ace your next exam.</p>
              </div>
            </div>
            <Link
              to="/papers"
              className="shrink-0 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white text-xs font-semibold transition-all shadow-lg"
            >
              Resume Studying
            </Link>
          </div>
        )}

        {/* ── All Devices: Premium Clean Grid ── */}
        <div className="px-6 md:px-12 py-8 relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10 md:gap-8">
            {FOOTER_SECTIONS(openContact).map((section) => {
              const Icon = section.icon;
              return (
                <div key={section.title} className="flex flex-col">
                  <div className="flex items-center gap-2 mb-4 md:mb-6">
                    <div className="p-1.5 rounded-md bg-indigo-500/10">
                      <Icon className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <span className="text-sm font-bold text-theme-primary">{section.title}</span>
                  </div>
                  <div className="flex flex-col gap-3 md:gap-4">
                    {section.links.map((link: any) => {
                      const content = (
                        <div className="group flex flex-col text-left">
                          <span className="text-[13px] font-medium text-theme-muted group-hover:text-indigo-400 transition-colors">{link.label}</span>
                          <span className="text-[10px] text-theme-muted/50 mt-0.5 group-hover:text-theme-muted transition-colors">{link.desc}</span>
                        </div>
                      );

                      return link.href ? (
                        <Link key={link.label} to={link.href} className="w-full inline-block">
                          {content}
                        </Link>
                      ) : (
                        <button key={link.label} onClick={link.onClick} className="w-full text-left">
                          {content}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Bottom Bar ── */}
        <div className="px-6 md:px-12 py-5 border-t border-theme-border flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
          <p className="text-xs text-theme-muted text-center sm:text-left flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span>© {new Date().getFullYear()} PastQ. Built for students, by students. 🇬🇭</span>
            <span className="hidden sm:inline text-theme-border">•</span>
            <span className="text-[10px] font-black tracking-widest text-indigo-400/70 uppercase">Sponsored by Wolf Team 🐺</span>
          </p>



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
