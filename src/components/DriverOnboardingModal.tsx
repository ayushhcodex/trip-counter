'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import QrCode from '@/components/QrCode';

interface DriverOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DriverOnboardingModal({ isOpen, onClose }: DriverOnboardingModalProps) {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'qr' | 'whatsapp' | 'guide' | 'poster'>('qr');
  const [copied, setCopied] = useState(false);
  const [appUrl, setAppUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppUrl(window.location.origin);
    }
  }, []);

  if (!isOpen) return null;

  const apkUrl = `${appUrl}/downloads/tripzoo.apk`;

  const getWhatsappMessage = () => {
    if (language === 'hi') {
      return `🚗 *ट्रिपज़ू (Trip Zoo) - ड्राइवर ऐप*\n\nसभी ड्राइवर्स कृपया नीचे दिए गए लिंक से Trip Zoo ऐप डाउनलोड व इंस्टॉल करें:\n\n🔗 *वेबसाइट लिंक:* ${appUrl}\n📲 *डायरेक्ट Android APK:* ${apkUrl}\n\n*ऐप इंस्टॉल कैसे करें:*\n1. लिंक पर क्लिक करें (Chrome या ब्राउज़र में)\n2. "Install App" या "Add to Home Screen" दबाएं\n3. अपना Driver ID (उदा. drv0001) और पासवर्ड डालकर लॉगिन करें।`;
    }
    if (language === 'gu') {
      return `🚗 *ટ્રિપઝૂ (Trip Zoo) - ડ્રાઇવર એપ*\n\nબધા ડ્રાઇવરો કૃપા કરીને નીચેની લિંક પરથી Trip Zoo એપ ઇન્સ્ટોલ કરો:\n\n🔗 *વેબસાઇટ લિંક:* ${appUrl}\n📲 *Android APK ડાઉનલોડ:* ${apkUrl}\n\n*ઇન્સ્ટોલ કરવાની રીત:*\n1. લિંક ખોલો અને "Add to Home Screen" અથવા "Install" દબાવો\n2. તમારું Driver ID (દા.ત. drv0001) અને પાસવર્ડથી લોગિન કરો.`;
    }
    return `🚗 *Trip Zoo - Driver App*\n\nAll drivers please install the Trip Zoo app on your mobile phone to record daily trips:\n\n🔗 *Web App Link:* ${appUrl}\n📲 *Direct Android APK:* ${apkUrl}\n\n*How to Install:*\n1. Tap the link to open in Chrome or your phone browser\n2. Tap "Install App" or "Add to Home Screen"\n3. Sign in with your Driver ID (e.g. drv0001) and Password.`;
  };

  const handleCopyWhatsappText = async () => {
    try {
      await navigator.clipboard.writeText(getWhatsappMessage());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenWhatsapp = () => {
    const text = encodeURIComponent(getWhatsappMessage());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      {/* Modal Container */}
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <img
              src="/icons/icon-192x192.png"
              alt="Trip Zoo"
              className="w-10 h-10 rounded-2xl border border-slate-700 object-cover shadow-sm"
            />
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-blue-400">
                Driver Onboarding & App Install
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                {language === 'hi' ? 'ड्राइवर्स के फोन में ऐप इंस्टॉल कराने का टूलकिट' :
                 language === 'gu' ? 'ડ્રાઇવરોના ફોનમાં એપ ઇન્સ્ટોલ કરાવવા માટેની ટૂલકિટ' :
                 'Supervisor toolkit to get all drivers setup in minutes'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('qr')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'qr'
                ? 'bg-white text-blue-600 border-t-2 border-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📱</span>
            <span>Live QR Code</span>
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'whatsapp'
                ? 'bg-white text-emerald-600 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>💬</span>
            <span>WhatsApp Share</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'bg-white text-purple-600 border-t-2 border-purple-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📖</span>
            <span>Install Guide</span>
          </button>
          <button
            onClick={() => setActiveTab('poster')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'poster'
                ? 'bg-white text-amber-600 border-t-2 border-amber-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🖨️</span>
            <span>Print Depot Poster</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: LIVE QR CODE */}
          {activeTab === 'qr' && (
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl p-4 text-xs font-medium max-w-lg">
                💡 <strong>In-Person Roll Call:</strong> Ask drivers to open their phone camera, Google Lens, or WhatsApp scanner and point at this QR code.
              </div>

              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 shadow-inner flex flex-col items-center">
                <QrCode value={appUrl || 'https://tripcounter.app'} size={220} />
                <p className="text-xs font-mono font-bold text-slate-500 mt-2 truncate max-w-xs">
                  {appUrl}
                </p>
              </div>

              {/* Direct APK Download Link */}
              <div className="w-full max-w-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-wider text-blue-200">Alternative Option</p>
                  <p className="text-sm font-extrabold">Download Android APK directly</p>
                  <p className="text-[11px] text-blue-100">For Samsung / Vivo / Mi phones</p>
                </div>
                <a
                  href="/downloads/tripzoo.apk"
                  download="tripzoo.apk"
                  className="bg-white hover:bg-blue-50 text-blue-900 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm shrink-0"
                >
                  Download .APK ⬇️
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: WHATSAPP SHARE */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 font-medium">
                📲 Send this pre-formatted message directly to your Driver WhatsApp Group. It contains the web app link and direct APK download link!
              </div>

              <div className="bg-slate-900 text-emerald-400 p-4 rounded-2xl font-mono text-xs whitespace-pre-line leading-relaxed border border-slate-800 shadow-inner">
                {getWhatsappMessage()}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleOpenWhatsapp}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <span>💬</span>
                  <span>Open WhatsApp & Send</span>
                </button>
                <button
                  onClick={handleCopyWhatsappText}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-700"
                >
                  <span>{copied ? '✓' : '📋'}</span>
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Message Text'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: STEP BY STEP GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Android Chrome */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                    <span className="text-lg">🤖</span>
                    <span>Android (Google Chrome)</span>
                  </div>
                  <ol className="text-xs text-slate-600 space-y-1.5 list-decimal pl-4">
                    <li>Open <strong>{appUrl || 'Trip Zoo'}</strong> in Chrome.</li>
                    <li>Tap <strong>&quot;Install App&quot;</strong> on the bottom banner.</li>
                    <li>Or tap Chrome menu (<strong>⋮</strong> at top right) $\rightarrow$ select <strong>&quot;Add to Home screen&quot;</strong>.</li>
                  </ol>
                </div>

                {/* Samsung / Vivo / Mi */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                    <span className="text-lg">📱</span>
                    <span>Samsung / Vivo / Mi Browser</span>
                  </div>
                  <ol className="text-xs text-slate-600 space-y-1.5 list-decimal pl-4">
                    <li>Tap browser Menu (<strong>☰</strong> or <strong>⋮</strong>).</li>
                    <li>Select <strong>&quot;Add page to&quot;</strong> or <strong>&quot;Add to Desktop&quot;</strong>.</li>
                    <li><strong>Best Alternative:</strong> Download and install the <strong>.APK</strong> file directly!</li>
                  </ol>
                </div>

                {/* iPhone Safari */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 sm:col-span-2">
                  <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                    <span className="text-lg">🍏</span>
                    <span>iPhone (Apple Safari)</span>
                  </div>
                  <ol className="text-xs text-slate-600 space-y-1.5 list-decimal pl-4">
                    <li>Open link in <strong>Safari</strong> browser.</li>
                    <li>Tap the <strong>Share button</strong> (square with up arrow 📤 at bottom of screen).</li>
                    <li>Scroll down and tap <strong>&quot;Add to Home Screen&quot; (+)</strong>.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRINTABLE DEPOT POSTER */}
          {activeTab === 'poster' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl text-xs font-medium">
                🖨️ <strong>Notice Board Poster:</strong> Print this clean A4 sheet and pin it at the depot counter, driver rest room, or inside vehicle cabins.
              </div>

              {/* Printable Card Preview */}
              <div className="border-2 border-dashed border-slate-300 rounded-3xl p-6 bg-white text-center space-y-4 shadow-xs">
                <div className="flex flex-col items-center">
                  <img
                    src="/icons/icon-192x192.png"
                    alt="Trip Zoo"
                    className="w-16 h-16 rounded-2xl border border-slate-200 shadow-md mb-2"
                  />
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">TRIP ZOO</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Driver Trip Verification App
                  </p>
                </div>

                <div className="flex justify-center py-2">
                  <QrCode value={appUrl || 'https://tripcounter.app'} size={180} />
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-slate-700 max-w-sm mx-auto space-y-1 text-left font-medium">
                  <p className="font-bold text-slate-900 text-center mb-1">📲 Scan & Install / स्कैन करके ऐप लगाएं</p>
                  <p>1. Phone Camera से QR Code स्कैन करें</p>
                  <p>2. &quot;Add to Home Screen&quot; / &quot;Install&quot; दबाएं</p>
                  <p>3. Driver ID (उदा. drv0001) से लॉगिन करें</p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handlePrint}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <span>🖨️</span>
                  <span>Print A4 Depot Poster</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-400 font-medium">Trip Zoo Fleet System</span>
          <button
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
