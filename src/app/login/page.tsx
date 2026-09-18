'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';
import ShareButton from '@/components/ShareButton';
import DriverOnboardingModal from '@/components/DriverOnboardingModal';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    const cleanUser = usernameOrEmail.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg(t('auth.invalidCredentials'));
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: cleanUser, password: cleanPass }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || t('auth.invalidCredentials'));
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        // Successful login, perform full window navigation to ensure session cookie is committed
        const role = data.user.role;
        if (role === 'SUPER_ADMIN') {
          window.location.href = '/superadmin';
        } else if (role === 'ADMIN' || role === 'SUPERVISOR') {
          window.location.href = '/admin';
        } else if (role === 'DRIVER') {
          window.location.href = '/driver';
        } else {
          setErrorMsg('Unauthorized account role.');
          setSubmitting(false);
        }
      }
    } catch (err) {
      console.error('Login request failed:', err);
      setErrorMsg(t('common.networkError'));
      setSubmitting(false);
    }
  };

  const handleOpenPwaInstall = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-install-prompt'));
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4 sm:p-6 space-y-6">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 sm:p-8 border border-slate-200 space-y-6">
        {/* Top Header & Language Picker */}
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-full flex justify-between items-center gap-2">
            <ShareButton variant="button" />
            <LanguageSelector variant="segmented" />
          </div>
          <div className="flex flex-col items-center">
            <img
              src="/icons/icon-192x192.png"
              alt="Trip Zoo"
              className="w-20 h-20 rounded-2xl shadow-lg border border-slate-100 object-cover mb-2"
            />
            <h1 className="text-3xl font-black text-blue-900 tracking-tight">
              {t('auth.title')}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1 font-semibold">
              {t('auth.subtitle')}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2.5 rounded-xl text-xs font-semibold text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-1.5">
              {t('auth.usernameLabel')}
            </label>
            <input
              type="text"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder={t('auth.usernamePlaceholder')}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-600 focus:bg-white text-slate-800 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs uppercase font-bold tracking-wider text-slate-400">
                {t('auth.passwordLabel')}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-blue-800 font-semibold hover:underline"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-600 focus:bg-white text-slate-800 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full bg-blue-900 hover:bg-blue-800 text-white rounded-xl py-3.5 text-sm font-black shadow-md hover:shadow-lg transition-all focus:outline-none ${
              submitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {submitting ? t('auth.signingIn') : t('auth.signInBtn')}
          </button>
        </form>

        {/* PWA Install & Driver Onboarding Section (No raw APK buttons) */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <button
            onClick={handleOpenPwaInstall}
            type="button"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 hover:from-blue-800 hover:to-indigo-800 text-white py-3 px-4 rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all text-center"
          >
            <span>📲</span>
            <span>{t('pwa.installAppBtn')} / Add to Home Screen</span>
          </button>

          <button
            onClick={() => setShowOnboarding(true)}
            type="button"
            className="w-full flex items-center justify-center gap-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 py-2.5 rounded-xl text-xs font-bold transition-all border border-slate-200"
          >
            <span>📋</span>
            <span>Driver QR & Setup Guide</span>
          </button>
        </div>

        <div className="text-center text-[11px] text-slate-400 font-semibold space-y-1">
          <p className="text-slate-500">{t('auth.rolesHint')}</p>
        </div>
      </div>

      {/* Legal Footer */}
      <footer className="text-center text-xs text-slate-500 space-y-1">
        <div className="flex items-center justify-center space-x-3 font-semibold">
          <Link href="/privacy" className="hover:text-blue-700 hover:underline">
            {t('common.privacyPolicy')}
          </Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-blue-700 hover:underline">
            {t('common.termsOfService')}
          </Link>
          <span>•</span>
          <Link href="/legal" className="hover:text-blue-700 hover:underline">
            {t('common.legalNotice')}
          </Link>
        </div>
        <p className="text-[11px] text-slate-400">© {new Date().getFullYear()} Rentzoo Private Limited. {t('common.allRightsReserved')}</p>
      </footer>

      {/* Driver Onboarding / Install Modal */}
      <DriverOnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
}
