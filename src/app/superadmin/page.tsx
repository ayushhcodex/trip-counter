'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';
import SiteLoader from '@/components/SiteLoader';

interface User {
  id: string;
  usernameOrEmail: string;
  name: string;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'SUPERVISOR' | 'ADMIN' | 'DRIVER';
  status: 'ACTIVE' | 'LEAVE' | 'INACTIVE';
}

interface Vehicle {
  id: string;
  vehicleNumber: string;
  status: 'ACTIVE' | 'BREAKDOWN' | 'INACTIVE';
}

interface DriverAssignment {
  id: string;
  vehicleId: string;
  driverId: string;
  slot: number;
  startAt: string;
  endAt: string | null;
  driverName: string;
  driverUsername: string;
  vehicleNumber: string;
}

interface AdminAssignment {
  id: string;
  adminId: string;
  vehicleId: string;
  adminName: string;
  adminUsername: string;
  vehicleNumber: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: any;
  createdAt: string;
  actorName: string | null;
  actorUsername: string | null;
}

interface SuperAdminCache {
  usersList: User[];
  vehiclesList: Vehicle[];
  driverAssignments: DriverAssignment[];
  adminAssignments: AdminAssignment[];
  auditLogsList: AuditLog[];
}

// In-memory cache for zero-delay tab switching
let cachedSuperAdminData: SuperAdminCache | null = null;

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'vehicles' | 'users' | 'assignments' | 'audits'>('vehicles');
  const [loading, setLoading] = useState<boolean>(() => !cachedSuperAdminData);

  // Data states initialized from cache for instant 0ms rendering
  const [usersList, setUsersList] = useState<User[]>(() => cachedSuperAdminData?.usersList || []);
  const [vehiclesList, setVehiclesList] = useState<Vehicle[]>(() => cachedSuperAdminData?.vehiclesList || []);
  const [driverAssignments, setDriverAssignments] = useState<DriverAssignment[]>(() => cachedSuperAdminData?.driverAssignments || []);
  const [adminAssignments, setAdminAssignments] = useState<AdminAssignment[]>(() => cachedSuperAdminData?.adminAssignments || []);
  const [auditLogsList, setAuditLogsList] = useState<AuditLog[]>(() => cachedSuperAdminData?.auditLogsList || []);

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Form states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // User form
  const [userName, setUserName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<'SUPER_ADMIN' | 'SUPERVISOR' | 'ADMIN' | 'DRIVER'>('DRIVER');
  const [userStatus, setUserStatus] = useState<'ACTIVE' | 'LEAVE' | 'INACTIVE'>('ACTIVE');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Vehicle form
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleStatus, setVehicleStatus] = useState<'ACTIVE' | 'BREAKDOWN' | 'INACTIVE'>('ACTIVE');
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  // Driver Assignment form
  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assignSlot, setAssignSlot] = useState<number>(1);

  // Admin Assignment form
  const [assignAdminId, setAssignAdminId] = useState('');
  const [assignAdminVehicleIds, setAssignAdminVehicleIds] = useState<string[]>([]);

  const handleAdminSelect = (adminId: string, currentAdminAssignments = adminAssignments) => {
    setAssignAdminId(adminId);
    if (adminId) {
      const assignedVids = currentAdminAssignments
        .filter((a) => a.adminId === adminId)
        .map((a) => a.vehicleId);
      setAssignAdminVehicleIds(assignedVids);
    } else {
      setAssignAdminVehicleIds([]);
    }
  };

  const loadAllData = async () => {
    setErrorMsg('');
    try {
      // Parallel execution for maximum performance
      const [usersRes, vehiclesRes, driverAssignRes, adminAssignRes, auditRes] = await Promise.all([
        fetch('/api/superadmin/users'),
        fetch('/api/superadmin/vehicles'),
        fetch('/api/superadmin/assignments/driver'),
        fetch('/api/superadmin/assignments/admin'),
        fetch('/api/superadmin/audit-logs'),
      ]);

      if (usersRes.status === 401) {
        router.push('/login');
        return;
      }

      const usersData = usersRes.ok ? await usersRes.json() : { users: [] };
      const vehiclesData = vehiclesRes.ok ? await vehiclesRes.json() : { vehicles: [] };
      const driverAssignData = driverAssignRes.ok ? await driverAssignRes.json() : { assignments: [] };
      const adminAssignData = adminAssignRes.ok ? await adminAssignRes.json() : { assignments: [] };
      const auditData = auditRes.ok ? await auditRes.json() : { logs: [] };

      const newUsers = usersData.users || [];
      const newVehicles = vehiclesData.vehicles || [];
      const newDriverAssignments = driverAssignData.assignments || [];
      const newAdminAssignments = adminAssignData.assignments || [];
      const newAuditLogs = auditData.logs || [];

      setUsersList(newUsers);
      setVehiclesList(newVehicles);
      setDriverAssignments(newDriverAssignments);
      setAdminAssignments(newAdminAssignments);
      setAuditLogsList(newAuditLogs);

      // Cache data for instant tab switching
      cachedSuperAdminData = {
        usersList: newUsers,
        vehiclesList: newVehicles,
        driverAssignments: newDriverAssignments,
        adminAssignments: newAdminAssignments,
        auditLogsList: newAuditLogs,
      };
    } catch (error) {
      console.error('Failed to load superadmin data:', error);
      setErrorMsg('Failed to sync management database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // --- USER HANDLERS ---
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      name: userName,
      usernameOrEmail: userUsername,
      phone: userPhone,
      role: userRole,
      status: userStatus,
      password: userPassword || undefined,
    };

    try {
      let res;
      if (editingUserId) {
        res = await fetch(`/api/superadmin/users/${editingUserId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/superadmin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setSuccessMsg(editingUserId ? 'User profile updated.' : 'New user created successfully.');
        setUserName('');
        setUserUsername('');
        setUserPhone('');
        setUserPassword('');
        setEditingUserId(null);
        await loadAllData();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to submit user.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    }
  };

  const startEditUser = (u: User) => {
    setEditingUserId(u.id);
    setUserName(u.name);
    setUserUsername(u.usernameOrEmail);
    setUserPhone(u.phone || '');
    setUserRole(u.role);
    setUserStatus(u.status);
    setUserPassword('');
  };

  // --- VEHICLE HANDLERS ---
  const handleVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      vehicleNumber,
      status: vehicleStatus,
    };

    try {
      let res;
      if (editingVehicleId) {
        res = await fetch(`/api/superadmin/vehicles/${editingVehicleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/superadmin/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setSuccessMsg(editingVehicleId ? 'Vehicle record updated.' : 'Vehicle added to fleet.');
        setVehicleNumber('');
        setEditingVehicleId(null);
        await loadAllData();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to submit vehicle.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    }
  };

  const startEditVehicle = (v: Vehicle) => {
    setEditingVehicleId(v.id);
    setVehicleNumber(v.vehicleNumber);
    setVehicleStatus(v.status);
  };

  // Quick Status Toggle for Vehicles
  const toggleVehicleStatus = async (vehicleId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'BREAKDOWN' : currentStatus === 'BREAKDOWN' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`/api/superadmin/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setSuccessMsg(`Vehicle status changed to ${nextStatus}.`);
        await loadAllData();
      }
    } catch (e) {
      setErrorMsg('Failed to update status.');
    }
  };

  // --- ASSIGNMENT HANDLERS ---
  const handleDriverAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/superadmin/assignments/driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: assignVehicleId,
          driverId: assignDriverId || null,
          slot: assignSlot,
        }),
      });

      if (res.ok) {
        setSuccessMsg('Driver slot assignment updated.');
        await loadAllData();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to assign driver.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    }
  };

  const handleAdminAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!assignAdminId) {
      setErrorMsg('Please select a Supervisor or Admin.');
      return;
    }

    try {
      const res = await fetch('/api/superadmin/assignments/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: assignAdminId,
          vehicleIds: assignAdminVehicleIds,
        }),
      });

      if (res.ok) {
        setSuccessMsg('Supervisor vehicle mapping updated.');
        await loadAllData();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to update mapping.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    }
  };

  const handleAdminRemove = async (adminId: string, vehicleId: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/superadmin/assignments/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, vehicleId }),
      });

      if (res.ok) {
        setSuccessMsg('Supervisor vehicle mapping removed.');
        await loadAllData();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to remove assignment.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    }
  };

  // Filtered Lists for Easy Searching
  const filteredVehicles = vehiclesList.filter((v) =>
    v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.usernameOrEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-100 text-slate-800">
      {/* Super Admin Control Header */}
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between shadow-md sticky top-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 text-white p-2 rounded-xl text-xl">⚡</div>
          <div>
            <h1 className="font-black text-lg sm:text-xl tracking-tight text-blue-400">
              Super Admin Control
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold">
              Fleet Management & Supervisor Access Panel
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <LanguageSelector variant="header" />
          <button
            onClick={handleLogout}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-xl font-bold border border-slate-700 transition-all"
          >
            {t('common.logout')}
          </button>
        </div>
      </header>

      {/* 4 Prominent High-Contrast Control Tabs at Top */}
      <section className="bg-white border-b border-slate-200 px-4 sm:px-6 sticky top-[68px] z-10 shadow-sm">
        <div className="grid grid-cols-4 gap-1 sm:gap-4 max-w-7xl mx-auto py-2">
          {[
            { id: 'vehicles', label: 'Fleet Vehicles', icon: '🚛', count: vehiclesList.length },
            { id: 'users', label: 'Users & Staff', icon: '👥', count: usersList.length },
            { id: 'assignments', label: 'Assignments', icon: '🔗', count: driverAssignments.length + adminAssignments.length },
            { id: 'audits', label: 'Audit Logs', icon: '📜', count: auditLogsList.length },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSearchTerm('');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`py-3 px-2 rounded-xl font-black text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all border ${
                  isActive
                    ? 'bg-blue-900 text-white border-blue-950 shadow-md ring-2 ring-blue-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {errorMsg && (
          <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 px-4 py-2.5 rounded-2xl text-xs font-bold mb-4 text-center shadow-xs">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-2xl text-xs font-bold mb-4 text-center shadow-xs">
            ✓ {successMsg}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <SiteLoader />
          </div>
        ) : (
          <div className="space-y-6">
            {/* --- TAB 1: FLEET VEHICLES --- */}
            {activeTab === 'vehicles' && (
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Left 2 Cols: Vehicles List */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-600 flex items-center gap-2">
                      <span>🚛</span> All Registered Fleet Vehicles ({filteredVehicles.length})
                    </h3>
                    <input
                      type="text"
                      placeholder="Search Vehicle No..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold uppercase w-44"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 uppercase font-black">
                          <th className="pb-2.5">Vehicle Number</th>
                          <th className="pb-2.5">Status</th>
                          <th className="pb-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredVehicles.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50">
                            <td className="py-3 font-black uppercase text-slate-900 text-sm">{v.vehicleNumber}</td>
                            <td className="py-3">
                              <button
                                onClick={() => toggleVehicleStatus(v.id, v.status)}
                                title="Click to toggle vehicle status"
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer ${
                                  v.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                    : v.status === 'BREAKDOWN'
                                    ? 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200 animate-pulse'
                                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                }`}
                              >
                                {v.status}
                              </button>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => startEditVehicle(v)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-extrabold px-3 py-1 rounded-lg text-xs"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Col: Add / Edit Vehicle Form */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <span>➕</span> {editingVehicleId ? 'Edit Vehicle Status' : 'Add New Vehicle'}
                  </h3>
                  <form onSubmit={handleVehicleSubmit} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-bold uppercase text-slate-500 mb-1">Vehicle Reg Number</label>
                      <input
                        type="text"
                        placeholder="e.g. KA-01-AB-1234"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 uppercase font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-500 mb-1">Vehicle Status</label>
                      <select
                        value={vehicleStatus}
                        onChange={(e) => setVehicleStatus(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-extrabold text-slate-900"
                      >
                        <option value="ACTIVE">ACTIVE (Running)</option>
                        <option value="BREAKDOWN">BREAKDOWN (Under Repair)</option>
                        <option value="INACTIVE">INACTIVE (Off-duty)</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-900 hover:bg-blue-800 text-white rounded-xl py-2.5 font-bold uppercase shadow-sm"
                      >
                        {editingVehicleId ? 'Update Vehicle' : 'Save Vehicle'}
                      </button>
                      {editingVehicleId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVehicleId(null);
                            setVehicleNumber('');
                          }}
                          className="bg-slate-200 text-slate-700 rounded-xl px-4 py-2.5 font-bold uppercase"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* --- TAB 2: USERS & STAFF --- */}
            {activeTab === 'users' && (
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Left 2 Cols: User Roster */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-600 flex items-center gap-2">
                      <span>👥</span> Staff & Driver Accounts ({filteredUsers.length})
                    </h3>
                    <input
                      type="text"
                      placeholder="Search Driver/User Name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold w-48"
                    />
                  </div>

                  {/* Role Filter Chips */}
                  <div className="flex gap-1.5 pt-1">
                    {['ALL', 'DRIVER', 'SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRoleFilter(r)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                          roleFilter === r
                            ? 'bg-blue-900 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 uppercase font-black">
                          <th className="pb-2">Full Name</th>
                          <th className="pb-2">User ID</th>
                          <th className="pb-2">Role</th>
                          <th className="pb-2">Status</th>
                          <th className="pb-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50">
                            <td className="py-3 font-bold text-slate-900">{u.name}</td>
                            <td className="py-3 font-semibold text-slate-600">{u.usernameOrEmail}</td>
                            <td className="py-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                  u.role === 'SUPERVISOR'
                                    ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                    : u.role === 'SUPER_ADMIN'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                    : u.role === 'ADMIN'
                                    ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                    : 'bg-slate-100 text-slate-800 border border-slate-300'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : u.status === 'LEAVE'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {u.status}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => startEditUser(u)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-extrabold px-3 py-1 rounded-lg text-xs"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Col: Add / Edit User Form */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <span>➕</span> {editingUserId ? 'Edit User Profile' : 'Register New User'}
                  </h3>
                  <form onSubmit={handleUserSubmit} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-bold uppercase text-slate-500 mb-1">Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Kumar"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-500 mb-1">User ID / Username</label>
                      <input
                        type="text"
                        placeholder="e.g. drv001"
                        value={userUsername}
                        onChange={(e) => setUserUsername(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-500 mb-1">Phone Number (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. +91 98765 43210"
                        value={userPhone}
                        onChange={(e) => setUserPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-500 mb-1">
                        {editingUserId ? 'New Password (Optional)' : 'Password'}
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={userPassword}
                        onChange={(e) => setUserPassword(e.target.value)}
                        required={!editingUserId}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-500 mb-1">System Role</label>
                      <select
                        value={userRole}
                        onChange={(e) => setUserRole(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-extrabold text-slate-900"
                      >
                        <option value="DRIVER">DRIVER</option>
                        <option value="SUPERVISOR">SUPERVISOR</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-500 mb-1">Status</label>
                      <select
                        value={userStatus}
                        onChange={(e) => setUserStatus(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="LEAVE">LEAVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-900 hover:bg-blue-800 text-white rounded-xl py-2.5 font-bold uppercase shadow-sm"
                      >
                        {editingUserId ? 'Update User' : 'Save User'}
                      </button>
                      {editingUserId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUserId(null);
                            setUserName('');
                            setUserUsername('');
                            setUserPhone('');
                            setUserPassword('');
                          }}
                          className="bg-slate-200 text-slate-700 rounded-xl px-4 py-2.5 font-bold uppercase"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* --- TAB 3: ASSIGNMENTS CONTROL --- */}
            {activeTab === 'assignments' && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Driver-to-Vehicle Slot Assignments */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                      <span>🚛</span> Assign Driver to Vehicle Slot
                    </h3>

                    <form onSubmit={handleDriverAssign} className="space-y-3.5 text-xs mt-3">
                      <div>
                        <label className="block font-bold uppercase text-slate-500 mb-1">Target Vehicle</label>
                        <select
                          value={assignVehicleId}
                          onChange={(e) => setAssignVehicleId(e.target.value)}
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-extrabold text-blue-950 uppercase"
                        >
                          <option value="">Select Vehicle</option>
                          {vehiclesList.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.vehicleNumber} ({v.status})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold uppercase text-slate-500 mb-1">Driver</label>
                        <select
                          value={assignDriverId}
                          onChange={(e) => setAssignDriverId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                        >
                          <option value="">-- Unassign Driver --</option>
                          {usersList
                            .filter((u) => u.role === 'DRIVER')
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.usernameOrEmail} - {u.status})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold uppercase text-slate-500 mb-1">Vehicle Shift Slot</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setAssignSlot(1)}
                            className={`py-2 rounded-xl font-black text-xs border ${
                              assignSlot === 1
                                ? 'bg-blue-900 text-white border-blue-950'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            Slot 1 (Day Shift)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAssignSlot(2)}
                            className={`py-2 rounded-xl font-black text-xs border ${
                              assignSlot === 2
                                ? 'bg-blue-900 text-white border-blue-950'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            Slot 2 (Night Shift)
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={!assignVehicleId}
                        className="w-full bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl py-2.5 font-extrabold uppercase shadow-sm mt-2"
                      >
                        Save Driver Assignment
                      </button>
                    </form>
                  </div>

                  {/* Active Driver Assignments Table */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 mb-2">
                      Active Driver Assignments ({driverAssignments.length})
                    </h4>
                    <div className="max-h-48 overflow-y-auto space-y-1.5">
                      {driverAssignments.map((a) => (
                        <div key={a.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-black uppercase text-blue-950">{a.vehicleNumber}</span>
                            <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded ml-2">
                              Slot {a.slot}
                            </span>
                          </div>
                          <span className="font-bold text-slate-800">{a.driverName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Supervisor / Admin Vehicle Assignments */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <span>👤</span> Map Supervisor / Admin to Vehicles
                      </h3>
                      {assignAdminId && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setAssignAdminVehicleIds(vehiclesList.map((v) => v.id))}
                            className="text-blue-700 hover:text-blue-900 font-black"
                          >
                            Select All
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setAssignAdminVehicleIds([])}
                            className="text-slate-500 hover:text-slate-700 font-bold"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleAdminAssign} className="space-y-3 text-xs mt-3">
                      <div>
                        <label className="block font-bold uppercase text-slate-500 mb-1">Supervisor / Admin User</label>
                        <select
                          value={assignAdminId}
                          onChange={(e) => handleAdminSelect(e.target.value)}
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-extrabold text-slate-900"
                        >
                          <option value="">Select Supervisor</option>
                          {usersList
                            .filter((u) => u.role === 'ADMIN' || u.role === 'SUPERVISOR')
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.role})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold uppercase text-slate-500 mb-1">
                          Assigned Vehicles ({assignAdminVehicleIds.length})
                        </label>
                        <div className="max-h-40 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
                          {vehiclesList.map((v) => {
                            const isChecked = assignAdminVehicleIds.includes(v.id);
                            return (
                              <label
                                key={v.id}
                                className={`flex items-center space-x-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                                  isChecked ? 'bg-blue-100 text-blue-950 font-black' : 'hover:bg-slate-100 text-slate-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setAssignAdminVehicleIds([...assignAdminVehicleIds, v.id]);
                                    } else {
                                      setAssignAdminVehicleIds(assignAdminVehicleIds.filter((id) => id !== v.id));
                                    }
                                  }}
                                  className="rounded border-slate-300 text-blue-900 focus:ring-blue-800 h-4 w-4"
                                />
                                <span className="uppercase text-xs tracking-wide">{v.vehicleNumber} ({v.status})</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={!assignAdminId}
                        className="w-full bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl py-2.5 font-extrabold uppercase shadow-sm"
                      >
                        Save Supervisor Mapping
                      </button>
                    </form>
                  </div>

                  {/* Active Admin Mappings Table */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 mb-2">
                      Supervisor Vehicle Mappings ({adminAssignments.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {adminAssignments.map((a) => (
                        <div key={a.id} className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                          <span className="font-bold text-slate-800">{a.adminName}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-black uppercase text-blue-900">{a.vehicleNumber}</span>
                            <button
                              onClick={() => handleAdminRemove(a.adminId, a.vehicleId)}
                              className="text-red-600 font-bold hover:underline"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 4: AUDIT LOGS --- */}
            {activeTab === 'audits' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <span>📜</span> System Audit Trail & Event Logs ({auditLogsList.length})
                </h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {auditLogsList.map((log) => (
                    <div key={log.id} className="border border-slate-200 bg-slate-50 rounded-xl p-3.5 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                        <span className="bg-blue-900 text-white px-2.5 py-0.5 rounded-full uppercase font-black">
                          {log.action}
                        </span>
                        <span>📅 {new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="font-extrabold text-slate-900 mt-1">
                        Actor: <span className="text-blue-900">{log.actorName || 'System'}</span> ({log.actorUsername || 'system'})
                      </p>
                      <p className="text-slate-600 font-semibold">
                        Entity: {log.entityType} ({log.entityId || 'N/A'})
                      </p>
                      {log.metadata && (
                        <pre className="bg-white p-2 rounded-lg border border-slate-200 text-[10px] text-slate-700 overflow-x-auto mt-1 font-mono">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
