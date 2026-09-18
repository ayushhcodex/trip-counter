'use client';

import React, { useMemo } from 'react';
import { generateQrSvg } from '@/lib/qrcode';

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QrCode({ value, size = 200, className = '' }: QrCodeProps) {
  const svgHtml = useMemo(() => {
    if (!value) return '';
    try {
      return generateQrSvg(value, size);
    } catch (e) {
      console.error('Failed to generate QR:', e);
      return '';
    }
  }, [value, size]);

  if (!svgHtml) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-slate-100 rounded-2xl border border-slate-200 text-xs text-slate-400 font-semibold ${className}`}
      >
        QR Code
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center bg-white p-2 rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}
