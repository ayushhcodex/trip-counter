'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already dismissed recently
    const dismissed = localStorage.getItem('tripcounter_install_dismissed');
    if (dismissed) return;

    // Check if running in standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);

    if (isAppleDevice && isSafari) {
      setIsIOS(true);
      // Small delay for smooth appearance
      const timer = setTimeout(() => setShowPrompt(true), 1200);
      return () => clearTimeout(timer);
    }

    // Android / Desktop Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 1000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setShowPrompt(false);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('tripcounter_install_dismissed', 'installed');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for 7 days
    localStorage.setItem('tripcounter_install_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 text-slate-800 space-y-4">
        {/* Header with App Logo */}
        <div className="flex items-center space-x-3">
          <img
            src="/icons/icon-192x192.png"
            alt="Rentzoo Go"
            className="w-12 h-12 rounded-xl shadow-md border border-slate-100 object-cover"
          />
          <div>
            <h3 className="font-extrabold text-base text-slate-900 leading-tight">
              Install Rentzoo Go
            </h3>
            <p className="text-xs text-slate-500 font-semibold">
              Fast trip logging & offline access
            </p>
          </div>
        </div>

        {/* Content based on Platform */}
        {isIOS ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-700">
            <p className="font-bold text-slate-800">
              To install this app on your iPhone:
            </p>
            <div className="flex items-start space-x-2">
              <span className="flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-900 rounded-full font-black text-[11px] shrink-0 mt-0.5">
                1
              </span>
              <p>
                Tap the <strong className="text-blue-900">Share</strong> button at the bottom of your Safari screen: <span className="text-base font-bold">⎋</span> or <span className="inline-block px-1 bg-slate-200 rounded">⎙</span>
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-900 rounded-full font-black text-[11px] shrink-0 mt-0.5">
                2
              </span>
              <p>
                Scroll down and tap <strong className="text-blue-900">"Add to Home Screen" ➕</strong>
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600 leading-relaxed">
            Install the verified driver & admin app on your home screen for instant one-tap access, notifications, and offline trip logging.
          </p>
        )}

        {/* Actions */}
        <div className="flex space-x-2 pt-1">
          {deferredPrompt && !isIOS ? (
            <button
              onClick={handleInstallClick}
              className="flex-1 bg-blue-900 hover:bg-blue-800 text-white rounded-xl py-2.5 text-xs font-bold shadow-md hover:shadow-lg transition-all"
            >
              Install App
            </button>
          ) : null}
          <button
            onClick={handleDismiss}
            className={`${
              isIOS || !deferredPrompt ? 'w-full' : 'w-1/3'
            } bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2.5 text-xs font-bold transition-all`}
          >
            {isIOS ? 'Got It' : 'Maybe Later'}
          </button>
        </div>
      </div>
    </div>
  );
}
