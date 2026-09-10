'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';
import SiteLoader from '@/components/SiteLoader';

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

interface DieselCache {
  entries: DieselEntry[];
  metrics: DieselMetrics;
  userRole: string;
  userName: string;
}

// In-memory instant cache for zero-delay tab switching
let cachedDieselData: DieselCache | null = null;

export default function DriverDieselPage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState<boolean>(() => !cachedDieselData);
  const [entries, setEntries] = useState<DieselEntry[]>(() => cachedDieselData?.entries || []);
  const [metrics, setMetrics] = useState<DieselMetrics>(() => cachedDieselData?.metrics || {
    totalLitres: 0,
    todayLitres: 0,
    monthLitres: 0,
  });
  const [unreadNotifications, setUnreadNotifications] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [userRole, setUserRole] = useState<string>(() => cachedDieselData?.userRole || 'DRIVER');
  const [userName, setUserName] = useState<string>(() => cachedDieselData?.userName || '');

  const loadDieselData = async () => {
    setErrorMsg('');
    try {
      // Parallel API calls for maximum speed
      const [meRes, res, notifRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/driver/diesel'),
        fetch('/api/notifications')
      ]);

      if (meRes.status === 401 || res.status === 401) {
        router.push('/login');
        return;
      }

      let currentRole = userRole;
      let currentName = userName;

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          currentRole = meData.user.role || 'DRIVER';
          currentName = meData.user.name || '';
          setUserRole(currentRole);
          setUserName(currentName);
        }
      }

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const newEntries = data.entries || [];
          const newMetrics = data.metrics || { totalLitres: 0, todayLitres: 0, monthLitres: 0 };
          setEntries(newEntries);
          setMetrics(newMetrics);

          // Update instant cache for zero-delay tab navigation
          cachedDieselData = {
            entries: newEntries,
            metrics: newMetrics,
            userRole: currentRole,
            userName: currentName,
          };
        } else {
          setErrorMsg(data.error || 'Unable to retrieve diesel records.');
        }
      }

      // Check notifications
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

        {/* High-Impact Visual Summary Metrics Cards */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {/* Today's Diesel Card */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-2xl p-3.5 shadow-md flex flex-col justify-between items-center text-center border border-amber-400">
            <div className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide opacity-90">
              <span>⛽</span>
              <span>{t('common.today')}</span>
            </div>
            <div className="my-1.5">
              <span className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-xs">
                {metrics.todayLitres}
              </span>
              <span className="text-xs font-black ml-1 uppercase opacity-90">L</span>
            </div>
            <span className="text-[10px] bg-amber-700/60 px-2 py-0.5 rounded-full font-bold">
              {t('diesel.litres')}
            </span>
          </div>

          {/* This Month Diesel Card */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl p-3.5 shadow-md flex flex-col justify-between items-center text-center border border-blue-500">
            <div className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide opacity-90">
              <span>📅</span>
              <span>{t('common.thisMonth')}</span>
            </div>
            <div className="my-1.5">
              <span className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-xs">
                {metrics.monthLitres}
              </span>
              <span className="text-xs font-black ml-1 uppercase opacity-90">L</span>
            </div>
            <span className="text-[10px] bg-blue-800/60 px-2 py-0.5 rounded-full font-bold">
              {t('diesel.litres')}
            </span>
          </div>

          {/* Total Diesel Card */}
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-2xl p-3.5 shadow-md flex flex-col justify-between items-center text-center border border-emerald-500">
            <div className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide opacity-90">
              <span>📊</span>
              <span>{t('common.total')}</span>
            </div>
            <div className="my-1.5">
              <span className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-xs">
                {metrics.totalLitres}
              </span>
              <span className="text-xs font-black ml-1 uppercase opacity-90">L</span>
            </div>
            <span className="text-[10px] bg-emerald-800/60 px-2 py-0.5 rounded-full font-bold">
              {t('diesel.litres')}
            </span>
          </div>
        </div>

        {/* Diesel Log Entries List */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3 bg-slate-200/60 p-2 rounded-xl border border-slate-300/70">
            <div className="flex items-center gap-2">
              <span className="text-base">⛽</span>
              <h3 className="text-xs uppercase font-black tracking-wider text-slate-700">
                {t('diesel.loggedFuelFillings')}
              </h3>
            </div>
            <button
              onClick={() => loadDieselData()}
              className="bg-white hover:bg-slate-50 text-blue-900 border border-slate-300 font-extrabold px-3 py-1 rounded-lg text-xs flex items-center gap-1 shadow-2xs transition-all active:scale-95"
            >
              <span>↻</span>
              <span>{t('common.refresh')}</span>
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <SiteLoader />
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 shadow-sm font-bold flex flex-col items-center gap-2">
              <span className="text-4xl">⛽</span>
              <span>{t('diesel.noDieselEntries')}</span>
            </div>
          ) : (
            <div className="space-y-3.5">
              {entries.map((entry) => {
                const d = new Date(entry.date + 'T00:00:00');
                const locale = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-US';
                const formattedDate = d.toLocaleDateString(locale, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });

                const todayStr = new Date().toISOString().split('T')[0];
                const isToday = entry.date === todayStr;

                return (
                  <div
                    key={entry.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow"
                  >
                    {/* Big Diesel Litres Pill Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-slate-100 text-slate-700 font-extrabold px-2.5 py-1 rounded-lg border border-slate-200">
                          📅 {isToday ? 'Today' : formattedDate}
                        </span>
                      </div>
                      <div className="bg-amber-100 border-2 border-amber-300 text-amber-950 px-3.5 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
                        <span className="text-base">⛽</span>
                        <span className="text-lg font-black tracking-tight">
                          {parseFloat(entry.litres || '0').toFixed(0)}
                        </span>
                        <span className="text-xs font-black uppercase text-amber-900">Litres</span>
                      </div>
                    </div>

                    {/* Details: Vehicle & Recorded By */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                        <span className="text-lg">🚛</span>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('diesel.vehicleLabel')}</span>
                          <span className="font-black text-slate-900 uppercase tracking-wide">
                            {entry.vehicleNumber || 'Unassigned'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                        <span className="text-lg">👤</span>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('diesel.recordedBy')}</span>
                          <span className="font-bold text-slate-800 truncate block">
                            {entry.adminName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Optional Notes */}
                    {entry.notes && (
                      <div className="text-xs text-slate-700 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/70 flex items-start gap-2">
                        <span className="text-sm">💬</span>
                        <p className="font-semibold italic">"{entry.notes}"</p>
                      </div>
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
