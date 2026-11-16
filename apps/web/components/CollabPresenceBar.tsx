'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { CollabUser } from '@/types/collab';

interface CollabPresenceBarProps {
  isConnected: boolean;
  isConnecting: boolean;
  roomId: string | null;
  peers: CollabUser[];
  localUser: CollabUser | null;
  onOpenModal: () => void;
}

export const CollabPresenceBar: React.FC<CollabPresenceBarProps> = ({
  isConnected,
  isConnecting,
  roomId,
  peers,
  localUser,
  onOpenModal,
}) => {
  if (!roomId && !isConnected && !isConnecting) {
    return (
      <button
        onClick={onOpenModal}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
        title="Invite others to edit lyrics or listen together"
      >
        <Users className="w-3.5 h-3.5 text-zinc-400" />
        <span>Invite</span>
      </button>
    );
  }

  // Combine unique peers + local user
  const allUsers: CollabUser[] = [];
  if (localUser) {
    allUsers.push({
      ...localUser,
      name: `${localUser.name} (You)`,
    });
  }
  peers.forEach((peer) => {
    if (!allUsers.some((u) => u.id === peer.id)) {
      allUsers.push(peer);
    }
  });

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onOpenModal}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
          isConnected
            ? 'bg-white/10 border-white/30 text-white'
            : isConnecting
            ? 'bg-white/5 border-white/20 text-zinc-400'
            : 'bg-white/5 border-white/10 text-zinc-400'
        }`}
        title="Manage room and listeners"
      >
        {/* Room Code */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-sans font-semibold tracking-wider uppercase text-white">
            {roomId}
          </span>
        </div>

        {/* Stacked Monochrome Avatars */}
        <div className="flex items-center -space-x-1.5 overflow-hidden pl-1">
          {allUsers.slice(0, 4).map((user, idx) => {
            const initial = user.name ? user.name.charAt(0).toUpperCase() : '?';
            const isHost = Boolean(user.isHost);
            return (
              <div
                key={user.id || idx}
                className={`relative inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold select-none ${
                  isHost
                    ? 'bg-white text-zinc-950 ring-1 ring-white'
                    : 'bg-zinc-800 text-zinc-200 ring-1 ring-[#09090b]'
                }`}
                title={`${user.name}${isHost ? ' (Host)' : ''}`}
              >
                {initial}
              </div>
            );
          })}
          {allUsers.length > 4 && (
            <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-900 text-zinc-400 text-[9px] font-medium ring-1 ring-[#09090b]">
              +{allUsers.length - 4}
            </div>
          )}
        </div>
      </button>
    </div>
  );
};
