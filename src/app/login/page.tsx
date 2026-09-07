'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [showPassword, setShowPassword] = useState(false);

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

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8 border border-slate-200 space-y-6">
        {/* Top Header & Language Picker */}
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-full flex justify-end">
            <LanguageSelector variant="segmented" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-blue-900 tracking-tight">
              {t('auth.title')}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1 font-semibold">
              {t('auth.subtitle')}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2.5 rounded-lg text-xs font-semibold text-center">
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
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-600 focus:bg-white text-slate-800 transition-colors"
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
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-600 focus:bg-white text-slate-800 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full bg-blue-900 hover:bg-blue-800 text-white rounded-lg py-3.5 text-sm font-bold shadow-md hover:shadow-lg transition-all focus:outline-none ${
              submitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {submitting ? t('auth.signingIn') : t('auth.signInBtn')}
          </button>
        </form>

        <div className="text-center text-[11px] text-slate-400 font-semibold border-t border-slate-100 pt-4 space-y-1">
          <p>{t('auth.driverIdHint')}</p>
          <p className="text-slate-500">{t('auth.rolesHint')}</p>
        </div>
      </div>
    </div>
  );
}
