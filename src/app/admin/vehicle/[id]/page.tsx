'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getLocalDateString } from '@/lib/timezone';

interface DriverInfo {
  id: string;
  name: string;
  reportedCount: number;
}

interface VehicleDetails {
  id: string;
  vehicleNumber: string;
  status: string;
  reportedCount: number;
  adjustmentTotal: number;
  verifiedCount: number;
  verificationStatus: string;
  driver1: DriverInfo | null;
  driver2: DriverInfo | null;
}

interface AdjustmentItem {
  id: string;
  adjustment: number;
  reason: string;
  adminName: string;
  createdAt: string;
  driverId: string;
}

export default function VehicleDetailPage(props: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: vehicleId } = use(props.params);

  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [adjustments, setAdjustments] = useState<AdjustmentItem[]>([]);
  
  const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()));
  const [errorMsg, setErrorMsg] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Form states for adding adjustment
  const [targetDriverId, setTargetDriverId] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('1');
  const [adjustmentType, setAdjustmentType] = useState('add'); // add (+), remove (-)
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [submittingAdj, setSubmittingAdj] = useState(false);
  const [submittingVerify, setSubmittingVerify] = useState(false);

  const loadVehicleDetails = async () => {
    setLoading(true);
    try {
      // Fetch stats for this vehicle on the selected date
      const statsRes = await fetch(`/api/admin/vehicles?range=custom&startDate=${selectedDate}&endDate=${selectedDate}`);
      if (statsRes.ok) {
        const data = await statsRes.json();
        const found = data.vehicles.find((v: any) => v.id === vehicleId);
        if (found) {
          setVehicle(found);
          // Set default driver selection to driver 1 if available
          if (found.driver1 && !targetDriverId) {
            setTargetDriverId(found.driver1.id);
          } else if (found.driver2 && !targetDriverId) {
            setTargetDriverId(found.driver2.id);
          }
        } else {
          setErrorMsg('Vehicle not assigned to you or does not exist.');
        }
      }

      // Fetch adjustments for this vehicle on this date
      const historyRes = await fetch(`/api/trips/history`); // Helper query or fallback list
      // To get adjustments specifically for this vehicle/date, we query notifications or fetch from list
      // Let's call our main history or query adjustments directly
      // Since we don't have a direct admin adjustments endpoint, let's build it or fetch from vehicles api if we add it there.
      // Wait, we can fetch all adjustments by querying users or from notifications, but actually let's implement a direct query:
      // Let's make an API call to get adjustments for this vehicle & date. Let's fetch all adjustments
      // Or we can just build a small API endpoint for it. But wait, we can also retrieve it directly!
      // Let's create an API route /api/admin/adjustments?vehicleId=...&date=... or we can fetch it as part of vehicles statistics.
      // Actually, let's fetch adjustments via a simple query we can perform inside /api/admin/vehicles or build a small adjustments fetch endpoint.
      // Wait, we can modify our /api/admin/vehicles route or create a simple route `/api/admin/adjustments` which returns adjustments.
      // Let's create `/api/admin/adjustments` endpoint! It will make the detail page 100% clean and correct.
      // Let's query `/api/admin/adjustments?vehicleId=...&date=...`.
      const adjRes = await fetch(`/api/admin/adjustments?vehicleId=${vehicleId}&date=${selectedDate}`);
      if (adjRes.ok) {
        const adjData = await adjRes.json();
        setAdjustments(adjData.adjustments || []);
      }
    } catch (error) {
      console.error('Failed to load vehicle details:', error);
      setErrorMsg('Failed to retrieve vehicle details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicleDetails();
  }, [selectedDate]);

  // Handle trip count verification
  const handleVerify = async () => {
    setErrorMsg('');
    setActionSuccess('');
    setSubmittingVerify(true);

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, date: selectedDate }),
      });

      if (res.ok) {
        setActionSuccess('Daily trip count verified successfully.');
        await loadVehicleDetails();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to verify trip count.');
      }
    } catch (error) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSubmittingVerify(false);
    }
  };

  // Handle adjustment submission
  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setActionSuccess('');

    if (!targetDriverId) {
      setErrorMsg('Please select a driver to adjust.');
      return;
    }
    if (!adjustmentReason.trim()) {
      setErrorMsg('Please provide a mandatory reason for adjustment.');
      return;
    }

    setSubmittingAdj(true);
    const amountVal = parseInt(adjustmentAmount, 10);
    const finalAmount = adjustmentType === 'add' ? amountVal : -amountVal;

    try {
      const res = await fetch('/api/admin/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          date: selectedDate,
          driverId: targetDriverId,
          adjustment: finalAmount,
          reason: adjustmentReason,
        }),
      });

      if (res.ok) {
        setActionSuccess('Trip count adjusted successfully. Notification sent to driver.');
        setAdjustmentReason('');
        await loadVehicleDetails();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to apply adjustment.');
      }
    } catch (error) {
      setErrorMsg('Network error. Try again.');
    } finally {
      setSubmittingAdj(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-100 text-slate-800">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push('/admin')}
            className="text-slate-300 hover:text-white text-sm font-bold focus:outline-none"
          >
            ← Dashboard
          </button>
          <h1 className="font-extrabold text-lg tracking-tight uppercase">
            {vehicle ? vehicle.vehicleNumber : 'Vehicle Details'}
          </h1>
        </div>
      </header>

      {/* Date selector toolbar */}
      <section className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="text-xs uppercase font-black text-slate-400">Target Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 font-semibold focus:outline-none focus:border-blue-600 focus:bg-white"
          />
        </div>
        
        {vehicle && (
          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 rounded text-xs font-black uppercase ${
                vehicle.verificationStatus === 'VERIFIED'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              Status: {vehicle.verificationStatus}
            </span>
          </div>
        )}
      </section>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full grid gap-6 md:grid-cols-3">
        {errorMsg && (
          <div className="md:col-span-3 bg-red-100 border border-red-300 text-red-700 px-4 py-2.5 rounded-lg text-xs font-semibold text-center">
            {errorMsg}
          </div>
        )}

        {actionSuccess && (
          <div className="md:col-span-3 bg-emerald-100 border border-emerald-300 text-emerald-700 px-4 py-2.5 rounded-lg text-xs font-semibold text-center">
            {actionSuccess}
          </div>
        )}

        {loading ? (
          <div className="md:col-span-3 flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-slate-500 text-xs font-semibold">Loading data...</p>
          </div>
        ) : !vehicle ? (
          <div className="md:col-span-3 text-center py-12 text-slate-400 text-xs font-semibold">
            Vehicle info not found.
          </div>
        ) : (
          <>
            {/* Column 1 & 2: Stats & Verification */}
            <div className="md:col-span-2 space-y-6">
              {/* Daily Stats Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
                <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-3 uppercase tracking-wider text-slate-400">
                  Daily Verification Summary
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 text-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Driver Reported</span>
                    <span className="text-4xl font-black text-slate-800 block mt-2">{vehicle.reportedCount}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 text-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Final Verified</span>
                    <span className="text-4xl font-black text-blue-900 block mt-2">{vehicle.verifiedCount}</span>
                  </div>
                </div>

                {/* Driver contributions */}
                <div className="space-y-3.5 border-t border-slate-100 pt-5">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400">
                    Individual Driver Submissions
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                      <span className="font-bold text-slate-700">Slot 1: {vehicle.driver1 ? vehicle.driver1.name : 'Unassigned'}</span>
                      <span className="font-black text-slate-800">{vehicle.driver1 ? vehicle.driver1.reportedCount : 0} trips</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                      <span className="font-bold text-slate-700">Slot 2: {vehicle.driver2 ? vehicle.driver2.name : 'Unassigned'}</span>
                      <span className="font-black text-slate-800">{vehicle.driver2 ? vehicle.driver2.reportedCount : 0} trips</span>
                    </div>
                  </div>
                </div>

                {/* Verification Control */}
                <div className="border-t border-slate-100 pt-5 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-semibold">
                    Ensure counts match before verifying.
                  </span>
                  <button
                    disabled={vehicle.verificationStatus === 'VERIFIED' || submittingVerify}
                    onClick={handleVerify}
                    className={`px-6 py-2.5 rounded-lg text-xs font-bold shadow-md transition-all uppercase ${
                      vehicle.verificationStatus === 'VERIFIED'
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-blue-900 hover:bg-blue-800 text-white hover:shadow-lg'
                    }`}
                  >
                    {submittingVerify ? 'Verifying...' : vehicle.verificationStatus === 'VERIFIED' ? 'Verified' : 'Verify Count'}
                  </button>
                </div>
              </div>

              {/* Adjustments History */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-3 uppercase tracking-wider text-slate-400">
                  Adjustment logs
                </h3>
                {adjustments.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-4 font-semibold">
                    No adjustments applied on this date.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {adjustments.map((adj) => {
                      const driverName =
                        vehicle.driver1 && vehicle.driver1.id === adj.driverId
                          ? vehicle.driver1.name
                          : vehicle.driver2 && vehicle.driver2.id === adj.driverId
                          ? vehicle.driver2.name
                          : 'Driver';

                      return (
                        <div
                          key={adj.id}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
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
                          <p className="text-slate-600 bg-white p-2.5 rounded border border-slate-200 italic">
                            "{adj.reason}"
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold">
                            Affected Driver: {driverName}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Adjustment Control Panel */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-3 uppercase tracking-wider text-slate-400">
                  Adjust Trip Count
                </h3>

                <form onSubmit={handleAddAdjustment} className="space-y-4 text-xs">
                  <div>
                    <label className="block uppercase font-bold text-slate-400 mb-1">Target Driver</label>
                    <select
                      value={targetDriverId}
                      onChange={(e) => setTargetDriverId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 font-semibold"
                    >
                      <option value="">Select Driver</option>
                      {vehicle.driver1 && <option value={vehicle.driver1.id}>{vehicle.driver1.name}</option>}
                      {vehicle.driver2 && <option value={vehicle.driver2.id}>{vehicle.driver2.name}</option>}
                    </select>
                  </div>

                  <div>
                    <label className="block uppercase font-bold text-slate-400 mb-1">Type</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setAdjustmentType('add')}
                        className={`py-1.5 rounded-md text-center font-bold transition-all ${
                          adjustmentType === 'add' ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        Add (+)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustmentType('remove')}
                        className={`py-1.5 rounded-md text-center font-bold transition-all ${
                          adjustmentType === 'remove' ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        Remove (-)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block uppercase font-bold text-slate-400 mb-1">Quantity (Trips)</label>
                    <input
                      type="number"
                      min="1"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block uppercase font-bold text-slate-400 mb-1">Reason for Adjustment</label>
                    <textarea
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      rows={3}
                      placeholder="e.g. Duplicate report detected or Driver forgot to report 2 trips"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 placeholder-slate-400"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingAdj || !targetDriverId}
                    className="w-full bg-blue-900 hover:bg-blue-800 text-white rounded-lg py-2.5 font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                  >
                    {submittingAdj ? 'Submitting...' : 'Apply Adjustment'}
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
