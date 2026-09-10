'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getQueuedTrips, saveQueuedTrip, removeQueuedTrips, OfflineTrip } from '@/lib/indexeddb';
import { getShiftInfo } from '@/lib/shifts';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';
import SiteLoader from '@/components/SiteLoader';

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

interface DriverDashboardCache {
  driverName: string;
  vehicle: VehicleInfo | null;
  todayTrips: TripItem[];
  adjustmentsTotal: number;
  isVerified: boolean;
}

// In-memory instant cache for zero-delay tab switching
let cachedDashboardData: DriverDashboardCache | null = null;

export default function DriverDashboard() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState<boolean>(() => !cachedDashboardData);
  const [driverName, setDriverName] = useState<string>(() => cachedDashboardData?.driverName || '');
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(() => cachedDashboardData?.vehicle || null);
  const [todayTrips, setTodayTrips] = useState<TripItem[]>(() => cachedDashboardData?.todayTrips || []);
  const [adjustmentsTotal, setAdjustmentsTotal] = useState<number>(() => cachedDashboardData?.adjustmentsTotal || 0);
  const [isVerified, setIsVerified] = useState<boolean>(() => cachedDashboardData?.isVerified || false);
  
  // Offline / sync states
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineTrip[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(false);

  const currentShift = getShiftInfo();

  // 1. Initial Load: Auth profile and today's trips (Parallel & SWR)
  const loadDashboardData = async () => {
    try {
      // Execute all 3 API queries in parallel for instant speed
      const [profileRes, tripsRes, notifRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/trips'),
        fetch('/api/notifications')
      ]);

      if (profileRes.status === 401 || tripsRes.status === 401) {
        router.push('/login');
        return;
      }

      let newDriverName = driverName;
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        newDriverName = profileData.user.name;
        setDriverName(newDriverName);
      }

      if (tripsRes.ok) {
        const tripsData = await tripsRes.json();
        if (tripsData.assigned) {
          const assignedVehicle = tripsData.vehicle;
          const adjTotal = tripsData.adjustmentsTotal || 0;
          const verified = tripsData.isVerified || false;

          setVehicle(assignedVehicle);
          setAdjustmentsTotal(adjTotal);
          setIsVerified(verified);
          
          // Merge local queued offline trips for this vehicle with backend trips
          const queued = await getQueuedTrips();
          setOfflineQueue(queued);
          
          const formattedQueued: TripItem[] = queued.map((q) => ({
            id: q.idempotencyKey,
            completedAt: q.completedAt,
            isOffline: true,
          }));

          const mergedTrips = [...formattedQueued, ...tripsData.trips];
          setTodayTrips(mergedTrips);

          // Update instant cache for 0ms tab switching
          cachedDashboardData = {
            driverName: newDriverName,
            vehicle: assignedVehicle,
            todayTrips: mergedTrips,
            adjustmentsTotal: adjTotal,
            isVerified: verified,
          };
        } else {
          setVehicle(null);
          setTodayTrips([]);
          setAdjustmentsTotal(0);
          setIsVerified(false);

          cachedDashboardData = {
            driverName: newDriverName,
            vehicle: null,
            todayTrips: [],
            adjustmentsTotal: 0,
            isVerified: false,
          };
        }
      }

      // Check notifications
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const hasUnread = (notifData.notifications || []).some((n: any) => !n.readAt);
        setUnreadNotifications(hasUnread);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setErrorMsg(t('common.networkError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Live 5-second polling so supervisor adjustments & verification status update in real-time
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadDashboardData();
      }
    }, 5000);

    // Setup network status listeners
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Trigger sync of offline queue
  const triggerSync = async () => {
    try {
      const queue = await getQueuedTrips();
      if (queue.length === 0) return;

      const res = await fetch('/api/trips/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trips: queue }),
      });

      if (res.ok) {
        await removeQueuedTrips(queue.map((q) => q.idempotencyKey));
        const remaining = await getQueuedTrips();
        setOfflineQueue(remaining);
        // Refresh today's trips
        loadDashboardData();
      }
    } catch (error) {
      console.error('Offline sync failed:', error);
    }
  };

  // 3. Complete Trip Action
  const handleCompleteTrip = async () => {
    if (!vehicle || submitting) return;

    setErrorMsg('');
    setSubmitting(true);

    const completedAt = new Date().toISOString();
    const idempotencyKey = generateUUID();

    if (!isOnline) {
      // Offline mode: log to IndexedDB
      try {
        const offlineTrip: OfflineTrip = { idempotencyKey, completedAt };
        await saveQueuedTrip(offlineTrip);
        setTodayTrips((prev) => [{ id: idempotencyKey, completedAt, isOffline: true }, ...prev]);
        const updatedQueue = await getQueuedTrips();
        setOfflineQueue(updatedQueue);
      } catch (err) {
        setErrorMsg('Failed to save offline trip locally.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          completedAt,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTodayTrips((prev) => [data.trip, ...prev]);
      } else {
        setErrorMsg(data.error || 'Failed to complete trip.');
      }
    } catch (error) {
      console.error('Network failure, queueing trip locally:', error);
      // Fallback: network failure midway, queue in IndexedDB
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 min-h-screen">
        <SiteLoader />
      </div>
    );
  }

  // Calculate last trip time format
  const getLastTripTime = () => {
    if (todayTrips.length === 0) return t('driver.noTripsLogged');
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
      <header className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="font-black text-lg tracking-tight text-blue-400">{t('common.appName')}</h1>
          <p className="text-[11px] text-slate-400 font-semibold">{t('driver.portalTitle')}</p>
        </div>
        <div className="flex items-center space-x-2">
          <LanguageSelector variant="header" />
          <button
            onClick={handleLogout}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg font-bold transition-all"
          >
            {t('common.logout')}
          </button>
        </div>
      </header>

      {/* Network & Warning Status Alerts */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-center text-xs py-1.5 font-semibold px-4">
          {t('driver.offlineModeNotice')}
        </div>
      )}
      {offlineQueue.length > 0 && isOnline && (
        <div className="bg-blue-600 text-white text-center text-xs py-1.5 font-semibold px-4 flex justify-between items-center">
          <span>{offlineQueue.length} {t('driver.queuedTripsCount')}</span>
          <button
            onClick={triggerSync}
            className="bg-white text-blue-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold"
          >
            {t('common.syncing')}
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-5 flex flex-col items-center">
        {/* Vehicle & Driver Header Card */}
        <div className="w-full text-center mb-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          {vehicle ? (
            <>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {t('driver.assignedVehicle')}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-blue-950 uppercase tracking-tight flex items-center justify-center gap-2 mt-0.5">
                  <span className="text-2xl">🚛</span>
                  <span>{vehicle.vehicleNumber}</span>
                </h2>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                  👤 Driver: <strong className="text-slate-900">{driverName}</strong> ({vehicle.slot === 1 ? t('common.slot1') : t('common.slot2')})
                </span>
                <span className="text-xs font-bold text-blue-900 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  ⏰ {currentShift.shiftNumber === 1 ? t('common.dayShift') : t('common.nightShift')}
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Assigned Driver
              </span>
              <h2 className="text-xl font-black text-slate-800 flex items-center justify-center gap-1.5">
                <span>👤</span> {driverName}
              </h2>
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-xs font-semibold">
                <p className="font-bold">{t('driver.noVehicleAssigned')}</p>
                <p className="mt-0.5 text-slate-600">{t('driver.contactAdmin')}</p>
              </div>
            </>
          )}
        </div>

        {errorMsg && (
          <div className="w-full bg-red-100 border border-red-300 text-red-700 px-4 py-2.5 rounded-lg text-xs mb-4 font-semibold text-center">
            {errorMsg}
          </div>
        )}

        {/* Today's Net Count Card */}
        {(() => {
          const netTripCount = Math.max(0, todayTrips.length + adjustmentsTotal);
          return (
            <div className={`w-full max-w-xs rounded-3xl p-5 my-3 flex flex-col items-center justify-center transition-all border shadow-sm ${
              isVerified
                ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white border-emerald-500 shadow-emerald-200 ring-4 ring-emerald-100'
                : 'bg-white text-slate-800 border-slate-200'
            }`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-xs uppercase font-extrabold tracking-wider ${isVerified ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {t('driver.todaysTrips')}
                </span>
              </div>

              <span className={`text-7xl font-black tracking-tighter my-1 ${isVerified ? 'text-white' : 'text-slate-900'}`}>
                {netTripCount}
              </span>

              {/* Verification Status Badge */}
              {isVerified ? (
                <div className="mt-2 bg-white/20 backdrop-blur-md text-white px-3.5 py-1 rounded-full font-extrabold text-xs flex items-center gap-1.5 border border-white/30 shadow-xs">
                  <svg className="w-4 h-4 text-emerald-200" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{t('admin.verifiedBadge')}</span>
                </div>
              ) : (
                <span className="text-xs text-slate-500 font-semibold mt-1">
                  {getLastTripTime()}
                </span>
              )}

              {/* Supervisor Adjustments Indicator */}
              {adjustmentsTotal !== 0 && (
                <div className={`mt-2.5 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                  isVerified 
                    ? 'bg-emerald-800/60 text-emerald-100 border border-emerald-400/40' 
                    : adjustmentsTotal > 0 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  <span>⚡</span> Admin Adjustment: {adjustmentsTotal > 0 ? `+${adjustmentsTotal}` : adjustmentsTotal}
                </div>
              )}
            </div>
          );
        })()}

        {/* Complete Trip Button */}
        <div className="my-6">
          <button
            disabled={!vehicle || submitting}
            onClick={handleCompleteTrip}
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center text-center font-black text-lg sm:text-xl shadow-xl border-8 border-white transition-all transform active:scale-95 select-none focus:outline-none ${
              vehicle && !submitting
                ? 'bg-blue-900 hover:bg-blue-800 text-white hover:shadow-2xl active:bg-blue-950'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed border-slate-200'
            }`}
          >
            <span className="leading-tight px-4">{t('driver.completeTripBtn')}</span>
          </button>
        </div>

        {/* Recent Activity List */}
        <div className="w-full mt-2 flex-1">
          <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2.5 text-left">
            {t('driver.todaysTrips')}
          </h3>
          {todayTrips.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-400 font-semibold">
              {t('driver.noTripsLogged')}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-56 overflow-y-auto shadow-sm">
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
                          {t('driver.tripNumber')} #{idx + 1}
                        </span>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-medium">{timeStr}</span>
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200">
                            {shift.shiftNumber === 1 ? t('common.slot1') : t('common.slot2')}
                          </span>
                        </div>
                      </div>
                      {trip.isOffline ? (
                        <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
                          {t('common.offline')}
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
                          {t('common.verified')}
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
          onClick={() => router.push('/driver/notifications')}
          className="flex flex-col items-center text-slate-500 hover:text-blue-900 text-xs font-semibold relative"
        >
          {unreadNotifications && (
            <span className="absolute top-0.5 right-4 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
          )}
          <span className="text-lg">🔔</span>
          <span>{t('nav.notifications')}</span>
        </button>
      </footer>
    </div>
  );
}
