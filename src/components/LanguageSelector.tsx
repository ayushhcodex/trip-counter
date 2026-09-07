'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Language } from '@/lib/i18n/types';

interface LanguageSelectorProps {
  variant?: 'header' | 'segmented' | 'dropdown';
  className?: string;
}

export function LanguageSelector({
  variant = 'header',
  className = '',
}: LanguageSelectorProps) {
  const { language, setLanguage, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Segmented Pill Toggle (great for login and settings)
  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center p-1 bg-slate-200/80 rounded-xl border border-slate-300/60 shadow-inner ${className}`}
      >
        {languages.map((lang) => {
          const isActive = language === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang.nativeLabel}
            </button>
          );
        })}
      </div>
    );
  }

  // Header dropdown / toggle (great for dark and light navbars)
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 bg-slate-800/80 hover:bg-slate-700/90 text-slate-200 hover:text-white border border-slate-700/60 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Change Language / भाषा बदलें / ભાષા બદલો"
      >
        <span className="text-sm leading-none">🌐</span>
        <span className="uppercase font-extrabold text-[11px] tracking-wide">
          {language === 'en' ? 'EN' : language === 'hi' ? 'हिन्दी' : 'ગુજરાતી'}
        </span>
        <span className="text-[9px] text-slate-400">▼</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-36 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs font-semibold animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
            Select Language
          </div>
          {languages.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                  isSelected ? 'text-blue-900 font-black bg-blue-50/50' : 'text-slate-700'
                }`}
              >
                <span>{lang.nativeLabel}</span>
                {isSelected && <span className="text-blue-900 font-black text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
