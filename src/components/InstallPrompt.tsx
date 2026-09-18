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
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(standalone);
    if (standalone) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isApple);

    // Sync from global early listener
    if ((window as any).deferredInstallPrompt) {
      setDeferredPrompt((window as any).deferredInstallPrompt);
    }

    const handlePromptReady = () => {
      if ((window as any).deferredInstallPrompt) {
        setDeferredPrompt((window as any).deferredInstallPrompt);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredInstallPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-ready', handlePromptReady);

    // Listen for custom trigger from any button on the page
    const handleCustomTrigger = () => {
      const promptEvent = (window as any).deferredInstallPrompt || deferredPrompt;
      if (promptEvent) {
        promptEvent.prompt();
        promptEvent.userChoice.then((choice: { outcome: string }) => {
          if (choice.outcome === 'accepted') {
            (window as any).deferredInstallPrompt = null;
            setDeferredPrompt(null);
            setShowPrompt(false);
          }
        });
      } else {
        setShowPrompt(true);
        setShowGuide(true);
      }
    };
    window.addEventListener('open-install-prompt', handleCustomTrigger);

    // Auto-display modal popup after 1s if not installed and not dismissed in current session
    const timer = setTimeout(() => {
      const dismissed = sessionStorage.getItem('tripcounter_install_dismissed_session');
      if (!dismissed) {
        setShowPrompt(true);
      }
    }, 1000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('open-install-prompt', handleCustomTrigger);
      clearTimeout(timer);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    const promptEvent = (window as any).deferredInstallPrompt || deferredPrompt;
    if (promptEvent) {
      setShowPrompt(false);
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        (window as any).deferredInstallPrompt = null;
        setDeferredPrompt(null);
        setIsStandalone(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowGuide(false);
    sessionStorage.setItem('tripcounter_install_dismissed_session', 'true');
  };

  if (isStandalone || !showPrompt) return null;

  const hasNativePrompt = Boolean((window as any).deferredInstallPrompt || deferredPrompt);

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
              Install App
            </span>
            <h3 className="font-black text-base text-slate-900 leading-tight">
              {t('pwa.installTitle')}
            </h3>
            <p className="text-xs text-slate-500 font-semibold">
              {t('pwa.installSubtitle')}
            </p>
          </div>
        </div>

        {/* Content / Guide */}
        {showGuide && !hasNativePrompt ? (
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
                    Tap the <strong>Share button</strong> at the bottom of Safari <span className="font-bold text-blue-900">⎋</span>.
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
                    Tap <strong>Add</strong> in top right.
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
                    Tap the <strong>three dots menu (⋮)</strong> at top right in Chrome.
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
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white rounded-xl py-3.5 text-sm font-black shadow-md hover:shadow-lg transition-all"
          >
            <span>📲</span>
            <span>{hasNativePrompt ? t('pwa.installAppBtn') : '1-Tap Install / Add to Home'}</span>
          </button>

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
