'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AppBackdropFit, AppBackdropType } from '@/types/settings';
import { isVideoUrl } from '@/lib/appBackdrop';

export type { AppBackdropFit };

interface AppBackdropProps {
  imageUrl?: string;
  url?: string;
  type?: AppBackdropType;
  /** Black veil opacity over the backdrop (0..0.9). */
  dim?: number;
  /** Backdrop blur in px (0..24). */
  blur?: number;
  fit?: AppBackdropFit;
  hardwareAcceleration?: boolean;
  onError?: () => void;
}

/**
 * Global Studio backdrop: bottom-most layer (z-0, pointer-transparent).
 * Chrome (dock/header/cards/modals), YouTube embeds and Stage renderers all
 * paint above with their own surfaces, so they keep priority untouched.
 * Supports both static/animated images and hardware-accelerated looping videos.
 * Renders nothing when no media is set — zero visual change by default.
 */
export const AppBackdrop: React.FC<AppBackdropProps> = ({
  imageUrl,
  url,
  type = 'auto',
  dim = 0.6,
  blur = 10,
  fit = 'cover',
  hardwareAcceleration = true,
  onError,
}) => {
  const mediaUrl = url || imageUrl;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Reset failure state if the URL changes
  useEffect(() => {
    setLoadFailed(false);
  }, [mediaUrl]);

  // Global flag so chrome (dock/header/footer/view headers) can turn glassy
  // only while a backdrop is set — zero visual change otherwise.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const hasBackdrop = Boolean(mediaUrl && !loadFailed);
    document.body.classList.toggle('has-app-backdrop', hasBackdrop);
    return () => {
      document.body.classList.remove('has-app-backdrop');
    };
  }, [mediaUrl, loadFailed]);

  const isVideo =
    Boolean(mediaUrl) &&
    (type === 'video' || (type !== 'image' && isVideoUrl(mediaUrl)));

  // Lifecycle optimization: pause video during tab backgrounding to drop CPU/GPU usage to 0%
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isVideo, mediaUrl]);

  if (!mediaUrl || loadFailed) return null;

  const objectClass =
    fit === 'contain' ? 'object-contain' : fit === 'fill' ? 'object-fill' : 'object-cover';

  // Apply effective blur only if hardware acceleration is enabled or minimal
  const effectiveBlur = hardwareAcceleration ? blur : Math.min(blur, 4);

  // Hardware compositing: translate3d + contain:strict prevents video repaint invalidation
  // from bleeding into the lyrics renderer or UI elements on the main thread.
  const layerStyle: React.CSSProperties = {
    filter: effectiveBlur > 0 ? `blur(${effectiveBlur}px)` : undefined,
    transform: effectiveBlur > 0 ? 'scale(1.06) translate3d(0, 0, 0)' : 'translate3d(0, 0, 0)',
    willChange: effectiveBlur > 0 ? 'transform, filter' : 'transform',
    contain: 'strict',
    pointerEvents: 'none',
  };

  const handleMediaError = () => {
    setLoadFailed(true);
    onError?.();
  };

  return (
    <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
      {isVideo ? (
        <video
          ref={videoRef}
          src={mediaUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          onError={handleMediaError}
          className={`absolute inset-0 w-full h-full ${objectClass}`}
          style={layerStyle}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={mediaUrl}
          alt=""
          draggable={false}
          onError={handleMediaError}
          className={`absolute inset-0 w-full h-full ${objectClass}`}
          style={layerStyle}
        />
      )}
      {dim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: dim }} />}
    </div>
  );
};
