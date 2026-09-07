'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';

interface DieselEntry {
  id: string;
  date: string;
  litres: string;
  notes: string | null;
  createdAt: string;
  vehicleNumber: string | null;
  adminName: string;
}

interface DieselMetrics {
  totalLitres: number;
  todayLitres: number;
  monthLitres: number;
}

export default function DriverDieselPage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DieselEntry[]>([]);
  const [metrics, setMetrics] = useState<DieselMetrics>({
    totalLitres: 0,
    todayLitres: 0,
    monthLitres: 0,
  });
  const [unreadNotifications, setUnreadNotifications] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [userRole, setUserRole] = useState<string>('DRIVER');
  const [userName, setUserName] = useState<string>('');

  const loadDieselData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Check user profile
      const meRes = await fetch('/api/auth/me');
      if (meRes.status === 401) {
        router.push('/login');
        return;
      }
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          setUserRole(meData.user.role || 'DRIVER');
          setUserName(meData.user.name || '');
        }
      }

      // 2. Fetch diesel data
      const res = await fetch('/api/driver/diesel');
      if (res.status === 401) {
        router.push('/login');
        return;
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setEntries(data.entries || []);
        setMetrics(data.metrics || { totalLitres: 0, todayLitres: 0, monthLitres: 0 });
      } else {
        setErrorMsg(data.error || 'Unable to retrieve diesel records.');
      }

      // 3. Check notifications (for drivers)
      const notifRes = await fetch('/api/notifications');
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const hasUnread = (notifData.notifications || []).some((n: any) => !n.readAt);
        setUnreadNotifications(hasUnread);
      }
    } catch (error) {
      console.error('Failed to load diesel logs:', error);
      setErrorMsg(t('common.networkError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDieselData();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const getBackRoute = () => {
    if (userRole === 'SUPER_ADMIN') return '/superadmin';
    if (userRole === 'ADMIN') return '/admin';
    return '/driver';
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-md sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          {userRole !== 'DRIVER' && (
            <button
              onClick={() => router.push(getBackRoute())}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg font-bold transition-all"
            >
              ← {t('common.back')}
            </button>
          )}
          <div>
            <h1 className="font-extrabold text-lg sm:text-xl tracking-tight text-blue-400">
              {t('common.appName')}
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold">
              {userRole === 'SUPER_ADMIN'
                ? `${t('common.superAdminRole')} • ${t('diesel.ledgerTitle')}`
                : userRole === 'ADMIN'
                ? `${t('common.adminRole')} • ${t('diesel.ledgerTitle')}`
                : `${t('common.driverRole')} • ${t('diesel.pageTitle')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {userName && (
            <span className="hidden sm:inline text-xs text-slate-300 font-bold mr-1">
              {userName}
            </span>
          )}
          <LanguageSelector variant="header" />
          <button
            onClick={handleLogout}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          >
            {t('common.logout')}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">
            {t('diesel.pageTitle')}
          </h2>
          {userRole !== 'DRIVER' && (
            <button
              onClick={() => router.push(getBackRoute())}
              className="text-xs bg-blue-900 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition-all"
            >
              {t('common.manageVehicles')}
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="w-full bg-amber-50 border border-amber-300 text-amber-800 px-4 py-2.5 rounded-lg text-xs mb-4 font-semibold text-center">
            {errorMsg}
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('common.today')}</span>
            <span className="text-xl font-black text-blue-900 block mt-1">
              {metrics.todayLitres} <span className="text-xs font-bold">L</span>
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('common.thisMonth')}</span>
            <span className="text-xl font-black text-blue-900 block mt-1">
              {metrics.monthLitres} <span className="text-xs font-bold">L</span>
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('common.total')}</span>
            <span className="text-xl font-black text-emerald-700 block mt-1">
              {metrics.totalLitres} <span className="text-xs font-bold">L</span>
            </span>
          </div>
        </div>

        {/* Diesel Entries List */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 text-left">
              {t('diesel.loggedFuelFillings')}
            </h3>
            <button
              onClick={() => loadDieselData()}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              ↻ {t('common.refresh')}
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-3 text-slate-500 text-xs font-semibold">{t('common.loading')}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400 shadow-sm font-semibold">
              {t('diesel.noDieselEntries')}
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const d = new Date(entry.date + 'T00:00:00');
                const locale = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-US';
                const formattedDate = d.toLocaleDateString(locale, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <div
                    key={entry.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-800 text-sm">
                        {formattedDate}
                      </span>
                      <span className="bg-blue-100 text-blue-900 text-xs px-2.5 py-1 rounded-full font-black">
                        {parseFloat(entry.litres || '0').toFixed(2)} {t('diesel.litres')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {t('diesel.vehicleLabel')}: <strong className="uppercase text-slate-800">{entry.vehicleNumber || 'Unassigned'}</strong>
                      </span>
                      <span>{t('diesel.recordedBy')}: {entry.adminName}</span>
                    </div>

                    {entry.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                        "{entry.notes}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Footer Navigation */}
      <footer className="bg-white border-t border-slate-200 flex justify-around py-2.5 sticky bottom-0 z-10">
        <button
          onClick={() => router.push(getBackRoute())}
          className="flex flex-col items-center text-slate-500 hover:text-blue-900 text-xs font-semibold"
        >
          <span className="text-lg">📊</span>
          <span>{t('nav.dashboard')}</span>
        </button>
        {userRole === 'DRIVER' && (
          <button
            onClick={() => router.push('/driver/history')}
            className="flex flex-col items-center text-slate-500 hover:text-blue-900 text-xs font-semibold"
          >
            <span className="text-lg">📅</span>
            <span>{t('nav.myTrips')}</span>
          </button>
        )}
        <button
          onClick={() => loadDieselData()}
          className="flex flex-col items-center text-blue-900 font-bold text-xs"
        >
          <span className="text-lg">⛽</span>
          <span>{t('nav.diesel')}</span>
        </button>
        {userRole === 'DRIVER' && (
          <button
            onClick={() => router.push('/driver/notifications')}
            className="flex flex-col items-center text-slate-500 hover:text-blue-900 text-xs font-semibold relative"
          >
            {unreadNotifications && (
              <span className="absolute top-0.5 right-4 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
            )}
            <span className="text-lg">🔔</span>
            <span>{t('nav.notifications')}</span>
          </button>
        )}
      </footer>
    </div>
  );
}
