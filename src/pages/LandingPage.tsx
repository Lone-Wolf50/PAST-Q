import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Sparkles, Layout, Zap, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

const CAROUSEL_WORDS = ["breakthrough.", "A+ Grade.", "study hack.", "past paper."];

const HERO_IMAGES = [
  { url: "/adonyig-school-times-3599175_1920.jpg", title: "Study Smarter", desc: "Collaborate with peers and access the best materials." },
  { url: "/adonyig-school-times-3599176_1920.jpg", title: "Focused Learning", desc: "Master difficult concepts with step-by-step guidance." },
  { url: "/adonyig-school-times-3599182_1920.jpg", title: "Better Results", desc: "Join thousands of successful students." },
  { url: "/ahmadardity-books-2463779_1920.jpg", title: "Infinite Knowledge", desc: "Explore over 20 years of past examination papers." },
  { url: "/elasticcomputefarm-library-1147815_1920.jpg", title: "Your Digital Library", desc: "Access resources anytime, anywhere." },
  { url: "/kollinger-books-5211309_1920.jpg", title: "Organized Success", desc: "Everything you need for your exams in one place." },
];

const LandingPage = () => {
  const [wordIndex, setWordIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [totalPapers, setTotalPapers] = useState(0);
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiFetch('/papers/subjects/public');
        if (res.subjects) {
          const total = res.subjects.reduce((sum: number, s: any) => sum + (s.count || 0), 0);
          setTotalPapers(total);
        }
      } catch (err) {
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const wordInterval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % CAROUSEL_WORDS.length);
    }, 3000);
    const imageInterval = setInterval(() => {
      setImageIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => {
      clearInterval(wordInterval);
      clearInterval(imageInterval);
    };
  }, []);

  return (
    <div className="w-full flex-grow flex flex-col items-center">

      {/* Hero Section */}
      <section className="w-full px-4 md:px-8 max-w-7xl mx-auto mt-12 md:mt-20 mb-24 grid lg:grid-cols-2 gap-12 items-center">
        <div className="text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-theme-surface-2 border border-theme-border text-sm font-medium text-theme-secondary mb-6">
            <SparklesIcon className="w-4 h-4 text-indigo-400" />
            <span>The ultimate study companion for university students</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-theme-primary mb-6 leading-[1.1] min-h-[160px] sm:min-h-[180px] md:min-h-[220px]">
            Find your next <br />
            <span className="gradient-text transition-all duration-500 inline-block">
              {CAROUSEL_WORDS[wordIndex]}
            </span>
          </h1>

          <p className="text-lg text-theme-muted mb-8 max-w-lg leading-relaxed">
            Stop guessing what will be on the exam. Access 20 years of past questions, comprehensive answers, and a powerful AI tutor to help you study smarter, not harder.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
            <Link to={isLoggedIn ? "/papers" : "/register"} className="w-full sm:w-auto px-8 py-3.5 rounded-full text-white bg-indigo-500 hover:bg-indigo-600 transition-all font-semibold text-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              {isLoggedIn ? "Browse Papers" : "Get Started for Free"}
            </Link>
            <Link to={isLoggedIn ? "/papers" : "/login"} className="w-full sm:w-auto px-8 py-3.5 rounded-full text-theme-primary bg-theme-surface-2 border border-theme-border hover:bg-theme-surface transition-all font-semibold text-center">
              {isLoggedIn ? "View Past Papers" : "Log In"}
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {[
              { label: `All Departments`, color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
              { label: `${totalPapers > 0 ? totalPapers.toLocaleString() : '1,500+'} Papers`, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
              { label: '20 Years', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
            ].map((stat) => (
              <div key={stat.label} className={clsx("flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border", stat.color)}>
                <div className="w-2 h-2 rounded-full bg-current opacity-80" />
                {stat.label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative w-full h-[400px] md:h-[500px] hidden lg:block perspective-1000">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-3xl blur-3xl transform -rotate-6"></div>
          <div className="absolute inset-0 bg-theme-surface border border-theme-border rounded-2xl shadow-2xl overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-700">
            {HERO_IMAGES.map((img, idx) => (
              <img
                key={img.url}
                src={img.url}
                alt={img.title}
                className={clsx(
                  "absolute inset-0 w-full h-full object-cover transition-opacity duration-1000",
                  idx === imageIndex ? "opacity-100" : "opacity-0"
                )}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="overflow-hidden">
                <p className={clsx(
                  "text-white font-bold text-2xl mb-1 transition-all duration-500 transform",
                  "translate-y-0 opacity-100"
                )}>
                  {HERO_IMAGES[imageIndex].title}
                </p>
              </div>
              <p className="text-gray-200 text-sm max-w-xs transition-opacity duration-500">
                {HERO_IMAGES[imageIndex].desc}
              </p>
              <div className="flex gap-1.5 mt-4">
                {HERO_IMAGES.map((_, idx) => (
                  <div
                    key={idx}
                    className={clsx(
                      "h-1 rounded-full transition-all duration-300",
                      idx === imageIndex ? "w-6 bg-indigo-400" : "w-1.5 bg-white/30"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase 1: AI Tutor */}
      <section className="w-full px-4 md:px-8 max-w-7xl mx-auto mb-32">
        <div className="glass-card p-8 md:p-12 border-theme-border relative overflow-hidden grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative z-10 w-full h-[300px] md:h-[450px] rounded-2xl overflow-hidden border border-theme-border shadow-2xl group">
            <img src="/leo_fontes-graduation-4502796_1920.jpg" alt="AI Tutor Chat" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 bg-indigo-500/10 group-hover:bg-transparent transition-colors" />
          </div>
          <div className="relative z-10 text-left">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 mb-6">
              <Zap className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-theme-primary mb-4">Stuck on a question? <br />Ask your AI Tutor.</h2>
            <p className="text-theme-muted text-lg mb-8 leading-relaxed">
              Our advanced AI model is trained specifically on university curriculum. Get instant step-by-step explanations, formulas, and guidance without waiting for office hours.
            </p>
            <ul className="space-y-4">
              {[
                "Available 24/7 for instant help",
                "Deep understanding of past papers",
                "Generates practice questions"
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-theme-secondary font-medium">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Feature Showcase 2: Comprehensive Archive */}
      <section className="w-full px-4 md:px-8 max-w-7xl mx-auto mb-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 text-left">
            <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 mb-6">
              <Layout className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-theme-primary mb-4">20 Years of Academic <br />Excellence in One Place.</h2>
            <p className="text-theme-muted text-lg mb-8 leading-relaxed">
              We've digitized and organized a decade and a half of examination materials across all major departments. No more hunting through dusty files or broken links.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: "IT & CS", desc: "Latest tech trends" },
                { title: "Accounting", desc: "Financial mastery" },
                { title: "Marketing", desc: "Brand strategies" },
                { title: "Business Admin", desc: "Management core" }
              ].map((dept) => (
                <div key={dept.title} className="p-4 rounded-2xl bg-theme-surface border border-theme-border">
                  <p className="text-theme-primary font-bold">{dept.title}</p>
                  <p className="text-theme-muted text-xs">{dept.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="order-1 lg:order-2 relative w-full h-[300px] md:h-[450px] rounded-2xl overflow-hidden border border-theme-border shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 blur-2xl" />
            <div className="relative h-full w-full p-8 flex items-center justify-center">
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="aspect-square relative rounded-2xl border border-indigo-500/20 overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                  <img src="/this_is_engineering-team-8499960_1920.jpg" alt="Verified" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
                  <div className="relative h-full w-full flex flex-col items-center justify-center p-4 bg-indigo-900/40">
                    <ShieldCheck className="w-10 h-10 text-indigo-400 mb-2" />
                    <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-100">Verified</p>
                  </div>
                </div>
                <div className="aspect-square relative rounded-2xl border border-emerald-500/20 overflow-hidden translate-y-8 group hover:scale-[1.02] transition-transform duration-500">
                  <img src="/ahmadardity-books-2463779_1920.jpg" alt="Organized" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
                  <div className="relative h-full w-full flex flex-col items-center justify-center p-4 bg-emerald-900/40">
                    <Layout className="w-10 h-10 text-emerald-400 mb-2" />
                    <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-100">Organized</p>
                  </div>
                </div>
                <div className="aspect-square relative rounded-2xl border border-amber-500/20 overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                  <img src="/poison_ivy-painting-1673774_1920.jpg" alt="Curated" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
                  <div className="relative h-full w-full flex flex-col items-center justify-center p-4 bg-amber-900/40">
                    <Sparkles className="w-10 h-10 text-amber-400 mb-2" />
                    <p className="text-[10px] uppercase tracking-widest font-bold text-amber-100">Curated</p>
                  </div>
                </div>
                <div className="aspect-square relative rounded-2xl border border-purple-500/20 overflow-hidden translate-y-8 group hover:scale-[1.02] transition-transform duration-500">
                  <img src="/xpresshealth-nursing-agency-ireland-9866597_1920.jpg" alt="Instant" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
                  <div className="relative h-full w-full flex flex-col items-center justify-center p-4 bg-purple-900/40">
                    <Zap className="w-10 h-10 text-purple-400 mb-2" />
                    <p className="text-[10px] uppercase tracking-widest font-bold text-purple-100">Instant</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Motivation / Community Section */}
      <section className="w-full px-4 md:px-8 max-w-7xl mx-auto mb-20">
        <div className="relative py-20 px-8 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 overflow-hidden text-center">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-black text-theme-primary mb-6 tracking-tight leading-tight">
              The <span className="gradient-text">Future of Learning</span> <br className="hidden md:block" /> is in your hands.
            </h2>
            <p className="text-lg md:text-xl text-theme-muted mb-8 leading-relaxed">
              We're building more than just a past paper repository. We're building a community of excellence where every UPSA student has the tools to succeed.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-theme-surface border border-theme-border shadow-sm">
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="text-sm font-semibold text-theme-secondary">24/7 AI Support</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-theme-surface border border-theme-border shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-sm font-semibold text-theme-secondary">Verified Content</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-theme-surface border border-theme-border shadow-sm">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-sm font-semibold text-theme-secondary">Zero Downtime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}

      {!isLoggedIn && (
        <section className="w-full px-4 md:px-8 max-w-5xl mx-auto mb-32">
          <div className="glass-card p-12 text-center border-indigo-500/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
            <h2 className="text-3xl md:text-5xl font-bold text-theme-primary mb-6">Ready to ace your exams?</h2>
            <p className="text-theme-muted text-lg mb-10 max-w-2xl mx-auto">
              Join thousands of students who are already using PastQ to simplify their studies and achieve better results.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register" className="w-full sm:w-auto px-10 py-4 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                Create Free Account
              </Link>
              <Link to="/papers" className="w-full sm:w-auto px-10 py-4 rounded-full bg-theme-surface border border-theme-border text-theme-primary font-bold hover:bg-theme-surface-2 transition-all">
                Explore Papers <ArrowRight className="w-4 h-4 inline-block ml-2" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

export default LandingPage;
