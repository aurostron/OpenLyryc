'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Achievement } from '@/lib/achievements';
import { AchievementStickers } from './AchievementStickers';

interface SteamAchievementToastProps {
  achievement: Achievement | null;
  onDismiss: () => void;
  playSound?: boolean;
}

function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const audio = new Audio('/notification.wav');
    audio.volume = 0.50;
    audio.play().catch(() => {});
  } catch {}
}

export const SteamAchievementToast: React.FC<SteamAchievementToastProps> = ({
  achievement,
  onDismiss,
  playSound = true,
}) => {
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!achievement) {
      setVisible(false);
      return;
    }

    // Sound fires immediately
    if (playSound) {
      playNotificationSound();
    }

    // Toast appears 150 ms later so the chime leads
    const showDelay = setTimeout(() => setVisible(true), 300);

    return () => clearTimeout(showDelay);
  }, [achievement, playSound]);

  // Auto-dismiss timer starts once the toast is actually visible
  useEffect(() => {
    if (!visible || !achievement) return;

    setProgress(100);
    const duration = 5000;
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [visible, achievement, onDismiss]);

  if (!achievement || !visible) return null;

  const StickerIcon =
    AchievementStickers[achievement.id] || AchievementStickers['first-pioneer'];

  return (
    <AnimatePresence>
      <motion.div
        key={achievement.id}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
        className="fixed bottom-6 right-6 z-50 max-w-[420px] w-full select-none font-sans"
      >
        <div className="relative overflow-hidden rounded-[20px] bg-[#0e0e12]/95 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl p-3 flex items-center gap-3 group">
          <div className="shrink-0 w-11 h-11 flex items-center justify-center">
            <StickerIcon className="w-11 h-11" />
          </div>

          <div className="min-w-0 flex-1 py-0.5">
            <h4 className="text-[13px] font-medium text-white tracking-tight leading-snug mt-0.5">
              {achievement.title}
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-normal">
              {achievement.description}
            </p>
          </div>

          <button
            onClick={onDismiss}
            className="w-6 h-6 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer shrink-0 self-start mt-0.5"
            aria-label="Dismiss achievement"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.04]">
            <div
              className="h-full transition-all duration-75 ease-linear opacity-70"
              style={{
                width: `${progress}%`,
                backgroundColor: achievement.accentColor,
              }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};