'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('ServiceWorker registered with scope:', registration.scope);
        },
        (error) => {
          console.error('ServiceWorker registration failed:', error);
        }
      );
    }
  }, []);

  return null;
}
