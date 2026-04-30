import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calculator, Microscope, TrendingUp, BookOpen, FlaskConical, Scale, BrainCircuit, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';

const STATS = [
  { label: '24 Subjects', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  { label: '1.2k Papers', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { label: '15 Years', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
];

const SUBJECTS = [
  { name: 'Maths', count: '142 papers', tags: ['Y1', 'Y2', 'Y3'], icon: Calculator, iconColor: 'text-indigo-400', iconBg: 'bg-indigo-400/10 border-indigo-400/20' },
  { name: 'Biology', count: '98 papers', tags: ['Y1', 'Y2'], icon: Microscope, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-400/10 border-emerald-400/20' },
  { name: 'Economics', count: '76 papers', tags: ['Y1', 'Y3'], icon: TrendingUp, iconColor: 'text-amber-400', iconBg: 'bg-amber-400/10 border-amber-400/20' },
  { name: 'Literature', count: '112 papers', tags: ['Y2', 'Y3'], icon: BookOpen, iconColor: 'text-pink-400', iconBg: 'bg-pink-400/10 border-pink-400/20' },
  { name: 'Chemistry', count: '84 papers', tags: ['Y1', 'Y2'], icon: FlaskConical, iconColor: 'text-cyan-400', iconBg: 'bg-cyan-400/10 border-cyan-400/20' },
  { name: 'Law', count: '56 papers', tags: ['Y3'], icon: Scale, iconColor: 'text-orange-400', iconBg: 'bg-orange-400/10 border-orange-400/20' },
];

const CAROUSEL_WORDS = ["breakthrough.", "A+ Grade.", "study hack.", "past paper."];

const LandingPage = () => {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % CAROUSEL_WORDS.length);
    }, 3000);
    return () => clearInterval(interval);
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
            Stop guessing what will be on the exam. Access 15 years of past questions, comprehensive answers, and a powerful AI tutor to help you study smarter, not harder.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
            <Link to="/register" className="w-full sm:w-auto px-8 py-3.5 rounded-full text-white bg-indigo-500 hover:bg-indigo-600 transition-all font-semibold text-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              Get Started for Free
            </Link>
            <Link to="/papers" className="w-full sm:w-auto px-8 py-3.5 rounded-full text-theme-primary bg-theme-surface-2 border border-theme-border hover:bg-theme-surface transition-all font-semibold text-center">
              Browse Papers
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {STATS.map((stat) => (
              <div key={stat.label} className={clsx("flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border", stat.color)}>
                <div className="w-2 h-2 rounded-full bg-current opacity-80" />
                {stat.label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative w-full h-[400px] md:h-[500px] hidden lg:block perspective-1000">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-3xl blur-3xl transform -rotate-6"></div>
          <img 
            src="/dashboard_mockup.png" 
            alt="Dashboard Preview" 
            className="absolute inset-0 w-full h-full object-cover rounded-2xl shadow-2xl border border-theme-border transform rotate-2 hover:rotate-0 transition-transform duration-500"
          />
        </div>
      </section>

      {/* AI Tutor Feature Section */}
      <section className="w-full px-4 md:px-8 max-w-7xl mx-auto mb-32">
        <div className="glass-card p-8 md:p-12 border-theme-border relative overflow-hidden grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative z-10 w-full h-[300px] md:h-[400px] rounded-2xl overflow-hidden border border-theme-border shadow-2xl">
            <img src="/ai_tutor_mockup.png" alt="AI Tutor Chat" className="w-full h-full object-cover" />
          </div>
          <div className="relative z-10 text-left">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 mb-6">
              <BrainCircuit className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-theme-primary mb-4">Stuck on a question? <br />Ask your AI Tutor.</h2>
            <p className="text-theme-muted text-lg mb-8">
              Our advanced AI model is trained specifically on university curriculum. Get instant step-by-step explanations, formulas, and guidance without waiting for office hours.
            </p>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-theme-secondary font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Available 24/7 for instant help
              </li>
              <li className="flex items-center gap-3 text-theme-secondary font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Deep understanding of past papers
              </li>
              <li className="flex items-center gap-3 text-theme-secondary font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Generates practice questions
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Browse by Subject Section */}
      <section className="w-full px-4 md:px-8 max-w-7xl mx-auto mb-32 text-left">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold text-theme-primary mb-2">Browse by subject</h2>
            <p className="text-theme-muted">Access resources across all major departments.</p>
          </div>
          <Link to="/papers" className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-theme-surface hover:bg-theme-surface-2 border border-theme-border text-theme-secondary hover:text-theme-primary transition-colors">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SUBJECTS.map((subject) => {
            const Icon = subject.icon;
            return (
              <Link 
                key={subject.name} 
                to={`/papers?subject=${subject.name.toLowerCase()}`}
                className="glass-card p-6 flex flex-col items-start gap-8 group hover:scale-[1.02] border-theme-border transition-all duration-300"
              >
                <div className={clsx(
                  "w-14 h-14 rounded-2xl border flex items-center justify-center transition-colors",
                  subject.iconBg
                )}>
                  <Icon className={clsx("w-7 h-7", subject.iconColor)} />
                </div>

                <div className="w-full">
                  <h3 className="text-xl font-bold text-theme-primary mb-1">{subject.name}</h3>
                  <p className="text-sm text-theme-muted mb-6">{subject.count}</p>
                  
                  <div className="flex items-center gap-2">
                    {subject.tags.map((tag) => (
                      <span 
                        key={tag} 
                        className="text-xs font-bold px-2 py-1 rounded-md bg-theme-surface text-theme-secondary border border-theme-border"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
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
