'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  usernameOrEmail: string;
  name: string;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'DRIVER';
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

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'vehicles' | 'users' | 'assignments' | 'audits'>('vehicles');
  const [loading, setLoading] = useState(true);

  // Data states
  const [usersList, setUsersList] = useState<User[]>([]);
  const [vehiclesList, setVehiclesList] = useState<Vehicle[]>([]);
  const [driverAssignments, setDriverAssignments] = useState<DriverAssignment[]>([]);
  const [adminAssignments, setAdminAssignments] = useState<AdminAssignment[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<AuditLog[]>([]);

  // Form states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // User form
  const [userName, setUserName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'DRIVER'>('DRIVER');
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
  const [assignAdminVehicleId, setAssignAdminVehicleId] = useState('');

  const loadAllData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Fetch users
      const usersRes = await fetch('/api/superadmin/users');
      if (!usersRes.ok) {
        router.push('/login');
        return;
      }
      const usersData = await usersRes.json();
      setUsersList(usersData.users || []);

      // Fetch vehicles
      const vehiclesRes = await fetch('/api/superadmin/vehicles');
      const vehiclesData = await vehiclesRes.json();
      setVehiclesList(vehiclesData.vehicles || []);

      // Fetch driver assignments
      const driverAssignRes = await fetch('/api/superadmin/assignments/driver');
      const driverAssignData = await driverAssignRes.json();
      setDriverAssignments(driverAssignData.assignments || []);

      // Fetch admin assignments
      const adminAssignRes = await fetch('/api/superadmin/assignments/admin');
      const adminAssignData = await adminAssignRes.json();
      setAdminAssignments(adminAssignData.assignments || []);

      // Fetch audit logs
      const auditRes = await fetch('/api/superadmin/audit-logs');
      const auditData = await auditRes.json();
      setAuditLogsList(auditData.logs || []);
    } catch (error) {
      console.error('Failed to load superadmin data:', error);
      setErrorMsg('Failed to sync management database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [activeTab]);

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
        setSuccessMsg(editingUserId ? 'User updated successfully.' : 'User created successfully.');
        // Reset form
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
    setUserPassword(''); // blank unless changing
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
        setSuccessMsg(editingVehicleId ? 'Vehicle updated successfully.' : 'Vehicle created successfully.');
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
          driverId: assignDriverId || null, // allow unassign
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

    try {
      const res = await fetch('/api/superadmin/assignments/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: assignAdminId,
          vehicleId: assignAdminVehicleId,
        }),
      });

      if (res.ok) {
        setSuccessMsg('Admin vehicle mapping assigned successfully.');
        await loadAllData();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to assign Admin.');
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
        setSuccessMsg('Admin vehicle mapping removed.');
        await loadAllData();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to remove assignment.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-100 text-slate-800">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div>
          <h1 className="font-extrabold text-xl tracking-tight text-blue-400">TripCounter Console</h1>
          <p className="text-xs text-slate-400 font-semibold">Super Admin Control Hub</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
        >
          Logout
        </button>
      </header>

      {/* Tabs */}
      <section className="bg-white border-b border-slate-200 px-6 py-2 shadow-sm">
        <div className="flex space-x-4">
          {[
            { id: 'vehicles', label: 'Vehicles' },
            { id: 'users', label: 'Users' },
            { id: 'assignments', label: 'Assignments' },
            { id: 'audits', label: 'Audit Logs' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`py-3.5 px-1.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all focus:outline-none ${
                activeTab === t.id
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* Main Grid */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {errorMsg && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2.5 rounded-lg text-xs font-semibold mb-6 text-center">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-700 px-4 py-2.5 rounded-lg text-xs font-semibold mb-6 text-center">
            {successMsg}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-slate-500 text-xs font-semibold">Syncing console data...</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Panel: Content Lists */}
            <div className="lg:col-span-2 space-y-6">
              {/* --- TAB: VEHICLES --- */}
              {activeTab === 'vehicles' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400">All Vehicles</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 uppercase font-black">
                          <th className="pb-2">Vehicle Number</th>
                          <th className="pb-2">Status</th>
                          <th className="pb-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vehiclesList.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50">
                            <td className="py-3 font-bold uppercase text-slate-700">{v.vehicleNumber}</td>
                            <td className="py-3">
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
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => startEditVehicle(v)}
                                className="text-blue-900 hover:text-blue-800 font-bold"
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
              )}

              {/* --- TAB: USERS --- */}
              {activeTab === 'users' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400">All Users</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 uppercase font-black">
                          <th className="pb-2">Name</th>
                          <th className="pb-2">ID / Username</th>
                          <th className="pb-2">Role</th>
                          <th className="pb-2">Status</th>
                          <th className="pb-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {usersList.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50">
                            <td className="py-3 font-bold text-slate-700">{u.name}</td>
                            <td className="py-3 font-medium text-slate-500">{u.usernameOrEmail}</td>
                            <td className="py-3 font-semibold text-blue-900">{u.role}</td>
                            <td className="py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : u.status === 'LEAVE'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {u.status}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => startEditUser(u)}
                                className="text-blue-900 hover:text-blue-800 font-bold"
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
              )}

              {/* --- TAB: ASSIGNMENTS --- */}
              {activeTab === 'assignments' && (
                <div className="space-y-6">
                  {/* Driver Assignments */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400">Driver Assignments</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 uppercase font-black">
                            <th className="pb-2">Vehicle</th>
                            <th className="pb-2">Driver</th>
                            <th className="pb-2">Slot</th>
                            <th className="pb-2">Assigned</th>
                            <th className="pb-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {driverAssignments.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50">
                              <td className="py-3 font-bold uppercase text-slate-700">{a.vehicleNumber}</td>
                              <td className="py-3 font-semibold text-slate-600">{a.driverName} ({a.driverUsername})</td>
                              <td className="py-3 font-medium">Slot {a.slot}</td>
                              <td className="py-3 text-slate-400">{new Date(a.startAt).toLocaleDateString()}</td>
                              <td className="py-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    a.endAt ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {a.endAt ? 'Historical' : 'Active'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Admin Assignments */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400">Admin Vehicle Mappings</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 uppercase font-black">
                            <th className="pb-2">Admin Name</th>
                            <th className="pb-2">Vehicle Number</th>
                            <th className="pb-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {adminAssignments.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50">
                              <td className="py-3 font-semibold text-slate-700">{a.adminName}</td>
                              <td className="py-3 uppercase font-bold text-blue-900">{a.vehicleNumber}</td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => handleAdminRemove(a.adminId, a.vehicleId)}
                                  className="text-red-600 hover:text-red-700 font-bold"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB: AUDITS --- */}
              {activeTab === 'audits' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400">System Audit Trail</h3>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {auditLogsList.map((log) => (
                      <div key={log.id} className="border border-slate-100 bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase font-bold">{log.action}</span>
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="font-bold text-slate-700 mt-1">
                          Actor: {log.actorName || 'System'} ({log.actorUsername || 'system'})
                        </p>
                        <p className="text-slate-500">
                          Entity: {log.entityType} ({log.entityId || 'N/A'})
                        </p>
                        {log.metadata && (
                          <pre className="bg-white p-2 rounded border border-slate-200 text-[10px] text-slate-600 overflow-x-auto mt-1">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel: Creation Forms (Context-dependent) */}
            <div className="space-y-6">
              {/* USER CREATION / EDITING FORM */}
              {activeTab === 'users' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400">
                    {editingUserId ? 'Edit User Profile' : 'Register User'}
                  </h3>
                  <form onSubmit={handleUserSubmit} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">Driver ID or Username</label>
                      <input
                        type="text"
                        value={userUsername}
                        onChange={(e) => setUserUsername(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={userPhone}
                        onChange={(e) => setUserPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">
                        Password {editingUserId && '(leave blank to keep unchanged)'}
                      </label>
                      <input
                        type="password"
                        value={userPassword}
                        onChange={(e) => setUserPassword(e.target.value)}
                        required={!editingUserId}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">System Role</label>
                      <select
                        value={userRole}
                        onChange={(e) => setUserRole(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                      >
                        <option value="DRIVER">Driver</option>
                        <option value="ADMIN">Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">Availability Status</label>
                      <select
                        value={userStatus}
                        onChange={(e) => setUserStatus(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="LEAVE">Leave</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg py-2.5 font-bold uppercase shadow"
                      >
                        Save User
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
                          className="bg-slate-200 text-slate-600 rounded-lg px-4 py-2.5 font-bold uppercase"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* VEHICLE CREATION / EDITING FORM */}
              {activeTab === 'vehicles' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400">
                    {editingVehicleId ? 'Edit Vehicle Status' : 'Add Vehicle'}
                  </h3>
                  <form onSubmit={handleVehicleSubmit} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">Vehicle Registration Number</label>
                      <input
                        type="text"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 uppercase"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">Breakdown Status</label>
                      <select
                        value={vehicleStatus}
                        onChange={(e) => setVehicleStatus(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                      >
                        <option value="ACTIVE">Active (Available)</option>
                        <option value="BREAKDOWN">Breakdown</option>
                        <option value="INACTIVE">Inactive (Deactivated)</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg py-2.5 font-bold uppercase shadow"
                      >
                        Save Vehicle
                      </button>
                      {editingVehicleId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVehicleId(null);
                            setVehicleNumber('');
                          }}
                          className="bg-slate-200 text-slate-600 rounded-lg px-4 py-2.5 font-bold uppercase"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* DRIVER AND ADMIN ASSIGNMENTS FORM PANEL */}
              {activeTab === 'assignments' && (
                <div className="space-y-6">
                  {/* Assign Driver to Vehicle */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400">Assign Driver to Slot</h3>
                    <form onSubmit={handleDriverAssign} className="space-y-3.5 text-xs">
                      <div>
                        <label className="block font-bold uppercase text-slate-400 mb-1">Target Vehicle</label>
                        <select
                          value={assignVehicleId}
                          onChange={(e) => setAssignVehicleId(e.target.value)}
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold uppercase"
                        >
                          <option value="">Select Vehicle</option>
                          {vehiclesList.map((v) => (
                            <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.status})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold uppercase text-slate-400 mb-1">Driver</label>
                        <select
                          value={assignDriverId}
                          onChange={(e) => setAssignDriverId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold"
                        >
                          <option value="">Unassign / Leave Slot Empty</option>
                          {usersList
                            .filter((u) => u.role === 'DRIVER')
                            .map((u) => (
                              <option key={u.id} value={u.id}>{u.name} ({u.usernameOrEmail} - {u.status})</option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold uppercase text-slate-400 mb-1">Vehicle Slot</label>
                        <select
                          value={assignSlot}
                          onChange={(e) => setAssignSlot(parseInt(e.target.value, 10))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold"
                        >
                          <option value={1}>Driver Slot 1</option>
                          <option value={2}>Driver Slot 2</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-blue-900 hover:bg-blue-800 text-white rounded-lg py-2.5 font-bold uppercase shadow pt-2"
                      >
                        Update Driver Assignment
                      </button>
                    </form>
                  </div>

                  {/* Assign Vehicle to Admin */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400">Map Vehicle to Admin</h3>
                    <form onSubmit={handleAdminAssign} className="space-y-3.5 text-xs">
                      <div>
                        <label className="block font-bold uppercase text-slate-400 mb-1">System Admin</label>
                        <select
                          value={assignAdminId}
                          onChange={(e) => setAssignAdminId(e.target.value)}
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold"
                        >
                          <option value="">Select Admin</option>
                          {usersList
                            .filter((u) => u.role === 'ADMIN')
                            .map((u) => (
                              <option key={u.id} value={u.id}>{u.name} ({u.usernameOrEmail})</option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold uppercase text-slate-400 mb-1">Target Vehicle</label>
                        <select
                          value={assignAdminVehicleId}
                          onChange={(e) => setAssignAdminVehicleId(e.target.value)}
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold uppercase"
                        >
                          <option value="">Select Vehicle</option>
                          {vehiclesList.map((v) => (
                            <option key={v.id} value={v.id}>{v.vehicleNumber}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-blue-900 hover:bg-blue-800 text-white rounded-lg py-2.5 font-bold uppercase shadow pt-2"
                      >
                        Grant Admin Permission
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
