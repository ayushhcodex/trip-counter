'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DieselEntry[]>([]);
  const [metrics, setMetrics] = useState<DieselMetrics>({
    totalLitres: 0,
    todayLitres: 0,
    monthLitres: 0,
  });
  const [unreadNotifications, setUnreadNotifications] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadDieselData = async () => {
    try {
      const res = await fetch('/api/driver/diesel');
      if (!res.ok) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries || []);
        setMetrics(data.metrics || { totalLitres: 0, todayLitres: 0, monthLitres: 0 });
      }

      // Check unread notifications
      const notifRes = await fetch('/api/notifications');
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const hasUnread = (notifData.notifications || []).some((n: any) => !n.readAt);
        setUnreadNotifications(hasUnread);
      }
    } catch (error) {
      console.error('Failed to load diesel logs:', error);
      setErrorMsg('Failed to load diesel log records.');
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

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div>
          <h1 className="font-extrabold text-xl tracking-tight text-blue-400">TripCounter</h1>
          <p className="text-xs text-slate-400 font-semibold">Driver Portal • Diesel Records</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
        >
          Logout
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-lg mx-auto w-full flex flex-col">
        <h2 className="text-xl font-black text-slate-800 tracking-tight mb-4">
          Fuel & Diesel Log
        </h2>

        {errorMsg && (
          <div className="w-full bg-red-100 border border-red-300 text-red-700 px-4 py-2.5 rounded-md text-xs mb-4 font-semibold text-center">
            {errorMsg}
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Today</span>
            <span className="text-xl font-black text-blue-900 block mt-1">
              {metrics.todayLitres} <span className="text-xs font-bold">L</span>
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">This Month</span>
            <span className="text-xl font-black text-blue-900 block mt-1">
              {metrics.monthLitres} <span className="text-xs font-bold">L</span>
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
            <span className="text-xl font-black text-emerald-700 block mt-1">
              {metrics.totalLitres} <span className="text-xs font-bold">L</span>
            </span>
          </div>
        </div>

        {/* Diesel Entries List */}
        <div className="flex-1 flex flex-col">
          <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-3 text-left">
            Logged Fuel Fillings
          </h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-3 text-slate-500 text-xs font-semibold">Loading records...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400 shadow-sm font-semibold">
              No diesel entries logged yet.
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 text-sm">
                      {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="bg-blue-100 text-blue-900 text-xs px-2.5 py-1 rounded-full font-black">
                      {parseFloat(entry.litres).toFixed(2)} Litres
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Vehicle: <strong className="uppercase text-slate-700">{entry.vehicleNumber || 'Unassigned'}</strong>
                    </span>
                    <span>By Admin: {entry.adminName}</span>
                  </div>

                  {entry.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 italic">
                      "{entry.notes}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Driver Footer Navigation */}
      <footer className="bg-white border-t border-slate-200 flex justify-around py-2.5 sticky bottom-0 z-10">
        <button
          onClick={() => router.push('/driver')}
          className="flex flex-col items-center text-slate-500 hover:text-blue-900 text-xs font-semibold"
        >
          <span className="text-lg">📊</span>
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => router.push('/driver/history')}
          className="flex flex-col items-center text-slate-500 hover:text-blue-900 text-xs font-semibold"
        >
          <span className="text-lg">📅</span>
          <span>My Trips</span>
        </button>
        <button
          onClick={() => loadDieselData()}
          className="flex flex-col items-center text-blue-900 font-bold text-xs"
        >
          <span className="text-lg">⛽</span>
          <span>Diesel</span>
        </button>
        <button
          onClick={() => router.push('/driver/notifications')}
          className="flex flex-col items-center text-slate-500 hover:text-blue-900 text-xs font-semibold relative"
        >
          {unreadNotifications && (
            <span className="absolute top-0.5 right-4 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
          )}
          <span className="text-lg">🔔</span>
          <span>Notifications</span>
        </button>
      </footer>
    </div>
  );
}
