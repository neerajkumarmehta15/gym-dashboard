'use client';

import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if user has already dismissed prompt recently
    const dismissed = localStorage.getItem('gymnation_pwa_dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Don't show again for 7 days if dismissed
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Detect standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) {
      return;
    }

    // Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    if (iosDevice) {
      // Show prompt after 3 seconds on iOS
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Listen for beforeinstallprompt on Android / Chrome / Windows / Mac
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gymnation_pwa_dismissed', Date.now().toString());
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 z-50 max-w-sm w-full animate-bounce-short">
      <div className="glass-panel p-4.5 rounded-2xl border border-brand-volt/40 bg-slate-950/95 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Glow accent */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-brand-volt/20 blur-2xl rounded-full pointer-events-none" />

        <button 
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          title="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          <div className="p-2.5 rounded-xl bg-brand-volt/10 border border-brand-volt/30 text-brand-volt shrink-0 mt-0.5">
            <Smartphone className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5 uppercase font-sans">
              Install GYMNATION App
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {isIOS ? (
                <span>Tap <Share className="w-3.5 h-3.5 inline mx-1 text-brand-volt" /> then select <strong>Add to Home Screen</strong> for 1-tap app access!</span>
              ) : (
                <span>Add GYMNATION to your home screen for ultra-fast 1-tap app access!</span>
              )}
            </p>

            {!isIOS && deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="mt-2.5 px-4 py-2 bg-brand-volt text-black font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 glow-btn-volt transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Install App Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
