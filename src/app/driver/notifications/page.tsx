'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedEntityId: string | null;
  readAt: string | null;
  createdAt: string;
}

// In-memory instant cache for zero-delay tab switching
let cachedNotifications: NotificationItem[] | null = null;

export default function DriverNotifications() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState<boolean>(() => !cachedNotifications);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => cachedNotifications || []);
  const [errorMsg, setErrorMsg] = useState('');
  const [ackLoading, setAckLoading] = useState<string | null>(null);

  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        cachedNotifications = data.notifications;
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setErrorMsg(t('common.networkError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleAcknowledge = async (adjustmentId: string, notificationId: string) => {
    setAckLoading(notificationId);
    setErrorMsg('');

    try {
      // 1. Acknowledge adjustment
      const ackRes = await fetch('/api/driver/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustmentId }),
      });

      if (!ackRes.ok) {
        const data = await ackRes.json();
        setErrorMsg(data.error || 'Failed to acknowledge adjustment.');
        return;
      }

      // 2. Mark notification as read
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      // Reload
      await loadNotifications();
    } catch (error) {
      console.error('Failed to process acknowledgment:', error);
      setErrorMsg(t('common.networkError'));
    } finally {
      setAckLoading(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 font-medium">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full bg-slate-50 shadow-md min-h-screen">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push('/driver')}
            className="text-slate-300 hover:text-white text-xs font-bold focus:outline-none bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-all"
          >
            ← {t('common.back')}
          </button>
          <h1 className="font-bold text-base tracking-tight">{t('driver.notificationsTitle')}</h1>
        </div>
        <div className="flex items-center space-x-2">
          {notifications.some((n) => !n.readAt) && (
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg font-bold border border-slate-700 transition-all"
            >
              {t('driver.markAllRead')}
            </button>
          )}
          <LanguageSelector variant="header" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 space-y-4 max-w-md mx-auto w-full">
        {errorMsg && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-xl text-xs font-bold text-center">
            {errorMsg}
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 shadow-sm font-bold flex flex-col items-center gap-2">
            <span className="text-4xl">🔔</span>
            <span>{t('driver.noNotifications')}</span>
          </div>
        ) : (
          <div className="space-y-3.5">
            {notifications.map((notif) => {
              const isUnread = !notif.readAt;
              const d = new Date(notif.createdAt);
              const locale = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-US';
              const dateStr = d.toLocaleDateString(locale, {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              // Determine visual icon and styling based on notification content/type
              const isDiesel = notif.message.toLowerCase().includes('diesel') || notif.type.toLowerCase().includes('diesel');
              const isTripAdj = notif.type === 'TRIP_ADJUSTMENT';

              const icon = isDiesel ? '⛽' : isTripAdj ? '🔢' : '📢';
              const badgeBg = isDiesel
                ? 'bg-amber-100 text-amber-950 border-amber-300'
                : isTripAdj
                ? 'bg-blue-100 text-blue-950 border-blue-300'
                : 'bg-slate-100 text-slate-900 border-slate-300';

              return (
                <div
                  key={notif.id}
                  className={`border-2 rounded-2xl p-4 shadow-sm transition-all ${
                    isUnread
                      ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-200/50 shadow-md'
                      : 'bg-white border-slate-200/80'
                  }`}
                >
                  {/* Top Bar: Icon Badge, Category & Date */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-base px-2 py-0.5 rounded-lg border font-black ${badgeBg}`}>
                        {icon} {isDiesel ? 'Diesel' : isTripAdj ? 'Trip Update' : 'Notice'}
                      </span>
                      {isUnread && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
                          NEW
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                      <span>📅</span> {dateStr}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-extrabold text-slate-900 text-sm leading-snug">
                    {notif.title}
                  </h3>

                  {/* Message Content */}
                  <div className="text-xs font-semibold text-slate-700 mt-1.5 p-2.5 bg-white/80 rounded-xl border border-slate-200/70 leading-relaxed whitespace-pre-line">
                    {notif.message}
                  </div>

                  {/* Action Button for Trip Adjustments */}
                  {notif.type === 'TRIP_ADJUSTMENT' && notif.relatedEntityId && isUnread && (
                    <div className="mt-3 pt-3 border-t border-blue-200/60 flex justify-end">
                      <button
                        disabled={ackLoading === notif.id}
                        onClick={() => handleAcknowledge(notif.relatedEntityId!, notif.id)}
                        className="w-full bg-blue-900 hover:bg-blue-800 text-white text-xs py-2.5 px-4 rounded-xl font-black shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98"
                      >
                        <span>✓</span>
                        <span>{ackLoading === notif.id ? t('common.loading') : `${t('driver.acknowledgeBtn')} (Got it)`}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Driver Footer Navigation */}
      <footer className="bg-white border-t border-slate-200 flex justify-around py-2.5 sticky bottom-0 z-10">
        <button
          onClick={() => router.push('/driver')}
          className="flex flex-col items-center text-slate-500 hover:text-blue-900 text-xs font-semibold"
        >
          <span className="text-lg">📊</span>
          <span>{t('nav.dashboard')}</span>
        </button>
        <button
          onClick={() => router.push('/driver/history')}
          className="flex flex-col items-center text-slate-500 hover:text-blue-900 text-xs font-semibold"
        >
          <span className="text-lg">📅</span>
          <span>{t('nav.myTrips')}</span>
        </button>
        <button
          onClick={() => router.push('/driver/diesel')}
          className="flex flex-col items-center text-slate-500 hover:text-blue-900 text-xs font-semibold"
        >
          <span className="text-lg">⛽</span>
          <span>{t('nav.diesel')}</span>
        </button>
        <button
          onClick={() => loadNotifications()}
          className="flex flex-col items-center text-blue-900 font-bold text-xs"
        >
          <span className="text-lg">🔔</span>
          <span>{t('nav.notifications')}</span>
        </button>
      </footer>
    </div>
  );
}
