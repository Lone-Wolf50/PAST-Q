import { useState, useEffect, useRef } from 'react';
import {
  Trophy, Crown, Sparkles, User, Zap, Clock, Flame, Award,
  BookOpen, Info, ChevronUp, Shield, Target, X, CheckCircle2, BarChart3
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';
import { Modal } from '../components/ui/Modal';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  score: number;
  login_streak: number;
  badge_count: number;
  avatar_url?: string;
}

// ── Animated counter hook ──────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200, delay = 0) {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) return;
    const start = Date.now() + delay;
    const animate = () => {
      const now = Date.now();
      if (now < start) { frameRef.current = requestAnimationFrame(animate); return; }
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(ease * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration, delay]);

  return count;
}

// ── Score counter component ────────────────────────────────────────────────────
const AnimatedScore = ({ value, delay = 0, className = '' }: { value: number; delay?: number; className?: string }) => {
  const count = useCountUp(value, 1400, delay);
  return <span className={className}>{count.toLocaleString()}</span>;
};


// ── Score progress bar ─────────────────────────────────────────────────────────
const ScoreBar = ({ score, maxScore, rank }: { score: number; maxScore: number; rank: number }) => {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const color = rank === 1 ? 'from-amber-400 to-amber-600' : rank === 2 ? 'from-slate-300 to-slate-500' : rank === 3 ? 'from-amber-600 to-amber-800' : 'from-indigo-500 to-violet-600';
  return (
    <div className="flex-1 h-1.5 bg-theme-border/50 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

// ── Rules / Rewards content ────────────────────────────────────────────────────
const RulesContent = () => (
  <div className="flex flex-col gap-5">
    {/* Points Formula */}
    <div className="rounded-2xl bg-gradient-to-br from-indigo-500/8 to-violet-500/5 border border-indigo-500/15 p-5 shadow-xl flex flex-col gap-4">
      <h3 className="text-xs font-black uppercase tracking-[0.15em] text-indigo-400 flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20">
          <Zap className="w-3.5 h-3.5" />
        </div>
        Points Formula
      </h3>

      <div className="flex flex-col gap-3">
        {[
          { icon: <Award className="w-3.5 h-3.5" />, color: 'indigo', title: 'Correct Answer', value: '+10 pts', desc: 'Base score for every correct answer.' },
          { icon: <Clock className="w-3.5 h-3.5" />, color: 'emerald', title: 'Speed Bonus', value: 'up to +5 pts', desc: 'Under 3s: +5 · Under 6s: +3 · Under 10s: +1' },
          { icon: <Flame className="w-3.5 h-3.5" />, color: 'amber', title: 'Hot Streak', value: '1.5× mult.', desc: '3+ correct in a row multiplies all future points.' },
          { icon: <Sparkles className="w-3.5 h-3.5" />, color: 'purple', title: 'Daily Login', value: '+5 pts', desc: 'Log in once per day for a free bonus.' },
        ].map((item, i) => (
          <div key={i} className={clsx(
            "flex gap-3 items-start p-3 rounded-xl border transition-all hover:scale-[1.01]",
            item.color === 'indigo' && "bg-indigo-500/5 border-indigo-500/15",
            item.color === 'emerald' && "bg-emerald-500/5 border-emerald-500/15",
            item.color === 'amber' && "bg-amber-500/5 border-amber-500/15",
            item.color === 'purple' && "bg-purple-500/5 border-purple-500/15",
          )}>
            <div className={clsx(
              "p-1.5 rounded-lg shrink-0 mt-0.5",
              item.color === 'indigo' && "bg-indigo-500/15 text-indigo-400",
              item.color === 'emerald' && "bg-emerald-500/15 text-emerald-400",
              item.color === 'amber' && "bg-amber-500/15 text-amber-400",
              item.color === 'purple' && "bg-purple-500/15 text-purple-400",
            )}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-theme-primary font-bold text-xs">{item.title}</span>
                <span className={clsx(
                  "text-[10px] font-black px-2 py-0.5 rounded-full shrink-0",
                  item.color === 'indigo' && "bg-indigo-500/15 text-indigo-400",
                  item.color === 'emerald' && "bg-emerald-500/15 text-emerald-400",
                  item.color === 'amber' && "bg-amber-500/15 text-amber-400",
                  item.color === 'purple' && "bg-purple-500/15 text-purple-400",
                )}>{item.value}</span>
              </div>
              <p className="text-[11px] text-theme-muted mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Badges */}
    <div className="rounded-2xl bg-gradient-to-br from-amber-500/8 to-orange-500/5 border border-amber-500/15 p-5 shadow-xl flex flex-col gap-4">
      <h3 className="text-xs font-black uppercase tracking-[0.15em] text-amber-400 flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/20">
          <Award className="w-3.5 h-3.5" />
        </div>
        Earn Badges
      </h3>

      <div className="flex flex-col gap-2">
        {[
          { emoji: '⚡', name: 'Speed Demon', desc: 'Answer under 3 seconds', color: 'from-yellow-500/10 to-amber-500/5 border-yellow-500/20' },
          { emoji: '🔥', name: 'Unstoppable', desc: '5 correct answers in a row', color: 'from-red-500/10 to-orange-500/5 border-red-500/20' },
          { emoji: '📚', name: 'Explorer', desc: 'Answer in 3+ different subjects', color: 'from-emerald-500/10 to-teal-500/5 border-emerald-500/20' },
          { emoji: '🏅', name: 'Top Scholar', desc: 'Reach top 10 on the leaderboard', color: 'from-indigo-500/10 to-violet-500/5 border-indigo-500/20' },
        ].map((b, i) => (
          <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r border ${b.color}`}>
            <span className="text-lg">{b.emoji}</span>
            <div>
              <div className="text-theme-primary font-bold text-xs">{b.name}</div>
              <div className="text-[10px] text-theme-muted">{b.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Podium Card ────────────────────────────────────────────────────────────────
const PodiumCard = ({ user, onClick }: { user: LeaderboardEntry; onClick: () => void }) => {
  const isGold = user.rank === 1;
  const isSilver = user.rank === 2;
  const isBronze = user.rank === 3;

  // Per-rank theming tokens
  const theme = isGold
    ? {
        outerGlow: 'shadow-[0_0_60px_rgba(245,158,11,0.5),0_0_120px_rgba(245,158,11,0.2)]',
        cardBorder: 'border-amber-400/40',
        cardBg: 'bg-gradient-to-b from-[rgba(245,158,11,0.18)] via-[rgba(245,158,11,0.08)] to-[rgba(0,0,0,0.4)]',
        shimmer: 'from-amber-300/0 via-amber-300/20 to-amber-300/0',
        innerGlow: 'rgba(245,158,11,0.12)',
        topLine: 'bg-gradient-to-r from-transparent via-amber-400/60 to-transparent',
        avatarRing: 'ring-2 ring-amber-400/70',
        avatarShadow: 'shadow-[0_0_20px_rgba(245,158,11,0.5)]',
        scoreColor: 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]',
        labelColor: 'text-amber-400/70',
        squareSize: 'w-32 h-40 sm:w-40 sm:h-48 md:w-44 md:h-56 lg:w-52 lg:h-64',
        avatarSize: 'w-12 h-12 sm:w-16 sm:h-16 md:w-18 md:h-18 lg:w-22 lg:h-22',
        scoreSize: 'text-lg sm:text-xl md:text-2xl lg:text-3xl',
        nameSize: 'text-xs sm:text-sm md:text-sm lg:text-base',
      }
    : isSilver
    ? {
        outerGlow: 'shadow-[0_0_30px_rgba(148,163,184,0.3),0_0_60px_rgba(148,163,184,0.1)]',
        cardBorder: 'border-slate-400/35',
        cardBg: 'bg-gradient-to-b from-[rgba(148,163,184,0.14)] via-[rgba(148,163,184,0.06)] to-[rgba(0,0,0,0.4)]',
        shimmer: 'from-slate-300/0 via-slate-300/15 to-slate-300/0',
        innerGlow: 'rgba(148,163,184,0.08)',
        topLine: 'bg-gradient-to-r from-transparent via-slate-400/50 to-transparent',
        avatarRing: 'ring-2 ring-slate-400/60',
        avatarShadow: 'shadow-[0_0_12px_rgba(148,163,184,0.4)]',
        scoreColor: 'text-slate-300 drop-shadow-[0_0_6px_rgba(148,163,184,0.5)]',
        labelColor: 'text-slate-400/70',
        squareSize: 'w-26 h-32 sm:w-32 sm:h-40 md:w-36 md:h-46 lg:w-44 lg:h-54',
        avatarSize: 'w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16',
        scoreSize: 'text-sm sm:text-base md:text-lg lg:text-2xl',
        nameSize: 'text-[10px] sm:text-xs md:text-xs lg:text-sm',
      }
    : {
        outerGlow: 'shadow-[0_0_25px_rgba(180,83,9,0.25),0_0_50px_rgba(180,83,9,0.1)]',
        cardBorder: 'border-amber-700/35',
        cardBg: 'bg-gradient-to-b from-[rgba(180,83,9,0.14)] via-[rgba(180,83,9,0.06)] to-[rgba(0,0,0,0.4)]',
        shimmer: 'from-amber-700/0 via-amber-700/12 to-amber-700/0',
        innerGlow: 'rgba(180,83,9,0.08)',
        topLine: 'bg-gradient-to-r from-transparent via-amber-700/50 to-transparent',
        avatarRing: 'ring-2 ring-amber-700/55',
        avatarShadow: 'shadow-[0_0_10px_rgba(180,83,9,0.35)]',
        scoreColor: 'text-amber-600 drop-shadow-[0_0_5px_rgba(180,83,9,0.5)]',
        labelColor: 'text-amber-700/70',
        squareSize: 'w-26 h-32 sm:w-32 sm:h-40 md:w-36 md:h-46 lg:w-44 lg:h-54',
        avatarSize: 'w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16',
        scoreSize: 'text-sm sm:text-base md:text-lg lg:text-2xl',
        nameSize: 'text-[10px] sm:text-xs md:text-xs lg:text-sm',
      };

  return (
    <div className="flex flex-col items-center">
      {/* Rank indicator above card */}
      <div className={clsx('flex flex-col items-center mb-3 h-10', isGold && 'podium-float')}>
        {isGold && (
          <div className="relative flex flex-col items-center">
            {/* Animated golden halo */}
            <div className="absolute -top-1 w-8 h-8 rounded-full bg-amber-400/20 animate-ping" style={{ animationDuration: '2.5s' }} />
            <Crown
              className="relative w-8 h-8 text-amber-400 drop-shadow-[0_0_14px_rgba(245,158,11,1)]"
            />
          </div>
        )}
        {isSilver && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 via-slate-400 to-slate-600 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-slate-400/30">
            2
          </div>
        )}
        {isBronze && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 via-amber-700 to-amber-900 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-amber-700/30">
            3
          </div>
        )}
      </div>

      {/* The square card */}
      <div
        onClick={onClick}
        className={clsx(
          'relative flex flex-col items-center justify-center rounded-2xl border backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 cursor-pointer overflow-hidden podium-shimmer',
          theme.cardBg, theme.cardBorder, theme.squareSize,
          isGold && 'podium-gold-pulse'
        )}
        style={{ boxShadow: isGold ? undefined : `inset 0 1px 0 ${theme.innerGlow}, inset 0 -1px 0 rgba(0,0,0,0.3)` }}
      >
        {/* Top metallic highlight line */}
        <div className={clsx('absolute top-0 left-4 right-4 h-px', theme.topLine)} />

        {/* Diagonal shimmer sweep */}
        <div
          className={clsx(
            'absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none',
            theme.shimmer
          )}
          style={{ transform: 'skewX(-20deg) scaleX(1.5)', transformOrigin: 'left' }}
        />

        {/* Gold: extra pulsing glow orb at top */}
        {isGold && (
          <div
            className="absolute -top-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.25) 0%, transparent 70%)' }}
          />
        )}

        {/* Avatar */}
        <div
          className={clsx(
            'rounded-full overflow-hidden shrink-0 mb-2 relative z-10',
            theme.avatarRing, theme.avatarSize, theme.avatarShadow
          )}
        >
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: isGold ? 'rgba(245,158,11,0.1)' : isSilver ? 'rgba(148,163,184,0.1)' : 'rgba(180,83,9,0.1)' }}
            >
              <User className={clsx('text-theme-muted', isGold ? 'w-8 h-8 md:w-9 h-9' : 'w-6 h-6 md:w-7 h-7')} />
            </div>
          )}
        </div>

        {/* Username */}
        <span
          className={clsx(
            'relative z-10 font-black text-white truncate max-w-full text-center leading-none w-full px-2',
            theme.nameSize
          )}
          style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}
        >
          {user.username}
        </span>

        {/* Score */}
        <div className="relative z-10 flex items-baseline gap-1 mt-1.5">
          <AnimatedScore
            value={user.score}
            delay={isGold ? 150 : isSilver ? 350 : 550}
            className={clsx('font-black leading-none tracking-tight', theme.scoreColor, theme.scoreSize)}
          />
          <span className={clsx('text-[9px] font-bold uppercase tracking-widest', theme.labelColor)}>pts</span>
        </div>

        {/* Badge count & Streak */}
        <div className="relative z-10 mt-2 flex items-center gap-1.5">
          {user.login_streak > 0 && (
            <div className={clsx(
              'flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold',
              isGold
                ? 'bg-orange-500/15 border border-orange-400/25 text-orange-300'
                : isSilver
                ? 'bg-orange-400/10 border border-orange-400/20 text-orange-300'
                : 'bg-orange-700/10 border border-orange-700/20 text-orange-500'
            )}>
              <Flame className="w-2.5 h-2.5" />
              {user.login_streak}
            </div>
          )}
          {user.badge_count > 0 && (
            <div className={clsx(
              'flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold',
              isGold
                ? 'bg-amber-500/15 border border-amber-400/25 text-amber-300'
                : isSilver
                ? 'bg-slate-400/10 border border-slate-400/20 text-slate-300'
                : 'bg-amber-700/10 border border-amber-700/20 text-amber-600'
            )}>
              <Sparkles className="w-2.5 h-2.5" />
              {user.badge_count}
            </div>
          )}
        </div>

        {/* Bottom vignette */}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/30 to-transparent pointer-events-none rounded-b-2xl" />
      </div>
    </div>
  );
};


// ── Main Component ─────────────────────────────────────────────────────────────
const LeaderboardPage = () => {
  const { token } = useAuth();
  const [period, setPeriod] = useState<'all_time' | 'weekly' | 'monthly'>('all_time');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Profile Modal
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  const openProfile = async (userId: string) => {
    setProfileUserId(userId);
    setProfileData(null);
    setProfileError('');
    setProfileLoading(true);
    try {
      const res = await apiFetch(`/quiz/stats/${userId}`, { token: token || undefined });
      setProfileData(res);
    } catch (err: any) {
      setProfileError('Could not load this player\'s profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setProfileUserId(null);
    setProfileData(null);
    setProfileLoading(false);
    setProfileError('');
  };


  const fetchLeaderboard = async (currentPeriod: typeof period) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/quiz/leaderboard?period=${currentPeriod}`, { token: token || undefined });
      setLeaderboard(res.leaderboard || []);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch leaderboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLeaderboard(period); }, [period]);

  const top3 = leaderboard.slice(0, 3);
  const others = leaderboard.slice(3);
  const maxScore = leaderboard[0]?.score || 1;

  // Podium order: Silver (2) | Gold (1) | Bronze (3)
  const podiumOrder: LeaderboardEntry[] = [];
  if (top3[1]) podiumOrder.push(top3[1]);
  if (top3[0]) podiumOrder.push(top3[0]);
  if (top3[2]) podiumOrder.push(top3[2]);

  const periodLabels: Record<string, string> = {
    all_time: 'All Time',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };

  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 md:px-6 max-w-6xl mx-auto py-10 pb-32 md:pb-16 gap-10 animate-fade-in">

      {/* ── HERO HEADER ─────────────────────────────────────────────────────── */}
      <div className="relative text-center max-w-2xl w-full">
        {/* Background glow */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-indigo-500/8 via-amber-500/4 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-widest mb-5">
          <Trophy className="w-3.5 h-3.5" />
          Global Rankings
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none">
          <span className="text-theme-primary">The </span>
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            Leaderboard
          </span>
        </h1>

        <p className="text-sm text-theme-muted mt-4 font-medium max-w-md mx-auto leading-relaxed">
          Answer faster. Stay consistent. Climb the ranks. Only the sharpest minds
          reach the top.
        </p>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-theme-surface border border-theme-border text-[11px] font-bold text-theme-secondary">
            <Target className="w-3 h-3 text-indigo-400" />
            {leaderboard.length} Competitors
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Rankings
          </div>
        </div>
      </div>

      {/* ── PERIOD TABS + RULES BUTTON ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between w-full max-w-2xl">
        {/* Period tabs */}
        <div className="relative flex p-1 bg-theme-surface border border-theme-border rounded-2xl w-full sm:w-auto">
          {/* Sliding indicator */}
          <div
            className="absolute top-1 bottom-1 rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/25 transition-all duration-300 ease-in-out"
            style={{
              width: 'calc(33.333% - 2px)',
              left: `calc(${['all_time', 'weekly', 'monthly'].indexOf(period)} * 33.333% + 1px)`,
            }}
          />
          {(['all_time', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              id={`tab-${p}`}
              onClick={() => setPeriod(p)}
              className={clsx(
                'relative z-10 flex-1 sm:w-28 py-2.5 px-4 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors duration-200 cursor-pointer',
                period === p ? 'text-white' : 'text-theme-muted hover:text-theme-secondary'
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* Rules button — mobile only */}
        <button
          id="rules-button"
          onClick={() => setShowRulesModal(true)}
          className="lg:hidden flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 bg-theme-surface border border-theme-border hover:border-indigo-500/40 text-indigo-400 rounded-2xl text-xs font-bold transition-all cursor-pointer hover:bg-indigo-500/5"
        >
          <Info className="w-4 h-4" />
          Rules & Rewards
        </button>
      </div>

      {/* ── MAIN CONTENT GRID ───────────────────────────────────────────────── */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* Main leaderboard column */}
        <div className="lg:col-span-2 flex flex-col gap-8 w-full">

          {isLoading ? (
            /* Loading state */
            <div className="w-full flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-amber-500/20 border-b-amber-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
              </div>
              <span className="text-xs text-theme-muted font-semibold animate-pulse">Loading rankings...</span>
            </div>
          ) : error ? (
            <div className="w-full p-6 text-center text-red-400 bg-red-500/10 border border-red-500/20 rounded-2xl">
              {error}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="w-full text-center py-20 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-theme-surface border border-theme-border flex items-center justify-center">
                <Trophy className="w-8 h-8 text-theme-muted" />
              </div>
              <div>
                <p className="text-theme-primary font-bold">No rankings yet</p>
                <p className="text-theme-muted text-sm mt-1">Be the first to take the quiz and claim the #1 spot!</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── PODIUM ─────────────────────────────────────────────────── */}
              {top3.length > 0 && (
                <div className="relative">

                  {/* ── Atmosphere layers ── */}
                  {/* Wide diffuse ambient */}
                  <div
                    className="absolute -inset-8 blur-3xl pointer-events-none rounded-full"
                    style={{ background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.08) 0%, transparent 70%)' }}
                  />
                  {/* Gold spotlight cone from top-center */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-6 w-56 h-56 pointer-events-none"
                    style={{ background: 'conic-gradient(from 160deg at 50% 0%, transparent 30%, rgba(245,158,11,0.12) 45%, rgba(245,158,11,0.06) 55%, transparent 70%)', borderRadius: '50%' }}
                  />

                  {/* Frosted glass stage platform */}
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-2xl border border-white/5 pointer-events-none"
                    style={{
                      top: '60px',
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0.02), rgba(0,0,0,0.25))',
                      backdropFilter: 'blur(12px)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.4)'
                    }}
                  />

                  {/* Cards row — items-end so larger gold card naturally rises */}
                  <div className="relative flex items-end justify-center gap-2 sm:gap-4 md:gap-8 pt-14 pb-6">
                    {podiumOrder.map((user) => (
                      <PodiumCard key={user.user_id} user={user} onClick={() => openProfile(user.user_id)} />
                    ))}
                  </div>

                  {/* Shimmering base line */}
                  <div
                    className="h-px w-full"
                    style={{ background: 'linear-gradient(to right, transparent, rgba(245,158,11,0.3) 30%, rgba(245,158,11,0.5) 50%, rgba(245,158,11,0.3) 70%, transparent)' }}
                  />
                </div>
              )}

              {/* ── RANK LIST 4–100 ─────────────────────────────────────── */}
              {others.length > 0 && (
                <div className="w-full flex flex-col gap-1.5">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-theme-muted flex items-center gap-1.5">
                      <ChevronUp className="w-3 h-3 text-indigo-400" />
                      Rankings — 4 to {leaderboard.length}
                    </span>
                    <span className="text-[10px] text-theme-muted font-semibold">{others.length} entries</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {others.map((user, idx) => (
                      <div
                        key={user.user_id}
                        id={`rank-row-${user.rank}`}
                        onClick={() => openProfile(user.user_id)}
                        className="group relative flex items-center gap-4 px-4 md:px-5 py-4 rounded-2xl border border-theme-border/30 bg-gradient-to-r from-theme-surface/10 to-theme-surface/5 backdrop-blur-md hover:from-indigo-500/[0.06] hover:to-violet-500/[0.02] hover:border-indigo-500/30 transition-all duration-300 shadow-md hover:shadow-indigo-500/5 hover:-translate-y-0.5 overflow-hidden cursor-pointer"
                        style={{ animationDelay: `${idx * 40}ms` }}
                      >
                        {/* Glowing ambient line on hover */}
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-indigo-500 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        {/* Rank number block */}
                        <div className="w-8 shrink-0 text-center">
                          <span className="text-sm font-black text-theme-muted group-hover:text-indigo-400 transition-colors drop-shadow-[0_0_10px_rgba(99,102,241,0)] group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">
                            #{user.rank}
                          </span>
                        </div>

                        {/* Avatar container with premium ring */}
                        <div className="w-10 h-10 rounded-full p-[1.5px] bg-gradient-to-br from-theme-border/60 to-theme-border/30 group-hover:from-indigo-500/40 group-hover:to-violet-500/40 transition-all duration-300 shrink-0">
                          <div className="w-full h-full rounded-full overflow-hidden bg-theme-surface-2 flex items-center justify-center">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-theme-muted group-hover:text-indigo-400 transition-colors" />
                            )}
                          </div>
                        </div>

                        {/* Name + badges + score bar */}
                        <div className="flex-grow min-w-0 flex flex-col gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-bold text-theme-primary truncate group-hover:text-white transition-colors">
                              {user.username}
                            </span>
                            {user.badge_count > 0 && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.05)] group-hover:shadow-[0_0_10px_rgba(99,102,241,0.15)] transition-shadow">
                                <Sparkles className="w-2.5 h-2.5 animate-pulse" />
                                {user.badge_count}
                              </span>
                            )}
                            {user.login_streak > 0 && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] text-orange-400 font-bold bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-full">
                                <Flame className="w-2.5 h-2.5" />
                                {user.login_streak}d
                              </span>
                            )}
                          </div>
                          {/* Sleek score bar */}
                          <div className="flex items-center gap-3">
                            <ScoreBar score={user.score} maxScore={maxScore} rank={user.rank} />
                          </div>
                        </div>

                        {/* Premium Score display */}
                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-theme-primary group-hover:text-white transition-colors drop-shadow-[0_0_8px_rgba(255,255,255,0)] group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]">
                            {user.score.toLocaleString()}
                          </span>
                          <span className="block text-[8px] font-black text-theme-muted group-hover:text-indigo-400/80 transition-colors uppercase tracking-widest mt-0.5">
                            PTS
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── RULES SIDEBAR (desktop) ────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col gap-3 w-full">
          <div className="flex items-center gap-2 px-1 mb-1">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-theme-muted">How it works</span>
          </div>
          <RulesContent />

          {/* CTA card */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/5 border border-indigo-500/20 p-5 flex flex-col gap-3 mt-1">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-sm font-bold text-theme-primary">Ready to compete?</p>
              <p className="text-xs text-theme-muted mt-1 leading-relaxed">Start the Quiz Arena and put your name on this board.</p>
            </div>
            <a
              href="/quiz"
              className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs text-center transition-all cursor-pointer block hover:shadow-lg hover:shadow-indigo-500/20"
            >
              Enter Quiz Arena →
            </a>
          </div>
        </div>
      </div>

      {/* ── MOBILE RULES MODAL ───────────────────────────────────────────────── */}
      <Modal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} title="Rules & Rewards">
        <div className="flex flex-col gap-4">
          <RulesContent />
        </div>
      </Modal>

      {/* ── PROFILE MODAL ──────────────────────────────────────────────────────── */}
      <Modal isOpen={!!profileUserId} onClose={closeProfile} hideHeader={true}>
        <div className="relative">
          {/* Close btn */}
          <button
            onClick={closeProfile}
            className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/5 text-theme-muted hover:text-white transition-colors cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {profileLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-violet-500/20 border-b-violet-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
              </div>
              <p className="text-xs text-theme-muted font-semibold animate-pulse">Loading profile...</p>
            </div>
          )}

          {profileError && !profileLoading && (
            <div className="p-8 text-center">
              <p className="text-sm text-red-400 font-semibold">{profileError}</p>
            </div>
          )}

          {profileData && !profileLoading && (() => {
            const { profile, badges } = profileData;
            const planColors: Record<string, string> = {
              free: 'from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-300',
              pro: 'from-indigo-500/20 to-violet-600/10 border-indigo-500/30 text-indigo-300',
              premium: 'from-amber-500/20 to-orange-600/10 border-amber-500/30 text-amber-300',
            };
            const planStyle = planColors[profile.plan] || planColors.free;

            return (
              <div className="flex flex-col">
                {/* Hero banner */}
                <div className="relative px-6 pt-8 pb-6 flex flex-col items-center gap-4 border-b border-white/[0.06]">
                  <div
                    className="absolute inset-0 opacity-30 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.25) 0%, transparent 65%)' }}
                  />

                  {/* Avatar */}
                  <div className="relative z-10 w-20 h-20 rounded-2xl ring-2 ring-indigo-500/40 shadow-[0_0_30px_rgba(99,102,241,0.3)] overflow-hidden bg-theme-surface-2 flex items-center justify-center">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-9 h-9 text-theme-muted" />
                    )}
                  </div>

                  {/* Name + plan */}
                  <div className="relative z-10 text-center">
                    <h2 className="text-xl font-black text-white leading-tight">{profile.username}</h2>
                    <span className={`inline-block mt-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-gradient-to-r border ${planStyle}`}>
                      {profile.plan || 'Free'}
                    </span>
                  </div>

                  {/* Global rank badge */}
                  <div className="relative z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/25">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-black text-amber-300">Rank #{profile.rank}</span>
                    <span className="text-[10px] text-amber-400/60 font-bold">Global</span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="p-5 grid grid-cols-2 gap-3">
                  {[
                    { icon: <BarChart3 className="w-3.5 h-3.5" />, label: 'Total Points', value: profile.points.toLocaleString(), color: 'indigo' },
                    { icon: <Target className="w-3.5 h-3.5" />, label: 'Accuracy', value: `${profile.accuracy}%`, color: 'emerald' },
                    { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Answered', value: `${profile.total_answered}`, color: 'violet' },
                    { icon: <Flame className="w-3.5 h-3.5" />, label: 'Login Streak', value: `${profile.login_streak}d`, color: 'amber' },
                  ].map((stat, i) => (
                    <div
                      key={i}
                      className={clsx(
                        'flex flex-col gap-2 p-4 rounded-2xl border',
                        stat.color === 'indigo' && 'bg-indigo-500/5 border-indigo-500/15',
                        stat.color === 'emerald' && 'bg-emerald-500/5 border-emerald-500/15',
                        stat.color === 'violet' && 'bg-violet-500/5 border-violet-500/15',
                        stat.color === 'amber' && 'bg-amber-500/5 border-amber-500/15',
                      )}
                    >
                      <div className={clsx(
                        'p-1.5 rounded-lg w-fit',
                        stat.color === 'indigo' && 'bg-indigo-500/15 text-indigo-400',
                        stat.color === 'emerald' && 'bg-emerald-500/15 text-emerald-400',
                        stat.color === 'violet' && 'bg-violet-500/15 text-violet-400',
                        stat.color === 'amber' && 'bg-amber-500/15 text-amber-400',
                      )}>
                        {stat.icon}
                      </div>
                      <div>
                        <div className="text-xl font-black text-white">{stat.value}</div>
                        <div className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Badges section */}
                {badges && badges.length > 0 && (
                  <div className="px-5 pb-6 flex flex-col gap-3">
                    <div className="flex items-center gap-2 border-t border-white/[0.06] pt-4">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                        Earned Badges ({badges.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {badges.map((badge: any) => (
                        <div
                          key={badge.slug}
                          className="flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-500/8 to-orange-500/4 border border-amber-500/15"
                        >
                          <span className="text-xl shrink-0">{badge.icon || '🏅'}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{badge.name}</div>
                            <div className="text-[9px] text-theme-muted truncate">{badge.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {badges && badges.length === 0 && (
                  <div className="px-5 pb-6 text-center border-t border-white/[0.06] pt-4">
                    <p className="text-xs text-theme-muted font-semibold">No badges earned yet — keep competing!</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
};

export default LeaderboardPage;
