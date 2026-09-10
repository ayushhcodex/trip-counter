'use client';

import React, { useState, useEffect, useCallback, useRef, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';
import SiteLoader from '@/components/SiteLoader';

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

// Memoized individual vehicle card component to isolate re-renders
const VehicleCard = React.memo(({
  vehicle,
  isExpanded,
  isSingleDay,
  dateRangeInfo,
  activeAdjustVehicleId,
  adjDriverId,
  adjType,
  adjAmount,
  adjReason,
  isSubmittingAdj,
  adjStatusMessage,
  activeDieselVehicleId,
  dieselDriverId,
  dieselLitres,
  isSubmittingDiesel,
  dieselStatusMessage,
  t,
  onToggleExpand,
  onVerify,
  onToggleAdjustForm,
  onQuickAdjust,
  onApplyAdjustment,
  onToggleDieselForm,
  onApplyDiesel,
  onNavigateDiesel,
  setAdjDriverId,
  setAdjType,
  setAdjAmount,
  setAdjReason,
  setActiveAdjustVehicleId,
  setDieselDriverId,
  setDieselLitres,
  setActiveDieselVehicleId,
}: {
  vehicle: Vehicle;
  isExpanded: boolean;
  isSingleDay: boolean;
  dateRangeInfo: { start: string; end: string } | null;
  activeAdjustVehicleId: string | null;
  adjDriverId: string;
  adjType: 'add' | 'remove';
  adjAmount: string;
  adjReason: string;
  isSubmittingAdj: boolean;
  adjStatusMessage: { type: 'success' | 'error'; text: string; vehicleId: string } | null;
  activeDieselVehicleId: string | null;
  dieselDriverId: string;
  dieselLitres: string;
  isSubmittingDiesel: boolean;
  dieselStatusMessage: { type: 'success' | 'error'; text: string; vehicleId: string } | null;
  t: (key: string) => string;
  onToggleExpand: (id: string) => void;
  onVerify: (id: string) => void;
  onToggleAdjustForm: (v: Vehicle) => void;
  onQuickAdjust: (v: Vehicle, type: 'add' | 'remove') => void;
  onApplyAdjustment: (e: React.FormEvent, vehicleId: string) => void;
  onToggleDieselForm: (v: Vehicle) => void;
  onApplyDiesel: (e: React.FormEvent, vehicleId: string) => void;
  onNavigateDiesel: (vehicleId: string) => void;
  setAdjDriverId: (val: string) => void;
  setAdjType: (val: 'add' | 'remove') => void;
  setAdjAmount: (val: string) => void;
  setAdjReason: (val: string) => void;
  setActiveAdjustVehicleId: (id: string | null) => void;
  setDieselDriverId: (val: string) => void;
  setDieselLitres: (val: string) => void;
  setActiveDieselVehicleId: (id: string | null) => void;
}) => {
  const driversText = [
    vehicle.driver1?.name,
    vehicle.driver2?.name
  ].filter(Boolean).join(' & ') || 'Unassigned';

  const statusColor = 
    vehicle.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
    vehicle.status === 'BREAKDOWN' ? 'bg-amber-100 text-amber-800' :
    'bg-slate-100 text-slate-800';

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header Card Strip */}
      <div className="p-4 flex flex-col gap-2.5">
        {/* Top Row: Vehicle Number, Status Badge, Direct Diesel Log Button */}
        <div className="flex items-center justify-between">
          <div 
            onClick={() => onToggleExpand(vehicle.id)}
            className="flex items-center gap-2 cursor-pointer min-w-0"
          >
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight truncate">
              {vehicle.vehicleNumber}
            </h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor}`}>
              {vehicle.status === 'ACTIVE' ? t('common.active') : vehicle.status === 'BREAKDOWN' ? t('common.breakdown') : t('common.inactive')}
            </span>
          </div>

          {/* Prominent Direct Diesel Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleDieselForm(vehicle);
            }}
            className={`font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all flex-shrink-0 active:scale-95 ${
              activeDieselVehicleId === vehicle.id
                ? 'bg-amber-700 text-white ring-2 ring-amber-300'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            <span>⛽</span> Diesel
          </button>
        </div>

        {/* Bottom Row: Drivers List + Stepper (+ / -) & Count Badge */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
          <div 
            onClick={() => onToggleExpand(vehicle.id)}
            className="flex flex-col min-w-0 pr-2 cursor-pointer flex-1"
          >
            <span className="text-[10px] uppercase font-bold text-slate-400">Drivers</span>
            <p className="text-xs text-slate-700 font-bold truncate">
              {driversText}
            </p>
          </div>

          {/* Stepper Buttons: minus (-1), Reported Count, plus (+1) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Quick Remove (-) Button */}
            <button
              type="button"
              title="Remove Trip (-1)"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdjust(vehicle, 'remove');
              }}
              className="w-10 h-10 rounded-xl bg-red-50 hover:bg-red-100 active:scale-90 text-red-600 font-black text-2xl flex items-center justify-center border border-red-200 shadow-xs transition-all"
            >
              −
            </button>

            {/* Reported Count Badge */}
            <div 
              onClick={() => onToggleExpand(vehicle.id)}
              className="flex flex-col items-center justify-center w-12 h-10 rounded-xl bg-gradient-to-br from-blue-900 to-slate-900 shadow-inner text-white cursor-pointer"
            >
              <span className="text-base font-black leading-none">{vehicle.reportedCount}</span>
              <span className="text-[8px] font-extrabold text-blue-200 uppercase mt-0.5">Trips</span>
            </div>

            {/* Quick Add (+) Button */}
            <button
              type="button"
              title="Add Trip (+1)"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdjust(vehicle, 'add');
              }}
              className="w-10 h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:scale-90 text-emerald-600 font-black text-2xl flex items-center justify-center border border-emerald-200 shadow-xs transition-all"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50 pt-3">
          
          {/* Summary Row */}
          <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
            <div className="text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">{t('driver.reportedTrips')}</div>
              <div className="text-lg font-black text-slate-800">{vehicle.reportedCount}</div>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">{t('driver.adjustmentsTotal')}</div>
              <div className="text-lg font-black text-slate-800">{vehicle.adjustmentTotal}</div>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">{t('driver.verifiedTrips')}</div>
              <div className="text-lg font-black text-slate-800">{vehicle.verifiedCount}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 mb-4">
            {isSingleDay && vehicle.verificationStatus !== 'VERIFIED' && (
              <button
                onClick={() => onVerify(vehicle.id)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold shadow-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                {t('admin.verifyCountBtn')}
              </button>
            )}

            {vehicle.verificationStatus === 'VERIFIED' && isSingleDay && (
              <div className="w-full bg-emerald-50 text-emerald-700 py-2 rounded-xl font-bold flex items-center justify-center gap-2 border border-emerald-200 text-xs">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                {t('admin.verifiedBadge')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onToggleAdjustForm(vehicle)}
                className={`py-2 px-3 rounded-xl font-bold shadow-xs transition-transform active:scale-[0.98] flex items-center justify-center gap-1.5 text-xs ${
                  activeAdjustVehicleId === vehicle.id
                    ? 'bg-blue-900 text-white'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200'
                }`}
              >
                <span>⚡</span> {activeAdjustVehicleId === vehicle.id ? t('common.cancel') : t('admin.adjustTripCount')}
              </button>

              <button
                onClick={() => onToggleDieselForm(vehicle)}
                className={`py-2 px-3 rounded-xl font-bold shadow-xs transition-transform active:scale-[0.98] flex items-center justify-center gap-1.5 text-xs ${
                  activeDieselVehicleId === vehicle.id
                    ? 'bg-amber-800 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                <span>⛽</span> {activeDieselVehicleId === vehicle.id ? t('common.cancel') : 'Quick Diesel'}
              </button>
            </div>
          </div>

          {/* Instant Diesel Logger Form */}
          {activeDieselVehicleId === vehicle.id && (
            <div className="mb-4 bg-amber-50/80 p-3.5 rounded-xl border border-amber-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                <h4 className="font-extrabold text-xs text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  <span>⛽</span> Instant Diesel Log
                </h4>
                <span className="text-[10px] text-amber-800 font-semibold">{dateRangeInfo?.start}</span>
              </div>

              {dieselStatusMessage && dieselStatusMessage.vehicleId === vehicle.id && (
                <div className={`p-2 rounded-lg text-xs font-semibold text-center ${
                  dieselStatusMessage.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {dieselStatusMessage.text}
                </div>
              )}

              <form onSubmit={(e) => onApplyDiesel(e, vehicle.id)} className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-amber-900 mb-1">Target Driver</label>
                  <select
                    value={dieselDriverId}
                    onChange={(e) => setDieselDriverId(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs text-slate-800 font-semibold"
                    required
                  >
                    <option value="">Select Driver</option>
                    {vehicle.driver1 && <option value={vehicle.driver1.id}>{t('common.slot1')}: {vehicle.driver1.name}</option>}
                    {vehicle.driver2 && <option value={vehicle.driver2.id}>{t('common.slot2')}: {vehicle.driver2.name}</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-amber-900 mb-1">Diesel Quantity (Litres)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="1500"
                      placeholder="Enter Litres (e.g. 100)"
                      value={dieselLitres}
                      onChange={(e) => setDieselLitres(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-lg p-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                    <span className="font-black text-amber-900 text-sm">L</span>
                  </div>
                </div>

                {/* Below side quick preset options: 100, 150, 200 */}
                <div className="flex gap-2 pt-0.5">
                  {[100, 150, 200].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDieselLitres(String(preset))}
                      className={`flex-1 py-1.5 rounded-lg font-black text-xs border transition-all text-center ${
                        dieselLitres === String(preset)
                          ? 'bg-amber-700 text-white border-amber-800 shadow-xs'
                          : 'bg-amber-200/70 hover:bg-amber-300 text-amber-950 border-amber-300'
                      }`}
                    >
                      +{preset} L
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isSubmittingDiesel || !dieselDriverId || !dieselLitres}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg py-2 font-bold uppercase shadow-xs transition-all text-xs flex items-center justify-center gap-1"
                  >
                    <span>⛽</span> {isSubmittingDiesel ? 'Saving Diesel...' : `Save ${dieselLitres ? `${dieselLitres} L` : ''} Diesel`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDieselVehicleId(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-3 py-2 font-bold text-xs"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Inline Quick Adjustment Form */}
          {activeAdjustVehicleId === vehicle.id && (
            <div className="mb-4 bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-extrabold text-xs text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                  <span>⚡</span> {t('admin.adjustTripCount')}
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

              <form onSubmit={(e) => onApplyAdjustment(e, vehicle.id)} className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{t('admin.targetDriver')}</label>
                  <select
                    value={adjDriverId}
                    onChange={(e) => setAdjDriverId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-semibold"
                    required
                  >
                    <option value="">Select Driver</option>
                    {vehicle.driver1 && <option value={vehicle.driver1.id}>{t('common.slot1')}: {vehicle.driver1.name} ({vehicle.driver1.reportedCount} trips)</option>}
                    {vehicle.driver2 && <option value={vehicle.driver2.id}>{t('common.slot2')}: {vehicle.driver2.name} ({vehicle.driver2.reportedCount} trips)</option>}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{t('admin.adjustmentType')}</label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setAdjType('add')}
                        className={`py-1 rounded text-center text-xs font-bold transition-all ${
                          adjType === 'add' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        {t('admin.addTrips')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjType('remove')}
                        className={`py-1 rounded text-center text-xs font-bold transition-all ${
                          adjType === 'remove' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        {t('admin.removeTrips')}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{t('admin.quantity')}</label>
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
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{t('admin.reasonLabel')}</label>
                  <input
                    type="text"
                    placeholder={t('admin.reasonPlaceholder')}
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
                    {isSubmittingAdj ? t('admin.adjusting') : `${t('admin.applyAdjustmentBtn')} (${adjType === 'add' ? '+' : '-'}${adjAmount || '1'})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAdjustVehicleId(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-3 py-2 font-bold text-xs"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Driver Breakdown */}
          <div className="mb-4 bg-white p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-semibold text-[11px]">{t('common.slot1')}: {vehicle.driver1 ? vehicle.driver1.name : 'Unassigned'}</span>
              <span className="font-black text-slate-800">{vehicle.driver1 ? vehicle.driver1.reportedCount : 0} trips</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 border-t border-slate-50 pt-1">
              <span className="font-semibold text-[11px]">{t('common.slot2')}: {vehicle.driver2 ? vehicle.driver2.name : 'Unassigned'}</span>
              <span className="font-black text-slate-800">{vehicle.driver2 ? vehicle.driver2.reportedCount : 0} trips</span>
            </div>
          </div>

          {/* Trips List */}
          <div>
            <h3 className="text-xs font-bold uppercase text-slate-500 mb-2 px-1">{t('driver.historyTitle')}</h3>
            {vehicle.trips.length === 0 ? (
              <div className="bg-white p-4 rounded-xl border border-slate-100 text-center text-sm font-semibold text-slate-400">
                {t('driver.noTripsLogged')}
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
});

VehicleCard.displayName = 'VehicleCard';

export default function AdminDashboard() {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<DateRange>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dateRangeInfo, setDateRangeInfo] = useState<{ start: string; end: string } | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [, setLastUpdated] = useState<Date>(new Date());
  
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

  // Quick Inline Diesel Log States
  const [activeDieselVehicleId, setActiveDieselVehicleId] = useState<string | null>(null);
  const [dieselDriverId, setDieselDriverId] = useState<string>('');
  const [dieselLitres, setDieselLitres] = useState<string>('');
  const [isSubmittingDiesel, setIsSubmittingDiesel] = useState<boolean>(false);
  const [dieselStatusMessage, setDieselStatusMessage] = useState<{ type: 'success' | 'error'; text: string; vehicleId: string } | null>(null);

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

    // Stale-While-Revalidate: render cached data immediately without clearing view
    if (cachedData) {
      setVehicles(cachedData.vehicles);
      setDateRangeInfo(cachedData.dateRange);
      setIsLoading(false);
      setIsRefreshing(true);
    } else if (!isBackground) {
      setIsLoading(true);
      setIsRefreshing(false);
    }

    try {
      let url = `/api/admin/vehicles?range=${tab}`;
      if (tab === 'custom' && start && end) {
        url += `&startDate=${start}&endDate=${end}`;
      } else if (tab === 'custom') {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
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

  // Non-blocking tab change using useTransition
  const handleTabChange = useCallback((tab: DateRange) => {
    startTransition(() => {
      setActiveTab(tab);
      setExpandedVehicleId(null);
    });
  }, [startTransition]);

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

  const handleQuickAdjust = useCallback((vehicle: Vehicle, type: 'add' | 'remove') => {
    setActiveAdjustVehicleId((currentActiveId) => {
      if (currentActiveId === vehicle.id) {
        setAdjType((currentType) => {
          if (currentType === type) {
            setAdjAmount((prev) => String((parseInt(prev, 10) || 0) + 1));
          } else {
            setAdjAmount('1');
          }
          return type;
        });
      } else {
        setAdjDriverId(vehicle.driver1?.id || vehicle.driver2?.id || '');
        setAdjType(type);
        setAdjAmount('1');
        setAdjReason('');
        setAdjStatusMessage(null);
      }
      return vehicle.id;
    });
    setExpandedVehicleId(vehicle.id);
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
        fetchVehicles(activeTab, customStartDate, customEndDate, true);
      } else {
        const err = await res.json();
        setAdjStatusMessage({ type: 'error', text: err.error || 'Failed to apply adjustment.', vehicleId });
      }
    } catch {
      setAdjStatusMessage({ type: 'error', text: t('common.networkError'), vehicleId });
    } finally {
      setIsSubmittingAdj(false);
    }
  }, [dateRangeInfo, adjDriverId, adjReason, adjAmount, adjType, activeTab, customStartDate, customEndDate, fetchVehicles, t]);

  const toggleDieselForm = useCallback((vehicle: Vehicle) => {
    setActiveDieselVehicleId((prev) => {
      if (prev === vehicle.id) {
        setDieselStatusMessage(null);
        return null;
      }
      setDieselDriverId(vehicle.driver1?.id || vehicle.driver2?.id || '');
      setDieselLitres('');
      setDieselStatusMessage(null);
      return vehicle.id;
    });
    setExpandedVehicleId(vehicle.id);
  }, []);

  const handleApplyDiesel = useCallback(async (e: React.FormEvent, vehicleId: string) => {
    e.preventDefault();
    if (!dateRangeInfo) return;
    if (!dieselDriverId) {
      setDieselStatusMessage({ type: 'error', text: 'Please select a driver for diesel record.', vehicleId });
      return;
    }
    const litresVal = parseFloat(dieselLitres);
    if (isNaN(litresVal) || litresVal <= 0) {
      setDieselStatusMessage({ type: 'error', text: 'Please enter a valid positive litres quantity.', vehicleId });
      return;
    }

    setIsSubmittingDiesel(true);
    setDieselStatusMessage(null);

    try {
      const res = await fetch('/api/admin/diesel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          driverId: dieselDriverId,
          date: dateRangeInfo.start,
          litres: dieselLitres,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setDieselStatusMessage({ type: 'success', text: `✅ Recorded ${litresVal.toFixed(2)} L Diesel!`, vehicleId });
        setDieselLitres('');
      } else {
        setDieselStatusMessage({ type: 'error', text: data.error || 'Failed to record diesel entry.', vehicleId });
      }
    } catch {
      setDieselStatusMessage({ type: 'error', text: t('common.networkError'), vehicleId });
    } finally {
      setIsSubmittingDiesel(false);
    }
  }, [dateRangeInfo, dieselDriverId, dieselLitres, t]);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }, [router]);

  const onToggleExpand = useCallback((id: string) => {
    setExpandedVehicleId(prev => (prev === id ? null : id));
  }, []);

  const onNavigateDiesel = useCallback((id: string) => {
    router.push(`/admin/vehicle/${id}`);
  }, [router]);

  // Memoized vehicle filter
  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return vehicles;
    const q = searchQuery.toLowerCase();
    return vehicles.filter(v => 
      v.vehicleNumber.toLowerCase().includes(q) ||
      v.driver1?.name.toLowerCase().includes(q) ||
      v.driver2?.name.toLowerCase().includes(q)
    );
  }, [vehicles, searchQuery]);

  const isSingleDay = activeTab === 'today' || activeTab === 'yesterday';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800 shadow-sm px-4 py-3.5 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-black text-blue-400 tracking-tight">{t('common.appName')}</h1>
          {userProfile && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                userProfile.role === 'SUPERVISOR' || userProfile.role === 'ADMIN' ? 'bg-blue-800 text-blue-100' :
                userProfile.role === 'SUPER_ADMIN' ? 'bg-purple-800 text-purple-100' :
                'bg-blue-800 text-blue-100'
              }`}>
                {userProfile.role === 'SUPER_ADMIN' ? t('common.superAdminRole') : t('common.adminRole')}
              </span>
              <span className="text-xs text-slate-300 font-bold truncate max-w-[120px]">
                {userProfile.name}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector variant="header" />
          <button 
            onClick={handleLogout}
            className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 transition-all"
          >
            {t('common.logout')}
          </button>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="sticky top-[68px] z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex overflow-x-auto hide-scrollbar px-2 py-2 gap-2">
          {(['today', 'yesterday', 'week', 'month', 'custom'] as DateRange[]).map((tab) => {
            const tabLabel =
              tab === 'today' ? t('common.today') :
              tab === 'yesterday' ? t('common.yesterday') :
              tab === 'week' ? t('common.thisWeek') :
              tab === 'month' ? t('common.thisMonth') : 'Custom';
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors ${
                  activeTab === tab 
                    ? 'bg-blue-900 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                }`}
              >
                {tabLabel}
              </button>
            );
          })}
        </div>
        {(isLoading || isRefreshing || isPending) && (
          <div className="h-0.5 w-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-blue-600 animate-pulse w-1/3 rounded-r-full"></div>
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
            placeholder="Search vehicle number or driver..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-4 shadow-sm text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Vehicle List */}
        {isLoading && !isRefreshing && vehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <SiteLoader />
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <p className="text-slate-500 font-semibold">{t('admin.fleetTitle')}: No vehicles found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredVehicles.map(vehicle => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                isExpanded={expandedVehicleId === vehicle.id}
                isSingleDay={isSingleDay}
                dateRangeInfo={dateRangeInfo}
                activeAdjustVehicleId={activeAdjustVehicleId}
                adjDriverId={adjDriverId}
                adjType={adjType}
                adjAmount={adjAmount}
                adjReason={adjReason}
                isSubmittingAdj={isSubmittingAdj}
                adjStatusMessage={adjStatusMessage}
                activeDieselVehicleId={activeDieselVehicleId}
                dieselDriverId={dieselDriverId}
                dieselLitres={dieselLitres}
                isSubmittingDiesel={isSubmittingDiesel}
                dieselStatusMessage={dieselStatusMessage}
                t={t}
                onToggleExpand={onToggleExpand}
                onVerify={handleVerify}
                onToggleAdjustForm={toggleAdjustForm}
                onQuickAdjust={handleQuickAdjust}
                onApplyAdjustment={handleApplyAdjustment}
                onToggleDieselForm={toggleDieselForm}
                onApplyDiesel={handleApplyDiesel}
                onNavigateDiesel={onNavigateDiesel}
                setAdjDriverId={setAdjDriverId}
                setAdjType={setAdjType}
                setAdjAmount={setAdjAmount}
                setAdjReason={setAdjReason}
                setActiveAdjustVehicleId={setActiveAdjustVehicleId}
                setDieselDriverId={setDieselDriverId}
                setDieselLitres={setDieselLitres}
                setActiveDieselVehicleId={setActiveDieselVehicleId}
              />
            ))}
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
