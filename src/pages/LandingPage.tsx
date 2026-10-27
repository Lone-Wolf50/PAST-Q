import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, ShieldCheck, Search, Flame, Download,
  BookOpen, ArrowRight, ChevronDown, Send, RotateCcw, CheckCircle2, BrainCircuit
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface MathDemoItem {
  id: string;
  tag: string;
  prompt: string;
  steps: { label: string; detail: string; math: string }[];
  answer: string;
  explanation: string;
}

const MATH_DEMOS: MathDemoItem[] = [
  {
    id: 'linear',
    tag: 'Algebra',
    prompt: 'Solve for x: 2x + 5 = 15',
    steps: [
      { label: 'Step 1', detail: 'Subtract 5 from both sides', math: '2x + 5 - 5 = 15 - 5  ⇒  2x = 10' },
      { label: 'Step 2', detail: 'Divide both sides by 2', math: '2x ÷ 2 = 10 ÷ 2  ⇒  x = 5' },
    ],
    answer: 'x = 5',
    explanation: 'Check: 2(5) + 5 = 10 + 5 = 15 ✓',
  },
  {
    id: 'percent',
    tag: 'Percentages',
    prompt: 'Calculate 15% of 240',
    steps: [
      { label: 'Step 1', detail: 'Break 15% into 10% + 5%', math: '10% of 240 = 24,  5% of 240 = 12' },
      { label: 'Step 2', detail: 'Add the two parts together', math: '24 + 12 = 36' },
    ],
    answer: '36',
    explanation: 'Check: 0.15 × 240 = 36 ✓',
  },
  {
    id: 'quadratic',
    tag: 'Quadratics',
    prompt: 'Solve: x² - 9 = 0',
    steps: [
      { label: 'Step 1', detail: 'Factor difference of squares', math: '(x - 3)(x + 3) = 0' },
      { label: 'Step 2', detail: 'Set each factor to zero', math: 'x - 3 = 0  or  x + 3 = 0' },
    ],
    answer: 'x = 3, -3',
    explanation: 'Check: (±3)² - 9 = 9 - 9 = 0 ✓',
  },
];

const CortanaMathDemo = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [demoIdx, setDemoIdx] = useState(0);
  // Phase: 0 = typing prompt, 1 = sent & AI thinking, 2 = step 1, 3 = step 2, 4 = final answer
  const [phase, setPhase] = useState<number>(0);
  const [typedChars, setTypedChars] = useState<number>(0);

  const currentDemo = MATH_DEMOS[demoIdx];

  // Reset when demoIdx changes
  useEffect(() => {
    setPhase(0);
    setTypedChars(0);
  }, [demoIdx]);

  // Phase 0: Typewriter effect for user prompt
  useEffect(() => {
    if (phase !== 0) return;
    if (typedChars < currentDemo.prompt.length) {
      const t = setTimeout(() => {
        setTypedChars((c) => c + 1);
      }, 45);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setPhase(1);
      }, 450);
      return () => clearTimeout(t);
    }
  }, [phase, typedChars, currentDemo.prompt.length]);

  // Phases 1 -> 2 -> 3 -> 4 -> next demo
  useEffect(() => {
    if (phase === 1) {
      const t = setTimeout(() => setPhase(2), 900);
      return () => clearTimeout(t);
    }
    if (phase === 2) {
      const t = setTimeout(() => setPhase(3), 1200);
      return () => clearTimeout(t);
    }
    if (phase === 3) {
      const t = setTimeout(() => setPhase(4), 1200);
      return () => clearTimeout(t);
    }
    if (phase === 4) {
      const t = setTimeout(() => {
        setDemoIdx((prev) => (prev + 1) % MATH_DEMOS.length);
      }, 3600);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const handleSelectDemo = (idx: number) => {
    if (idx === demoIdx) {
      setPhase(0);
      setTypedChars(0);
    } else {
      setDemoIdx(idx);
    }
  };

  return (
    <div
      className={clsx(
        "relative rounded-3xl overflow-hidden min-h-[430px] sm:min-h-[490px] md:min-h-[540px] flex flex-col justify-between p-4 sm:p-6 order-2 lg:order-1 border transition-all duration-300",
        isDark
          ? "bg-[#121212] border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.65)]"
          : "bg-white/90 border-[#73b0f4]/30 shadow-[0_24px_60px_rgba(115,176,244,0.18)]"
      )}
    >
      {/* Subtle ambient top glow */}
      <div
        className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(circle, rgba(165,180,252,0.15), transparent 70%)'
            : 'radial-gradient(circle, rgba(238,220,251,0.7), transparent 70%)',
        }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full blur-3xl pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(circle, rgba(98,220,173,0.10), transparent 70%)'
            : 'radial-gradient(circle, rgba(205,232,254,0.75), transparent 70%)',
        }}
      />

      {/* Top Header & Problem Switcher */}
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-theme-border">
          <div className="flex items-center gap-2.5">
            <div
              className={clsx(
                "w-9 h-9 rounded-full flex items-center justify-center border",
                isDark
                  ? "bg-[#181818] border-[#a5b4fc]/30 text-[#a5b4fc]"
                  : "bg-[#cde8fe]/60 border-[#73b0f4]/40 text-[#4a89dc]"
              )}
            >
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-theme-primary tracking-tight">Cortana AI Tutor</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Demo
                </span>
              </div>
              <p className="text-[11px] text-theme-muted font-medium">
                {phase === 0 && 'Student is typing a question...'}
                {phase === 1 && 'Cortana is analyzing the equation...'}
                {(phase === 2 || phase === 3) && 'Solving step-by-step...'}
                {phase === 4 && 'Solution verified ✓'}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleSelectDemo(demoIdx)}
            className={clsx(
              "p-2 rounded-full border transition-all hover:scale-105 active:scale-95",
              isDark
                ? "bg-[#181818] border-white/10 text-theme-secondary hover:text-white"
                : "bg-[#eef3f8] border-[#73b0f4]/25 text-slate-600 hover:text-slate-900"
            )}
            title="Replay demonstration"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Interactive Problem Tabs */}
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto scrollbar-hide pb-1">
          {MATH_DEMOS.map((item, idx) => {
            const active = idx === demoIdx;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectDemo(idx)}
                className={clsx(
                  "px-3 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap border",
                  active
                    ? isDark
                      ? "bg-[#a5b4fc] text-[#0a0a0a] border-[#a5b4fc] shadow-[0_0_15px_rgba(165,180,252,0.25)]"
                      : "bg-[#73b0f4] text-white border-[#73b0f4] shadow-sm"
                    : isDark
                      ? "bg-[#181818] text-theme-secondary border-white/10 hover:border-white/20"
                      : "bg-[#eef3f8] text-slate-600 border-white hover:bg-[#e3e9ed]"
                )}
              >
                {item.tag}: {item.prompt.replace('Solve for x: ', '').replace('Calculate ', '').replace('Solve: ', '')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Middle Conversation Canvas */}
      <div className="relative z-10 flex-grow flex flex-col justify-center gap-3 my-4">
        {/* User Prompt Bubble (appears once sent in phase >= 1) */}
        <div
          className={clsx(
            "self-end max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 border transition-all duration-300",
            phase >= 1
              ? "opacity-100 translate-y-0"
              : "opacity-40 translate-y-1",
            isDark
              ? "bg-[#1c1b1b] border-[#a5b4fc]/30 text-white"
              : "bg-[#eedcfb]/75 border-[#c99cf2]/40 text-slate-900"
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-0.5">Student Question</p>
          <p className="text-xs sm:text-sm font-bold font-mono">
            {phase === 0 ? currentDemo.prompt.slice(0, typedChars) : currentDemo.prompt}
            {phase === 0 && <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-current animate-pulse align-middle" />}
          </p>
        </div>

        {/* AI Response Card */}
        <div
          className={clsx(
            "w-full rounded-2xl p-4 border transition-all duration-300 min-h-[210px] flex flex-col justify-between",
            isDark
              ? "bg-[#181818] border-white/10"
              : "bg-[#eef3f8]/90 border-white shadow-inner"
          )}
        >
          {phase === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center">
              <Sparkles className={clsx("w-6 h-6 mb-2 animate-pulse", isDark ? "text-[#a5b4fc]" : "text-[#73b0f4]")} />
              <p className="text-xs font-semibold text-theme-secondary">
                Waiting for prompt...
              </p>
            </div>
          )}

          {phase === 1 && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={clsx(
                      "w-2 h-2 rounded-full animate-bounce",
                      isDark ? "bg-[#a5b4fc]" : "bg-[#73b0f4]"
                    )}
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-theme-secondary">
                Cortana is breaking down the steps...
              </span>
            </div>
          )}

          {phase >= 2 && (
            <div className="space-y-2.5">
              {/* Step 1 */}
              <div
                className={clsx(
                  "rounded-xl p-2.5 border transition-all duration-300 animate-fade-in",
                  isDark
                    ? "bg-[#121212] border-white/10"
                    : "bg-white border-[#cde8fe]"
                )}
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className={clsx("font-extrabold uppercase tracking-wider", isDark ? "text-[#a5b4fc]" : "text-[#4a89dc]")}>
                    {currentDemo.steps[0].label}
                  </span>
                  <span className="text-theme-secondary font-medium">{currentDemo.steps[0].detail}</span>
                </div>
                <p className="text-xs sm:text-sm font-mono font-bold text-theme-primary">
                  {currentDemo.steps[0].math}
                </p>
              </div>

              {/* Step 2 */}
              {phase >= 3 && (
                <div
                  className={clsx(
                    "rounded-xl p-2.5 border transition-all duration-300 animate-fade-in",
                    isDark
                      ? "bg-[#121212] border-white/10"
                      : "bg-white border-[#cde8fe]"
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className={clsx("font-extrabold uppercase tracking-wider", isDark ? "text-[#a5b4fc]" : "text-[#4a89dc]")}>
                      {currentDemo.steps[1].label}
                    </span>
                    <span className="text-theme-secondary font-medium">{currentDemo.steps[1].detail}</span>
                  </div>
                  <p className="text-xs sm:text-sm font-mono font-bold text-theme-primary">
                    {currentDemo.steps[1].math}
                  </p>
                </div>
              )}

              {/* Final Answer */}
              {phase >= 4 && (
                <div
                  className={clsx(
                    "rounded-xl p-3 border flex items-center justify-between transition-all duration-300 animate-fade-in",
                    isDark
                      ? "bg-[#62dcad]/12 border-[#62dcad]/35 text-[#62dcad]"
                      : "bg-[#cde8fe]/65 border-[#73b0f4]/50 text-[#1e3a8a]"
                  )}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-black uppercase tracking-wider">
                        Final Answer: {currentDemo.answer}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono opacity-85 mt-0.5">
                      {currentDemo.explanation}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider",
                      isDark ? "bg-[#62dcad]/20 text-[#62dcad]" : "bg-white/80 text-[#4a89dc]"
                    )}
                  >
                    100% Clear
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Simulated Input Bar */}
      <div
        className={clsx(
          "relative z-10 flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl border",
          isDark
            ? "bg-[#0a0a0a] border-white/10"
            : "bg-[#eef3f8] border-[#73b0f4]/25"
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-grow">
          <Sparkles className={clsx("w-4 h-4 shrink-0", isDark ? "text-[#a5b4fc]" : "text-[#73b0f4]")} />
          <span className="text-xs font-mono text-theme-secondary truncate">
            {phase === 0
              ? currentDemo.prompt.slice(0, typedChars) || 'Ask Cortana a math question...'
              : 'Ask Cortana any past paper or math question...'}
          </span>
        </div>
        <div
          className={clsx(
            "w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform",
            phase === 0 && typedChars === currentDemo.prompt.length ? "scale-110" : "scale-100",
            isDark
              ? "bg-[#a5b4fc] text-[#0a0a0a]"
              : "bg-[#73b0f4] text-white"
          )}
        >
          <Send className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};

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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out",
              idx === imageIndex ? "opacity-100 pointer-events-auto z-0" : "opacity-0 pointer-events-none -z-10"
            )}
            style={{ backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)' }}
          />
        ))}

        {/* Cinematic gradient overlay — adapts to Lumina OLED Dark & Soft Pastel Light */}
        <div
          className={clsx(
            "absolute inset-0 pointer-events-none",
            isDark
              ? "bg-gradient-to-b from-[#131313]/85 via-[#131313]/55 to-[#131313]"
              : "bg-gradient-to-b from-[#eaf1f8]/85 via-[#eaf1f8]/65 to-[#eaf1f8]"
          )}
        />

        {/* Hero content */}
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto w-full">
          {/* Live badge */}
          <div
            className={clsx(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black tracking-[0.18em] uppercase backdrop-blur-md mb-8 border",
              isDark
                ? "bg-[#1c1b1b]/85 border-[#454650] text-[#c9d1ff]"
                : "bg-[#cde8fe]/90 border-white text-[#1b2533] shadow-sm"
            )}
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span
                className={clsx(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  isDark ? "bg-[#62dcad]" : "bg-[#73b0f4]"
                )}
              />
              <span
                className={clsx(
                  "relative inline-flex rounded-full h-1.5 w-1.5",
                  isDark ? "bg-[#62dcad]" : "bg-[#73b0f4]"
                )}
              />
            </span>
            <Sparkles className={clsx("w-3 h-3", isDark ? "text-[#c9d1ff]" : "text-[#4a90e2]")} />
            Cortana AI v3.0 · Now Live
          </div>

          {/* Main headline */}
          <h1
            className={clsx(
              "text-[clamp(3rem,10vw,7rem)] font-black tracking-tight leading-[1.0] mb-6",
              isDark ? "text-[#e5e2e1]" : "text-[#1b2533]"
            )}
          >
            Study smarter.<br />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: isDark
                  ? 'linear-gradient(90deg, #c9d1ff, #62dcad, #d8cdff)'
                  : 'linear-gradient(90deg, #4a90e2, #73b0f4, #9d65d8)',
              }}
            >
              Score higher.
            </span>
          </h1>

          <p
            className={clsx(
              "text-base sm:text-xl max-w-2xl mx-auto mb-10 font-medium leading-relaxed",
              isDark ? "text-[#c6c5d2]" : "text-[#4c637a]"
            )}
          >
            20 years of UPSA past papers. Verified answers. A powerful AI tutor trained on your syllabus — all in one place.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isLoggedIn ? (
              <Link
                to="/papers"
                className={clsx(
                  "w-full sm:w-auto px-10 py-4 rounded-full font-bold text-sm transition-all hover:scale-105 active:scale-95",
                  isDark
                    ? "bg-[#a5b4fc] text-[#1a2b6a] hover:bg-[#c9d1ff] shadow-[0_0_24px_rgba(165,180,252,0.3)]"
                    : "bg-[#73b0f4] text-white hover:bg-[#5a9cf0] shadow-[0_10px_30px_rgba(115,176,244,0.4)]"
                )}
              >
                Start Studying
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className={clsx(
                    "w-full sm:w-auto px-10 py-4 rounded-full font-bold text-sm transition-all hover:scale-105 active:scale-95",
                    isDark
                      ? "bg-[#a5b4fc] text-[#1a2b6a] hover:bg-[#c9d1ff] shadow-[0_0_24px_rgba(165,180,252,0.3)]"
                      : "bg-[#73b0f4] text-white hover:bg-[#5a9cf0] shadow-[0_10px_30px_rgba(115,176,244,0.4)]"
                  )}
                >
                  Create Free Account
                </Link>
                <Link
                  to="/login"
                  className={clsx(
                    "w-full sm:w-auto px-10 py-4 rounded-full font-bold text-sm transition-all hover:scale-105 active:scale-95 backdrop-blur-sm border",
                    isDark
                      ? "bg-[#1c1b1b]/80 border-[#454650] text-[#e5e2e1] hover:bg-[#2a2a2a]"
                      : "bg-[#eedcfb]/85 border-white text-[#1b2533] hover:bg-[#eedcfb]"
                  )}
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className={clsx(
            "absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-10 pointer-events-none",
            isDark ? "text-[#8f909b]" : "text-[#4c637a]"
          )}
        >
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Scroll</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </div>
      </section>

      {/* ── FEATURE CAPSULE STRIP ───────────────────────────── */}
      <section
        className={clsx(
          "w-full py-10 px-4 border-b",
          isDark
            ? "bg-[#1c1b1b] border-[#454650]/50"
            : "bg-white/80 border-[#73b0f4]/20"
        )}
      >
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2.5">
          {[
            {
              icon: Sparkles,
              label: 'Cortana AI Tutor',
              pillClass: isDark
                ? 'bg-[#201f1f] border-[#454650] text-[#c9d1ff]'
                : 'bg-[#cde8fe] border-white text-[#1b2533]',
              iconColor: isDark ? 'text-[#c9d1ff]' : 'text-[#4a90e2]',
            },
            {
              icon: BookOpen,
              label: '20-Year Archive',
              pillClass: isDark
                ? 'bg-[#201f1f] border-[#454650] text-[#d8cdff]'
                : 'bg-[#eedcfb] border-white text-[#1b2533]',
              iconColor: isDark ? 'text-[#d8cdff]' : 'text-[#9d65d8]',
            },
            {
              icon: ShieldCheck,
              label: 'Verified Answers',
              pillClass: isDark
                ? 'bg-[#201f1f] border-[#454650] text-[#62dcad]'
                : 'bg-[#e2e8ed] border-white text-[#1b2533]',
              iconColor: isDark ? 'text-[#62dcad]' : 'text-[#469c82]',
            },
            {
              icon: Search,
              label: 'Instant Search',
              pillClass: isDark
                ? 'bg-[#201f1f] border-[#454650] text-[#b8c4ff]'
                : 'bg-[#cde8fe]/75 border-white text-[#1b2533]',
              iconColor: isDark ? 'text-[#b8c4ff]' : 'text-[#4a90e2]',
            },
            {
              icon: Download,
              label: 'Offline PDFs',
              pillClass: isDark
                ? 'bg-[#201f1f] border-[#454650] text-[#e7deff]'
                : 'bg-[#fceaf6] border-white text-[#1b2533]',
              iconColor: isDark ? 'text-[#d8cdff]' : 'text-[#d474b3]',
            },
            {
              icon: Flame,
              label: 'Study Streaks',
              pillClass: isDark
                ? 'bg-[#201f1f] border-[#454650] text-[#80f9c8]'
                : 'bg-[#eedcfb]/75 border-white text-[#1b2533]',
              iconColor: isDark ? 'text-[#62dcad]' : 'text-[#9d65d8]',
            },
          ].map(({ icon: Icon, label, pillClass, iconColor }) => (
            <div
              key={label}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 rounded-full border transition-colors shadow-xs",
                pillClass
              )}
            >
              <Icon className={clsx('w-3.5 h-3.5', iconColor)} />
              <span className="text-xs font-bold whitespace-nowrap">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── SPOTLIGHT 1: Cortana AI ─────────────────────────── */}
      <section className="w-full py-24 md:py-36 px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

          {/* Live Interactive AI Math Demonstration */}
          <CortanaMathDemo />

          {/* Text */}
          <div className="order-1 lg:order-2">
            <div
              className={clsx(
                "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.18em] mb-6",
                isDark
                  ? "bg-[#a5b4fc]/15 border-[#a5b4fc]/35 text-[#c9d1ff]"
                  : "bg-[#cde8fe] border-[#73b0f4]/40 text-[#2b6cb0]"
              )}
            >
              <Sparkles className="w-3 h-3" /> Cortana AI
            </div>
            <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-black text-theme-primary tracking-tight leading-[1.05] mb-6">
              Your personal<br />AI tutor.<br />
              <span
                className="text-transparent bg-clip-text"
                style={{
                  backgroundImage: isDark
                    ? 'linear-gradient(90deg, #c9d1ff, #62dcad)'
                    : 'linear-gradient(90deg, #4a90e2, #9d65d8)',
                }}
              >
                Always on.
              </span>
            </h2>
            <p className="text-base md:text-lg text-theme-secondary leading-relaxed mb-8 font-medium max-w-lg">
              Cortana is built specifically for the UPSA syllabus. Ask it to explain a concept, solve a past paper question, or build a full study plan — and get step-by-step answers in seconds.
            </p>
            <Link
              to="/ask-ai"
              className={clsx(
                "inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all group",
                isDark
                  ? "bg-[#a5b4fc] text-[#1a2b6a] hover:bg-[#c9d1ff]"
                  : "bg-[#73b0f4] text-white hover:bg-[#5a9cf0] shadow-sm"
              )}
            >
              Try Cortana Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── SPOTLIGHT 2: 20-Year Archive ────────────────────── */}
      <section
        className={clsx(
          "w-full py-24 md:py-36 px-4 md:px-8",
          isDark ? "bg-[#1c1b1b]" : "bg-[#eedcfb]/40"
        )}
      >
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

          {/* Text */}
          <div>
            <div
              className={clsx(
                "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.18em] mb-6",
                isDark
                  ? "bg-[#d8cdff]/15 border-[#d8cdff]/35 text-[#d8cdff]"
                  : "bg-[#eedcfb] border-[#c99cf2]/50 text-[#6b21a8]"
              )}
            >
              <BookOpen className="w-3 h-3" /> 20-Year Archive
            </div>
            <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-black text-theme-primary tracking-tight leading-[1.05] mb-6">
              Every exam.<br />Every year.<br />
              <span
                className="text-transparent bg-clip-text"
                style={{
                  backgroundImage: isDark
                    ? 'linear-gradient(90deg, #d8cdff, #c9d1ff)'
                    : 'linear-gradient(90deg, #9d65d8, #4a90e2)',
                }}
              >
                All organised.
              </span>
            </h2>
            <p className="text-base md:text-lg text-theme-secondary leading-relaxed mb-8 font-medium max-w-lg">
              A fully-indexed vault spanning every department at UPSA — from Level 100 foundations to Level 400 finals, from 2005 to 2025. Digitised, verified, instantly searchable.
            </p>
            <Link
              to="/papers"
              className={clsx(
                "inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all group",
                isDark
                  ? "bg-[#bdaef5] text-[#332664] hover:bg-[#d8cdff]"
                  : "bg-[#eedcfb] text-[#1b2533] border border-white hover:bg-[#e2c7fa] shadow-sm"
              )}
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
                  className={clsx(
                    "flex-1 rounded-xl border backdrop-blur-xl p-3 text-center",
                    isDark
                      ? "border-[#454650] bg-[#131313]/80"
                      : "border-white/80 bg-white/85"
                  )}
                >
                  <p className={clsx("font-black text-xl leading-none", isDark ? "text-[#c9d1ff]" : "text-[#1b2533]")}>{s.v}</p>
                  <p className={clsx("text-[10px] font-bold mt-1 uppercase tracking-wider", isDark ? "text-[#c6c5d2]" : "text-[#4c637a]")}>{s.l}</p>
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
            <div
              className={clsx(
                "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.18em] mb-6",
                isDark
                  ? "bg-[#62dcad]/15 border-[#62dcad]/35 text-[#62dcad]"
                  : "bg-[#cde8fe] border-[#73b0f4]/40 text-[#1b2533]"
              )}
            >
              <ShieldCheck className="w-3 h-3" /> Verified Solutions
            </div>
            <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-black text-theme-primary tracking-tight leading-[1.05] mb-6">
              Answers you<br />can trust.<br />
              <span
                className="text-transparent bg-clip-text"
                style={{
                  backgroundImage: isDark
                    ? 'linear-gradient(90deg, #62dcad, #80f9c8)'
                    : 'linear-gradient(90deg, #469c82, #4a90e2)',
                }}
              >
                Every time.
              </span>
            </h2>
            <p className="text-base md:text-lg text-theme-secondary leading-relaxed mb-8 font-medium max-w-lg">
              Every solution key is reviewed by UPSA faculty and senior tutors. You always learn the correct logic — not just a guess. Study with confidence.
            </p>
            <div className="flex flex-col gap-3 max-w-xs">
              {[
                {
                  icon: ShieldCheck,
                  text: 'Faculty-verified answers',
                  boxClass: isDark ? 'bg-[#1c1b1b] border-[#454650] text-[#62dcad]' : 'bg-[#cde8fe] border-white text-[#2b6cb0]',
                },
                {
                  icon: Flame,
                  text: 'Daily study streaks',
                  boxClass: isDark ? 'bg-[#1c1b1b] border-[#454650] text-[#c9d1ff]' : 'bg-[#eedcfb] border-white text-[#7e22ce]',
                },
                {
                  icon: Download,
                  text: 'Offline PDF downloads',
                  boxClass: isDark ? 'bg-[#1c1b1b] border-[#454650] text-[#d8cdff]' : 'bg-[#fceaf6] border-white text-[#be185d]',
                },
              ].map(({ icon: Icon, text, boxClass }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className={clsx("w-8 h-8 rounded-xl border flex items-center justify-center shrink-0", boxClass)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-theme-secondary">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BANNER ────────────────────────────────────── */}
      <section
        className={clsx(
          "w-full py-20 md:py-28 px-4 md:px-8 border-y",
          isDark
            ? "bg-[#1c1b1b] border-[#454650]/50"
            : "bg-[#cde8fe]/50 border-[#73b0f4]/25"
        )}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-4 sm:gap-6 md:gap-16 text-center">
          {[
            { num: '10,000+', label: 'Active Students', color: isDark ? 'text-[#c9d1ff]' : 'text-[#1b2533]' },
            { num: '1,500+',  label: 'Past Papers',     color: isDark ? 'text-[#62dcad]' : 'text-[#2b6cb0]' },
            { num: '20',      label: 'Years of Coverage', color: isDark ? 'text-[#d8cdff]' : 'text-[#6b21a8]' },
          ].map((s) => (
            <div key={s.label}>
              <p className={clsx("text-2xl sm:text-4xl md:text-6xl font-black tracking-tight", s.color)}>{s.num}</p>
              <p className="text-[10px] sm:text-xs text-theme-secondary font-bold mt-2 uppercase tracking-wider">{s.label}</p>
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
            <p className="text-base md:text-xl text-theme-secondary font-medium mb-10 max-w-xl mx-auto leading-relaxed">
              Join thousands of students already using PastQ to master past questions and boost their GPA.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className={clsx(
                  "w-full sm:w-auto px-12 py-4 rounded-full font-bold text-sm transition-all hover:scale-105 active:scale-95",
                  isDark
                    ? "bg-[#a5b4fc] hover:bg-[#c9d1ff] text-[#1a2b6a] shadow-[0_10px_40px_rgba(165,180,252,0.25)]"
                    : "bg-[#73b0f4] hover:bg-[#5a9cf0] text-white shadow-[0_10px_30px_rgba(115,176,244,0.35)]"
                )}
              >
                Create Free Account
              </Link>
              <Link
                to="/papers"
                className={clsx(
                  "w-full sm:w-auto px-12 py-4 rounded-full border font-bold text-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2",
                  isDark
                    ? "bg-[#1c1b1b] border-[#454650] text-[#e5e2e1] hover:border-[#c9d1ff]/50"
                    : "bg-[#eedcfb]/75 border-white text-[#1b2533] hover:bg-[#eedcfb]"
                )}
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
