'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';

export default function PrivacyPolicyPage() {
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
              {t('common.privacyPolicy')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Last Updated: March 2025 • Version 1.0
            </p>
          </div>

          <div className="prose prose-slate max-w-none text-sm text-slate-600 space-y-5 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>1. Overview & Purpose</span>
              </h2>
              <p>
                <strong>Trip Zoo</strong> (&quot;we&quot;, &quot;our&quot;, or &quot;the Platform&quot;), operated by <strong>Rentzoo Private Limited</strong>, is a mobile-first fleet operations and trip verification management system. This Privacy Policy explains how we collect, use, process, and safeguard information when drivers, supervisors, and administrators use the Trip Zoo web application and mobile application.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>2. Information We Collect</span>
              </h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account & Identification Data:</strong> Driver IDs (e.g. <code>drv0001</code>), username, full name, phone number, and system role.</li>
                <li><strong>Fleet Operational Records:</strong> Vehicle numbers, slot assignments, trip completion timestamps, daily verified trip counts, and diesel/fuel entry logs.</li>
                <li><strong>Audit & Verification Logs:</strong> Supervisor adjustments, timestamps of verification, and administrative audit trails.</li>
                <li><strong>Technical & Offline Storage:</strong> Local browser storage and Service Worker cache on your device to enable offline trip logging and instant network sync.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>3. How We Use Information</span>
              </h2>
              <p>The collected information is strictly used for:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Verifying and recording fleet transport trips accurately.</li>
                <li>Managing vehicle assignments and diesel/fuel distribution.</li>
                <li>Preventing duplicate trip submissions and verifying driver shifts.</li>
                <li>Generating operational reports for fleet administrators and supervisors.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>4. Data Security & Storage</span>
              </h2>
              <p>
                All account credentials are protected using industry-standard hashing (bcrypt). Communication between mobile devices and the Trip Zoo server is encrypted via HTTPS / TLS. Access to fleet logs is strictly restricted based on user role (Driver, Supervisor, Admin, Super Admin).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>5. Offline Data & Sync</span>
              </h2>
              <p>
                When trips are logged without an active internet connection, records are stored safely in the device&apos;s local cache (IndexedDB/CacheStorage) and automatically synchronized with the main database once connectivity is restored.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>6. Contact & Support</span>
              </h2>
              <p>
                If you have any questions regarding your account data or privacy practices, please contact your depot supervisor or reach out to <strong>Rentzoo Private Limited</strong>.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 px-4 text-center border-t border-slate-800 space-y-2">
        <div className="flex justify-center space-x-4 font-semibold">
          <Link href="/privacy" className="text-blue-400 hover:underline">{t('common.privacyPolicy')}</Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-slate-200">{t('common.termsOfService')}</Link>
          <span>•</span>
          <Link href="/legal" className="hover:text-slate-200">{t('common.legalNotice')}</Link>
        </div>
        <p>© {new Date().getFullYear()} Rentzoo Private Limited. {t('common.allRightsReserved')}</p>
      </footer>
    </div>
  );
}
