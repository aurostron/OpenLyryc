'use client';

import React, { useEffect, useRef } from 'react';
import { CollabUser } from '@/types/collab';

interface CollabCursorsProps {
  peers: CollabUser[];
  roomMode?: 'edit' | 'party';
}

interface PeerCursorState {
  id: string;
  name: string;
  color: string;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  lastUpdated: number;
  visible: boolean;
  element: HTMLDivElement | null;
}

export const CollabCursors: React.FC<CollabCursorsProps> = ({ peers, roomMode }) => {
  const cursorsRef = useRef<Map<string, PeerCursorState>>(new Map());
  const animFrameRef = useRef<number | null>(null);

  // Sync peer list metadata (name, color) into our interpolation map
  useEffect(() => {
    const map = cursorsRef.current;
    peers.forEach((peer) => {
      let state = map.get(peer.id);
      if (!state) {
        state = {
          id: peer.id,
          name: peer.name || 'Writer',
          color: peer.color || '#ffffff',
          currentX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
          currentY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
          targetX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
          targetY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
          lastUpdated: Date.now(),
          visible: false,
          element: null,
        };
        map.set(peer.id, state);
      } else {
        state.name = peer.name || state.name;
        state.color = peer.color || state.color;
      }
    });

    // Cleanup peers that left the room
    const activeIds = new Set(peers.map((p) => p.id));
    map.forEach((_, id) => {
      if (!activeIds.has(id)) {
        map.delete(id);
      }
    });
  }, [peers]);

  // Listen directly to fast remote cursor data events without re-rendering parent components
  useEffect(() => {
    const handleRemoteCursor = (e: Event) => {
      const customEvent = e as CustomEvent<{
        peerId: string;
        cursor: { x: number; y: number };
        peer?: CollabUser;
      }>;
      const detail = customEvent.detail;
      if (!detail || !detail.peerId || !detail.cursor) return;

      const map = cursorsRef.current;
      let state = map.get(detail.peerId);

      // Convert percentage coordinates (0-100) to current window pixels
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1000;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

      const px = detail.cursor.x <= 0 && detail.cursor.y <= 0 && detail.cursor.x < -100
        ? -999
        : (detail.cursor.x / 100) * winW;
      const py = detail.cursor.y <= 0 && detail.cursor.x <= 0 && detail.cursor.x < -100
        ? -999
        : (detail.cursor.y / 100) * winH;

      if (px < 0 || py < 0) {
        // Cursor left window
        if (state) {
          state.visible = false;
        }
        return;
      }

      if (!state) {
        state = {
          id: detail.peerId,
          name: detail.peer?.name || 'Writer',
          color: detail.peer?.color || '#ffffff',
          currentX: px,
          currentY: py,
          targetX: px,
          targetY: py,
          lastUpdated: Date.now(),
          visible: true,
          element: null,
        };
        map.set(detail.peerId, state);
      } else {
        state.targetX = px;
        state.targetY = py;
        state.lastUpdated = Date.now();
        state.visible = true;
      }
    };

    const handlePeerLeave = (e: Event) => {
      const custom = e as CustomEvent<{ peerId: string }>;
      if (custom.detail?.peerId) {
        cursorsRef.current.delete(custom.detail.peerId);
      }
    };

    window.addEventListener('openlyryc:collab-cursor', handleRemoteCursor);
    window.addEventListener('openlyryc:collab-cursor-leave', handlePeerLeave);

    return () => {
      window.removeEventListener('openlyryc:collab-cursor', handleRemoteCursor);
      window.removeEventListener('openlyryc:collab-cursor-leave', handlePeerLeave);
    };
  }, []);

  // Continuous 60/120 FPS spring-lerp interpolation loop
  useEffect(() => {
    const LERP_FACTOR = 0.32; // Responsive damping factor: fluid, zero teleportation
    const HIDE_TIMEOUT_MS = 3500; // Auto-fade cursor if peer stops moving for 3.5s

    const renderLoop = () => {
      const now = Date.now();
      cursorsRef.current.forEach((state) => {
        if (!state.element) return;

        // Auto-fade idle cursor
        if (now - state.lastUpdated > HIDE_TIMEOUT_MS) {
          state.visible = false;
        }

        // Smooth linear interpolation (lerp) towards target coordinate
        const dx = state.targetX - state.currentX;
        const dy = state.targetY - state.currentY;

        state.currentX += dx * LERP_FACTOR;
        state.currentY += dy * LERP_FACTOR;

        state.element.style.transform = `translate3d(${state.currentX}px, ${state.currentY}px, 0)`;
        state.element.style.opacity = state.visible ? '1' : '0';
      });

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {peers.map((peer) => {
        const color = peer.color || '#ffffff';
        return (
          <div
            key={peer.id}
            ref={(el) => {
              const state = cursorsRef.current.get(peer.id);
              if (state) state.element = el;
            }}
            className="absolute top-0 left-0 transition-opacity duration-300 pointer-events-none will-change-transform opacity-0"
            style={{
              transform: 'translate3d(-100px, -100px, 0)',
            }}
          >
            {/* High-contrast Monochrome SVG Cursor Pointer */}
            <svg
              className="w-5 h-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 2L10.8 23.5L14.7 15.2L23 12.3L3 2Z"
                fill={color}
                stroke="#09090b"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>

            {/* Subtle Translucent Name Tag */}
            <div className="absolute left-3.5 top-3.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-white bg-black/75 backdrop-blur-md border border-white/20 whitespace-nowrap select-none shadow-md">
              <span>{peer.name || 'Writer'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
