'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import ShareButton from '@/components/ShareButton';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed as PWA)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(standalone);
    if (standalone) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isApple);

    // Capture Android / Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for custom trigger from any page button (e.g. login page, settings)
    const handleCustomTrigger = () => {
      setShowPrompt(true);
    };
    window.addEventListener('open-install-prompt', handleCustomTrigger);

    // Show prompt automatically after 800ms if not in standalone
    const timer = setTimeout(() => {
      const dismissed = sessionStorage.getItem('tripcounter_install_dismissed_session');
      if (!dismissed) {
        setShowPrompt(true);
      }
    }, 800);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('open-install-prompt', handleCustomTrigger);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setShowPrompt(false);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
    } else {
      // If native prompt is not available, show visual step-by-step installation guide
      setShowGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowGuide(false);
    // Dismiss only for current session so it doesn't annoy the user permanently
    sessionStorage.setItem('tripcounter_install_dismissed_session', 'true');
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 text-slate-800 space-y-4 relative">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 text-sm font-bold transition-all"
        >
          ✕
        </button>

        {/* Header with App Logo */}
        <div className="flex items-center space-x-3 pr-6">
          <img
            src="/icons/icon-192x192.png"
            alt="Trip Zoo"
            className="w-13 h-13 rounded-2xl shadow-md border border-slate-100 object-cover shrink-0"
          />
          <div>
            <span className="inline-block bg-blue-100 text-blue-900 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full mb-0.5">
              Official App
            </span>
            <h3 className="font-black text-base text-slate-900 leading-tight">
              {t('pwa.installTitle')}
            </h3>
            <p className="text-xs text-slate-500 font-semibold">
              {t('pwa.installSubtitle')}
            </p>
          </div>
        </div>

        {/* Step-by-Step Guide or Summary */}
        {showGuide || isIOS ? (
          <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 space-y-3 text-xs text-slate-700">
            <p className="font-extrabold text-blue-950 flex items-center gap-1.5">
              <span>📲</span>
              <span>{isIOS ? 'How to install on iPhone (Safari):' : 'How to install on Android (Chrome):'}</span>
            </p>
            {isIOS ? (
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-blue-900 text-white rounded-full font-black text-[10px] shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    Tap the <strong>Share button</strong> at bottom of Safari <span className="font-bold text-blue-900">⎋</span>.
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-blue-900 text-white rounded-full font-black text-[10px] shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    Scroll down and tap <strong>Add to Home Screen ➕</strong>.
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-blue-900 text-white rounded-full font-black text-[10px] shrink-0 mt-0.5">
                    3
                  </span>
                  <p>
                    Tap <strong>Add</strong> in top-right. The app is installed!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-blue-900 text-white rounded-full font-black text-[10px] shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    Tap the <strong>three dots menu (⋮)</strong> at top-right in Chrome.
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-blue-900 text-white rounded-full font-black text-[10px] shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    Select <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
            {t('pwa.androidDescription')}
          </p>
        )}

        {/* Share option */}
        <ShareButton variant="banner" />

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          {!showGuide && !isIOS ? (
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white rounded-xl py-3 text-sm font-black shadow-md hover:shadow-lg transition-all"
            >
              <span>📲</span>
              <span>{t('pwa.installAppBtn')}</span>
            </button>
          ) : null}

          <button
            onClick={handleDismiss}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2.5 text-xs font-bold transition-all text-center"
          >
            {isIOS || showGuide ? t('pwa.gotItBtn') : t('pwa.maybeLaterBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
