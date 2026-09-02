'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!usernameOrEmail || !password) {
      setErrorMsg('Please enter both your ID/Username and Password.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Invalid credentials or login failed.');
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        // Successful login, redirect depending on role
        const role = data.user.role;
        if (role === 'SUPER_ADMIN') {
          router.push('/superadmin');
        } else if (role === 'ADMIN') {
          router.push('/admin');
        } else if (role === 'DRIVER') {
          router.push('/driver');
        } else {
          setErrorMsg('Unauthorized account role.');
        }
      }
    } catch (err) {
      console.error('Login request failed:', err);
      setErrorMsg('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-100 p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 border border-slate-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-blue-900 tracking-tight">TripCounter</h1>
          <p className="text-slate-500 text-sm mt-1 font-semibold">
            Sign in to your account
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-xs font-semibold mb-6 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-1.5">
              Driver ID or Username/Email
            </label>
            <input
              type="text"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder="e.g. DRV001 or admin@tripcounter.org"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-600 focus:bg-white text-slate-800 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-600 focus:bg-white text-slate-800 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full bg-blue-900 hover:bg-blue-800 text-white rounded-lg py-3.5 text-sm font-bold shadow-md hover:shadow-lg transition-all focus:outline-none ${
              submitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-400 font-semibold border-t border-slate-100 pt-6">
          Authorized personnel only. Contact administration for account setup.
        </div>
      </div>
    </div>
  );
}
