import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // If they previously dismissed it or we know they installed it, don't show
    if (localStorage.getItem('pwa_prompt_dismissed') === 'true' || localStorage.getItem('has_installed_pwa') === 'true') {
      setIsStandalone(true); // Reusing this flag to permanently hide
      return;
    }

    // Check if currently running in standalone mode (installed app)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
      localStorage.setItem('has_installed_pwa', 'true');
      return;
    }

    // Check device type
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Listen for Android/Desktop prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDismissed(true);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSPrompt(true);
    } else if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('has_installed_pwa', 'true');
        setDeferredPrompt(null);
      }
    } else if (isAndroid) {
      // If we're on Android but deferredPrompt isn't ready (often happens when testing over local HTTP IP address)
      setShowAndroidPrompt(true);
    }
  };

  const handleAcknowledgeInstruction = (isIOSModal: boolean) => {
    if (isIOSModal) setShowIOSPrompt(false);
    else setShowAndroidPrompt(false);
    
    // We assume if they followed instructions, they will install it.
    // If they just close it to ignore, they can use the X button instead.
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (isStandalone || dismissed) return null;
  // Show if it's iOS, Android, or if the native prompt fired (desktop)
  if (!isIOS && !isAndroid && !deferredPrompt) return null;

  return (
    <>
      {/* Floating Action Button or Banner */}
      <div className="fixed bottom-24 md:bottom-6 right-4 md:right-8 z-50 animate-bounce">
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-all"
        >
          <Download className="w-5 h-5" />
          <span>Install App</span>
          <div 
            className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-theme-surface w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-6 border border-theme-border shadow-2xl relative animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <button 
              onClick={() => setShowIOSPrompt(false)}
              className="absolute top-4 right-4 p-2 text-theme-muted hover:text-theme-primary rounded-full hover:bg-theme-surface-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center text-center pt-4">
              <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
                <img src="/pwa-icon-512.png" alt="App Icon" className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-theme-primary mb-2">Install PastQ</h3>
              <p className="text-theme-muted mb-6 text-sm">
                Install this application on your home screen for quick and easy access when you're on the go.
              </p>
              
              <div className="w-full bg-theme-surface-2 rounded-xl p-4 text-left border border-theme-border">
                <ol className="space-y-4 text-sm text-theme-secondary font-medium">
                  <li className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs">1</span>
                    <span>Tap the <Share className="w-4 h-4 inline mx-1" /> Share button below.</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs">2</span>
                    <span>Select <strong>"Add to Home Screen"</strong></span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs">3</span>
                    <span>Tap <strong>"Add"</strong> in the top right</span>
                  </li>
                </ol>
              </div>
              
              <button 
                onClick={() => handleAcknowledgeInstruction(true)}
                className="w-full mt-6 py-3 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Android Manual Instructions Modal (Fallback) */}
      {showAndroidPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-theme-surface w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-6 border border-theme-border shadow-2xl relative animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <button 
              onClick={() => setShowAndroidPrompt(false)}
              className="absolute top-4 right-4 p-2 text-theme-muted hover:text-theme-primary rounded-full hover:bg-theme-surface-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center text-center pt-4">
              <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
                <img src="/pwa-icon-512.png" alt="App Icon" className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-theme-primary mb-2">Install PastQ</h3>
              <p className="text-theme-muted mb-6 text-sm">
                It looks like auto-install is blocked right now (likely because you are testing on a local IP address).
              </p>
              
              <div className="w-full bg-theme-surface-2 rounded-xl p-4 text-left border border-theme-border">
                <ol className="space-y-4 text-sm text-theme-secondary font-medium">
                  <li className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs">1</span>
                    <span>Tap the <strong>3-dots menu</strong> in Chrome (top right).</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs">2</span>
                    <span>Select <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong>.</span>
                  </li>
                </ol>
              </div>
              
              <button 
                onClick={() => handleAcknowledgeInstruction(false)}
                className="w-full mt-6 py-3 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallPrompt;
