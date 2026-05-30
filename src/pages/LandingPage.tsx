import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, ShieldCheck, Search, Flame, Download,
  BookOpen, ArrowRight, ChevronDown
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';

const HERO_IMAGES = [
  "/adonyig-school-times-3599175_1920.jpg",
  "/adonyig-school-times-3599176_1920.jpg",
  "/adonyig-school-times-3599182_1920.jpg",
  "/ahmadardity-books-2463779_1920.jpg",
  "/elasticcomputefarm-library-1147815_1920.jpg",
  "/kollinger-books-5211309_1920.jpg",
];

const LandingPage = () => {
  const { isLoggedIn } = useAuth();
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setImageIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full flex-grow flex flex-col overflow-x-hidden">

      {/* ── HERO: Full-bleed, cinematic ─────────────────────── */}
      <section className="relative w-full min-h-[100svh] flex flex-col items-center justify-center overflow-hidden">
        {/* Rotating background images */}
        {HERO_IMAGES.map((src, idx) => (
          <img
            key={src}
            src={src}
            alt=""
            className={clsx(
              "absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out",
              idx === imageIndex ? "opacity-100 scale-100" : "opacity-0 scale-[1.04]"
            )}
          />
        ))}

        {/* Cinematic gradient overlay — dark top/bottom, lighter middle */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80 pointer-events-none" />
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />

        {/* Hero content */}
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto w-full">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white/80 text-[10px] font-black tracking-[0.18em] uppercase backdrop-blur-md mb-8">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400" />
            </span>
            <Sparkles className="w-3 h-3 text-indigo-300" />
            Cortana Premium AI v3.0 · Now Live
          </div>

          {/* Main headline */}
          <h1 className="text-[clamp(3rem,10vw,7rem)] font-black text-white tracking-tight leading-[1.0] mb-6">
            Study smarter.<br />
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(90deg, #818cf8, #a78bfa, #f472b6)' }}
            >
              Score higher.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
            20 years of UPSA past papers. Verified answers. A powerful AI tutor trained on your syllabus — all in one place.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isLoggedIn ? (
              <Link
                to="/papers"
                className="w-full sm:w-auto px-10 py-4 rounded-full bg-white text-gray-900 font-bold text-sm hover:bg-white/90 transition-all hover:scale-105 active:scale-95 shadow-[0_10px_40px_rgba(0,0,0,0.4)]"
              >
                Start Studying
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="w-full sm:w-auto px-10 py-4 rounded-full bg-white text-gray-900 font-bold text-sm hover:bg-white/90 transition-all hover:scale-105 active:scale-95 shadow-[0_10px_40px_rgba(0,0,0,0.4)]"
                >
                  Create Free Account
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-10 py-4 rounded-full bg-white/10 border border-white/30 text-white font-bold text-sm hover:bg-white/20 transition-all hover:scale-105 active:scale-95 backdrop-blur-sm"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Slide dots */}
          <div className="flex justify-center gap-1.5 mt-12">
            {HERO_IMAGES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setImageIndex(idx)}
                aria-label={`Show slide ${idx + 1}`}
                className={clsx(
                  "h-1 rounded-full transition-all duration-400",
                  idx === imageIndex ? "w-8 bg-white" : "w-1.5 bg-white/30"
                )}
              />
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/40 z-10 pointer-events-none">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Scroll</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </div>
      </section>

      {/* ── FEATURE CAPSULE STRIP ───────────────────────────── */}
      <section className="w-full py-10 px-4 bg-theme-surface border-b border-theme-border/40">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2.5">
          {[
            { icon: Sparkles, label: 'Cortana AI Tutor', color: 'text-indigo-400' },
            { icon: BookOpen,  label: '20-Year Archive',  color: 'text-purple-400' },
            { icon: ShieldCheck, label: 'Verified Answers', color: 'text-emerald-400' },
            { icon: Search,   label: 'Instant Search',   color: 'text-blue-400' },
            { icon: Download, label: 'Offline PDFs',     color: 'text-pink-400' },
            { icon: Flame,    label: 'Study Streaks',    color: 'text-orange-400' },
          ].map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-theme-surface-2 border border-theme-border/60 hover:border-indigo-500/30 transition-colors"
            >
              <Icon className={clsx('w-3.5 h-3.5', color)} />
              <span className="text-xs font-bold text-theme-secondary whitespace-nowrap">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── SPOTLIGHT 1: Cortana AI ─────────────────────────── */}
      <section className="w-full py-24 md:py-36 px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

          {/* Image card */}
          <div className="relative rounded-3xl overflow-hidden h-[360px] sm:h-[460px] md:h-[540px] shadow-[0_40px_80px_rgba(0,0,0,0.35)] order-2 lg:order-1">
            <img
              src="/leo_fontes-graduation-4502796_1920.jpg"
              alt="Student with AI tutor"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            {/* Floating AI answer chip */}
            <div className="absolute bottom-6 left-5 right-5 rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[10px] font-black text-white/70 uppercase tracking-[0.18em]">Cortana · Solving</span>
                <span className="ml-auto flex gap-0.5">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                  ))}
                </span>
              </div>
              <p className="text-white/80 text-xs font-mono leading-relaxed">
                <span className="text-indigo-400 font-bold">Step 1 </span>→ Simplify: 2x + 5 = 15<br />
                <span className="text-indigo-400 font-bold">Step 2 </span>→ Isolate: 2x = 10<br />
                <span className="text-emerald-400 font-bold">Answer </span>→ x = 5 ✓
              </p>
            </div>
          </div>

          {/* Text */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.18em] mb-6">
              <Sparkles className="w-3 h-3" /> Cortana AI
            </div>
            <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-black text-theme-primary tracking-tight leading-[1.05] mb-6">
              Your personal<br />AI tutor.<br />
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(90deg, #818cf8, #a78bfa)' }}
              >
                Always on.
              </span>
            </h2>
            <p className="text-base md:text-lg text-theme-muted leading-relaxed mb-8 font-medium max-w-lg">
              Cortana is built specifically for the UPSA syllabus. Ask it to explain a concept, solve a past paper question, or build a full study plan — and get step-by-step answers in seconds.
            </p>
            <Link
              to="/ask-ai"
              className="inline-flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors group"
            >
              Try Cortana Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── SPOTLIGHT 2: 20-Year Archive ────────────────────── */}
      <section className="w-full py-24 md:py-36 px-4 md:px-8 bg-theme-surface-2/30">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

          {/* Text */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-[0.18em] mb-6">
              <BookOpen className="w-3 h-3" /> 20-Year Archive
            </div>
            <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-black text-theme-primary tracking-tight leading-[1.05] mb-6">
              Every exam.<br />Every year.<br />
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(90deg, #c084fc, #f472b6)' }}
              >
                All organised.
              </span>
            </h2>
            <p className="text-base md:text-lg text-theme-muted leading-relaxed mb-8 font-medium max-w-lg">
              A fully-indexed vault spanning every department at UPSA — from Level 100 foundations to Level 400 finals, from 2005 to 2025. Digitised, verified, instantly searchable.
            </p>
            <Link
              to="/papers"
              className="inline-flex items-center gap-2 text-sm font-bold text-purple-400 hover:text-purple-300 transition-colors group"
            >
              Browse All Papers
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Image card */}
          <div className="relative rounded-3xl overflow-hidden h-[360px] sm:h-[460px] md:h-[540px] shadow-[0_40px_80px_rgba(0,0,0,0.35)]">
            <img
              src="/ahmadardity-books-2463779_1920.jpg"
              alt="Books archive"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Stats row */}
            <div className="absolute bottom-6 left-5 right-5 flex gap-3">
              {[
                { v: '1,500+', l: 'Papers' },
                { v: '20 yrs', l: 'Coverage' },
                { v: '50+',   l: 'Subjects' },
              ].map((s) => (
                <div
                  key={s.l}
                  className="flex-1 rounded-xl border border-white/10 bg-black/50 backdrop-blur-xl p-3 text-center"
                >
                  <p className="text-white font-black text-xl leading-none">{s.v}</p>
                  <p className="text-white/50 text-[10px] font-bold mt-1 uppercase tracking-wider">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SPOTLIGHT 3: Study Environment ──────────────────── */}
      <section className="w-full py-24 md:py-36 px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

          {/* Image grid */}
          <div className="grid grid-cols-2 gap-3 h-[400px] sm:h-[480px] order-2 lg:order-1">
            <div className="relative rounded-2xl overflow-hidden row-span-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
              <img src="/adonyig-school-times-3599176_1920.jpg" alt="Students studying" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <p className="absolute bottom-4 left-4 right-4 text-white font-black text-lg leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">Focused Learning</p>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
              <img src="/adonyig-school-times-3599182_1920.jpg" alt="Better results" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <p className="absolute bottom-3 left-3 right-3 text-white font-black text-sm drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">Better Results</p>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
              <img src="/kollinger-books-5211309_1920.jpg" alt="Organised success" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <p className="absolute bottom-3 left-3 right-3 text-white font-black text-sm drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">Organised Success</p>
            </div>
          </div>

          {/* Text */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-[0.18em] mb-6">
              <ShieldCheck className="w-3 h-3" /> Verified Solutions
            </div>
            <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-black text-theme-primary tracking-tight leading-[1.05] mb-6">
              Answers you<br />can trust.<br />
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(90deg, #34d399, #06b6d4)' }}
              >
                Every time.
              </span>
            </h2>
            <p className="text-base md:text-lg text-theme-muted leading-relaxed mb-8 font-medium max-w-lg">
              Every solution key is reviewed by UPSA faculty and senior tutors. You always learn the correct logic — not just a guess. Study with confidence.
            </p>
            <div className="flex flex-col gap-3 max-w-xs">
              {[
                { icon: ShieldCheck, text: 'Faculty-verified answers',   color: 'text-emerald-400' },
                { icon: Flame,       text: 'Daily study streaks',        color: 'text-orange-400' },
                { icon: Download,    text: 'Offline PDF downloads',      color: 'text-pink-400' },
              ].map(({ icon: Icon, text, color }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-theme-surface-2 border border-theme-border flex items-center justify-center shrink-0">
                    <Icon className={clsx('w-4 h-4', color)} />
                  </div>
                  <span className="text-sm font-semibold text-theme-secondary">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BANNER ────────────────────────────────────── */}
      <section className="w-full py-20 md:py-28 px-4 md:px-8 bg-theme-surface-2/30 border-y border-theme-border/40">
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-6 md:gap-16 text-center">
          {[
            { num: '10,000+', label: 'Active Students' },
            { num: '1,500+',  label: 'Past Papers' },
            { num: '20 Years', label: 'of Coverage' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl sm:text-4xl md:text-6xl font-black text-theme-primary tracking-tight">{s.num}</p>
              <p className="text-[10px] sm:text-xs text-theme-muted font-bold mt-2 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ──────────────────────────────────────── */}
      {!isLoggedIn && (
        <section className="w-full py-24 md:py-36 px-4 md:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-[clamp(2.5rem,6vw,5rem)] font-black text-theme-primary tracking-tight leading-[1.05] mb-6">
              Ready to ace<br />your exams?
            </h2>
            <p className="text-base md:text-xl text-theme-muted font-medium mb-10 max-w-xl mx-auto leading-relaxed">
              Join thousands of students already using PastQ to master past questions and boost their GPA.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="w-full sm:w-auto px-12 py-4 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm transition-all hover:scale-105 active:scale-95 shadow-[0_10px_40px_rgba(99,102,241,0.35)]"
              >
                Create Free Account
              </Link>
              <Link
                to="/papers"
                className="w-full sm:w-auto px-12 py-4 rounded-full bg-theme-surface-2 border border-theme-border text-theme-primary font-bold text-sm hover:border-indigo-500/40 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                Explore Papers <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default LandingPage;
