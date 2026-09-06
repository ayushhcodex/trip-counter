'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getQueuedTrips, saveQueuedTrip, removeQueuedTrips, OfflineTrip } from '@/lib/indexeddb';
import { getShiftInfo } from '@/lib/shifts';

interface TripItem {
  id: string;
  completedAt: string;
  isOffline?: boolean;
}

interface VehicleInfo {
  id: string;
  vehicleNumber: string;
  status: string;
  slot: number;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function DriverDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState('');
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [todayTrips, setTodayTrips] = useState<TripItem[]>([]);
  
  // Offline / sync states
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineTrip[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(false);

  const currentShift = getShiftInfo();

  // 1. Initial Load: Auth profile and today's trips
  const loadDashboardData = async () => {
    try {
      // Get profile info
      const profileRes = await fetch('/api/auth/me');
      if (!profileRes.ok) {
        router.push('/login');
        return;
      }
      const profileData = await profileRes.json();
      setDriverName(profileData.user.name);

      // Get vehicle and today's trips
      const tripsRes = await fetch('/api/trips');
      if (tripsRes.ok) {
        const tripsData = await tripsRes.json();
        if (tripsData.assigned) {
          setVehicle(tripsData.vehicle);
          
          // Merge local queued offline trips for this vehicle with backend trips
          const queued = await getQueuedTrips();
          setOfflineQueue(queued);
          
          const formattedQueued: TripItem[] = queued.map((q) => ({
            id: q.idempotencyKey,
            completedAt: q.completedAt,
            isOffline: true,
          }));

          setTodayTrips([...formattedQueued, ...tripsData.trips]);
        } else {
          setVehicle(null);
          setTodayTrips([]);
        }
      }

      // Check notifications
      const notifRes = await fetch('/api/notifications');
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const hasUnread = (notifData.notifications || []).some((n: any) => !n.readAt);
        setUnreadNotifications(hasUnread);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setErrorMsg('Failed to load connection data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Listen to network status change
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Synchronize IndexedDB queue with backend
  const triggerSync = async () => {
    const queued = await getQueuedTrips();
    if (queued.length === 0) return;

    try {
      const res = await fetch('/api/trips/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trips: queued }),
      });

      if (res.ok) {
        const result = await res.json();
        // Clear synced items from local db
        const keys = queued.map((q) => q.idempotencyKey);
        await removeQueuedTrips(keys);
        
        // Reload dashboard
        await loadDashboardData();
      }
    } catch (err) {
      console.error('Offline synchronization failed:', err);
    }
  };

  // 3. COMPLETE TRIP Action
  const handleCompleteTrip = async () => {
    if (!vehicle) return;
    setErrorMsg('');
    setSubmitting(true);

    const completedAt = new Date().toISOString();
    const idempotencyKey = generateUUID();

    if (!isOnline) {
      // Offline mode: log to IndexedDB
      try {
        const offlineTrip: OfflineTrip = { idempotencyKey, completedAt };
        await saveQueuedTrip(offlineTrip);
        
        const localTrip: TripItem = {
          id: idempotencyKey,
          completedAt,
          isOffline: true,
        };

        setTodayTrips((prev) => [localTrip, ...prev]);
        const updatedQueue = await getQueuedTrips();
        setOfflineQueue(updatedQueue);
      } catch (err) {
        console.error('Failed to log trip offline:', err);
        setErrorMsg('Failed to log trip locally.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Online mode: submit directly
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey, completedAt }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setErrorMsg(errorData.error || 'Failed to submit trip.');
        return;
      }

      const data = await res.json();
      if (data.success) {
        // Reload to get updated db values
        await loadDashboardData();
      }
    } catch (err) {
      console.error('Failed to submit trip:', err);
      // Fallback to offline queue if request failed due to sudden network loss
      try {
        const offlineTrip: OfflineTrip = { idempotencyKey, completedAt };
        await saveQueuedTrip(offlineTrip);
        setTodayTrips((prev) => [{ id: idempotencyKey, completedAt, isOffline: true }, ...prev]);
        const updatedQueue = await getQueuedTrips();
        setOfflineQueue(updatedQueue);
        setIsOnline(false);
      } catch (dbErr) {
        setErrorMsg('Network error and failed to write offline backup.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Logout Action
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading Dashboard...</p>
      </div>
    );
  }

  // Calculate last trip time format
  const getLastTripTime = () => {
    if (todayTrips.length === 0) return 'No trips today';
    const last = todayTrips[0];
    const date = new Date(last.completedAt);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full bg-slate-50 shadow-md min-h-screen">
      {/* Header */}
      <header className="bg-blue-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="font-bold text-lg tracking-tight">TripCounter</h1>
          <p className="text-xs text-blue-200">Driver Portal</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-blue-800 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-md font-semibold transition-colors"
        >
          Logout
        </button>
      </header>

      {/* Network & Warning Status Alerts */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-center text-xs py-1.5 font-semibold px-4">
          Offline Mode. Trips will queue locally and auto-sync when online.
        </div>
      )}
      {offlineQueue.length > 0 && isOnline && (
        <div className="bg-blue-600 text-white text-center text-xs py-1.5 font-semibold px-4 flex justify-between items-center">
          <span>Unsynced offline trips: {offlineQueue.length}</span>
          <button
            onClick={triggerSync}
            className="bg-white text-blue-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold"
          >
            Sync Now
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-6 flex flex-col items-center">
        {/* Welcome Block */}
        <div className="w-full text-center mb-4">
          <h2 className="text-xl font-bold text-slate-800">Welcome, {driverName}</h2>
          {vehicle ? (
            <div className="flex flex-col items-center mt-1 space-y-1">
              <p className="text-sm font-semibold text-slate-500">
                Vehicle: <span className="text-blue-900 uppercase font-extrabold">{vehicle.vehicleNumber}</span> (Slot {vehicle.slot})
              </p>
              <div className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-xs font-bold">
                <span>⏰ {currentShift.shiftName}</span>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 text-red-600 border border-red-200 rounded-md p-3 mt-2 text-xs font-semibold">
              No active vehicle assigned. You cannot report trips.
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="w-full bg-red-100 border border-red-300 text-red-700 px-4 py-2.5 rounded-md text-xs mb-4 font-semibold text-center">
            {errorMsg}
          </div>
        )}

        {/* Today's Count */}
        <div className="flex flex-col items-center justify-center my-4">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Today's Trips</span>
          <span className="text-7xl font-black text-slate-800 tracking-tighter my-2">
            {todayTrips.length}
          </span>
          <span className="text-xs text-slate-500 font-semibold">
            Last trip: {getLastTripTime()}
          </span>
        </div>

        {/* Complete Trip Button */}
        <div className="my-8">
          <button
            disabled={!vehicle || submitting}
            onClick={handleCompleteTrip}
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center text-center font-bold text-xl shadow-lg border-8 border-white transition-all transform active:scale-95 select-none focus:outline-none ${
              vehicle && !submitting
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-xl active:bg-blue-800'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed border-slate-200'
            }`}
          >
            <span>COMPLETE</span>
            <span className="text-sm tracking-wide mt-1">TRIP</span>
          </button>
        </div>

        {/* Recent Activity List */}
        <div className="w-full mt-4 flex-1">
          <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-3 text-left">
            Today's Logged Trips
          </h3>
          {todayTrips.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-100 p-6 text-center text-xs text-slate-400">
              No trips reported today.
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-100 max-h-56 overflow-y-auto shadow-sm">
              {[...todayTrips]
                .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
                .map((trip, idx) => {
                  const date = new Date(trip.completedAt);
                  const timeStr = date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  });
                  const shift = getShiftInfo(date);
                  return (
                    <div key={trip.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">
                          Trip Completed {idx + 1}
                        </span>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-medium">Time: {timeStr}</span>
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200">
                            {shift.shiftLabel}
                          </span>
                        </div>
                      </div>
                      {trip.isOffline ? (
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                          Queued
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                          Synced
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </main>

      {/* Driver Footer Navigation */}
      <footer className="bg-white border-t border-slate-200 flex justify-around py-2.5 sticky bottom-0 z-10">
        <button
          onClick={() => loadDashboardData()}
          className="flex flex-col items-center text-blue-900 font-bold text-xs"
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
          onClick={() => router.push('/driver/diesel')}
          className="flex flex-col items-center text-slate-500 hover:text-blue-900 text-xs font-semibold"
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
