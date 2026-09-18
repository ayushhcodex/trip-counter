'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface ShareButtonProps {
  variant?: 'button' | 'icon' | 'banner';
  className?: string;
}

export default function ShareButton({ variant = 'button', className = '' }: ShareButtonProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.origin : '';
    const shareData = {
      title: 'Trip Zoo',
      text: 'Access & Download the Trip Zoo app:',
      url: url,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled share dialog or native share fell back
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleShare}
        title={copied ? t('common.linkCopied') : t('common.shareApp')}
        className={`relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all text-sm font-bold flex items-center justify-center ${className}`}
      >
        {copied ? '✓' : '🔗'}
      </button>
    );
  }

  if (variant === 'banner') {
    return (
      <button
        onClick={handleShare}
        className={`w-full flex items-center justify-center space-x-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs ${className}`}
      >
        <span className="text-base">📲</span>
        <span>{copied ? t('common.linkCopied') : t('common.shareApp')}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className={`flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs px-3 py-1.5 rounded-xl font-bold border border-slate-700 transition-all ${className}`}
    >
      <span>{copied ? '✓' : '📤'}</span>
      <span>{copied ? t('common.linkCopied') : t('common.shareApp')}</span>
    </button>
  );
}
