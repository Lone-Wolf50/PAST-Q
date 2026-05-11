import { useState, useRef, useEffect } from 'react';
import { User, Mail, CreditCard, LogOut, ShieldAlert, Bell, Camera, Trash2, Sparkles, HelpCircle, X as CloseIcon, Zap, MessageSquare, Target, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

const ProfilePage = () => {
  const { user, updateUser, logout } = useAuth();
  const [name, setName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [isAvatarDeleted, setIsAvatarDeleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showPersonalizeInfo, setShowPersonalizeInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [streak, setStreak] = useState<number>(0);

  useEffect(() => {
    // Fetch latest profile to get avatar_url if any
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token') || undefined;
        const res = await apiFetch('/profile/me', { token });
        if (res.user) {
          setName(res.user.full_name);
          setAvatarUrl(res.user.avatar_url || '');
          // Sync everything with AuthContext so all components (Navbar, etc.) update
          updateUser({ 
            full_name: res.user.full_name, 
            avatar_url: res.user.avatar_url,
            plan: res.user.plan,
            plan_expires: res.user.plan_expires,
            ai_usage_count: res.user.ai_usage_count
          });
          // Load streak from DB if available
          if (res.user.streak_count !== undefined) {
            setStreak(res.user.streak_count);
          }
        }
      } catch (err) {

      }
    };
    fetchProfile();
    // Also read from sessionStorage (set by AuthContext ping)
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
    if (e.target.files && e.target.files[0]) {
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

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token') || undefined;
      
      // Update Name
      await apiFetch('/profile/me', {
        method: 'PATCH',
        token,
        body: { full_name: name }
      });

      let finalAvatarUrl = avatarUrl;

      // Update Avatar
      if (isAvatarDeleted) {
        await apiFetch('/profile/me/avatar', { method: 'DELETE', token });
        finalAvatarUrl = '';
      } else if (avatarBase64) {
        const res = await apiFetch('/profile/me/avatar', {
          method: 'POST',
          token,
          body: { avatar_base64: avatarBase64 }
        });
        if (res.avatar_url) finalAvatarUrl = res.avatar_url;
      }

      // Sync with AuthContext so Navbar updates immediately
      updateUser({ full_name: name, avatar_url: finalAvatarUrl });

      setMessage('Profile updated successfully!');
      setAvatarBase64(null);
      setIsAvatarDeleted(false);
    } catch (err: any) {

      setMessage(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 md:px-8 max-w-4xl mx-auto py-12">
      <div className="w-full mb-8 text-center md:text-left">
        <h1 className="text-3xl font-bold text-theme-primary mb-2">Account Settings</h1>
        <p className="text-theme-muted">Manage your profile, subscription, and preferences.</p>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column - Navigation */}
        <div className="col-span-1 flex flex-col gap-2">
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-theme-surface-2 text-theme-primary font-medium border border-theme-border transition-colors">
            <User className="w-5 h-5 text-indigo-400" />
            Profile Details
          </Link>
          <Link to="/subscription" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-theme-surface text-theme-muted hover:text-theme-primary transition-colors text-left">
            <CreditCard className="w-5 h-5" />
            Subscription Plan
          </Link>
          <Link to="/notifications" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-theme-surface text-theme-muted hover:text-theme-primary transition-colors text-left">
            <Bell className="w-5 h-5" />
            Notifications
          </Link>
          <div className="h-px bg-theme-surface-2 my-2" />
          <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-theme-surface text-red-400 hover:text-red-300 transition-colors text-left w-full">
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>

        {/* Right Column - Content */}
        <div className="col-span-1 md:col-span-2 flex flex-col gap-6">
          {/* Profile Card */}
          <div className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-semibold text-theme-primary mb-6">Personal Information</h2>
            
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-theme-surface border-2 border-theme-border flex items-center justify-center overflow-hidden">
                  {isAvatarDeleted ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-red-500/10">
                      <Trash2 className="w-8 h-8 text-red-400 mb-1" />
                      <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">Removed</span>
                    </div>
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-theme-muted" />
                  )}
                </div>
                {isAvatarDeleted && (
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-red-400/60 pointer-events-none" />
                )}
                {!isAvatarDeleted && (
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 bg-indigo-500 rounded-full text-white hover:bg-indigo-600 transition-colors shadow-lg"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
                <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-lg font-medium text-theme-primary">Profile Picture</h3>
                <p className="text-sm text-theme-muted mb-3">JPG, GIF or PNG. Max size of 5MB.</p>
                <div className="flex gap-3 justify-center sm:justify-start">
                  <button onClick={() => fileInputRef.current?.click()} className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                    {isAvatarDeleted ? 'Upload New' : 'Change Photo'}
                  </button>
                  {avatarUrl && !isAvatarDeleted && (
                    <button onClick={handleRemoveAvatar} className="text-sm font-medium text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <form className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-theme-secondary ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
                  <input type="text" value={name} onChange={handleNameChange} className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-4 text-theme-primary focus:outline-none focus:border-indigo-500/50 transition-colors" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-theme-secondary ml-1">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
                  <input type="email" value={user?.email || ''} disabled className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-4 text-theme-muted opacity-70 cursor-not-allowed" />
                </div>
              </div>
              {message && (
                <div className={`px-4 py-3 rounded-xl text-sm ${message.includes('successfully') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {message}
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={handleSaveChanges} disabled={isSaving} className="px-6 py-2.5 rounded-xl font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Dynamic AI Value Tracker Card */}
          <div className="glass-card p-0 overflow-hidden relative">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 blur-[100px] pointer-events-none" />

            <div className="p-6 md:p-8 relative">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-xl font-bold text-theme-primary mb-1">AI Study Companion</h2>
                  <p className="text-sm text-theme-muted">
                    Your account is powered by <span className="text-indigo-400 font-semibold">PastQ Advanced AI</span>
                  </p>
                </div>
                <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                  {user?.plan || 'free'} member
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-theme-surface border border-theme-border rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-1">Queries Answered</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-theme-primary tracking-tight">
                      {user?.ai_usage_count || 0}
                    </span>
                    <span className="text-sm font-medium text-theme-muted">
                      {user?.plan?.toLowerCase() === 'free' ? '/ 5 queries' : 
                       user?.plan?.toLowerCase() === 'basic' ? '/ 20 queries' : '/ unlimited'}
                    </span>
                  </div>
                </div>

                <div className="bg-theme-surface border border-theme-border rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-1">Study Time Saved</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-500 tracking-tight">
                      {Math.round((user?.ai_usage_count || 0) * 2 / 60 * 10) / 10}h
                    </span>
                    <span className="text-sm font-medium text-theme-muted">Estimated</span>
                  </div>
                </div>
              </div>

              {/* Status Bar */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-theme-secondary uppercase tracking-widest">Engine Status</span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    Online & Ready
                  </span>
                </div>
                {['plus', 'pro'].includes(user?.plan?.toLowerCase() || '') ? (
                  <div className="w-full h-3 bg-theme-surface-2 rounded-full overflow-hidden border border-theme-border/50 relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-shimmer bg-[length:200%_100%]" />
                  </div>
                ) : (
                  <div className="w-full h-3 bg-theme-surface-2 rounded-full overflow-hidden border border-theme-border/50">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-1000" 
                      style={{ width: `${Math.min(((user?.ai_usage_count || 0) / 5) * 100, 100)}%` }} 
                    />
                  </div>
                )}
                <p className="text-[10px] text-theme-muted mt-3 italic text-center">
                  * Time saved is calculated based on an average of 2 minutes saved per AI interaction.
                </p>
              </div>

               <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
                    {(['plus', 'pro'].includes(user?.plan?.toLowerCase() || '') 
                      ? ['Unlimited Queries', 'PDF Analysis', 'Priority Speed', 'Advanced Reasoning']
                      : user?.plan?.toLowerCase() === 'basic' 
                      ? ['20 Queries', 'File Analysis', 'Standard Speed']
                      : ['5 Queries', 'Standard Speed']
                    ).map(perk => (
                      <div key={perk} className="px-3 py-1.5 rounded-xl bg-theme-surface border border-theme-border text-[10px] font-bold text-theme-secondary shadow-sm">
                          ✓ {perk}
                      </div>
                    ))}
                  </div>

                  {['plus', 'pro'].includes(user?.plan?.toLowerCase() || '') ? (
                    <button 
                        onClick={() => setShowPersonalizeInfo(true)}
                        className="w-full py-4 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 group"
                    >
                        <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                        Personalize your AI Tutor
                        <HelpCircle className="w-3.5 h-3.5 opacity-60 ml-1" />
                    </button>
                  ) : (
                    <button 
                        onClick={() => setShowPersonalizeInfo(true)}
                        className="w-full py-4 rounded-2xl bg-theme-surface border-2 border-dashed border-theme-border text-theme-muted font-bold text-sm transition-all hover:border-indigo-400/50 hover:text-theme-primary flex items-center justify-center gap-2 group"
                    >
                        <ShieldAlert className="w-4 h-4" />
                        Personalize AI Tutor (Plus/Pro only)
                        <HelpCircle className="w-3.5 h-3.5 opacity-60 ml-1" />
                    </button>
                  )}
               </div>
            </div>
            
            {user?.plan !== 'pro' && (
              <div className="p-6 md:p-8 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border-t border-theme-border flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-lg font-bold text-theme-primary mb-1 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    Unlock the Full Potential
                  </h3>
                  <p className="text-xs text-theme-muted max-w-sm">
                    Upgrade to **Pro** for unlimited analysis, 1-on-1 exam prep guidance, and custom study plans.
                  </p>
                </div>
                <Link to="/pricing" className="shrink-0 px-8 py-3 rounded-2xl font-bold text-sm text-white bg-indigo-500 hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-500/20">
                  View Plans
                </Link>
              </div>
            )}
          </div>

          {/* Personalization Info Modal */}
          {showPersonalizeInfo && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <div className="max-w-md w-full bg-theme-base border border-theme-border rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden">
                {/* Glow effects inside modal */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 blur-[100px] rounded-full"></div>
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 blur-[100px] rounded-full"></div>

                <div className="relative">
                  <button 
                    onClick={() => setShowPersonalizeInfo(false)}
                    className="absolute -top-2 -right-2 p-2 text-theme-muted hover:text-theme-primary transition-colors"
                  >
                    <CloseIcon size={20} />
                  </button>

                  <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-8 border border-indigo-500/20">
                    <Sparkles className="text-indigo-500" size={32} />
                  </div>

                  <h3 className="text-2xl font-black text-theme-primary mb-4 tracking-tight">AI Personalization</h3>
                  <p className="text-sm text-theme-secondary mb-8 leading-relaxed">
                    Tailor your <span className="text-indigo-400 font-bold uppercase">{user?.plan}</span> AI Tutor to match your learning style perfectly.
                  </p>

                  <div className="space-y-6 mb-10">
                    <div className="flex gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-theme-surface-2 flex items-center justify-center border border-theme-border">
                        <Zap className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-theme-primary mb-1">Custom Persona</p>
                        <p className="text-xs text-theme-muted leading-relaxed">Switch between a "Supportive Coach", "Strict Examiner", or "Simplified Tutor".</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-theme-surface-2 flex items-center justify-center border border-theme-border">
                        <Target className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-theme-primary mb-1">Subject Expertise</p>
                        <p className="text-xs text-theme-muted leading-relaxed">Tell the AI your major so it uses specific examples from Law, Business, or Science.</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-theme-surface-2 flex items-center justify-center border border-theme-border">
                        <MessageSquare className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-theme-primary mb-1">Response Formatting</p>
                        <p className="text-xs text-theme-muted leading-relaxed">Prefer visual outlines? Short summaries? Or Twi/Ga translations? Your choice.</p>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowPersonalizeInfo(false)}
                    className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
                  >
                    Awesome, thanks!
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Revision Streak Card ─────────────────────────────── */}
          <div className="glass-card p-0 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/5 blur-[80px] pointer-events-none" />
            <div className="p-6 md:p-8 relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-theme-primary mb-1 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-400" />
                    Revision Streak
                  </h2>
                  <p className="text-sm text-theme-muted">Keep logging in daily to grow your streak!</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  streak >= 7 ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                  : streak >= 3 ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                }`}>
                  {streak >= 7 ? '🔥 On Fire' : streak >= 3 ? '⚡ Building' : '🌱 Starting'}
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Flame display */}
                <div className="flex flex-col items-center">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border ${
                    streak > 0
                      ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/10 border-orange-500/30 text-orange-400'
                      : 'bg-theme-surface border-theme-border text-theme-muted/30'
                  }`}>
                    <Flame className="w-10 h-10" />
                  </div>
                  <span className="text-[10px] text-theme-muted font-bold mt-2 uppercase tracking-wider">Today</span>
                </div>

                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-5xl font-black text-theme-primary tracking-tight">{streak}</span>
                    <span className="text-sm font-bold text-theme-muted">day{streak !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-xs text-theme-muted leading-relaxed">
                    {streak === 0
                      ? 'Log in today to start your streak!'
                      : streak === 1
                      ? 'Great start! Come back tomorrow to keep it going.'
                      : streak < 7
                      ? `${7 - streak} more day${7 - streak !== 1 ? 's' : ''} to reach a 7-day streak! 🎯`
                      : 'Incredible dedication! Keep it up! 🏆'}
                  </p>
                  {/* Mini streak dots */}
                  <div className="flex gap-1.5 mt-3">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 flex-1 rounded-full transition-all ${
                          i < streak
                            ? 'bg-gradient-to-r from-orange-500 to-amber-400'
                            : 'bg-theme-surface border border-theme-border'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-theme-muted mt-1.5">7-day goal</p>
                </div>
              </div>
            </div>
          </div>

          {/* Restored Danger Zone */}
          <div className="glass-card p-6 md:p-8 border-red-500/20 bg-red-500/5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-theme-primary mb-2">Danger Zone</h2>
                <p className="text-sm text-theme-muted mb-6">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <Link to="/delete-account" className="px-5 py-2.5 rounded-xl font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors inline-block">
                  Delete Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
