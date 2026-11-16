'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { OpenLyricsDocument, SongSearchResult } from '@/types/lyrics';
import { fetchOnlineLyricsDocument, searchAllOnlineLyrics } from '@/lib/onlineLyricsService';
import { resolveLyricsWithAutoRetry } from '@/lib/lyricsResolver';
import { fetchArtworkUrl } from '@/lib/artworkFetcher';
import { detectBestInstrumentalYouTubeMatch } from '@/lib/youtubeAutoDetector';
import { fetchUnisonLyricsByVideo, fetchUnisonLyricsVariant } from '@/lib/unison/apiClient';
import { parseTTML } from '@/lib/ttmlParser';
import { parseLRC } from '@/lib/lrcParser';
import { LyricsSearchHero } from '@/components/lyrics/LyricsSearchHero';
import { LyricsPlayerView } from '@/components/lyrics/LyricsPlayerView';
import { BackgroundCustomizerModal, BackgroundConfig, DEFAULT_BG_CONFIG } from '@/components/lyrics/BackgroundCustomizerModal';
import { TvSwipeTransition } from '@/components/lyrics/TvSwipeTransition';

const BG_STORAGE_KEY = 'openlyryc_karaoke_bg_config';
const FALLBACK_BG_KEY = 'openlyryc_lyrics_bg_config';

function KaraokePageContent() {
  const searchParams = useSearchParams();
  const qParam = searchParams.get('q') || searchParams.get('query') || '';
  const idParam = searchParams.get('id') || searchParams.get('track') || '';
  const ytParam = searchParams.get('yt') || searchParams.get('v') || null;
  const unisonParam = searchParams.get('unison') || '';
  const variantParam = searchParams.get('variant') || '';
  const artistParam = searchParams.get('artist') || '';
  const titleParam = searchParams.get('title') || '';
  const coverParam = searchParams.get('cover') || searchParams.get('artwork') || '';

  // ── Background Configuration State ───────────────────────────────────────
  const [bgConfig, setBgConfig] = useState<BackgroundConfig>(DEFAULT_BG_CONFIG);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(BG_STORAGE_KEY) || localStorage.getItem(FALLBACK_BG_KEY);
      if (stored) {
        setBgConfig(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleUpdateBgConfig = (newCfg: BackgroundConfig) => {
    setBgConfig(newCfg);
    try {
      localStorage.setItem(BG_STORAGE_KEY, JSON.stringify(newCfg));
    } catch {
      // ignore
    }
  };

  const [isBgModalOpen, setIsBgModalOpen] = useState(false);

  // ── Current Song & Playback State ─────────────────────────────────────────
  const [currentDoc, setCurrentDoc] = useState<OpenLyricsDocument | null>(null);
  const [currentCoverArt, setCurrentCoverArt] = useState<string | undefined>(undefined);
  const [currentYoutubeId, setCurrentYoutubeId] = useState<string | null>(ytParam);
  const [isLoadingSong, setIsLoadingSong] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Coordinated Scene Transition State ─────────────────────────────────────
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'fading-out' | 'holding' | 'fading-in'>('idle');
  const transitionPhaseRef = useRef<'idle' | 'fading-out' | 'holding' | 'fading-in'>('idle');
  transitionPhaseRef.current = transitionPhase;

  const pendingSongDataRef = useRef<{
    doc: OpenLyricsDocument;
    artwork?: string;
    matchedYt: string | null;
    target: any;
  } | null>(null);

  const applySongData = (payload: {
    doc: OpenLyricsDocument;
    artwork?: string;
    matchedYt: string | null;
    target: any;
  }) => {
    setCurrentDoc(payload.doc);
    setCurrentCoverArt(payload.artwork);
    setCurrentYoutubeId(payload.matchedYt);

    // Update URL silently with complete shareable state on /karaoke
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (payload.target.id) {
        url.searchParams.set('id', payload.target.id);
        url.searchParams.delete('q');
      } else {
        url.searchParams.set('q', `${payload.doc.metadata.artist} ${payload.doc.metadata.title}`);
      }
      if (payload.doc.metadata.title) url.searchParams.set('title', payload.doc.metadata.title);
      if (payload.doc.metadata.artist) url.searchParams.set('artist', payload.doc.metadata.artist);
      if (payload.artwork) url.searchParams.set('cover', payload.artwork);
      if (payload.matchedYt) url.searchParams.set('yt', payload.matchedYt);
      window.history.pushState(null, '', url.toString());
    }
  };

  const handleFadeOutComplete = () => {
    if (pendingSongDataRef.current) {
      applySongData(pendingSongDataRef.current);
      pendingSongDataRef.current = null;
      setTimeout(() => {
        setTransitionPhase('fading-in');
      }, 160);
    } else {
      setTransitionPhase('holding');
    }
  };

  const handleFadeInComplete = () => {
    setTransitionPhase('idle');
  };

  const showFeedback = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4500);
  };

  // ── Song Resolution Orchestrator (Karaoke Mode) ───────────────────────────
  const loadSong = async (
    target: {
      id?: string;
      title?: string;
      artist?: string;
      coverArt?: string;
      query?: string;
      unisonVideoId?: string;
      unisonVariantId?: string;
    },
    preferredYtId?: string | null,
    skipTransition = false
  ) => {
    setIsLoadingSong(true);
    setLoadingStatus('Loading lyrics…');
    if (!skipTransition) {
      setTransitionPhase('fading-out');
    }

    try {
      let doc: OpenLyricsDocument | null = null;

      // 0. Try direct Unison fetch if unisonVideoId or unisonVariantId specified
      if (target.unisonVariantId || target.unisonVideoId) {
        setLoadingStatus('Loading lyrics…');
        try {
          let unisonData: any = null;
          if (target.unisonVariantId) {
            unisonData = await fetchUnisonLyricsVariant(Number(target.unisonVariantId));
          } else if (target.unisonVideoId) {
            unisonData = await fetchUnisonLyricsByVideo(target.unisonVideoId);
          }

          if (unisonData?.lyrics) {
            const rawLyrics = String(unisonData.lyrics);
            const format = (unisonData.format || 'ttml').toLowerCase();
            if (format === 'ttml' || rawLyrics.includes('<tt') || rawLyrics.includes('<p ')) {
              doc = parseTTML(rawLyrics);
            } else {
              doc = parseLRC(rawLyrics);
            }

            if (doc) {
              if (unisonData.song) doc.metadata.title = unisonData.song;
              if (unisonData.artist) doc.metadata.artist = unisonData.artist;
              if (unisonData.album && !doc.metadata.album) doc.metadata.album = unisonData.album;
              const submitterName =
                unisonData.submitter?.displayName || unisonData.submitter?.handle || 'Unison Curator';
              doc.metadata.syncedBy = `${submitterName} (via Unison)`;
            }
          }
        } catch (unisonErr) {
          console.warn('[KaraokePage] Failed to fetch Unison lyrics:', unisonErr);
        }
      }

      // 1. Try direct ID fetch if available
      if (!doc && target.id) {
        doc = await fetchOnlineLyricsDocument(target.id);
      }

      // 2. Cascade resolve if not found
      if (!doc) {
        setLoadingStatus('Searching lyrics…');
        doc = await resolveLyricsWithAutoRetry({
          id: target.id,
          title: target.title,
          artist: target.artist,
          query: target.query,
        });
      }

      if (!doc || !doc.lines || doc.lines.length === 0) {
        showFeedback('Could not find lyrics for this song.');
        setIsLoadingSong(false);
        return;
      }

      // 2.5 Metadata Rehydration Fallback (for direct URL loads or missing XML metadata)
      if (target.title && (!doc.metadata.title || /^untitled\s*(track|song)?$/i.test(doc.metadata.title))) {
        doc.metadata.title = target.title;
      }
      if (target.artist && (!doc.metadata.artist || /^unknown\s*(artist|author)?$/i.test(doc.metadata.artist))) {
        doc.metadata.artist = target.artist;
      }

      if (!doc.metadata.title || /^untitled\s*(track|song)?$/i.test(doc.metadata.title)) {
        const searchKey = target.id || doc.metadata.isrc || doc.metadata.canonicalKey;
        if (searchKey) {
          try {
            const hits = await searchAllOnlineLyrics(searchKey);
            if (hits && hits.length > 0) {
              const bestHit = hits.find((h) => h.id === target.id) || hits[0];
              if (bestHit && bestHit.title && !/^untitled/i.test(bestHit.title)) {
                doc.metadata.title = bestHit.title;
                if (bestHit.artist && (!doc.metadata.artist || /^unknown/i.test(doc.metadata.artist))) {
                  doc.metadata.artist = bestHit.artist;
                }
                if (bestHit.album && !doc.metadata.album) {
                  doc.metadata.album = bestHit.album;
                }
                if (bestHit.coverArt && !doc.metadata.coverArt) {
                  doc.metadata.coverArt = bestHit.coverArt;
                }
              }
            }
          } catch {
            // ignore
          }
        }
      }

      // 3. Resolve Artwork
      let artwork = target.coverArt || doc.metadata.coverArt;
      if (!artwork) {
        artwork = (await fetchArtworkUrl(doc.metadata.artist, doc.metadata.title)) || undefined;
      }

      // 4. Resolve YouTube Match strictly searching for instrumental audio
      let matchedYt = preferredYtId || null;
      if (!matchedYt) {
        setLoadingStatus('Finding instrumental audio…');
        const best = await detectBestInstrumentalYouTubeMatch(
          doc.metadata.artist,
          doc.metadata.title,
          doc.metadata.duration
        );
        matchedYt = best?.videoId || null;
      }

      const payload = { doc, artwork, matchedYt, target };

      if (skipTransition) {
        applySongData(payload);
      } else {
        if (transitionPhaseRef.current === 'holding') {
          applySongData(payload);
          setTimeout(() => {
            setTransitionPhase('fading-in');
          }, 160);
        } else {
          pendingSongDataRef.current = payload;
        }
      }
    } catch (err: any) {
      console.error('[KaraokePage] Failed to load song:', err);
      showFeedback('Failed to load karaoke track.');
      pendingSongDataRef.current = null;
      if (transitionPhaseRef.current !== 'idle') {
        setTransitionPhase('fading-in');
      }
    } finally {
      setIsLoadingSong(false);
    }
  };

  // Auto-load on mount if query params present
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    if (unisonParam || variantParam) {
      loadSong(
        {
          unisonVideoId: unisonParam || undefined,
          unisonVariantId: variantParam || undefined,
          title: titleParam,
          artist: artistParam,
          coverArt: coverParam,
        },
        ytParam || unisonParam,
        true
      );
    } else if (idParam) {
      loadSong({ id: idParam, title: titleParam, artist: artistParam, coverArt: coverParam }, ytParam, true);
    } else if (titleParam || artistParam) {
      loadSong({ title: titleParam, artist: artistParam, coverArt: coverParam }, ytParam, true);
    } else if (qParam) {
      loadSong({ query: qParam }, ytParam, true);
    }
  }, [idParam, titleParam, artistParam, coverParam, qParam, ytParam, unisonParam, variantParam]);

  const handleSelectSong = (song: SongSearchResult) => {
    loadSong({
      id: song.id,
      title: song.title,
      artist: song.artist,
      coverArt: song.coverArt,
    });
  };

  const handleBackToSearch = () => {
    setTransitionPhase('fading-out');
    setTimeout(() => {
      setCurrentDoc(null);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.search = '';
        window.history.pushState(null, '', url.pathname);
      }
      setTimeout(() => {
        setTransitionPhase('fading-in');
      }, 160);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Non-intrusive notification toast */}
      {errorMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-zinc-900/95 border border-white/10 text-zinc-100 text-xs font-medium shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-zinc-400 hover:text-white text-base leading-none p-0.5 cursor-pointer"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {/* Coordinated Cinematic Screen Crossfade */}
      <TvSwipeTransition
        phase={transitionPhase}
        statusText={loadingStatus}
        onFadeOutComplete={handleFadeOutComplete}
        onFadeInComplete={handleFadeInComplete}
      />

      {/* Main View Router */}
      {currentDoc ? (
        <LyricsPlayerView
          initialDoc={currentDoc}
          coverArt={currentCoverArt}
          initialYoutubeId={currentYoutubeId}
          bgConfig={bgConfig}
          onUpdateBgConfig={handleUpdateBgConfig}
          onBackToSearch={handleBackToSearch}
          onSelectSong={handleSelectSong}
          mode="karaoke"
          isKaraoke={true}
        />
      ) : (
        <LyricsSearchHero
          onSelectSong={handleSelectSong}
          onOpenBgCustomizer={() => setIsBgModalOpen(true)}
          initialQuery={qParam}
          mode="karaoke"
          isKaraoke={true}
        />
      )}

      {/* Background Customizer Modal */}
      <BackgroundCustomizerModal
        isOpen={isBgModalOpen}
        onClose={() => setIsBgModalOpen(false)}
        config={bgConfig}
        coverArt={currentCoverArt}
        onSaveConfig={handleUpdateBgConfig}
      />
    </div>
  );
}

export default function KaraokePage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-[#09090b] flex flex-col items-center justify-center text-zinc-400 gap-4 font-sans">
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-white/60 animate-spin" />
          <p className="text-xs font-medium tracking-wide">Loading OpenLyryc Karaoke…</p>
        </div>
      }
    >
      <KaraokePageContent />
    </Suspense>
  );
}
