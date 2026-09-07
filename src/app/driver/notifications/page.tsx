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

export default function DriverNotifications() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
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
      <main className="flex-1 p-4 space-y-4">
        {errorMsg && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2.5 rounded-lg text-xs font-semibold text-center">
            {errorMsg}
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400 font-semibold">
            {t('driver.noNotifications')}
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

              return (
                <div
                  key={notif.id}
                  className={`border rounded-xl p-4 shadow-sm transition-colors ${
                    isUnread
                      ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-blue-900 tracking-wide uppercase">
                      {notif.type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{dateStr}</span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-sm mt-1.5 leading-snug">
                    {notif.title}
                  </h3>

                  <div className="text-xs text-slate-600 mt-2 space-y-2 leading-relaxed whitespace-pre-line">
                    {notif.message}
                  </div>

                  {notif.type === 'TRIP_ADJUSTMENT' && notif.relatedEntityId && isUnread && (
                    <div className="mt-3.5 pt-3.5 border-t border-blue-100 flex justify-end">
                      <button
                        disabled={ackLoading === notif.id}
                        onClick={() => handleAcknowledge(notif.relatedEntityId!, notif.id)}
                        className="bg-blue-900 hover:bg-blue-800 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-sm transition-colors"
                      >
                        {ackLoading === notif.id ? t('common.loading') : t('driver.acknowledgeBtn')}
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
