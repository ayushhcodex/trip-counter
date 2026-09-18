'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';

export default function TermsOfServicePage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <Link href="/login" className="flex items-center space-x-2.5 hover:opacity-90 transition-opacity">
            <img
              src="/icons/icon-192x192.png"
              alt="Trip Zoo"
              className="w-9 h-9 rounded-xl shadow-sm border border-slate-700 object-cover shrink-0"
            />
            <span className="font-black text-lg tracking-tight text-blue-400">{t('common.appName')}</span>
          </Link>
        </div>
        <div className="flex items-center space-x-2">
          <LanguageSelector variant="header" />
          <Link
            href="/login"
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl border border-slate-700 font-bold transition-all"
          >
            ← {t('common.back')}
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl w-full mx-auto px-4 py-8 sm:py-12 space-y-6 flex-1">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {t('common.termsOfService')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Last Updated: March 2025 • Version 1.0
            </p>
          </div>

          <div className="prose prose-slate max-w-none text-sm text-slate-600 space-y-5 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>1. Acceptance of Terms</span>
              </h2>
              <p>
                By accessing and using the <strong>Trip Zoo</strong> application (&quot;App&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the App.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>2. Authorized Fleet Use Only</span>
              </h2>
              <p>
                Trip Zoo is designed strictly for registered drivers, fleet supervisors, and fleet managers. Unauthorized access, account sharing, or falsification of vehicle trip and diesel records is strictly prohibited.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>3. Driver Responsibilities</span>
              </h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Drivers must accurately record trip completions upon physical delivery/run completion.</li>
                <li>Drivers must ensure their assigned vehicle registration number matches the vehicle in operation.</li>
                <li>Keep account credentials secure and report any unauthorized access to the depot supervisor immediately.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>4. Supervisor & Audit Adjustments</span>
              </h2>
              <p>
                Supervisors hold administrative authority to verify daily trip counts, make corrections or manual adjustments with recorded rationale, and manage diesel allocations. All adjustments are permanently recorded in the system audit log.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>5. Service Availability & Offline Usage</span>
              </h2>
              <p>
                Trip Zoo includes offline synchronization capabilities. However, users must ensure their device connects to the internet periodically to upload queued offline records and synchronize verified counts.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>6. Termination of Access</span>
              </h2>
              <p>
                Fleet management reserves the right to deactivate or revoke account access for any driver or staff member found violating operational procedures or providing false trip verification data.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 px-4 text-center border-t border-slate-800 space-y-2">
        <div className="flex justify-center space-x-4 font-semibold">
          <Link href="/privacy" className="hover:text-slate-200">{t('common.privacyPolicy')}</Link>
          <span>•</span>
          <Link href="/terms" className="text-blue-400 hover:underline">{t('common.termsOfService')}</Link>
          <span>•</span>
          <Link href="/legal" className="hover:text-slate-200">{t('common.legalNotice')}</Link>
        </div>
        <p>© {new Date().getFullYear()} Trip Zoo. {t('common.allRightsReserved')}</p>
      </footer>
    </div>
  );
}
