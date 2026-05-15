import { useState, useEffect } from 'react';
import { Megaphone, X } from 'lucide-react';
import { apiFetch } from '../lib/api';

export const GlobalBanner = () => {
  const [banner, setBanner] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session
    const dismissedBanner = sessionStorage.getItem('dismissed_banner');

    apiFetch('/public/site-config')
      .then(data => {
        if (data.globalBannerActive && data.globalBanner) {
          if (dismissedBanner !== data.globalBanner) {
            setBanner(data.globalBanner);
            setIsVisible(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  if (!isVisible || isDismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('dismissed_banner', banner);
    setIsDismissed(true);
  };

  return (
    <>
      <style>{`
        @keyframes marquee-ltr {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100vw); }
        }
        .banner-marquee {
          display: inline-block;
          white-space: nowrap;
          animation: marquee-ltr 18s linear infinite;
        }
      `}</style>

      <div className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white shadow-md sticky top-0 z-[100]">
        <div className="flex items-center px-4 py-2.5 gap-3">
          {/* Icon – always visible, never scrolls */}
          <span className="flex-shrink-0 flex p-2 rounded-lg bg-white/20 shadow-sm">
            <Megaphone className="h-4 w-4 sm:h-5 sm:w-5 text-white" aria-hidden="true" />
          </span>

          {/* Scrolling text container */}
          <div className="flex-1 overflow-hidden min-w-0">
            <span className="banner-marquee font-semibold text-sm sm:text-base">
              {banner}
            </span>
          </div>

          {/* Dismiss button – always visible */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="flex-shrink-0 flex p-2 rounded-md hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5 text-white" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
};

export default GlobalBanner;
