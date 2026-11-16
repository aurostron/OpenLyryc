'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { OpenLyricsDocument } from '@/types/lyrics';
import {
  getSavedProjects,
  deleteProjectFromStorage,
  SavedProject,
} from './ProjectsModal';
import { LocalFolderSyncCard } from './LocalFolderSyncCard';
import {
  ArrowLeft,
  Search,
  FilePlus,
  Trash2,
  Clock,
  Check,
  FolderOpen,
  Music2,
} from 'lucide-react';

interface ProjectsViewProps {
  onBack: () => void;
  onSelectProject: (project: SavedProject) => void;
  onNewBlankProject: () => void;
  activeProjectId?: string | null;
  currentTitle?: string;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onBack,
  onSelectProject,
  onNewBlankProject,
  activeProjectId,
  currentTitle,
}) => {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;
    getSavedProjects().then((items) => {
      if (isMounted) {
        setProjects(items);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

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
    <div className="flex-1 flex flex-col h-full bg-transparent text-zinc-100 select-none overflow-hidden font-sans">
      {/* Top Bar */}
      <header className="h-13 bg-[#111115] border-b border-white/[0.08] px-6 flex items-center justify-between shrink-0 gap-4 studio-chrome">
        <div className="flex items-center gap-3">
          <motion.button
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            onClick={onBack}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer text-xs font-semibold shadow-sm"
            title="Back to Editor"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.25]" />
            <span>Back</span>
          </motion.button>
          <div className="md:hidden h-4 w-[1px] bg-white/[0.1]" />
          <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-zinc-300" />
            <span>Projects Library</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Global Search Input */}
          <div className="relative w-64 max-w-full">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search saved projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#17171d] border border-white/[0.08] focus:border-white/30 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 outline-none transition-all"
            />
          </div>

          {/* New Blank Project Button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              onNewBlankProject();
              onBack();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 transition-colors font-bold text-xs shadow-sm cursor-pointer"
          >
            <FilePlus className="w-4 h-4 stroke-[2.5]" />
            <span>New Song</span>
          </motion.button>
        </div>
      </header>

      {/* Projects Grid */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Overview Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Recent Sessions</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Switch projects or start a new lyric synchronization.
              </p>
            </div>
            <span className="text-xs text-zinc-500 font-sans">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'} saved
            </span>
          </div>

          {/* Local Disk Folder Sync Card */}
          <LocalFolderSyncCard projects={projects} />

          {/* Grid of Projects */}
          {filteredProjects.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-white/[0.1] rounded-2xl bg-white/[0.01]">
              <Music2 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <div className="text-xs font-bold text-zinc-400">No matching projects found</div>
              <p className="text-[11px] text-zinc-600 mt-1 max-w-xs mx-auto">
                {searchQuery ? 'Try a different search query' : 'Import or paste lyrics in the editor to start saving tracks.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredProjects.map((project) => {
                const isActive = project.id === activeProjectId;
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -3, transition: { duration: 0.15 } }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onSelectProject(project);
                      onBack();
                    }}
                    className={`p-4 rounded-2xl border text-left cursor-pointer group relative flex flex-col justify-between transition-colors ${
                      isActive
                        ? 'bg-[#181822] border-white/30 ring-1 ring-white/20 shadow-lg'
                        : 'bg-[#141418] border-white/[0.08] hover:border-white/20 hover:bg-[#18181d]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="font-bold text-sm text-white group-hover:text-zinc-100 transition-colors truncate">
                          {project.title || 'Untitled Track'}
                        </div>
                        {isActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-white text-zinc-950 text-[10px] font-bold shrink-0 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, project.id)}
                            title="Delete project"
                            className="text-zinc-500 hover:text-red-400 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="text-xs text-zinc-400 font-medium truncate mb-4">
                        {project.artist || 'Unknown Artist'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-[11px] text-zinc-500 font-sans">
                      <span>{project.lineCount} lines</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-600" />
                        <span>{formatTimeAgo(project.updatedAt)}</span>
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
