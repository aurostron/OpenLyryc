'use client';

import React, { useState, useRef } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { TurnstileWidget, PRODUCTION_SITE_KEY, TurnstileWidgetRef } from '@/components/TurnstileWidget';

interface TurnstileGateProps {
  section: 'metadata' | 'unison' | 'share';
  onBack?: () => void;
  children: React.ReactNode;
}

export const TurnstileGate: React.FC<TurnstileGateProps> = ({
  section,
  onBack,
  children,
}) => {
  const widgetRef = useRef<TurnstileWidgetRef>(null);
  const storageKey = `openlyryc_turnstile_${section}`;

  // Session verification state (2 hour cache in browser session)
  const [isVerified, setIsVerified] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - (parsed.timestamp || 0) < 2 * 60 * 60 * 1000) {
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSuccess = (token: string) => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          token,
          timestamp: Date.now(),
        })
      );
    } catch {
      // ignore
    }

    setIsVerified(true);
  };

  // If verified, render children cleanly without any overlay, badges, or watermarks
  if (isVerified) {
    return <>{children}</>;
  }

  // Verification Gate View
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 font-sans text-zinc-100">
      <div className="relative w-full max-w-sm bg-[#0c0c0e] border border-white/[0.08] rounded-2xl shadow-2xl p-6 text-center space-y-5 animate-in zoom-in-95 duration-150">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-4 right-4 w-7 h-7 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Back to editor"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="space-y-2 pt-2">
          <div className="w-11 h-11 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto text-white">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>

          <h2 className="text-base font-semibold text-white tracking-tight">
            Sure you not a robo?
          </h2>
        </div>

        {/* Turnstile Widget */}
        <div className="flex flex-col items-center justify-center min-h-[68px]">
          {errorMessage && (
            <p className="text-[11px] text-zinc-400 mb-2">{errorMessage}</p>
          )}

          <TurnstileWidget
            ref={widgetRef}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY || PRODUCTION_SITE_KEY}
            onSuccess={handleSuccess}
            onError={(err) => setErrorMessage(`Error: ${err}`)}
            onExpire={() => setErrorMessage('Expired, try again.')}
          />
        </div>

        {/* Footer */}
        {onBack && (
          <div className="pt-1">
            <button
              onClick={onBack}
              className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Back to editor
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
