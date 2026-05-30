import { useState, useRef, useEffect } from 'react';
import { User, Mail, CreditCard, LogOut, ShieldAlert, Bell, Camera, Trash2, Sparkles, HelpCircle, X as CloseIcon, Zap, MessageSquare, Target, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { clsx } from 'clsx';

const ProfilePage = () => {
  const { user, token, updateUser, logout } = useAuth();
  const [name, setName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [isAvatarDeleted, setIsAvatarDeleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showPersonalizeInfo, setShowPersonalizeInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [streak, setStreak] = useState<number>(0);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'ai_stats'>('profile');

  useEffect(() => {
    // Fetch latest profile to get avatar_url if any
    const fetchProfile = async () => {
      try {
        const res = await apiFetch('/profile/me', { token: token || undefined });
        if (res.user) {
          setName(res.user.full_name);
          setAvatarUrl(res.user.avatar_url || '');
          // Sync everything with AuthContext so all components (Navbar, etc.) update
          updateUser({ 
            full_name: res.user.full_name, 
            avatar_url: res.user.avatar_url,
            plan: res.user.plan,
            plan_expires: res.user.plan_expires,
            ai_usage_count: res.user.ai_usage_count,
            pdf_downloads_count: res.user.pdf_downloads_count,
            pdf_views_count: res.user.pdf_views_count
          });
          // Load streak from DB if available
          if (res.user.streak_count !== undefined) {
            setStreak(res.user.streak_count);
          }
        }
      } catch (err) {
        // silently catch
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
      // Update Name
      await apiFetch('/profile/me', {
        method: 'PATCH',
        token: token || undefined,
        body: { full_name: name }
      });

      let finalAvatarUrl = avatarUrl;

      // Update Avatar
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

  const activePlanName = user?.plan || 'Free';
  const formattedPlanName = activePlanName.charAt(0).toUpperCase() + activePlanName.slice(1).toLowerCase();

  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 md:px-8 max-w-5xl mx-auto py-12">
      
      {/* Premium Header Dashboard Panel */}
      <div className="w-full mb-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-6 glass-card p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none" />
        <div>
          <h1 className="text-3xl font-black tracking-tight text-theme-primary mb-2">Account Portal</h1>
          <p className="text-theme-muted font-medium text-sm">Control your academic setup, track metrics, and adjust personalized study settings.</p>
        </div>
        <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-2xl shadow-sm">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-400">{formattedPlanName} Plan</span>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column - Redesigned Interactive Sidebar */}
        <div className="col-span-1 flex flex-col gap-4">
          <div className="glass-card p-6 shrink-0 flex flex-col gap-6 relative overflow-hidden border border-theme-border/60">
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-indigo-500/5 blur-2xl rounded-full" />
            
            <div className="flex flex-col items-center text-center gap-3">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-theme-surface border-4 border-indigo-500/30 flex items-center justify-center overflow-hidden shadow-lg transition-transform duration-500 group-hover:scale-105">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover animate-fade-in" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-black">
                      {name?.charAt(0).toUpperCase() || 'S'}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-black text-lg text-theme-primary tracking-tight leading-none mb-1.5">{name || 'Student'}</h3>
                <p className="text-[10px] text-theme-muted uppercase font-bold tracking-widest bg-theme-surface-2/60 px-3 py-1 rounded-full border border-theme-border/50 inline-block">
                  {formattedPlanName} Member
                </p>
              </div>
            </div>

            <div className="h-px bg-theme-border/40" />

            <div className="flex flex-col gap-1.5">
              <Link to="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-500/10 text-indigo-400 font-bold text-xs border border-indigo-500/25 transition-all shadow-[0_4px_12px_rgba(99,102,241,0.06)]">
                <User className="w-4 h-4" />
                Profile Settings
              </Link>
              <Link to="/subscription" className="flex items-center gap-3 px-4 py-3 rounded-xl text-theme-muted hover:text-theme-primary hover:bg-theme-surface/60 font-bold text-xs transition-all">
                <CreditCard className="w-4 h-4" />
                Subscription Plan
              </Link>
              <Link to="/notifications" className="flex items-center gap-3 px-4 py-3 rounded-xl text-theme-muted hover:text-theme-primary hover:bg-theme-surface/60 font-bold text-xs transition-all">
                <Bell className="w-4 h-4" />
                Notifications
              </Link>
              <div className="h-px bg-theme-border/40 my-2" />
              <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/5 font-bold text-xs transition-all text-left w-full cursor-pointer">
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          </div>
        </div>

        {/* Right Columns - Dynamic Tabs Content Panel */}
        <div className="col-span-1 md:col-span-2 flex flex-col gap-6">
          
          {/* segmented switcher container */}
          <div className="flex bg-theme-surface/40 border border-theme-border/50 p-1.5 rounded-2xl w-full sm:w-fit self-center sm:self-start relative backdrop-blur-md">
            <button
              onClick={() => setActiveSubTab('profile')}
              className={clsx(
                "flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                activeSubTab === 'profile'
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/10"
                  : "text-theme-muted hover:text-theme-primary"
              )}
            >
              <User className="w-4 h-4" />
              Personal Details
            </button>
            <button
              onClick={() => setActiveSubTab('ai_stats')}
              className={clsx(
                "flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                activeSubTab === 'ai_stats'
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/10"
                  : "text-theme-muted hover:text-theme-primary"
              )}
            >
              <Sparkles className="w-4 h-4" />
              AI Tutor & Stats
            </button>
          </div>

          {/* Render Active Sub-Tab */}
          {activeSubTab === 'profile' ? (
            <div className="flex flex-col gap-6 animate-fade-in">
              
              {/* Personal Information Form Card */}
              <div className="glass-card p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 blur-[80px] pointer-events-none" />
                <h2 className="text-xl font-extrabold text-theme-primary tracking-tight mb-2">Personal Information</h2>
                <p className="text-xs text-theme-muted mb-8 font-medium">Update your account name, avatar, and academic credentials.</p>
                
                {/* Photo uploader */}
                <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 bg-theme-surface/30 border border-theme-border/40 p-5 rounded-2xl">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-theme-surface border border-theme-border flex items-center justify-center overflow-hidden shadow-inner">
                      {isAvatarDeleted ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-red-500/10">
                          <Trash2 className="w-6 h-6 text-red-400 mb-0.5" />
                          <span className="text-[8px] font-bold text-red-400 uppercase tracking-wider">Removed</span>
                        </div>
                      ) : avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8 text-theme-muted" />
                      )}
                    </div>
                    {isAvatarDeleted && (
                      <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-red-400/50 pointer-events-none" />
                    )}
                    {!isAvatarDeleted && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-1.5 -right-1.5 p-2 bg-indigo-500 rounded-xl text-white hover:bg-indigo-600 transition-colors shadow-lg cursor-pointer"
                        title="Upload photo"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
                  </div>
                  <div className="text-center sm:text-left flex-grow">
                    <h3 className="text-sm font-bold text-theme-primary mb-1">Profile Photo</h3>
                    <p className="text-[11px] text-theme-muted mb-3 font-medium">JPG, PNG or GIF. Max file size of 5MB.</p>
                    <div className="flex gap-4 justify-center sm:justify-start">
                      <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer">
                        {isAvatarDeleted ? 'Upload New Image' : 'Replace Photo'}
                      </button>
                      {avatarUrl && !isAvatarDeleted && (
                        <button onClick={handleRemoveAvatar} className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors cursor-pointer">
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <form className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-theme-secondary uppercase tracking-wider ml-1">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                        <input 
                          type="text" 
                          value={name} 
                          onChange={handleNameChange} 
                          className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-4 text-sm text-theme-primary font-medium focus:outline-none focus:border-indigo-500/50 transition-colors" 
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-theme-secondary uppercase tracking-wider ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                        <input 
                          type="email" 
                          value={user?.email || ''} 
                          disabled 
                          className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-4 text-sm text-theme-muted font-medium opacity-70 cursor-not-allowed" 
                        />
                      </div>
                    </div>
                  </div>

                  {message && (
                    <div className={`px-4 py-3.5 rounded-xl text-xs font-bold ${message.includes('successfully') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {message}
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button 
                      type="button" 
                      onClick={handleSaveChanges} 
                      disabled={isSaving} 
                      className="px-6 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
                    >
                      {isSaving ? 'Saving Updates...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Danger Zone Card */}
              <div className="glass-card p-6 md:p-8 border-red-500/20 bg-red-500/5 relative overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0 shadow-inner">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-theme-primary mb-1 tracking-tight">Danger Zone</h2>
                    <p className="text-xs text-theme-muted mb-5 leading-relaxed font-medium">
                      Permanently delete your account, session logs, streaks, and subscription history. This action is absolute and cannot be undone.
                    </p>
                    <Link to="/delete-account" className="px-5 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all inline-block shadow-sm">
                      Delete Account
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 animate-fade-in">
              
              {/* Premium Dashboard Metrics Panel */}
              <div className="glass-card p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none" />
                <h2 className="text-xl font-black text-theme-primary tracking-tight mb-1">AI Study Analytics</h2>
                <p className="text-xs text-theme-muted mb-6 font-medium">Track your learning velocity, queries, and study time saved.</p>
                
                {/* Visual stats grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                  <div className="bg-theme-surface/40 border border-theme-border/60 rounded-2xl p-5 shadow-inner relative overflow-hidden group">
                    <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/5 blur-2xl rounded-full" />
                    <p className="text-[10px] font-extrabold text-theme-muted uppercase tracking-widest mb-1.5">Queries Answered</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-theme-primary tracking-tight">
                        {user?.ai_usage_count || 0}
                      </span>
                      <span className="text-xs font-bold text-theme-muted">
                        {user?.plan?.toLowerCase() === 'free' ? '/ 3 queries' : 
                         user?.plan?.toLowerCase() === 'basic' ? '/ 20 queries' : '/ unlimited'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-theme-surface/40 border border-theme-border/60 rounded-2xl p-5 shadow-inner relative overflow-hidden group">
                    <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full" />
                    <p className="text-[10px] font-extrabold text-theme-muted uppercase tracking-widest mb-1.5">Study Time Saved</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-emerald-500 tracking-tight">
                        {Math.round((user?.ai_usage_count || 0) * 2 / 60 * 10) / 10}h
                      </span>
                      <span className="text-xs font-bold text-theme-muted uppercase tracking-wider">Estimated</span>
                    </div>
                  </div>
                </div>

                {/* PDF Quota Limits Grid - Show for Free & Basic members */}
                {!['plus', 'pro'].includes(user?.plan?.toLowerCase() || '') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8 bg-theme-surface-2/30 border border-theme-border/50 p-5 rounded-2xl">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-xs font-bold text-theme-secondary uppercase tracking-wide">
                        <span>PDF Views</span>
                        <span>{(user as any)?.pdf_views_count || 0} / 4</span>
                      </div>
                      <div className="w-full h-2 bg-theme-surface rounded-full overflow-hidden border border-theme-border/50">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
                          style={{ width: `${Math.min((((user as any)?.pdf_views_count || 0) / 4) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-theme-muted font-semibold uppercase tracking-wider">Resets every 3 days</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-xs font-bold text-theme-secondary uppercase tracking-wide">
                        <span>PDF Downloads</span>
                        <span>{(user as any)?.pdf_downloads_count || 0} / 4</span>
                      </div>
                      <div className="w-full h-2 bg-theme-surface rounded-full overflow-hidden border border-theme-border/50">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700"
                          style={{ width: `${Math.min((((user as any)?.pdf_downloads_count || 0) / 4) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-theme-muted font-semibold uppercase tracking-wider">Resets every 3 days</p>
                    </div>
                  </div>
                )}

                {/* Engine Status Bar & Shimmer */}
                <div className="bg-theme-surface/30 border border-theme-border/40 p-5 rounded-2xl mb-8">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[10px] font-extrabold text-theme-secondary uppercase tracking-widest">Engine Status</span>
                    <span className="text-[10px] font-extrabold text-emerald-400 flex items-center gap-1.5 uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      Cortana v3.0 Online
                    </span>
                  </div>
                  {['plus', 'pro'].includes(user?.plan?.toLowerCase() || '') ? (
                    <div className="w-full h-2.5 bg-theme-surface-2 rounded-full overflow-hidden border border-theme-border/50 relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-shimmer bg-[length:200%_100%]" />
                    </div>
                  ) : (
                    <div className="w-full h-2.5 bg-theme-surface-2 rounded-full overflow-hidden border border-theme-border/50">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000" 
                        style={{ width: `${Math.min(((user?.ai_usage_count || 0) / 3) * 100, 100)}%` }} 
                      />
                    </div>
                  )}
                  <p className="text-[9px] text-theme-muted mt-2 font-medium italic">
                    * Estimated study time saved is computed based on 2 minutes saved per AI prompt answer.
                  </p>
                </div>

                {/* Personalization Trigger Panel */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2.5">
                    {(['plus', 'pro'].includes(user?.plan?.toLowerCase() || '') 
                      ? ['Unlimited Queries', 'PDF File Analysis', 'Ultra Speed Processing', 'Advanced Cognitive Reasoning']
                      : user?.plan?.toLowerCase() === 'basic' 
                      ? ['20 Queries', 'File Analysis Support', 'Standard Processing Speed']
                      : ['3 AI Queries / 10h', '4 PDF Views / 3 days', '4 Downloads / 3 days', 'Standard Speed']
                    ).map(perk => (
                      <div key={perk} className="px-3 py-2 rounded-xl bg-theme-surface/60 border border-theme-border/50 text-[10px] font-extrabold text-theme-secondary shadow-sm">
                          ✓ {perk}
                      </div>
                    ))}
                  </div>

                  {['plus', 'pro'].includes(user?.plan?.toLowerCase() || '') ? (
                    <button 
                      onClick={() => setShowPersonalizeInfo(true)}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-500/10 flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                      Configure Cortana Persona
                      <HelpCircle className="w-3.5 h-3.5 opacity-60 ml-0.5" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShowPersonalizeInfo(true)}
                      className="w-full py-4 rounded-2xl bg-theme-surface border border-dashed border-theme-border/80 text-theme-muted font-bold text-xs uppercase tracking-wider transition-all hover:border-indigo-400/40 hover:text-theme-primary flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      Personalize AI Tutor (Plus/Pro only)
                      <HelpCircle className="w-3.5 h-3.5 opacity-60 ml-0.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Revision Streak Premium Milestones Card */}
              <div className="glass-card p-6 md:p-8 relative overflow-hidden border border-theme-border/60">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] pointer-events-none" />
                
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-black text-theme-primary mb-1 flex items-center gap-2 tracking-tight">
                      <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
                      Study Streak
                    </h2>
                    <p className="text-xs text-theme-muted font-medium">Keep querying AI or viewing papers daily to grow your streak!</p>
                  </div>
                  <div className={clsx("px-3 py-1.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border shadow-sm",
                    streak >= 7 ? 'bg-orange-500/15 border-orange-500/20 text-orange-400'
                    : streak >= 3 ? 'bg-amber-500/15 border-amber-500/20 text-amber-400'
                    : 'bg-yellow-500/10 border-yellow-500/15 text-yellow-400'
                  )}>
                    {streak >= 7 ? '🔥 Unstoppable' : streak >= 3 ? '⚡ Building Momentum' : '🌱 Study Habit Initiated'}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 bg-theme-surface/20 border border-theme-border/40 p-5 rounded-2xl">
                  
                  {/* Streak Flame Container */}
                  <div className={clsx("flex flex-col items-center shrink-0", streak >= 7 && "relative")}>
                    {streak >= 7 && (
                      <div className="absolute inset-0 bg-red-600/20 blur-xl rounded-full animate-pulse pointer-events-none" />
                    )}
                    <div className={clsx(
                      'w-20 h-20 rounded-2xl flex items-center justify-center border transition-all duration-700 relative shadow-sm',
                      streak >= 7
                        ? 'bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 border-red-400 text-white shadow-lg shadow-orange-500/20'
                        : streak > 0
                          ? 'bg-gradient-to-br from-orange-500/15 to-amber-500/10 border-orange-500/25 text-orange-500'
                          : 'bg-theme-surface border-theme-border text-theme-muted/30'
                    )}>
                      {streak >= 7 ? (
                        <>
                          <span className="absolute inset-0 rounded-2xl border border-red-400 animate-ping opacity-50 pointer-events-none" />
                          <Flame className="w-10 h-10 animate-bounce text-yellow-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                        </>
                      ) : (
                        <Flame className={clsx("w-9 h-9", streak > 0 ? "animate-pulse" : "")} />
                      )}
                    </div>
                    <span className="text-[9px] text-theme-muted font-bold mt-2 uppercase tracking-wider">Today</span>
                  </div>

                  <div className="flex-grow w-full text-center sm:text-left">
                    <div className="flex items-baseline justify-center sm:justify-start gap-1.5 mb-1.5">
                      <span className="text-5xl font-black text-theme-primary tracking-tight leading-none">{streak}</span>
                      <span className="text-xs font-bold text-theme-muted uppercase tracking-wider">consecutive day{streak !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-xs text-theme-muted leading-relaxed font-medium max-w-sm mb-4">
                      {streak === 0
                        ? 'Log in today, ask AI or solve a question to ignite your academic study streak!'
                        : streak === 1
                        ? 'Study routine initiated! Come back tomorrow to raise your streak score.'
                        : streak < 7
                        ? `Only ${7 - streak} more study day${7 - streak !== 1 ? 's' : ''} to unlock a full 7-day streak milestone! 🎯`
                        : 'Premium study habits unlocked! Your learning consistency is unmatched. 🏆'}
                    </p>
                    
                    {/* Progress tracking dots */}
                    <div className="flex gap-2 justify-center sm:justify-start max-w-xs">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <div
                          key={i}
                          className={clsx("h-2 flex-1 rounded-full transition-all duration-500",
                            i < streak
                              ? 'bg-gradient-to-r from-orange-500 to-amber-400 shadow-sm shadow-orange-500/10'
                              : 'bg-theme-surface border border-theme-border/60'
                          )}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between max-w-xs text-[8px] text-theme-muted font-bold uppercase tracking-wider mt-1 px-0.5">
                      <span>Day 1</span>
                      <span>Milestone (7 days)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Plans Upsell Card (for non Pro users) */}
              {user?.plan !== 'pro' && (
                <div className="p-6 md:p-8 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-theme-border/60 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] pointer-events-none" />
                  <div>
                    <h3 className="text-lg font-black text-theme-primary mb-1 flex items-center gap-2 tracking-tight">
                      <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                      Unlock Advanced Cortana Pro
                    </h3>
                    <p className="text-xs text-theme-muted max-w-xs leading-relaxed font-medium">
                      Upgrade to **Pro** to unlock limitless academic guidance, advanced file analysis, and 1-on-1 tutoring.
                    </p>
                  </div>
                  <Link to="/pricing" className="shrink-0 px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider text-white bg-indigo-500 hover:bg-indigo-600 transition-all shadow-md shadow-indigo-500/10 cursor-pointer">
                    View Upgrade Plans
                  </Link>
                </div>
              )}

            </div>
          )}

        </div>
      </div>

      {/* Personalization Modal */}
      {showPersonalizeInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="max-w-md w-full bg-theme-base border border-theme-border rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden">
            {/* Glow effects inside modal */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 blur-[100px] rounded-full"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 blur-[100px] rounded-full"></div>

            <div className="relative">
              <button 
                onClick={() => setShowPersonalizeInfo(false)}
                className="absolute -top-2 -right-2 p-2 text-theme-muted hover:text-theme-primary transition-colors cursor-pointer"
              >
                <CloseIcon size={20} />
              </button>

              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-8 border border-indigo-500/20">
                <Sparkles className="text-indigo-400" size={28} />
              </div>

              <h3 className="text-2xl font-black text-theme-primary mb-3 tracking-tight">AI Personalization</h3>
              <p className="text-xs text-theme-secondary mb-8 leading-relaxed font-medium">
                Tailor your <span className="text-indigo-400 font-bold uppercase">{user?.plan}</span> AI Tutor to match your learning style perfectly.
              </p>

              <div className="space-y-5 mb-8">
                <div className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-theme-surface-2 flex items-center justify-center border border-theme-border/60">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-theme-primary mb-1">Custom Persona</p>
                    <p className="text-[11px] text-theme-muted leading-relaxed font-medium">Switch between a "Supportive Coach", "Strict Examiner", or "Simplified Tutor".</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-theme-surface-2 flex items-center justify-center border border-theme-border/60">
                    <Target className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-theme-primary mb-1">Subject Expertise</p>
                    <p className="text-[11px] text-theme-muted leading-relaxed font-medium">Tell the AI your major so it uses specific examples from Law, Business, or Science.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-theme-surface-2 flex items-center justify-center border border-theme-border/60">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-theme-primary mb-1">Response Formatting</p>
                    <p className="text-[11px] text-theme-muted leading-relaxed font-medium">Prefer visual outlines? Short summaries? Or Twi/Ga translations? Your choice.</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowPersonalizeInfo(false)}
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-500/10 active:scale-95 cursor-pointer"
              >
                Awesome, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfilePage;
