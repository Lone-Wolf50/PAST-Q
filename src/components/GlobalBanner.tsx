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
          } else {

          }
        } else {

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
    <div className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white shadow-md relative z-[100]">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="w-0 flex-1 flex items-center gap-3">
            <span className="flex p-2 rounded-lg bg-white/20 shadow-sm">
              <Megaphone className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <p className="font-semibold text-sm truncate">
              {banner}
            </p>
          </div>
          <div className="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
            {/* Optional call to action button can go here */}
          </div>
          <div className="order-2 flex-shrink-0 sm:order-3 sm:ml-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="-mr-1 flex p-2 rounded-md hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
            >
              <span className="sr-only">Dismiss</span>
              <X className="h-5 w-5 text-white" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalBanner;
