import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, ShieldCheck, Search, Flame, Download, 
  BookOpen, ArrowUpRight 
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';

const HERO_IMAGES = [
  { url: "/adonyig-school-times-3599175_1920.jpg", title: "Study Smarter", desc: "Collaborate with peers and access the best materials." },
  { url: "/adonyig-school-times-3599176_1920.jpg", title: "Focused Learning", desc: "Master difficult concepts with step-by-step guidance." },
  { url: "/adonyig-school-times-3599182_1920.jpg", title: "Better Results", desc: "Join thousands of successful students." },
  { url: "/ahmadardity-books-2463779_1920.jpg", title: "Infinite Knowledge", desc: "Explore over 20 years of past examination papers." },
  { url: "/elasticcomputefarm-library-1147815_1920.jpg", title: "Your Digital Library", desc: "Access resources anytime, anywhere." },
  { url: "/kollinger-books-5211309_1920.jpg", title: "Organized Success", desc: "Everything you need for your exams in one place." },
];

const LandingPage = () => {
  const { isLoggedIn } = useAuth();
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const imageInterval = setInterval(() => {
      setImageIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(imageInterval);
  }, []);

  return (
    <div className="w-full flex-grow flex flex-col items-center overflow-x-hidden relative">
      
      {/* Ambient background glow elements (Apple/Samsung-style) */}
      <div className="absolute top-[-100px] left-[50%] -translate-x-[50%] w-[100vw] h-[600px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute top-[800px] left-[-200px] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-[1600px] right-[-200px] w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Hero Section */}
      <section className="w-full px-4 md:px-8 max-w-7xl mx-auto mt-12 md:mt-20 mb-24 grid lg:grid-cols-12 gap-12 items-center text-left">
        
        {/* Left Column: Typography & CTAs (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-start">
          {/* Cortana AI Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-theme-surface-2/80 border border-theme-border/60 text-xs font-bold text-theme-secondary mb-6 shadow-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span className="uppercase tracking-widest text-[9px] font-black text-theme-secondary">Now with Cortana Premium AI v3.0</span>
          </div>

          {/* Hero Title */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight text-theme-primary leading-[1.05] mb-6">
            Find your next <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400">
              breakthrough.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-theme-muted max-w-xl mb-10 leading-relaxed font-medium">
            Stop guessing what will be on the exam. Access 20 years of past examination papers, step-by-step answers, and a powerful AI tutor tailored to your syllabus.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            {isLoggedIn ? (
              <Link 
                to="/papers" 
                className="w-full sm:w-auto px-10 py-4 rounded-full text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-95 transition-all font-bold text-center shadow-[0_10px_30px_rgba(99,102,241,0.25)] hover:scale-[1.02] active:scale-[0.98]"
              >
                Start Studying
              </Link>
            ) : (
              <>
                <Link 
                  to="/register" 
                  className="w-full sm:w-auto px-10 py-4 rounded-full text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-95 transition-all font-bold text-center shadow-[0_10px_30px_rgba(99,102,241,0.25)] hover:scale-[1.02] active:scale-[0.98]"
                >
                  Create Free Account
                </Link>
                <Link 
                  to="/login" 
                  className="w-full sm:w-auto px-10 py-4 rounded-full text-theme-primary bg-theme-surface-2 border border-theme-border/80 hover:bg-theme-surface-2-hover transition-all font-bold text-center hover:scale-[1.02] active:scale-[0.98]"
                >
                  Log In
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Premium Device Mockup utilizing User's HERO_IMAGES (5 cols) */}
        <div className="lg:col-span-5 relative w-full h-[350px] sm:h-[420px] md:h-[500px] perspective-1000">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-3xl blur-3xl transform -rotate-6"></div>
          <div className="absolute inset-0 bg-theme-surface border border-theme-border/80 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden transform rotate-1 hover:rotate-0 transition-transform duration-700">
            {HERO_IMAGES.map((img, idx) => (
              <img
                key={img.url}
                src={img.url}
                alt={img.title}
                className={clsx(
                  "absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out",
                  idx === imageIndex ? "opacity-100 scale-100" : "opacity-0 scale-105"
                )}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
            
            <div className="absolute bottom-6 left-6 right-6 text-white text-left z-10">
              <div className="overflow-hidden">
                <p className="text-white font-black text-2xl mb-1.5 tracking-tight animate-fade-in">
                  {HERO_IMAGES[imageIndex].title}
                </p>
              </div>
              <p className="text-gray-300 text-xs font-semibold leading-relaxed max-w-xs">
                {HERO_IMAGES[imageIndex].desc}
              </p>
              
              {/* Device Slide Indicators */}
              <div className="flex gap-1.5 mt-5">
                {HERO_IMAGES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setImageIndex(idx)}
                    className={clsx(
                      "h-1 rounded-full transition-all duration-300",
                      idx === imageIndex ? "w-6 bg-indigo-400" : "w-1.5 bg-white/30"
                    )}
                    aria-label={`Show slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Feature Section incorporating User's Images */}
      <section className="w-full px-4 md:px-8 max-w-7xl mx-auto py-16 mb-24 relative z-10">
        
        {/* Section title */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-theme-primary tracking-tight mb-4">
            Designed for academic success.
          </h2>
          <p className="text-base md:text-lg text-theme-muted max-w-xl mx-auto font-medium">
            Every feature is hand-crafted to streamline your exam preparation and boost your comprehension.
          </p>
        </div>

        {/* Bento Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[220px] md:auto-rows-[250px]">
          
          {/* Card 1: Cortana AI (Large - Span 2 cols, Row 2 rows) */}
          <div className="md:col-span-2 md:row-span-2 glass-card border border-theme-border/60 bg-gradient-to-br from-theme-surface via-theme-surface to-theme-surface-2 p-6 md:p-8 flex flex-col justify-between overflow-hidden group relative hover:border-indigo-500/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 blur-3xl -mr-24 -mt-24 pointer-events-none" />
            
            <div className="max-w-md relative z-10">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold text-theme-primary mb-2">Cortana AI Assistant</h3>
              <p className="text-sm text-theme-muted leading-relaxed font-medium">
                Our advanced AI is specifically trained on college past examination papers. Ask Cortana math queries, request law essay prompts, or explain accounting formulas to receive immediate step-by-step guidance.
              </p>
            </div>

            {/* Feature Demo block incorporating User's Graduation Picture */}
            <div className="w-full mt-6 bg-theme-surface-2 border border-theme-border rounded-xl p-3 flex flex-col sm:flex-row gap-4 items-center relative overflow-hidden">
              <div className="flex-grow font-mono text-[10px] md:text-xs text-theme-secondary space-y-1.5 text-left w-full sm:w-auto">
                <div className="flex items-center gap-2 border-b border-theme-border/60 pb-1.5">
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-black tracking-tight uppercase">Step-by-Step Explanation</span>
                </div>
                <p className="text-indigo-400">Step 1: Simplify expression.</p>
                <p>2x + 5 = 15 &rArr; 2x = 10</p>
                <p className="text-indigo-400">Step 2: Solve for x.</p>
                <p>x = 5 &rArr; Verified Answer ✅</p>
              </div>
              
              {/* Inset visual using user's graduation photo */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-theme-border shrink-0 relative group">
                <img src="/leo_fontes-graduation-4502796_1920.jpg" alt="Graduation" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-indigo-500/10" />
              </div>
            </div>
          </div>

          {/* Card 2: 20 Year Archive (utilizes user's books image in bg) */}
          <div className="glass-card border border-theme-border/60 p-0 flex flex-col justify-between overflow-hidden hover:border-indigo-500/30 transition-all duration-300 group relative">
            <img src="/ahmadardity-books-2463779_1920.jpg" alt="Archive Books" className="absolute inset-0 w-full h-full object-cover opacity-60 scale-102 group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-theme-surface via-theme-surface/90 to-theme-surface/75" />
            
            <div className="p-6 md:p-8 flex flex-col justify-between h-full w-full relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-sm backdrop-blur-md">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-[10px] text-theme-muted font-bold tracking-tight bg-theme-surface-2/65 px-2 py-0.5 rounded border border-theme-border/40">2005 - 2025</span>
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-theme-primary mb-1">Two Decades of Archive</h3>
                <p className="text-xs text-theme-muted leading-relaxed font-medium">
                  A massive digitized vault of past exams across every major department. Organized by year and semester.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Instant Search */}
          <div className="glass-card border border-theme-border/60 p-6 md:p-8 flex flex-col justify-between overflow-hidden hover:border-indigo-500/30 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-sm">
              <Search className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-theme-primary mb-1">Speed Index</h3>
              <p className="text-xs text-theme-muted leading-relaxed font-medium">
                Find exactly the course, code, or topic you need instantly. Autocompletes as you type with zero delay.
              </p>
            </div>
          </div>

          {/* Card 4: Study Habits */}
          <div className="glass-card border border-theme-border/60 p-6 md:p-8 flex flex-col justify-between overflow-hidden hover:border-indigo-500/30 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shadow-sm">
                <Flame className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-amber-500 font-extrabold uppercase tracking-tight flex items-center gap-1"><Flame size={10} /> Streak System</span>
            </div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-theme-primary mb-1">Interactive Streaks</h3>
              <p className="text-xs text-theme-muted leading-relaxed font-medium">
                Keep the momentum going. Track consecutive study days and earn premium badges to gamify your exam prep.
              </p>
            </div>
          </div>

          {/* Card 5: Verified Answers (utilizes user's team image in bg) */}
          <div className="glass-card border border-theme-border/60 p-0 flex flex-col justify-between overflow-hidden hover:border-indigo-500/30 transition-all duration-300 group relative">
            <img src="/this_is_engineering-team-8499960_1920.jpg" alt="Verified Team" className="absolute inset-0 w-full h-full object-cover opacity-60 scale-102 group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-theme-surface via-theme-surface/90 to-theme-surface/75" />
            
            <div className="p-6 md:p-8 flex flex-col justify-between h-full w-full relative z-10">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-sm backdrop-blur-md">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-theme-primary mb-1">Verified Solutions</h3>
                <p className="text-xs text-theme-muted leading-relaxed font-medium">
                  Answer keys verified by faculty and top tutors, ensuring you learn correct logic and study with confidence.
                </p>
              </div>
            </div>
          </div>

          {/* Card 6: Fast Download (utilizes user's library image in bg) */}
          <div className="glass-card border border-theme-border/60 p-0 flex flex-col justify-between overflow-hidden hover:border-indigo-500/30 transition-all duration-300 group relative">
            <img src="/xpresshealth-nursing-agency-ireland-9866597_1920.jpg" alt="Library Study" className="absolute inset-0 w-full h-full object-cover opacity-60 scale-102 group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-theme-surface via-theme-surface/90 to-theme-surface/75" />
            
            <div className="p-6 md:p-8 flex flex-col justify-between h-full w-full relative z-10">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center shadow-sm backdrop-blur-md">
                <Download className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-theme-primary mb-1">Instant Offline Access</h3>
                <p className="text-xs text-theme-muted leading-relaxed font-medium">
                  Download verified papers and answers directly as clean, lightweight PDFs to study offline without data.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Value Statement Section */}
      <section className="w-full px-4 md:px-8 max-w-7xl mx-auto py-16 mb-24">
        <div className="relative py-24 px-8 md:px-16 rounded-[2.5rem] bg-gradient-to-b from-indigo-500/[0.03] to-purple-500/[0.01] border border-indigo-500/10 overflow-hidden text-center">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-indigo-500/[0.03] rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-purple-500/[0.03] rounded-full blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-black text-theme-primary mb-6 tracking-tight leading-[1.15]">
              The future of learning. <br />In your control.
            </h2>
            <p className="text-base sm:text-lg text-theme-muted mb-10 leading-relaxed font-medium">
              We're building more than just an exam database. We're creating a premium hub of academic excellence to empower every UPSA student to succeed.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-theme-secondary">
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-theme-surface border border-theme-border shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>24/7 Cortana AI</span>
              </div>
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-theme-surface border border-theme-border shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Verified Solutions</span>
              </div>
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-theme-surface border border-theme-border shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>Optimized Performance</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Block */}
      {!isLoggedIn && (
        <section className="w-full px-4 md:px-8 max-w-5xl mx-auto mb-28">
          <div className="glass-card p-10 md:p-16 text-center border-indigo-500/20 relative overflow-hidden bg-gradient-to-b from-theme-surface to-theme-surface-2">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
            <h2 className="text-2xl sm:text-4xl font-bold text-theme-primary mb-4">Ready to ace your exams?</h2>
            <p className="text-theme-muted text-sm sm:text-base mb-10 max-w-xl mx-auto font-medium leading-relaxed">
              Join thousands of students who are already using PastQ to simplify their studies, master past questions, and get higher grades.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                to="/register" 
                className="w-full sm:w-auto px-10 py-4 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-all shadow-[0_10px_25px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-[0.98]"
              >
                Create Free Account
              </Link>
              <Link 
                to="/papers" 
                className="w-full sm:w-auto px-10 py-4 rounded-full bg-theme-surface border border-theme-border text-theme-primary font-bold hover:bg-theme-surface-2 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                Explore Papers <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default LandingPage;
