'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getShiftInfo } from '@/lib/shifts';

interface TripLog {
  id: string;
  completedAt: string;
  vehicleNumber: string;
}

interface AdjustmentLog {
  id: string;
  date: string;
  adjustment: number;
  reason: string;
  createdAt: string;
  adminName: string;
  acknowledgedAt: string | null;
}

interface HistoryDay {
  date: string;
  reportedCount: number;
  adjustmentCount: number;
  verifiedCount: number;
  trips: TripLog[];
  adjustments: AdjustmentLog[];
}

export default function DriverHistory() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [ackLoading, setAckLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/trips/history');
      if (!res.ok) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      setErrorMsg('Failed to load history logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const toggleExpand = (date: string) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  const handleAcknowledge = async (adjustmentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent collapsing the day layout
    setAckLoading(adjustmentId);
    setErrorMsg('');

    try {
      const res = await fetch('/api/driver/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustmentId }),
      });

      if (res.ok) {
        // Refresh local details
        await loadHistory();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Failed to submit acknowledgment.');
      }
    } catch (error) {
      console.error('Acknowledgment submit error:', error);
      setErrorMsg('Network error. Try again.');
    } finally {
      setAckLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading History...</p>
      </div>
    );
  }

  // Format YYYY-MM-DD to a more readable "28 Aug 2026"
  const formatDateString = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full bg-slate-50 shadow-md min-h-screen">
      {/* Header */}
      <header className="bg-blue-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push('/driver')}
            className="text-white hover:text-blue-200 text-sm font-semibold focus:outline-none"
          >
            ← Back
          </button>
          <h1 className="font-bold text-lg tracking-tight">My Trips History</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4">
        {errorMsg && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2.5 rounded-md text-xs mb-4 font-semibold text-center">
            {errorMsg}
          </div>
        )}

        {history.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-sm text-slate-400">
            No historical trip logs found.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((day) => {
              const isExpanded = expandedDate === day.date;
              return (
                <div
                  key={day.date}
                  onClick={() => toggleExpand(day.date)}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:border-slate-300 transition-colors cursor-pointer"
                >
                  {/* Summary Row */}
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        {formatDateString(day.date)}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Reported: {day.reportedCount} | Adjustments:{' '}
                        {day.adjustmentCount > 0 ? `+${day.adjustmentCount}` : day.adjustmentCount}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <span className="text-xs uppercase font-bold text-slate-400 block leading-none">
                          Verified
                        </span>
                        <span className="text-xl font-black text-blue-900 block mt-1">
                          {day.verifiedCount}
                        </span>
                      </div>
                      <span className="text-slate-300 text-sm font-bold">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-100 p-4 space-y-4">
                      {/* Trips Detail */}
                      <div>
                        <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">
                          Logged Trips Activity
                        </h4>
                        {day.trips.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No direct reported trips recorded.</p>
                        ) : (
                          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                            {[...day.trips]
                              .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
                              .map((trip, idx) => {
                                const date = new Date(trip.completedAt);
                                const timeStr = date.toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                });
                                const shift = getShiftInfo(date);
                                return (
                                  <div key={trip.id} className="px-3 py-2 flex justify-between items-center text-xs">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-800">Trip Completed {idx + 1}</span>
                                      <span className="text-[10px] text-slate-400 font-medium">Time: {timeStr}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200">
                                        {shift.shiftLabel}
                                      </span>
                                      <span className="text-slate-500 uppercase font-bold text-[10px]">{trip.vehicleNumber}</span>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      {/* Adjustments Detail */}
                      {day.adjustments.length > 0 && (
                        <div>
                          <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">
                            Admin Adjustments
                          </h4>
                          <div className="space-y-2">
                            {day.adjustments.map((adj) => (
                              <div
                                key={adj.id}
                                className="bg-white rounded-lg border border-slate-200 p-3 space-y-2 text-xs"
                              >
                                <div className="flex justify-between items-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      adj.adjustment > 0
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {adj.adjustment > 0 ? `+${adj.adjustment}` : adj.adjustment} trips
                                  </span>
                                  <span className="text-slate-400 text-[10px]">
                                    By {adj.adminName}
                                  </span>
                                </div>
                                <p className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 italic">
                                  "{adj.reason}"
                                </p>
                                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                                  {adj.acknowledgedAt ? (
                                    <span className="text-emerald-600 font-semibold text-[10px] flex items-center">
                                      ✓ Acknowledged
                                    </span>
                                  ) : (
                                    <button
                                      disabled={ackLoading === adj.id}
                                      onClick={(e) => handleAcknowledge(adj.id, e)}
                                      className="bg-blue-900 hover:bg-blue-800 text-white text-[10px] px-3 py-1 rounded font-bold shadow-sm transition-colors"
                                    >
                                      {ackLoading === adj.id ? 'Loading...' : 'I Understand'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
          className="flex flex-col items-center text-slate-400 text-xs font-semibold"
        >
          <span className="text-lg">📊</span>
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => loadHistory()}
          className="flex flex-col items-center text-blue-900 font-bold text-xs"
        >
          <span className="text-lg">📅</span>
          <span>My Trips</span>
        </button>
        <button
          onClick={() => router.push('/driver/diesel')}
          className="flex flex-col items-center text-slate-400 hover:text-blue-900 text-xs font-semibold"
        >
          <span className="text-lg">⛽</span>
          <span>Diesel</span>
        </button>
        <button
          onClick={() => router.push('/driver/notifications')}
          className="flex flex-col items-center text-slate-400 text-xs font-semibold"
        >
          <span className="text-lg">🔔</span>
          <span>Notifications</span>
        </button>
      </footer>
    </div>
  );
}
