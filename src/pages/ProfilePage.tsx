import { useState } from 'react';
import { User, Mail, CreditCard, LogOut, ShieldAlert, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

const ProfilePage = () => {
  const [name, setName] = useState('John Doe');
  
  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 md:px-8 max-w-4xl mx-auto py-12 mb-24 md:mb-0">
      <div className="w-full mb-8">
        <h1 className="text-3xl font-bold text-theme-primary mb-2">Account Settings</h1>
        <p className="text-theme-muted">Manage your profile, subscription, and preferences.</p>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column - Navigation */}
        <div className="col-span-1 flex flex-col gap-2">
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-theme-surface-2 text-theme-primary font-medium border border-theme-border transition-colors">
            <User className="w-5 h-5 text-indigo-400" />
            Profile Details
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-theme-surface text-theme-muted hover:text-theme-primary transition-colors text-left">
            <CreditCard className="w-5 h-5" />
            Subscription Plan
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-theme-surface text-theme-muted hover:text-theme-primary transition-colors text-left">
            <Bell className="w-5 h-5" />
            Notifications
          </button>
          <div className="h-px bg-theme-surface-2 my-2" />
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-theme-surface text-red-400 hover:text-red-300 transition-colors text-left">
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>

        {/* Right Column - Content */}
        <div className="col-span-1 md:col-span-2 flex flex-col gap-6">
          {/* Profile Card */}
          <div className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-semibold text-theme-primary mb-6">Personal Information</h2>
            
            <form className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-theme-secondary ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-4 text-theme-primary focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-theme-secondary ml-1">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
                  <input 
                    type="email" 
                    value="john.doe@university.edu" 
                    disabled
                    className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-4 text-theme-muted opacity-70 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-theme-muted ml-1 mt-1">Email cannot be changed.</p>
              </div>

              <div className="mt-4 flex justify-end">
                <button 
                  type="button" 
                  className="px-6 py-2.5 rounded-xl font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Current Plan Card */}
          <div className="glass-card p-6 md:p-8 bg-gradient-to-br from-white/5 to-indigo-500/5">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold text-theme-primary mb-1">Current Plan</h2>
                <p className="text-sm text-theme-muted">You are currently on the <strong className="text-theme-primary">Free</strong> plan.</p>
              </div>
              <div className="px-3 py-1 rounded-lg bg-theme-surface-2 border border-theme-border text-xs font-semibold text-theme-secondary uppercase tracking-wider">
                Free
              </div>
            </div>
            
            <div className="bg-black/20 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-theme-secondary">AI Queries Remaining</span>
                <span className="text-sm font-bold text-theme-primary">2 / 5</span>
              </div>
              <div className="w-full h-2 bg-theme-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full w-2/5" />
              </div>
              <p className="text-xs text-theme-muted mt-2 text-right">Resets in 3h 12m</p>
            </div>

            <Link 
              to="/pricing"
              className="w-full flex items-center justify-center py-2.5 rounded-xl font-medium text-theme-primary bg-theme-surface-2 hover:bg-theme-surface-2 border border-theme-border transition-colors"
            >
              Upgrade Plan
            </Link>
          </div>

          {/* Danger Zone */}
          <div className="glass-card p-6 md:p-8 border-red-500/20 bg-red-500/5 mt-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-theme-primary mb-2">Danger Zone</h2>
                <p className="text-sm text-theme-muted mb-6">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <button className="px-5 py-2.5 rounded-xl font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
