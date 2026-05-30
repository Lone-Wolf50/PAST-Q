import { Link } from 'react-router-dom';
import { 
  ArrowRight, Sparkles, Zap, ShieldCheck, FileText, 
  Search, Flame, Download, Compass, BookOpen, ArrowUpRight 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
  const { isLoggedIn } = useAuth();

  return (
    <div className="w-full flex-grow flex flex-col items-center overflow-x-hidden relative">
      
      {/* Ambient background glow elements (Apple/Samsung-style) */}
      <div className="absolute top-[-100px] left-[50%] -translate-x-[50%] w-[100vw] h-[600px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute top-[800px] left-[-200px] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-[1600px] right-[-200px] w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Hero Section */}
      <section className="w-full px-4 md:px-8 max-w-7xl mx-auto mt-16 md:mt-24 mb-24 text-center flex flex-col items-center">
        
        {/* Cortana AI Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-theme-surface-2/80 border border-theme-border/60 text-xs font-bold text-theme-secondary mb-8 shadow-sm backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span className="uppercase tracking-widest text-[9px] font-black text-theme-secondary">Now with Cortana Premium AI v3.0</span>
        </div>

        {/* Hero Typography */}
        <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tight text-theme-primary leading-[1.05] max-w-4xl mb-6">
          Find your next <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400">
            breakthrough.
          </span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-theme-muted max-w-2xl mb-10 leading-relaxed font-medium px-4">
          Stop guessing what will be on the exam. Access 20 years of past examination papers, step-by-step answers, and a powerful AI tutor tailored to your syllabus.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto px-4">
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

        {/* Interactive CSS UI Mockup of the Platform */}
        <div className="w-full max-w-5xl mt-16 md:mt-24 px-2 md:px-0">
          <div className="relative aspect-[16/10] md:aspect-[16/9] w-full rounded-2xl md:rounded-[2.5rem] border border-theme-border bg-gradient-to-b from-theme-surface/60 to-theme-surface-2/40 backdrop-blur-2xl shadow-[0_30px_100px_rgba(0,0,0,0.6)] p-3 md:p-5 flex gap-3 md:gap-5 overflow-hidden group">
            
            {/* Ambient inner glow inside mockup */}
            <div className="absolute top-0 right-0 w-[400px] h-[300px] bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent blur-[80px]" />

            {/* Sidebar Mock */}
            <div className="w-[50px] md:w-[70px] h-full bg-theme-surface-2/60 border border-theme-border rounded-xl md:rounded-2xl p-2.5 md:p-4 flex flex-col items-center gap-6 md:gap-8 shrink-0">
              <div className="w-7 md:w-9 h-7 md:h-9 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-black text-sm md:text-base shadow-lg shadow-indigo-500/30">P</div>
              <div className="flex flex-col gap-5 md:gap-6 mt-4">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400"><FileText className="w-4 h-4 md:w-5 md:h-5" /></div>
                <div className="p-2 rounded-lg text-theme-muted hover:text-theme-secondary"><Compass className="w-4 h-4 md:w-5 md:h-5" /></div>
                <div className="p-2 rounded-lg text-theme-muted hover:text-theme-secondary"><Zap className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} /></div>
              </div>
              <div className="mt-auto w-6 md:w-8 h-6 md:h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400" />
            </div>

            {/* Main Panel Content: Split View */}
            <div className="flex-grow h-full flex gap-3 md:gap-5 min-w-0">
              
              {/* Paper Reader Pane (Left 55%) */}
              <div className="w-[55%] md:w-[60%] h-full bg-theme-surface border border-theme-border rounded-xl md:rounded-2xl p-4 md:p-6 flex flex-col text-left relative overflow-hidden">
                <div className="flex items-center justify-between mb-4 border-b border-theme-border pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-black">UPSA</span>
                    <span className="text-[10px] text-theme-secondary font-bold tracking-tight">IT - Year 2024</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-[9px] text-emerald-400 font-extrabold tracking-widest uppercase">ANSWERS AVAILABLE</span>
                  </div>
                </div>

                {/* Simulated Exam Questions */}
                <div className="flex-grow overflow-y-auto space-y-4 pr-1 scrollbar-hide text-xs md:text-sm">
                  <div className="p-3 bg-theme-surface-2/40 rounded-xl border border-theme-border/50">
                    <p className="font-black text-theme-primary mb-1.5">QUESTION 1</p>
                    <p className="text-theme-secondary leading-relaxed font-medium">Explain the difference between SQL database normalization and denormalization. Provide a typical use case for each.</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2/40 rounded-xl border border-theme-border/50 opacity-60">
                    <p className="font-black text-theme-primary mb-1.5">QUESTION 2</p>
                    <p className="text-theme-secondary leading-relaxed font-medium">Draw a schema diagram illustrating a one-to-many relationship in an ecommerce store database.</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2/40 rounded-xl border border-theme-border/50 opacity-30">
                    <p className="font-black text-theme-primary mb-1.5">QUESTION 3</p>
                    <p className="text-theme-secondary leading-relaxed font-medium">Analyze how indexing impacts execution speed of SELECT and UPDATE queries.</p>
                  </div>
                </div>
              </div>

              {/* Cortana AI Pane (Right 45%) */}
              <div className="w-[45%] md:w-[40%] h-full bg-theme-surface-2/80 border border-theme-border rounded-xl md:rounded-2xl p-4 flex flex-col text-left relative overflow-hidden backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-2 mb-4 border-b border-theme-border pb-3 shrink-0">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-theme-primary leading-tight">Cortana AI</span>
                    <span className="text-[8px] text-indigo-400 font-extrabold uppercase tracking-widest leading-none">AI TUTOR V3</span>
                  </div>
                </div>

                {/* Simulated Chat Feed */}
                <div className="flex-grow overflow-y-auto space-y-3.5 pr-1 scrollbar-hide text-[10px] md:text-xs">
                  <div className="flex flex-col items-end gap-1">
                    <div className="bg-indigo-500 text-white rounded-2xl rounded-tr-none px-3 py-2 max-w-[85%] font-medium leading-relaxed">
                      How is index speed optimization achieved in SQL?
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md shadow-indigo-500/10">
                      <Sparkles className="w-2.5 h-2.5" />
                    </div>
                    <div className="bg-theme-surface border border-theme-border/60 text-theme-secondary rounded-2xl rounded-tl-none px-3 py-2 max-w-[85%] font-medium leading-relaxed space-y-1.5">
                      <p>An <strong className="text-theme-primary">index</strong> operates like an index in a book. It stores columns in a B-Tree structure:</p>
                      <ul className="list-disc pl-3.5 space-y-0.5">
                        <li><strong className="text-theme-primary">SELECT:</strong> Speed jumps from O(N) linear search to O(log N) binary search.</li>
                        <li><strong className="text-theme-primary">UPDATE:</strong> Slightly slower since index must rebuild.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Fake Input Box */}
                <div className="mt-3 bg-theme-surface border border-theme-border rounded-xl p-2 flex items-center gap-2 shrink-0">
                  <div className="text-theme-muted text-[10px] flex-grow font-medium">Ask Cortana a question...</div>
                  <div className="w-6 h-6 rounded-lg bg-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Feature Section */}
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
            
            <div className="max-w-md">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold text-theme-primary mb-2">Cortana AI Assistant</h3>
              <p className="text-sm text-theme-muted leading-relaxed font-medium">
                Our advanced AI is specifically trained on college past examination papers. Highlight any math question, law essay prompt, or accounting formula to receive immediate, step-by-step explanations.
              </p>
            </div>

            {/* Feature Demo block */}
            <div className="w-full mt-6 bg-theme-surface-2 border border-theme-border rounded-xl p-4 flex flex-col gap-2 relative">
              <div className="flex items-center gap-2 border-b border-theme-border/60 pb-2">
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-black tracking-tight uppercase">Step-by-Step Explanation</span>
              </div>
              <div className="font-mono text-[10px] md:text-xs text-theme-secondary space-y-1">
                <p className="text-indigo-400">Step 1: Simplify expression.</p>
                <p>2x + 5 = 15 &rArr; 2x = 10</p>
                <p className="text-indigo-400">Step 2: Solve for x.</p>
                <p>x = 5 &rArr; Verified Answer ✅</p>
              </div>
            </div>
          </div>

          {/* Card 2: 20 Year Archive */}
          <div className="glass-card border border-theme-border/60 p-6 md:p-8 flex flex-col justify-between overflow-hidden hover:border-indigo-500/30 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-sm">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-theme-muted font-bold tracking-tight">2005 - 2025</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-theme-primary mb-1">Two Decades of Archive</h3>
              <p className="text-xs text-theme-muted leading-relaxed font-medium">
                A massive digitized vault of past exams across every major department. Organized by year and semester.
              </p>
            </div>
          </div>

          {/* Card 3: Instant Search */}
          <div className="glass-card border border-theme-border/60 p-6 md:p-8 flex flex-col justify-between overflow-hidden hover:border-indigo-500/30 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-sm">
              <Search className="w-5 h-5" />
            </div>
            <div>
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
            <div>
              <h3 className="text-lg font-bold text-theme-primary mb-1">Interactive Streaks</h3>
              <p className="text-xs text-theme-muted leading-relaxed font-medium">
                Keep the momentum going. Track consecutive study days and earn premium badges to gamify your exam prep.
              </p>
            </div>
          </div>

          {/* Card 5: Verified Answers */}
          <div className="glass-card border border-theme-border/60 p-6 md:p-8 flex flex-col justify-between overflow-hidden hover:border-indigo-500/30 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-theme-primary mb-1">Verified Solutions</h3>
              <p className="text-xs text-theme-muted leading-relaxed font-medium">
                Answer keys verified by faculty and top tutors, ensuring you learn correct logic and study with confidence.
              </p>
            </div>
          </div>

          {/* Card 6: Fast Download */}
          <div className="glass-card border border-theme-border/60 p-6 md:p-8 flex flex-col justify-between overflow-hidden hover:border-indigo-500/30 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center shadow-sm">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-theme-primary mb-1">Instant Offline Access</h3>
              <p className="text-xs text-theme-muted leading-relaxed font-medium">
                Download verified papers and answers directly as clean, lightweight PDFs to study anytime without data.
              </p>
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
