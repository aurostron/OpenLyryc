import type { RendererViewMode } from '@/types/editor';
import type { OvisModule, OvisRenderProps } from '@/types/ovis';
import { OVIS_MANIFESTS } from './manifests';
import FlowVisualizer from '@/visuals/flow';
import React from 'react';

/**
 * OpenLyryc Visuals (.ovis) Runtime Module Loader
 * Handles dynamic fetching, Blob URL ESM compilation, in-memory caching,
 * and zero-latency fallback to embedded Flow.
 */

const ovisModuleCache = new Map<RendererViewMode, OvisModule>();
const inFlightRequests = new Map<RendererViewMode, Promise<OvisModule>>();

// ── Bootstrap Embedded Core Visualizers ─────────────────────────────────────
// Flow.ovis is kept embedded into core as the instant zero-latency default
ovisModuleCache.set('flow', {
  manifest: OVIS_MANIFESTS.flow,
  default: FlowVisualizer,
});

/**
 * Registers an embedded visualizer into the cache (e.g. flow.ovis).
 */
export function registerEmbeddedOvis(
  id: RendererViewMode,
  component: React.ComponentType<OvisRenderProps>
): void {
  const manifest = OVIS_MANIFESTS[id];
  if (!manifest) return;
  ovisModuleCache.set(id, {
    manifest,
    default: component,
  });
}

/**
 * Fetches and instantiates an .ovis module on demand.
 */
export async function loadOvisModule(mode: RendererViewMode): Promise<OvisModule> {
  // 1. Instant Cache Hit
  const cached = ovisModuleCache.get(mode);
  if (cached) return cached;

  // 2. In-flight Deduplication
  const existingPromise = inFlightRequests.get(mode);
  if (existingPromise) return existingPromise;

  const loadPromise = (async () => {
    try {
      // 3. Check if mode is configured as embedded-only
      const manifest = OVIS_MANIFESTS[mode];
      if (manifest?.capabilities?.embedded) {
        // Should have been registered at bootstrap; if not, throw to trigger fallback
        throw new Error(`Embedded .ovis visualizer "${mode}" was not registered.`);
      }

      // 4. Fetch self-hosted .oviz asset from Cloudflare CDN (with .ovis fallback)
      let response = await fetch(`/visuals/${mode}.oviz`, {
        headers: { Accept: 'application/javascript, text/javascript' },
      });

      if (!response.ok) {
        response = await fetch(`/visuals/${mode}.ovis`, {
          headers: { Accept: 'application/javascript, text/javascript' },
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch /visuals/${mode}.oviz (HTTP ${response.status})`);
      }

      const code = await response.text();
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      try {
        // 5. Dynamic ESM Import via Blob URL
        const rawModule = await import(/* webpackIgnore: true */ /* @vite-ignore */ blobUrl);
        const resolvedModule: OvisModule = {
          manifest: rawModule.manifest || manifest || OVIS_MANIFESTS.flow,
          default: rawModule.default,
        };

        ovisModuleCache.set(mode, resolvedModule);
        return resolvedModule;
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      console.warn(`[OvisLoader] Failed to load "${mode}.ovis", falling back to embedded flow:`, err);
      // Fallback to embedded flow
      const fallback = ovisModuleCache.get('flow');
      if (fallback) return fallback;
      throw err;
    } finally {
      inFlightRequests.delete(mode);
    }
  })();

  inFlightRequests.set(mode, loadPromise);
  return loadPromise;
}

/**
 * Synchronous cache check for zero-flicker mounts.
 */
export function getLoadedOvisModule(mode: RendererViewMode): OvisModule | null {
  return ovisModuleCache.get(mode) || null;
}
