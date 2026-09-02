'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface VehicleStat {
  id: string;
  vehicleNumber: string;
  status: string;
  reportedCount: number;
  adjustmentTotal: number;
  verifiedCount: number;
  verificationStatus: string;
  driver1: { name: string; reportedCount: number } | null;
  driver2: { name: string; reportedCount: number } | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState('');
  const [vehicles, setVehicles] = useState<VehicleStat[]>([]);
  const [range, setRange] = useState('today'); // today, yesterday, week, month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      // Get profile
      const profRes = await fetch('/api/auth/me');
      if (!profRes.ok) {
        router.push('/login');
        return;
      }
      const profData = await profRes.json();
      setAdminName(profData.user.name);

      // Get vehicles stats
      let url = `/api/admin/vehicles?range=${range}`;
      if (range === 'custom') {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const statsRes = await fetch(url);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setVehicles(statsData.vehicles);
      }
    } catch (error) {
      console.error('Failed to load admin stats:', error);
      setErrorMsg('Failed to fetch vehicle dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (range !== 'custom') {
      loadData();
    }
  }, [range]);

  const handleCustomRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setErrorMsg('Please specify both Start Date and End Date.');
      return;
    }
    loadData();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-100 text-slate-800">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div>
          <h1 className="font-extrabold text-xl tracking-tight text-blue-400">TripCounter</h1>
          <p className="text-xs text-slate-400 font-semibold">Admin Panel • Hello, {adminName}</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
        >
          Logout
        </button>
      </header>

      {/* Toolbar / Filters */}
      <section className="bg-white border-b border-slate-200 px-6 py-4 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex bg-slate-100 p-1.5 rounded-lg border border-slate-200">
            {['today', 'yesterday', 'week', 'month', 'custom'].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${
                  range === r
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Range Picker */}
        {range === 'custom' && (
          <form onSubmit={handleCustomRangeSubmit} className="flex flex-wrap items-end gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-900 hover:bg-blue-800 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm"
            >
              Filter
            </button>
          </form>
        )}
      </section>

      {/* Main Grid */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {errorMsg && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2.5 rounded-lg text-xs font-semibold mb-6 text-center">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-slate-500 text-xs font-semibold">Loading stats...</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs shadow-sm font-semibold">
            No assigned vehicles found for your admin account.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => (
              <div
                key={v.id}
                onClick={() => router.push(`/admin/vehicle/${v.id}`)}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-sm transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Title Row */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                      {v.vehicleNumber}
                    </h3>
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          v.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : v.status === 'BREAKDOWN'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {v.status}
                      </span>
                      {range !== 'week' && range !== 'month' && range !== 'custom' && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            v.verificationStatus === 'VERIFIED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {v.verificationStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Count Stats Grid */}
                  <div className="grid grid-cols-3 gap-2.5 text-center bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">Reported</span>
                      <span className="text-base font-black text-slate-800 block mt-1">{v.reportedCount}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">Adjusted</span>
                      <span className="text-base font-black text-slate-800 block mt-1">
                        {v.adjustmentTotal > 0 ? `+${v.adjustmentTotal}` : v.adjustmentTotal}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none text-blue-900">Verified</span>
                      <span className="text-base font-black text-blue-900 block mt-1">{v.verifiedCount}</span>
                    </div>
                  </div>

                  {/* Driver List */}
                  <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Driver 1:</span>
                      <span className="font-semibold">
                        {v.driver1 ? `${v.driver1.name} (${v.driver1.reportedCount} trips)` : 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Driver 2:</span>
                      <span className="font-semibold">
                        {v.driver2 ? `${v.driver2.name} (${v.driver2.reportedCount} trips)` : 'Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end text-xs font-bold text-blue-900 uppercase">
                  Verify & Adjust →
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
