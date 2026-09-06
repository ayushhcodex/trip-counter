'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface UserProfile {
  name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'SUPER_ADMIN';
}

interface Trip {
  id: string;
  driverId: string;
  driverName: string;
  completedAt: string;
  shift: string;
}

interface Vehicle {
  id: string;
  vehicleNumber: string;
  status: 'ACTIVE' | 'BREAKDOWN' | 'INACTIVE';
  reportedCount: number;
  adjustmentTotal: number;
  verifiedCount: number;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED';
  driver1: { id: string; name: string; reportedCount: number } | null;
  driver2: { id: string; name: string; reportedCount: number } | null;
  trips: Trip[];
}

interface VehiclesResponse {
  success: boolean;
  dateRange: { start: string; end: string };
  vehicles: Vehicle[];
}

type DateRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export default function AdminDashboard() {
  const router = useRouter();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<DateRange>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dateRangeInfo, setDateRangeInfo] = useState<{ start: string; end: string } | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);

  // Quick Inline Trip Adjustment States
  const [activeAdjustVehicleId, setActiveAdjustVehicleId] = useState<string | null>(null);
  const [adjDriverId, setAdjDriverId] = useState<string>('');
  const [adjType, setAdjType] = useState<'add' | 'remove'>('add');
  const [adjAmount, setAdjAmount] = useState<string>('1');
  const [adjReason, setAdjReason] = useState<string>('');
  const [isSubmittingAdj, setIsSubmittingAdj] = useState<boolean>(false);
  const [adjStatusMessage, setAdjStatusMessage] = useState<{ type: 'success' | 'error'; text: string; vehicleId: string } | null>(null);

  const cacheRef = useRef<Record<string, VehiclesResponse>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);


  const getCacheKey = useCallback((tab: DateRange, start: string, end: string) => {
    return tab === 'custom' ? `${tab}-${start}-${end}` : tab;
  }, []);

  const fetchVehicles = useCallback(async (
    tab: DateRange, 
    start: string, 
    end: string, 
    isBackground: boolean = false
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const cacheKey = getCacheKey(tab, start, end);
    const cachedData = cacheRef.current[cacheKey];

    if (cachedData && !isBackground) {
      setVehicles(cachedData.vehicles);
      setDateRangeInfo(cachedData.dateRange);
      setIsLoading(false);
      setIsRefreshing(true);
    } else if (!isBackground) {
      setIsLoading(true);
      setIsRefreshing(false);
    }

    try {
      let url = `/api/admin/vehicles?range=${tab}&_t=${Date.now()}`;
      if (tab === 'custom' && start && end) {
        url += `&startDate=${start}&endDate=${end}`;
      } else if (tab === 'custom') {
        setIsLoading(false);
        setIsRefreshing(false);
        return; // Don't fetch if custom range is incomplete
      }

      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to fetch vehicles');
      
      const data: VehiclesResponse = await res.json();
      
      cacheRef.current[cacheKey] = data;
      setVehicles(data.vehicles);
      setDateRangeInfo(data.dateRange);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Fetch vehicles error:', err);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [getCacheKey]);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.user) {
          setUserProfile(data.user);
        }
      })
      .catch((err) => console.error('Failed to fetch profile', err));
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        fetchVehicles(activeTab, customStartDate, customEndDate, false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [activeTab, customStartDate, customEndDate, fetchVehicles]);

  useEffect(() => {
    if (activeTab === 'custom') {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
      return;
    }

    pollingTimerRef.current = setInterval(() => {
      fetchVehicles(activeTab, customStartDate, customEndDate, true);
    }, 5000);

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [activeTab, customStartDate, customEndDate, fetchVehicles]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchVehicles(activeTab, customStartDate, customEndDate, true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTab, customStartDate, customEndDate, fetchVehicles]);

  const handleTabChange = useCallback((tab: DateRange) => {
    setActiveTab(tab);
    setExpandedVehicleId(null);
  }, []);

  const handleCustomFilter = useCallback(() => {
    if (customStartDate && customEndDate) {
      fetchVehicles('custom', customStartDate, customEndDate, false);
    }
  }, [customStartDate, customEndDate, fetchVehicles]);

  const handleVerify = useCallback(async (vehicleId: string) => {
    if (!dateRangeInfo) return;
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, date: dateRangeInfo.start })
      });
      if (res.ok) {
        // Refresh silently
        fetchVehicles(activeTab, customStartDate, customEndDate, true);
      }
    } catch (err) {
      console.error('Failed to verify', err);
    }
  }, [dateRangeInfo, activeTab, customStartDate, customEndDate, fetchVehicles]);

  const toggleAdjustForm = useCallback((vehicle: Vehicle) => {
    setActiveAdjustVehicleId((prev) => {
      if (prev === vehicle.id) {
        setAdjStatusMessage(null);
        return null;
      }
      setAdjDriverId(vehicle.driver1?.id || vehicle.driver2?.id || '');
      setAdjType('add');
      setAdjAmount('1');
      setAdjReason('');
      setAdjStatusMessage(null);
      return vehicle.id;
    });
  }, []);

  const handleApplyAdjustment = useCallback(async (e: React.FormEvent, vehicleId: string) => {
    e.preventDefault();
    if (!dateRangeInfo) return;
    if (!adjDriverId) {
      setAdjStatusMessage({ type: 'error', text: 'Please select a driver to adjust.', vehicleId });
      return;
    }
    if (!adjReason.trim()) {
      setAdjStatusMessage({ type: 'error', text: 'Please provide a mandatory reason for adjustment.', vehicleId });
      return;
    }

    setIsSubmittingAdj(true);
    setAdjStatusMessage(null);

    const amountVal = parseInt(adjAmount, 10) || 1;
    const finalAmount = adjType === 'add' ? amountVal : -amountVal;

    try {
      const res = await fetch('/api/admin/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          date: dateRangeInfo.start,
          driverId: adjDriverId,
          adjustment: finalAmount,
          reason: adjReason.trim(),
        }),
      });

      if (res.ok) {
        setAdjStatusMessage({ type: 'success', text: `Adjustment of ${finalAmount > 0 ? '+' : ''}${finalAmount} applied! Driver notified.`, vehicleId });
        setAdjReason('');
        // Refresh live stats
        fetchVehicles(activeTab, customStartDate, customEndDate, true);
      } else {
        const err = await res.json();
        setAdjStatusMessage({ type: 'error', text: err.error || 'Failed to apply adjustment.', vehicleId });
      }
    } catch {
      setAdjStatusMessage({ type: 'error', text: 'Network error. Try again.', vehicleId });
    } finally {
      setIsSubmittingAdj(false);
    }
  }, [dateRangeInfo, adjDriverId, adjReason, adjAmount, adjType, activeTab, customStartDate, customEndDate, fetchVehicles]);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }, [router]);

  const formatTime = useCallback((isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const filteredVehicles = vehicles.filter(v => 
    v.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.driver1?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.driver2?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSingleDay = activeTab === 'today' || activeTab === 'yesterday';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-black text-slate-900 tracking-tight">TripCounter</h1>
          {userProfile && (
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                userProfile.role === 'SUPERVISOR' ? 'bg-amber-100 text-amber-800' :
                userProfile.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {userProfile.role.replace('_', ' ')}
              </span>
              <span className="text-xs text-slate-500 font-semibold truncate max-w-[100px]">
                {userProfile.name}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              Live: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <button 
            onClick={handleLogout}
            className="text-xs font-bold text-red-600 active:text-red-800 py-1"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="sticky top-[68px] z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex overflow-x-auto hide-scrollbar px-2 py-2 gap-2">
          {['today', 'yesterday', 'week', 'month', 'custom'].map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab as DateRange)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                activeTab === tab 
                  ? 'bg-blue-900 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-600 active:bg-slate-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        {(isLoading || isRefreshing) && (
          <div className="h-0.5 w-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-1/3 rounded-r-full"></div>
          </div>
        )}
      </div>

      <main className="flex-1 p-4 pb-20 max-w-lg mx-auto w-full">
        
        {/* Custom Range Selector */}
        {activeTab === 'custom' && (
          <div className="mb-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Start</label>
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">End</label>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold"
                />
              </div>
              <button 
                onClick={handleCustomFilter}
                className="bg-blue-900 text-white rounded-lg p-2 px-4 font-bold text-sm h-[38px] active:scale-95 transition-transform"
              >
                Go
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-4 relative">
          <input 
            type="text" 
            placeholder="Search vehicle or driver..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-4 shadow-sm text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Vehicle List */}
        {isLoading && !isRefreshing && vehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-900 rounded-full animate-spin"></div>
            <p className="mt-4 text-sm font-semibold text-slate-500">Loading vehicles...</p>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 font-semibold">No assigned vehicles found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredVehicles.map(vehicle => {
              const isExpanded = expandedVehicleId === vehicle.id;
              
              const driversText = [
                vehicle.driver1?.name,
                vehicle.driver2?.name
              ].filter(Boolean).join(' & ') || 'Unassigned';

              const statusColor = 
                vehicle.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                vehicle.status === 'BREAKDOWN' ? 'bg-amber-100 text-amber-800' :
                'bg-slate-100 text-slate-800';

              return (
                <div key={vehicle.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  {/* Strip Header (Clickable) */}
                  <div 
                    onClick={() => setExpandedVehicleId(isExpanded ? null : vehicle.id)}
                    className="p-4 flex items-center justify-between cursor-pointer active:bg-slate-50 transition-colors"
                  >
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight truncate">
                          {vehicle.vehicleNumber}
                        </h2>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                          {vehicle.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold truncate">
                        {driversText}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-800 to-blue-950 shadow-inner flex-shrink-0 ml-3">
                      <span className="text-xl font-black text-white">{vehicle.reportedCount}</span>
                    </div>
                  </div>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50 pt-3">
                      
                      {/* Summary Row */}
                      <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                        <div className="text-center">
                          <div className="text-[10px] uppercase font-bold text-slate-400">Reported</div>
                          <div className="text-lg font-black text-slate-800">{vehicle.reportedCount}</div>
                        </div>
                        <div className="w-px h-8 bg-slate-200"></div>
                        <div className="text-center">
                          <div className="text-[10px] uppercase font-bold text-slate-400">Adjusted</div>
                          <div className="text-lg font-black text-slate-800">{vehicle.adjustmentTotal}</div>
                        </div>
                        <div className="w-px h-8 bg-slate-200"></div>
                        <div className="text-center">
                          <div className="text-[10px] uppercase font-bold text-slate-400">Verified</div>
                          <div className="text-lg font-black text-slate-800">{vehicle.verifiedCount}</div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2 mb-4">
                        {isSingleDay && vehicle.verificationStatus !== 'VERIFIED' && (
                          <button
                            onClick={() => handleVerify(vehicle.id)}
                            className="w-full bg-emerald-600 active:bg-emerald-700 text-white py-2.5 rounded-xl font-bold shadow-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            Verify Today&apos;s Trips
                          </button>
                        )}

                        {vehicle.verificationStatus === 'VERIFIED' && isSingleDay && (
                          <div className="w-full bg-emerald-50 text-emerald-700 py-2 rounded-xl font-bold flex items-center justify-center gap-2 border border-emerald-200 text-xs">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                            Verified
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => toggleAdjustForm(vehicle)}
                            className={`py-2 px-3 rounded-xl font-bold shadow-xs transition-transform active:scale-[0.98] flex items-center justify-center gap-1.5 text-xs ${
                              activeAdjustVehicleId === vehicle.id
                                ? 'bg-blue-900 text-white'
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200'
                            }`}
                          >
                            <span>⚡</span> {activeAdjustVehicleId === vehicle.id ? 'Close Adjust' : 'Adjust Trips (+/-)'}
                          </button>

                          <button
                            onClick={() => router.push(`/admin/vehicle/${vehicle.id}`)}
                            className="bg-slate-800 active:bg-slate-900 text-white py-2 px-3 rounded-xl font-bold shadow-xs transition-transform active:scale-[0.98] flex items-center justify-center gap-1.5 text-xs"
                          >
                            <span>⛽</span> Fuel & Details →
                          </button>
                        </div>
                      </div>

                      {/* Inline Quick Adjustment Form */}
                      {activeAdjustVehicleId === vehicle.id && (
                        <div className="mb-4 bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <h4 className="font-extrabold text-xs text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                              <span>⚡</span> Adjust Trip Count
                            </h4>
                            <span className="text-[10px] text-slate-400 font-semibold">{dateRangeInfo?.start}</span>
                          </div>

                          {adjStatusMessage && adjStatusMessage.vehicleId === vehicle.id && (
                            <div className={`p-2 rounded-lg text-xs font-semibold text-center ${
                              adjStatusMessage.type === 'success'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : 'bg-red-50 border border-red-200 text-red-700'
                            }`}>
                              {adjStatusMessage.text}
                            </div>
                          )}

                          <form onSubmit={(e) => handleApplyAdjustment(e, vehicle.id)} className="space-y-2.5 text-xs">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Target Driver</label>
                              <select
                                value={adjDriverId}
                                onChange={(e) => setAdjDriverId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-semibold"
                                required
                              >
                                <option value="">Select Driver</option>
                                {vehicle.driver1 && <option value={vehicle.driver1.id}>Slot 1: {vehicle.driver1.name} ({vehicle.driver1.reportedCount} trips)</option>}
                                {vehicle.driver2 && <option value={vehicle.driver2.id}>Slot 2: {vehicle.driver2.name} ({vehicle.driver2.reportedCount} trips)</option>}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Type</label>
                                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg">
                                  <button
                                    type="button"
                                    onClick={() => setAdjType('add')}
                                    className={`py-1 rounded text-center text-xs font-bold transition-all ${
                                      adjType === 'add' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'
                                    }`}
                                  >
                                    + Add
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAdjType('remove')}
                                    className={`py-1 rounded text-center text-xs font-bold transition-all ${
                                      adjType === 'remove' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-500'
                                    }`}
                                  >
                                    - Remove
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Trips</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="50"
                                  value={adjAmount}
                                  onChange={(e) => setAdjAmount(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 font-bold"
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Mandatory Reason</label>
                              <input
                                type="text"
                                placeholder="e.g. Duplicate report detected or missed logging"
                                value={adjReason}
                                onChange={(e) => setAdjReason(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700"
                                required
                              />
                            </div>

                            <div className="flex gap-2 pt-1">
                              <button
                                type="submit"
                                disabled={isSubmittingAdj || !adjDriverId}
                                className="flex-1 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg py-2 font-bold uppercase shadow-xs transition-all text-xs"
                              >
                                {isSubmittingAdj ? 'Applying...' : `Apply ${adjType === 'add' ? '+' : '-'}${adjAmount || '1'} Trips`}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveAdjustVehicleId(null)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-3 py-2 font-bold text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {/* Driver Breakdown */}
                      <div className="mb-4 bg-white p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="font-semibold text-[11px]">Slot 1: {vehicle.driver1 ? vehicle.driver1.name : 'Unassigned'}</span>
                          <span className="font-black text-slate-800">{vehicle.driver1 ? vehicle.driver1.reportedCount : 0} trips</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600 border-t border-slate-50 pt-1">
                          <span className="font-semibold text-[11px]">Slot 2: {vehicle.driver2 ? vehicle.driver2.name : 'Unassigned'}</span>
                          <span className="font-black text-slate-800">{vehicle.driver2 ? vehicle.driver2.reportedCount : 0} trips</span>
                        </div>
                      </div>

                      {/* Trips List */}
                      <div>
                        <h3 className="text-xs font-bold uppercase text-slate-500 mb-2 px-1">Trip History</h3>
                        {vehicle.trips.length === 0 ? (
                          <div className="bg-white p-4 rounded-xl border border-slate-100 text-center text-sm font-semibold text-slate-400">
                            No trips recorded
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {vehicle.trips.map((trip, idx) => (
                              <div key={trip.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                                <div className="bg-slate-100 w-8 h-8 rounded-lg flex items-center justify-center font-black text-slate-600 text-sm flex-shrink-0">
                                  #{idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-800 text-sm truncate">{trip.driverName}</span>
                                    <span className="text-xs font-semibold text-slate-500 flex-shrink-0">
                                      {formatTime(trip.completedAt)}
                                    </span>
                                  </div>
                                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    trip.shift.includes('1') ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                  }`}>
                                    {trip.shift}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      
      {/* Global Styles for hide-scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
