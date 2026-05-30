import { useState, useRef, useEffect } from 'react';
import {
  User, Mail, CreditCard, LogOut, ShieldAlert, Bell, Camera,
  Sparkles, X as CloseIcon, Zap, MessageSquare,
  Target, Flame, ChevronRight, CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { clsx } from 'clsx';

// ─── Reusable Row Component ───────────────────────────────────────────────────

interface SettingsRowProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value?: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  last?: boolean;
  rightContent?: React.ReactNode;
}

const SettingsRow = ({ icon, iconBg, label, value, to, onClick, danger = false, last = false, rightContent }: SettingsRowProps) => {
  const inner = (
    <div className={clsx(
      "flex items-center gap-4 px-5 py-4 transition-all duration-150",
      !last && "border-b border-theme-border/30",
      (to || onClick) && "active:bg-theme-surface/60 hover:bg-theme-surface/40 cursor-pointer",
    )}>
      <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm", iconBg)}>
        {icon}
      </div>
      <div className="flex-grow min-w-0">
        <span className={clsx("text-sm font-semibold", danger ? "text-red-400" : "text-theme-primary")}>
          {label}
        </span>
        {value && (
          <p className="text-xs text-theme-muted font-medium mt-0.5 truncate">{value}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {rightContent}
        {(to || onClick) && !rightContent && (
          <ChevronRight className="w-4 h-4 text-theme-muted/50" />
        )}
      </div>
    </div>
  );

  if (to) return <Link to={to}>{inner}</Link>;
  if (onClick) return <button onClick={onClick} className="w-full text-left">{inner}</button>;
  return inner;
};

// ─── Section Container ────────────────────────────────────────────────────────
interface SettingsSectionProps {
  label?: string;
  children: React.ReactNode;
}
const SettingsSection = ({ label, children }: SettingsSectionProps) => (
  <div className="w-full">
    {label && (
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-theme-muted px-1 mb-2">
        {label}
      </p>
    )}
    <div className="rounded-2xl bg-theme-surface/60 border border-theme-border/50 overflow-hidden backdrop-blur-sm">
      {children}
    </div>
  </div>
);

// ─── Stat Pill ────────────────────────────────────────────────────────────────
interface StatPillProps {
  label: string;
  value: string | number;
  color: string;
}
const StatPill = ({ label, value, color }: StatPillProps) => (
  <div className="flex flex-col items-center justify-center px-6 py-5 bg-theme-surface/40 border border-theme-border/40 rounded-2xl text-center">
    <span className={clsx("text-3xl font-black tracking-tight leading-none mb-1", color)}>{value}</span>
    <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">{label}</span>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const ProfilePage = () => {
  const { user, token, updateUser, logout } = useAuth();
  const [name, setName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [isAvatarDeleted, setIsAvatarDeleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showPersonalizeInfo, setShowPersonalizeInfo] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [streak, setStreak] = useState<number>(0);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiFetch('/profile/me', { token: token || undefined });
        if (res.user) {
          setName(res.user.full_name);
          setAvatarUrl(res.user.avatar_url || '');
          updateUser({
            full_name: res.user.full_name,
            avatar_url: res.user.avatar_url,
            plan: res.user.plan,
            plan_expires: res.user.plan_expires,
            ai_usage_count: res.user.ai_usage_count,
            pdf_downloads_count: res.user.pdf_downloads_count,
            pdf_views_count: res.user.pdf_views_count
          });
          if (res.user.streak_count !== undefined) {
            setStreak(res.user.streak_count);
          }
        }
      } catch { /* silent */ }
    };
    fetchProfile();
    const cached = sessionStorage.getItem('streak_count');
    if (cached) setStreak(parseInt(cached, 10));
  }, []);

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    setAvatarBase64(null);
    setIsAvatarDeleted(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAvatarUrl(base64);
        setAvatarBase64(base64);
        setIsAvatarDeleted(false);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      await apiFetch('/profile/me', {
        method: 'PATCH',
        token: token || undefined,
        body: { full_name: name }
      });

      let finalAvatarUrl = avatarUrl;
      if (isAvatarDeleted) {
        await apiFetch('/profile/me/avatar', { method: 'DELETE', token: token || undefined });
        finalAvatarUrl = '';
      } else if (avatarBase64) {
        const res = await apiFetch('/profile/me/avatar', {
          method: 'POST',
          token: token || undefined,
          body: { avatar_base64: avatarBase64 }
        });
        if (res.avatar_url) finalAvatarUrl = res.avatar_url;
      }

      updateUser({ full_name: name, avatar_url: finalAvatarUrl });
      setMessage('Changes saved.');
      setAvatarBase64(null);
      setIsAvatarDeleted(false);
      setIsEditingName(false);
    } catch (err: any) {
      setMessage(err.message || 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  const planName = (user?.plan || 'Free').charAt(0).toUpperCase() + (user?.plan || 'free').slice(1).toLowerCase();
  const isPremium = ['plus', 'pro'].includes(user?.plan?.toLowerCase() || '');
  const queriesLimit = user?.plan?.toLowerCase() === 'free' ? 3 : user?.plan?.toLowerCase() === 'basic' ? 20 : '∞';

  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 md:px-6 max-w-xl mx-auto py-10 pb-32 md:pb-16 gap-8">

      {/* ── Hero Profile Section ─────────────────────────────────────────── */}
      <div className="w-full flex flex-col items-center gap-4 pt-4">

        {/* Avatar */}
        <div className="relative group">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-theme-surface shadow-xl">
            {avatarUrl && !isAvatarDeleted ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-3xl font-black text-white select-none">
                  {name?.charAt(0).toUpperCase() || 'S'}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-indigo-500 hover:bg-indigo-600 border-2 border-theme-base flex items-center justify-center transition-all shadow-md cursor-pointer"
            title="Change photo"
          >
            <Camera className="w-3.5 h-3.5 text-white" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        {/* Name & Plan Badge */}
        <div className="text-center">
          <h1 className="text-2xl font-black text-theme-primary tracking-tight leading-tight">
            {name || 'Student'}
          </h1>
          <p className="text-sm text-theme-muted font-medium mt-1">{user?.email}</p>
          <div className={clsx(
            "inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border",
            isPremium
              ? "bg-indigo-500/10 border-indigo-500/25 text-indigo-400"
              : "bg-theme-surface border-theme-border text-theme-muted"
          )}>
            {isPremium && <Sparkles className="w-3 h-3" />}
            {planName} Plan
          </div>
        </div>

        {/* Streak chip */}
        {streak > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1.5 rounded-full text-xs font-bold">
            <Flame className="w-3.5 h-3.5" />
            {streak}-Day Study Streak
          </div>
        )}
      </div>

      {/* ── Quick Stats ─────────────────────────────────────────────────── */}
      <div className="w-full grid grid-cols-3 gap-3">
        <StatPill
          label="AI Queries"
          value={user?.ai_usage_count || 0}
          color="text-indigo-400"
        />
        <StatPill
          label="Study Hours"
          value={`${Math.round((user?.ai_usage_count || 0) * 2 / 60 * 10) / 10}h`}
          color="text-emerald-400"
        />
        <StatPill
          label="Day Streak"
          value={streak}
          color="text-orange-400"
        />
      </div>

      {/* ── Profile Section ──────────────────────────────────────────────── */}
      <SettingsSection label="Profile">
        <div className={clsx(
          "px-5 py-4 border-b border-theme-border/30",
          !isEditingName && "cursor-pointer hover:bg-theme-surface/40 transition-all"
        )}
          onClick={() => !isEditingName && setIsEditingName(true)}
        >
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-[10px] font-extrabold text-theme-muted uppercase tracking-widest mb-1">Full Name</p>
              {isEditingName ? (
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveChanges()}
                  className="w-full bg-transparent border-b-2 border-indigo-500/60 text-sm font-semibold text-theme-primary focus:outline-none pb-0.5"
                />
              ) : (
                <p className="text-sm font-semibold text-theme-primary truncate">{name || '—'}</p>
              )}
            </div>
            {isEditingName ? (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditingName(false); }}
                  className="text-xs font-bold text-theme-muted hover:text-theme-primary transition-colors cursor-pointer px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleSaveChanges(); }}
                  disabled={isSaving}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer px-2 py-1 disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : (
              <ChevronRight className="w-4 h-4 text-theme-muted/50 shrink-0" />
            )}
          </div>
        </div>

        <SettingsRow
          icon={<Mail className="w-4 h-4 text-blue-400" />}
          iconBg="bg-blue-500/10"
          label="Email"
          value={user?.email || '—'}
          last
          rightContent={
            <span className="text-[10px] font-bold text-theme-muted bg-theme-surface border border-theme-border/50 px-2 py-1 rounded-full">Verified</span>
          }
        />
      </SettingsSection>

      {/* Save Changes feedback */}
      {message && (
        <div className={clsx(
          "w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border",
          message.includes('saved') || message.includes('Changes')
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : "bg-red-500/10 text-red-400 border-red-500/20"
        )}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {message}
        </div>
      )}

      {/* Photo actions if pending */}
      {(avatarBase64 || isAvatarDeleted) && (
        <div className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-500/8 border border-indigo-500/20 rounded-2xl">
          <p className="flex-grow text-xs font-semibold text-theme-secondary">
            {isAvatarDeleted ? 'Photo marked for removal.' : 'New photo ready to save.'}
          </p>
          <button onClick={handleSaveChanges} disabled={isSaving} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer disabled:opacity-50">
            {isSaving ? 'Saving…' : 'Save Now'}
          </button>
          {avatarUrl && !isAvatarDeleted && (
            <button onClick={handleRemoveAvatar} className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer">
              Remove
            </button>
          )}
        </div>
      )}

      {/* ── Cortana AI Section ───────────────────────────────────────────── */}
      <SettingsSection label="Cortana AI">
        {/* Plan status row */}
        <div className="px-5 py-4 border-b border-theme-border/30">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex-grow">
              <p className="text-sm font-semibold text-theme-primary">{planName} Plan</p>
              <p className="text-xs text-theme-muted mt-0.5">
                {isPremium ? 'Unlimited AI queries · Full access' : `${user?.ai_usage_count || 0} of ${queriesLimit} queries used`}
              </p>
              {!isPremium && typeof queriesLimit === 'number' && (
                <div className="mt-2 w-full h-1 bg-theme-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(((user?.ai_usage_count || 0) / queriesLimit) * 100, 100)}%` }}
                  />
                </div>
              )}
              {isPremium && (
                <div className="mt-2 w-full h-1 bg-indigo-500/20 rounded-full overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-shimmer bg-[length:200%_100%]" />
                </div>
              )}
            </div>
            {!isPremium && (
              <Link to="/pricing" className="shrink-0 text-[10px] font-extrabold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors">
                Upgrade
              </Link>
            )}
          </div>
        </div>

        {/* Engine status */}
        <div className="px-5 py-4 border-b border-theme-border/30 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </div>
          <div className="flex-grow">
            <p className="text-sm font-semibold text-theme-primary">Cortana AI Engine</p>
            <p className="text-xs text-theme-muted mt-0.5">Online · Ready · v3.0</p>
          </div>
          <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">Active</span>
        </div>

        {/* Personalization */}
        <SettingsRow
          icon={<Zap className="w-4 h-4 text-amber-400" />}
          iconBg="bg-amber-500/10"
          label="Personalize AI Tutor"
          value={isPremium ? 'Configure response style & persona' : 'Requires Plus or Pro'}
          onClick={() => setShowPersonalizeInfo(true)}
          last
        />
      </SettingsSection>

      {/* ── PDF Quota (Free/Basic) ───────────────────────────────────────── */}
      {!isPremium && (
        <SettingsSection label="Quotas">
          <div className="px-5 py-4 border-b border-theme-border/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <span className="text-sm">👁️</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-theme-primary">PDF Views</p>
                  <p className="text-xs text-theme-muted">{(user as any)?.pdf_views_count || 0} of 4 used · Resets every 3 days</p>
                </div>
              </div>
              <span className="text-xs font-bold text-theme-muted">{(user as any)?.pdf_views_count || 0}/4</span>
            </div>
            <div className="ml-12 w-full h-1 bg-theme-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min((((user as any)?.pdf_views_count || 0) / 4) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <span className="text-sm">⬇️</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-theme-primary">PDF Downloads</p>
                  <p className="text-xs text-theme-muted">{(user as any)?.pdf_downloads_count || 0} of 4 used · Resets every 3 days</p>
                </div>
              </div>
              <span className="text-xs font-bold text-theme-muted">{(user as any)?.pdf_downloads_count || 0}/4</span>
            </div>
            <div className="ml-12 w-full h-1 bg-theme-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min((((user as any)?.pdf_downloads_count || 0) / 4) * 100, 100)}%` }}
              />
            </div>
          </div>
        </SettingsSection>
      )}

      {/* ── Study Streak ─────────────────────────────────────────────────── */}
      <SettingsSection label="Activity">
        <div className="px-5 py-5">
          <div className="flex items-center gap-4 mb-4">
            <div className={clsx(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all",
              streak >= 7
                ? "bg-gradient-to-br from-red-500 to-orange-500 shadow-[0_0_16px_rgba(239,68,68,0.4)]"
                : streak > 0
                  ? "bg-orange-500/10"
                  : "bg-theme-surface"
            )}>
              <Flame className={clsx(
                "w-4 h-4",
                streak >= 7 ? "text-yellow-200 animate-pulse" : streak > 0 ? "text-orange-400" : "text-theme-muted/30"
              )} />
            </div>
            <div className="flex-grow">
              <p className="text-sm font-semibold text-theme-primary">Revision Streak</p>
              <p className="text-xs text-theme-muted mt-0.5">
                {streak === 0 ? 'Log in daily to start your streak' : `${streak} consecutive day${streak !== 1 ? 's' : ''} · ${streak >= 7 ? 'Unstoppable! 🏆' : `${7 - streak} days to 7-day milestone`}`}
              </p>
            </div>
            <div className={clsx(
              "text-2xl font-black tracking-tight",
              streak >= 7 ? "text-orange-400" : streak > 0 ? "text-amber-400" : "text-theme-muted/30"
            )}>
              {streak}
            </div>
          </div>
          {/* 7-dot progress */}
          <div className="flex gap-1.5 ml-12">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className={clsx(
                  "h-1.5 flex-1 rounded-full transition-all duration-500",
                  i < streak
                    ? "bg-gradient-to-r from-orange-500 to-amber-400"
                    : "bg-theme-surface-2 border border-theme-border/40"
                )}
              />
            ))}
          </div>
          <p className="text-[9px] text-theme-muted mt-1.5 ml-12 font-bold uppercase tracking-wider">7-Day Goal</p>
        </div>
      </SettingsSection>

      {/* ── Account & Settings ───────────────────────────────────────────── */}
      <SettingsSection label="Account">
        <SettingsRow
          icon={<CreditCard className="w-4 h-4 text-indigo-400" />}
          iconBg="bg-indigo-500/10"
          label="Subscription Plan"
          value={`${planName} · ${isPremium ? 'Active premium' : 'Free tier'}`}
          to="/subscription"
        />
        <SettingsRow
          icon={<Bell className="w-4 h-4 text-blue-400" />}
          iconBg="bg-blue-500/10"
          label="Notifications"
          value="Updates and announcements"
          to="/notifications"
          last
        />
      </SettingsSection>

      {/* ── Support ──────────────────────────────────────────────────────── */}
      {!isPremium && (
        <div className="w-full rounded-2xl bg-gradient-to-r from-indigo-500/8 to-purple-500/8 border border-indigo-500/20 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
          </div>
          <div className="flex-grow">
            <p className="text-sm font-bold text-theme-primary">Unlock Cortana Pro</p>
            <p className="text-xs text-theme-muted mt-0.5">Unlimited queries, file analysis, and more.</p>
          </div>
          <Link to="/pricing" className="shrink-0 px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-indigo-500 hover:bg-indigo-600 transition-all shadow-sm shadow-indigo-500/20 cursor-pointer uppercase tracking-wide">
            Upgrade
          </Link>
        </div>
      )}

      {/* ── Session / Danger ─────────────────────────────────────────────── */}
      <SettingsSection>
        <SettingsRow
          icon={<LogOut className="w-4 h-4 text-red-400" />}
          iconBg="bg-red-500/10"
          label="Sign Out"
          onClick={logout}
          danger
        />
        <SettingsRow
          icon={<ShieldAlert className="w-4 h-4 text-red-400" />}
          iconBg="bg-red-500/10"
          label="Delete Account"
          value="Permanently remove all data"
          to="/delete-account"
          danger
          last
        />
      </SettingsSection>

      {/* ── Personalization Modal ────────────────────────────────────────── */}
      {showPersonalizeInfo && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full sm:max-w-sm bg-theme-base border border-theme-border rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/10 blur-[60px] rounded-full pointer-events-none" />

            <button
              onClick={() => setShowPersonalizeInfo(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-theme-surface text-theme-muted hover:text-theme-primary transition-colors cursor-pointer"
            >
              <CloseIcon size={16} />
            </button>

            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/20">
              <Sparkles className="text-indigo-400" size={22} />
            </div>

            <h3 className="text-xl font-black text-theme-primary mb-1.5 tracking-tight">AI Personalization</h3>
            <p className="text-xs text-theme-muted mb-6 leading-relaxed">
              {isPremium
                ? `Configure your ${planName} AI Tutor to match your exact learning style.`
                : 'Upgrade to Plus or Pro to access AI persona customization.'}
            </p>

            <div className="space-y-4 mb-8">
              {[
                { icon: <Zap className="w-4 h-4 text-amber-400" />, bg: "bg-amber-500/10", label: "Custom Persona", desc: "Supportive Coach, Strict Examiner, or Simplified Tutor." },
                { icon: <Target className="w-4 h-4 text-indigo-400" />, bg: "bg-indigo-500/10", label: "Subject Focus", desc: "Tailor responses to your major — Law, Business, Science." },
                { icon: <MessageSquare className="w-4 h-4 text-emerald-400" />, bg: "bg-emerald-500/10", label: "Response Format", desc: "Visual outlines, summaries, or local language translations." },
              ].map(({ icon, bg, label, desc }) => (
                <div key={label} className="flex gap-4 items-start">
                  <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-theme-border/50", bg)}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-theme-primary mb-0.5">{label}</p>
                    <p className="text-[11px] text-theme-muted leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {isPremium ? (
              <button
                onClick={() => setShowPersonalizeInfo(false)}
                className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold text-sm transition-all shadow-md shadow-indigo-500/15 active:scale-95 cursor-pointer"
              >
                Got it
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <Link
                  to="/pricing"
                  onClick={() => setShowPersonalizeInfo(false)}
                  className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold text-sm transition-all shadow-md shadow-indigo-500/15 active:scale-95 cursor-pointer text-center"
                >
                  Upgrade to Plus
                </Link>
                <button
                  onClick={() => setShowPersonalizeInfo(false)}
                  className="w-full py-3 bg-theme-surface border border-theme-border text-theme-muted rounded-2xl font-bold text-sm transition-all active:scale-95 cursor-pointer"
                >
                  Maybe Later
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfilePage;
