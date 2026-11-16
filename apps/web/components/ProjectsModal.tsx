'use client';

import React, { useState, useEffect } from 'react';
import type { OpenLyricsDocument } from '@/types/lyrics';
import { Folder, FilePlus, Trash2, Clock, Check, Search, ArrowRight } from 'lucide-react';
import { LocalFolderSyncCard } from './LocalFolderSyncCard';

import {
  type ProjectRecord,
  ACTIVE_PROJECT_ID_KEY,
  getSavedProjects,
  saveProjectToStorage,
  deleteProjectFromStorage,
} from '@/lib/db';

export type SavedProject = ProjectRecord;
export { ACTIVE_PROJECT_ID_KEY, getSavedProjects, saveProjectToStorage, deleteProjectFromStorage };

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDoc: OpenLyricsDocument;
  currentTitle: string;
  activeProjectId: string | null;
  onSelectProject: (project: SavedProject) => void;
  onNewBlankProject: () => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  currentDoc,
  currentTitle,
  activeProjectId,
  onSelectProject,
  onNewBlankProject,
}) => {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      getSavedProjects().then((items) => {
        if (isMounted) {
          setProjects(items);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = await deleteProjectFromStorage(id);
    setProjects(updated);
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimeAgo = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-modal-3d-backdrop animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-lg glass-modal-3d rounded-2xl overflow-hidden flex flex-col max-h-[85vh] animate-modal-pop-3d">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2 text-white">
            <Folder className="w-5 h-5 text-zinc-300" />
            <h2 className="text-base font-bold text-white tracking-tight">Projects</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* New Blank Project Action */}
          <button
            type="button"
            onClick={() => {
              onNewBlankProject();
              onClose();
            }}
            className="w-full p-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white flex items-center justify-between group transition-all cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                <FilePlus className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white">New Blank Project</div>
                <div className="text-xs text-zinc-400">Start with fresh lyrics and clean timeline</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </button>

          {/* Local Disk Folder Sync Card */}
          <LocalFolderSyncCard projects={projects} compact />

          {/* Search Input */}
          {projects.length > 0 && (
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search recent projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-all"
              />
            </div>
          )}

          {/* Recent Projects Section */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-zinc-400 tracking-wider uppercase px-1">
              Recent Projects ({projects.length})
            </div>

            {filteredProjects.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-white/[0.08] rounded-xl text-zinc-500 text-xs">
                {projects.length === 0 ? 'No saved projects yet. Start editing to auto-save.' : 'No projects match your search.'}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredProjects.map((project) => {
                  const isActive = project.id === activeProjectId;
                  return (
                    <div
                      key={project.id}
                      onClick={() => {
                        onSelectProject(project);
                        onClose();
                      }}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer group ${
                        isActive
                          ? 'bg-white/10 border-white/30 text-white shadow-lg'
                          : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.06] text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-white text-zinc-950 font-bold' : 'bg-white/5 text-zinc-400'}`}>
                          {isActive ? <Check className="w-4 h-4" /> : <Folder className="w-4 h-4 text-zinc-300" />}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                            <span>{project.title}</span>
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-sans uppercase bg-white/20 text-white">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate flex items-center gap-2 mt-0.5">
                            <span>{project.artist || 'Unknown Artist'}</span>
                            <span>•</span>
                            <span>{project.lineCount} lines</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          <span>{formatTimeAgo(project.updatedAt)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, project.id)}
                          title="Delete Project"
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between text-xs text-zinc-400">
          <span>Projects auto-saved locally</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
