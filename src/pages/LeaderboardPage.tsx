import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Sparkles, User, Zap, Clock, Flame, Award,
  BookOpen, Info, ChevronUp, Shield, Target, X, CheckCircle2, BarChart3
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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

const SafeAvatarImg = ({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null;
  alt: string;
  className: string;
  fallback: React.ReactNode;
}) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (!src || failed) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

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
const ScoreBar = ({ score, maxScore, rank, isDark }: { score: number; maxScore: number; rank: number; isDark: boolean }) => {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const color = rank === 1 ? 'from-amber-400 to-amber-600' : rank === 2 ? 'from-slate-300 to-slate-500' : rank === 3 ? 'from-amber-600 to-amber-800' : 'from-indigo-500 to-violet-600';
  return (
    <div className={clsx('flex-1 h-1.5 rounded-full overflow-hidden', isDark ? 'bg-theme-border/50' : 'bg-slate-200/80')}>
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

// ── Podium Item (Open circular avatar + 3D diamond rank badge, no box card) ────
const PodiumCard = ({
  user,
  isDark,
  isCurrentUser,
  onClick,
}: {
  user: LeaderboardEntry;
  isDark: boolean;
  isCurrentUser?: boolean;
  onClick: () => void;
}) => {
  const isGold = user.rank === 1;
  const isSilver = user.rank === 2;
  const initial = (user.username || 'S').trim().charAt(0).toUpperCase();

  const theme = isGold
    ? {
        outerRing: isDark
          ? 'border-amber-400/80 bg-amber-500/10 shadow-[0_10px_30px_rgba(245,158,11,0.25)]'
          : 'border-amber-400 bg-white shadow-[0_10px_28px_rgba(245,158,11,0.20)]',
        diamondOuter: 'bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-[0_6px_16px_rgba(245,158,11,0.35)]',
        diamondInner: 'bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 border border-white/70 text-amber-950',
        fallbackBg: isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800',
        avatarSize: 'w-22 h-22 sm:w-28 sm:h-28 md:w-32 md:h-32',
        diamondSize: 'w-8 h-8 sm:w-9 sm:h-9',
        elevation: 'pb-5 sm:pb-7',
      }
    : isSilver
    ? {
        outerRing: isDark
          ? 'border-slate-300/70 bg-slate-400/10 shadow-[0_8px_24px_rgba(148,163,184,0.18)]'
          : 'border-slate-300 bg-white shadow-[0_8px_22px_rgba(100,116,139,0.14)]',
        diamondOuter: 'bg-gradient-to-br from-white via-slate-300 to-slate-500 shadow-[0_6px_14px_rgba(100,116,139,0.28)]',
        diamondInner: 'bg-gradient-to-br from-white via-slate-200 to-slate-300 border border-white/90 text-slate-700',
        fallbackBg: isDark ? 'bg-indigo-500/20 text-indigo-200' : 'bg-[#dcd3ea] text-slate-800',
        avatarSize: 'w-18 h-18 sm:w-22 sm:h-22 md:w-26 md:h-26',
        diamondSize: 'w-7 h-7 sm:w-8 sm:h-8',
        elevation: 'pb-0',
      }
    : {
        outerRing: isDark
          ? 'border-amber-600/75 bg-orange-500/10 shadow-[0_8px_24px_rgba(180,83,9,0.20)]'
          : 'border-[#b08d74] bg-white shadow-[0_8px_22px_rgba(180,83,9,0.14)]',
        diamondOuter: 'bg-gradient-to-br from-[#e6ccb2] via-[#b08968] to-[#7f5539] shadow-[0_6px_14px_rgba(127,85,57,0.30)]',
        diamondInner: 'bg-gradient-to-br from-[#ddb892] via-[#b08968] to-[#9c6644] border border-amber-100/60 text-amber-950',
        fallbackBg: isDark ? 'bg-orange-500/20 text-orange-200' : 'bg-[#f6d5b0] text-amber-950',
        avatarSize: 'w-18 h-18 sm:w-22 sm:h-22 md:w-26 md:h-26',
        diamondSize: 'w-7 h-7 sm:w-8 sm:h-8',
        elevation: 'pb-0',
      };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'group flex flex-col items-center w-full min-w-0 cursor-pointer transition-transform duration-300 hover:-translate-y-1',
        theme.elevation
      )}
    >
      {/* Circular Avatar with Outer Ring + 3D Rotated Diamond Badge */}
      <div className="relative flex items-center justify-center">
        <div
          className={clsx(
            'rounded-full p-1 sm:p-1.5 border-2 transition-transform duration-300 group-hover:scale-[1.03]',
            theme.outerRing,
            theme.avatarSize,
            isCurrentUser && 'ring-2 ring-indigo-500/60'
          )}
        >
          <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
            <SafeAvatarImg
              src={user.avatar_url}
              alt={user.username}
              className="w-full h-full object-cover"
              fallback={
                <div className={clsx('w-full h-full flex items-center justify-center font-semibold', theme.fallbackBg, isGold ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl')}>
                  {initial}
                </div>
              }
            />
          </div>
        </div>

        {/* 3D Beveled Diamond Badge */}
        <div
          className={clsx(
            'absolute -bottom-3 sm:-bottom-3.5 left-1/2 -translate-x-1/2 rotate-45 rounded-lg p-[2.5px] sm:p-[3px] z-10',
            theme.diamondOuter,
            theme.diamondSize
          )}
        >
          <div className={clsx('w-full h-full rounded-[5px] flex items-center justify-center', theme.diamondInner)}>
            <span className="-rotate-45 font-black text-xs sm:text-sm leading-none">
              {user.rank}
            </span>
          </div>
        </div>
      </div>

      {/* Username */}
      <div className="mt-5 sm:mt-6 w-full flex items-center justify-center gap-1 min-w-0 px-1">
        <span className="font-bold text-theme-primary text-xs sm:text-sm md:text-base truncate text-center leading-tight group-hover:text-indigo-500 transition-colors">
          {user.username}
        </span>
        {isCurrentUser && (
          <span className={clsx(
            'shrink-0 text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full',
            isDark ? 'bg-indigo-500/25 text-indigo-300' : 'bg-indigo-100 text-indigo-600'
          )}>
            You
          </span>
        )}
      </div>

      {/* Score */}
      <div className="mt-0.5 flex items-baseline justify-center gap-1">
        <AnimatedScore
          value={user.score}
          delay={isGold ? 150 : isSilver ? 350 : 550}
          className="font-semibold text-theme-secondary text-xs sm:text-sm md:text-base leading-none"
        />
      </div>

      {/* Streak / Badges (subtle pill row if present) */}
      {(user.login_streak > 0 || user.badge_count > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
          {user.login_streak > 0 && (
            <div className={clsx(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border',
              isDark
                ? 'bg-orange-500/15 border-orange-400/25 text-orange-300'
                : 'bg-orange-50 border-orange-200 text-orange-600'
            )}>
              <Flame className="w-2.5 h-2.5 shrink-0" />
              {user.login_streak}d
            </div>
          )}
          {user.badge_count > 0 && (
            <div className={clsx(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border',
              isDark
                ? 'bg-indigo-500/15 border-indigo-400/25 text-indigo-300'
                : 'bg-indigo-50 border-indigo-200 text-indigo-600'
            )}>
              <Sparkles className="w-2.5 h-2.5 shrink-0" />
              {user.badge_count}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


// ── Main Component ─────────────────────────────────────────────────────────────
const LeaderboardPage = () => {
  const { token, user: currentUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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

  // Podium order: Silver (2) | Gold (1) | Bronze (3) when all 3 exist; otherwise #1, #2
  const podiumOrder: LeaderboardEntry[] =
    top3.length === 3
      ? [top3[1], top3[0], top3[2]]
      : top3;

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
              {/* ── PODIUM (Open layout, no outer container box) ───────────── */}
              {top3.length > 0 && (
                <div
                  className={clsx(
                    'w-full max-w-xl mx-auto pt-2 pb-2',
                    top3.length === 3
                      ? 'grid grid-cols-3 items-end gap-2 sm:gap-6 md:gap-8'
                      : 'flex justify-center items-end gap-6 sm:gap-10'
                  )}
                >
                  {podiumOrder.map((entry) => (
                    <div
                      key={entry.user_id}
                      className={top3.length < 3 ? 'flex-1 max-w-[160px] sm:max-w-[190px]' : 'w-full min-w-0'}
                    >
                      <PodiumCard
                        user={entry}
                        isDark={isDark}
                        isCurrentUser={currentUser?.id === entry.user_id}
                        onClick={() => openProfile(entry.user_id)}
                      />
                    </div>
                  ))}
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
                    {others.map((user, idx) => {
                      const isMe = currentUser?.id === user.user_id;
                      return (
                        <div
                          key={user.user_id}
                          id={`rank-row-${user.rank}`}
                          onClick={() => openProfile(user.user_id)}
                          className={clsx(
                            'group relative flex items-center gap-3 sm:gap-4 px-3.5 sm:px-5 py-3.5 sm:py-4 rounded-2xl border backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 overflow-hidden cursor-pointer',
                            isMe
                              ? (isDark
                                  ? 'bg-indigo-500/12 border-indigo-400/50 ring-1 ring-indigo-400/30'
                                  : 'bg-indigo-50/90 border-indigo-400/60 ring-1 ring-indigo-400/30 shadow-sm')
                              : (isDark
                                  ? 'bg-theme-surface/60 border-theme-border/40 hover:bg-theme-surface-2/70 hover:border-indigo-500/40'
                                  : 'bg-white/90 border-theme-border/70 hover:bg-white hover:border-indigo-400/60 shadow-sm hover:shadow-md')
                          )}
                          style={{ animationDelay: `${idx * 40}ms` }}
                        >
                          {/* Glowing ambient line on hover */}
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-indigo-500 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                          {/* Rank number block */}
                          <div className="w-6 sm:w-7 shrink-0 text-center">
                            <span className="text-xs sm:text-sm font-bold text-theme-primary group-hover:text-indigo-500 transition-colors">
                              {user.rank}
                            </span>
                          </div>

                          {/* Avatar container */}
                          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden bg-theme-surface-2 flex items-center justify-center shrink-0">
                            <SafeAvatarImg
                              src={user.avatar_url}
                              alt={user.username}
                              className="w-full h-full object-cover"
                              fallback={
                                <span className={clsx(
                                  'w-full h-full flex items-center justify-center text-sm font-semibold',
                                  isDark ? 'bg-indigo-500/20 text-indigo-200' : 'bg-[#f6d5b0] text-slate-800'
                                )}>
                                  {(user.username || 'S').trim().charAt(0).toUpperCase()}
                                </span>
                              }
                            />
                          </div>

                          {/* Name + badges + score bar */}
                          <div className="flex-grow min-w-0 flex flex-col gap-1.5 sm:gap-2">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <span className="text-xs sm:text-sm font-bold text-theme-primary truncate group-hover:text-indigo-500 transition-colors">
                                {user.username}
                              </span>
                              {isMe && (
                                <span className={clsx(
                                  'shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full',
                                  isDark ? 'bg-indigo-500/25 text-indigo-300' : 'bg-indigo-100 text-indigo-600'
                                )}>
                                  You
                                </span>
                              )}
                              {user.badge_count > 0 && (
                                <span className={clsx(
                                  'shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border',
                                  isDark
                                    ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20'
                                    : 'text-indigo-600 bg-indigo-50 border-indigo-200'
                                )}>
                                  <Sparkles className="w-2.5 h-2.5" />
                                  {user.badge_count}
                                </span>
                              )}
                              {user.login_streak > 0 && (
                                <span className={clsx(
                                  'shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border',
                                  isDark
                                    ? 'text-orange-300 bg-orange-500/10 border-orange-500/20'
                                    : 'text-orange-600 bg-orange-50 border-orange-200'
                                )}>
                                  <Flame className="w-2.5 h-2.5" />
                                  {user.login_streak}d
                                </span>
                              )}
                            </div>
                            {/* Sleek score bar */}
                            <div className="flex items-center gap-3">
                              <ScoreBar score={user.score} maxScore={maxScore} rank={user.rank} isDark={isDark} />
                            </div>
                          </div>

                          {/* Premium Score display */}
                          <div className="text-right shrink-0">
                            <span className="text-xs sm:text-sm font-black text-theme-primary group-hover:text-indigo-500 transition-colors">
                              {user.score.toLocaleString()}
                            </span>
                            <span className="block text-[8px] font-black text-theme-muted group-hover:text-indigo-500/80 transition-colors uppercase tracking-widest mt-0.5">
                              PTS
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
            <Link
              to="/quiz"
              className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs text-center transition-all cursor-pointer block hover:shadow-lg hover:shadow-indigo-500/20"
            >
              Enter Quiz Arena →
            </Link>
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
            className="absolute top-4 right-4 p-2 rounded-xl hover:bg-theme-surface-2 text-theme-muted hover:text-theme-primary transition-colors cursor-pointer z-10"
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
              free: isDark
                ? 'bg-slate-500/15 border-slate-500/30 text-slate-300'
                : 'bg-slate-100 border-slate-300 text-slate-700',
              basic: isDark
                ? 'bg-blue-500/15 border-blue-400/30 text-blue-300'
                : 'bg-blue-50 border-blue-200 text-blue-700',
              plus: isDark
                ? 'bg-indigo-500/15 border-indigo-400/30 text-indigo-300'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700',
              pro: isDark
                ? 'bg-amber-500/15 border-amber-400/30 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-700',
              premium: isDark
                ? 'bg-amber-500/15 border-amber-400/30 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-700',
            };
            const planKey = (profile.plan || 'free').toLowerCase();
            const planStyle = planColors[planKey] || planColors.free;

            return (
              <div className="flex flex-col">
                {/* Hero banner */}
                <div className="relative px-6 pt-8 pb-6 flex flex-col items-center gap-4 border-b border-theme-border/40">
                  <div
                    className="absolute inset-0 opacity-30 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.22) 0%, transparent 65%)' }}
                  />

                  {/* Avatar */}
                  <div className="relative z-10 w-20 h-20 rounded-2xl ring-2 ring-indigo-500/40 shadow-[0_0_30px_rgba(99,102,241,0.25)] overflow-hidden bg-theme-surface-2 flex items-center justify-center">
                    <SafeAvatarImg
                      src={profile.avatar_url}
                      alt={profile.username}
                      className="w-full h-full object-cover"
                      fallback={<User className="w-9 h-9 text-theme-muted" />}
                    />
                  </div>

                  {/* Name + plan */}
                  <div className="relative z-10 text-center">
                    <h2 className="text-xl font-black text-theme-primary leading-tight">{profile.username}</h2>
                    <span className={`inline-block mt-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${planStyle}`}>
                      {profile.plan || 'Free'}
                    </span>
                  </div>

                  {/* Global rank badge */}
                  <div className={clsx(
                    'relative z-10 flex items-center gap-2 px-4 py-2 rounded-full border',
                    isDark ? 'bg-amber-500/10 border-amber-500/25' : 'bg-amber-50 border-amber-200'
                  )}>
                    <Trophy className={clsx('w-3.5 h-3.5', isDark ? 'text-amber-400' : 'text-amber-600')} />
                    <span className={clsx('text-xs font-black', isDark ? 'text-amber-300' : 'text-amber-700')}>Rank #{profile.rank}</span>
                    <span className={clsx('text-[10px] font-bold', isDark ? 'text-amber-400/70' : 'text-amber-600/80')}>Global</span>
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
                        stat.color === 'indigo' && 'bg-indigo-500/15 text-indigo-500',
                        stat.color === 'emerald' && 'bg-emerald-500/15 text-emerald-500',
                        stat.color === 'violet' && 'bg-violet-500/15 text-violet-500',
                        stat.color === 'amber' && 'bg-amber-500/15 text-amber-500',
                      )}>
                        {stat.icon}
                      </div>
                      <div>
                        <div className="text-xl font-black text-theme-primary">{stat.value}</div>
                        <div className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Badges section */}
                {badges && badges.length > 0 && (
                  <div className="px-5 pb-6 flex flex-col gap-3">
                    <div className="flex items-center gap-2 border-t border-theme-border/40 pt-4">
                      <Award className={clsx('w-3.5 h-3.5', isDark ? 'text-amber-400' : 'text-amber-600')} />
                      <span className={clsx('text-[10px] font-black uppercase tracking-widest', isDark ? 'text-amber-400' : 'text-amber-600')}>
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
                            <div className="text-xs font-bold text-theme-primary truncate">{badge.name}</div>
                            <div className="text-[9px] text-theme-muted truncate">{badge.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {badges && badges.length === 0 && (
                  <div className="px-5 pb-6 text-center border-t border-theme-border/40 pt-4">
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
