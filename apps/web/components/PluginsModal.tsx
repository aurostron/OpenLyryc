'use client';

import React, { useState, useEffect } from 'react';
import {
  OpenLyrycPluginManifest,
  InstalledPlugin,
  PluginExecutionQuery,
} from '@/types/plugins';
import {
  getInstalledPlugins,
  installPluginFromManifest,
  installPluginFromUrl,
  togglePlugin,
  uninstallPlugin,
  updatePluginSettings,
  testPluginResolver,
} from '@/lib/plugins/pluginManager';

interface PluginsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CUSTOM_POST_STREAMER_TEMPLATE: OpenLyrycPluginManifest = {
  id: 'org.community.custom-post-streamer',
  name: 'JSON POST Stream Resolver',
  version: '1.0.0',
  description: 'Resolves direct audio streams via a REST POST endpoint with custom JSON payload templates.',
  author: 'Community',
  homepage: 'https://openlyryc.org',
  capabilities: ['stream-resolver'],
  settingsSchema: [
    {
      key: 'instanceUrl',
      label: 'API Base URL',
      type: 'string',
      defaultValue: 'https://api.example.com',
      description: 'Base URL for custom REST POST endpoint',
    },
  ],
  endpoints: {
    resolveStream: '{instanceUrl}/stream',
    resolveStreamMethod: 'POST',
    resolveStreamBody: '{"sourceId":"{sourceId}","format":"audio"}',
  },
};

export const ADAPTIVE_MEDIA_STREAMER_TEMPLATE: OpenLyrycPluginManifest = {
  id: 'org.community.adaptive-streamer',
  name: 'Adaptive Media Streamer',
  version: '1.0.0',
  description: 'Extracts and plays audio streams with adaptive bitrate format detection.',
  author: 'Community',
  homepage: 'https://openlyryc.org',
  capabilities: ['stream-resolver'],
  settingsSchema: [
    {
      key: 'instanceUrl',
      label: 'Media Endpoint URL',
      type: 'string',
      defaultValue: 'https://media.example.com',
      description: 'Base URL for media stream resolution endpoint',
    },
  ],
  endpoints: {
    resolveStream: '{instanceUrl}/api/v1/streams/{sourceId}',
  },
};

export const DIRECT_AUDIO_STREAMER_TEMPLATE: OpenLyrycPluginManifest = {
  id: 'org.community.direct-audio-streamer',
  name: 'Direct Audio Streamer',
  version: '1.0.0',
  description: 'Connects to a REST streaming endpoint returning high-quality audio streams.',
  author: 'Community',
  homepage: 'https://openlyryc.org',
  capabilities: ['stream-resolver'],
  settingsSchema: [
    {
      key: 'instanceUrl',
      label: 'Streaming Endpoint URL',
      type: 'string',
      defaultValue: 'https://stream.example.com',
      description: 'Base URL for audio streaming endpoint',
    },
  ],
  endpoints: {
    resolveStream: '{instanceUrl}/streams/{sourceId}',
  },
};

export const LOCAL_STREAM_PROXY_TEMPLATE: OpenLyrycPluginManifest = {
  id: 'org.community.local-stream-proxy',
  name: 'Local Stream Proxy',
  version: '1.0.0',
  description: 'Streams audio directly from a local helper daemon on localhost:8888.',
  author: 'Community',
  homepage: 'https://openlyryc.org',
  capabilities: ['stream-resolver'],
  settingsSchema: [
    {
      key: 'serverUrl',
      label: 'Local Server URL',
      type: 'string',
      defaultValue: 'http://localhost:8888',
      description: 'URL of your local streaming server daemon',
    },
  ],
  endpoints: {
    resolveStream: '{serverUrl}/audio?id={sourceId}',
  },
};

export const MONOCHROME_BRIDGE_TEMPLATE: OpenLyrycPluginManifest = {
  id: 'org.openlyryc.monochrome-bridge',
  name: 'Monochrome Bridge',
  version: '1.0.0',
  description: 'Search the Monochrome/TIDAL catalog and download full tracks into the Studio. Requires the local bridge daemon (tools/monochrome-bridge).',
  author: 'OpenLyryc',
  homepage: 'https://github.com/monochrome-music/monochrome',
  capabilities: ['stream-resolver', 'search-provider'],
  settingsSchema: [
    {
      key: 'serverUrl',
      label: 'Bridge Server URL',
      type: 'string',
      defaultValue: 'http://localhost:8888',
      description: 'URL of your local monochrome-bridge daemon (node tools/monochrome-bridge/server.mjs)',
    },
    {
      key: 'quality',
      label: 'Audio Quality',
      type: 'select',
      defaultValue: 'LOSSLESS',
      description: 'The bridge serves direct FLAC; quality is kept for forward compatibility.',
      options: [
        { label: 'Low (fast preview)', value: 'LOW' },
        { label: 'High (fast)', value: 'HIGH' },
        { label: 'Lossless 16-bit FLAC', value: 'LOSSLESS' },
        { label: 'Hi-Res 24-bit FLAC (huge)', value: 'HI_RES_LOSSLESS' },
      ],
    },
  ],
  endpoints: {
    resolveStream: '{serverUrl}/stream?id={sourceId}&quality={quality}',
    searchTracks: '{serverUrl}/search?q={query}',
  },
};

const SAMPLE_REST_TEMPLATE: OpenLyrycPluginManifest = {
  id: 'org.community.custom-audio-endpoint',
  name: 'Custom Audio Endpoint',
  version: '1.0.0',
  description: 'Connects to a custom REST endpoint returning audio stream URLs.',
  author: 'Community',
  homepage: 'https://openlyryc.org',
  capabilities: ['stream-resolver', 'search-provider'],
  settingsSchema: [
    {
      key: 'endpointUrl',
      label: 'API Base URL',
      type: 'string',
      defaultValue: 'https://api.example.com',
      description: 'Base URL for the audio stream resolution endpoint.',
    },
  ],
  endpoints: {
    resolveStream: '{endpointUrl}/streams/{sourceId}',
    searchTracks: '{endpointUrl}/search?q={query}',
  },
};

export const PluginsModal: React.FC<PluginsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'installed' | 'install' | 'sandbox'>('installed');
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [manifestUrl, setManifestUrl] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installSuccess, setInstallSuccess] = useState<string | null>(null);

  // Settings configuration state
  const [configPluginId, setConfigPluginId] = useState<string | null>(null);
  const [configSettings, setConfigSettings] = useState<Record<string, any>>({});

  // Developer Sandbox State
  const [sandboxCode, setSandboxCode] = useState(JSON.stringify(SAMPLE_REST_TEMPLATE, null, 2));
  const [sandboxQuery, setSandboxQuery] = useState<PluginExecutionQuery>({
    sourceId: 'track_sample_01',
    title: 'Sample Track',
    artist: 'Sample Artist',
    query: 'Sample Artist Sample Track',
  });
  const [sandboxTesting, setSandboxTesting] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<any>(null);

  const reloadPlugins = () => {
    setPlugins(getInstalledPlugins());
  };

  useEffect(() => {
    if (isOpen) {
      reloadPlugins();
    }
  }, [isOpen]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggle = (id: string, current: boolean) => {
    togglePlugin(id, !current);
    reloadPlugins();
  };

  const handleUninstall = (id: string) => {
    uninstallPlugin(id);
    reloadPlugins();
    if (configPluginId === id) setConfigPluginId(null);
  };

  const handleOpenConfig = (plugin: InstalledPlugin) => {
    setConfigPluginId(plugin.manifest.id);
    setConfigSettings(plugin.userSettings || {});
  };

  const handleSaveConfig = () => {
    if (configPluginId) {
      updatePluginSettings(configPluginId, configSettings);
      reloadPlugins();
      setConfigPluginId(null);
    }
  };

  const handleInstallFromUrl = async () => {
    const raw = manifestUrl.trim();
    if (!raw) return;
    setIsInstalling(true);
    setInstallError(null);
    setInstallSuccess(null);

    // If user pasted raw JSON directly into the input
    if (raw.startsWith('{')) {
      try {
        const manifest: OpenLyrycPluginManifest = JSON.parse(raw);
        const installed = installPluginFromManifest(manifest);
        setInstallSuccess(`Successfully installed "${installed.manifest.name}"`);
        setManifestUrl('');
        reloadPlugins();
        setTimeout(() => {
          setActiveTab('installed');
          setInstallSuccess(null);
        }, 1200);
      } catch (err: any) {
        setInstallError(`Invalid JSON Manifest: ${err.message}`);
      } finally {
        setIsInstalling(false);
      }
      return;
    }

    try {
      const installed = await installPluginFromUrl(raw);
      setInstallSuccess(`Successfully installed "${installed.manifest.name}"`);
      setManifestUrl('');
      reloadPlugins();
      setTimeout(() => {
        setActiveTab('installed');
        setInstallSuccess(null);
      }, 1200);
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('Network error')) {
        setInstallError(
          `Could not fetch manifest JSON from "${raw}". If this is an instance base URL, open the Developer Sandbox tab to test and install it directly.`
        );
      } else {
        setInstallError(err.message || 'Failed to install manifest from URL.');
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const handleRunSandboxTest = async () => {
    setSandboxTesting(true);
    setSandboxResult(null);

    try {
      const manifest: OpenLyrycPluginManifest = JSON.parse(sandboxCode);
      const res = await testPluginResolver(manifest, sandboxQuery);
      setSandboxResult(res);
    } catch (e: any) {
      setSandboxResult({
        success: false,
        latencyMs: 0,
        error: `Invalid JSON syntax or Manifest error: ${e.message}`,
      });
    } finally {
      setSandboxTesting(false);
    }
  };

  const handleInstallSandboxManifest = () => {
    try {
      const manifest: OpenLyrycPluginManifest = JSON.parse(sandboxCode);
      installPluginFromManifest(manifest);
      reloadPlugins();
      setActiveTab('installed');
    } catch (e: any) {
      setSandboxResult({
        success: false,
        latencyMs: 0,
        error: `Manifest Error: ${e.message}`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* 3D Glass Modal Shell */}
      <div
        className="glass-modal-3d w-full max-w-2xl bg-[#0e0e12]/95 border border-white/[0.12] rounded-3xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-hidden text-zinc-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white shadow-inner">
              <span className="material-symbols-outlined text-xl">extension</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-sans flex items-center gap-2">
                Plugins
              </h2>
              <p className="text-xs text-zinc-400 font-sans">
                Audio sources and stream integrations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 pt-3 pb-3 border-b border-white/[0.06] shrink-0">
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'installed'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">widgets</span>
            <span>Installed ({plugins.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('install')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'install'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">add_link</span>
            <span>Install Addon</span>
          </button>

          <button
            onClick={() => setActiveTab('sandbox')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sandbox'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">terminal</span>
            <span>Developer Sandbox</span>
          </button>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-4 pr-1">
          {/* TAB 1: INSTALLED ADDONS */}
          {activeTab === 'installed' && (
            <div className="space-y-3">
              {plugins.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-white/[0.02] border border-dashed border-white/[0.08] rounded-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-500 mb-3">
                    <span className="material-symbols-outlined text-2xl">extension_off</span>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-200 mb-1 font-sans">No Addons Installed</h3>
                  <p className="text-xs text-zinc-400 max-w-md font-sans mb-4">
                    Add custom manifest URLs or create your own integrations in the developer sandbox.
                  </p>
                  <button
                    onClick={() => setActiveTab('install')}
                    className="px-4 py-2 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer shadow-sm"
                  >
                    Install Addon
                  </button>
                </div>
              ) : (
                plugins.map((plugin) => {
                  const isConfiguring = configPluginId === plugin.manifest.id;
                  return (
                    <div
                      key={plugin.manifest.id}
                      className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white shrink-0">
                            <span className="material-symbols-outlined text-xl">
                              {plugin.manifest.capabilities.includes('stream-resolver') ? 'stream' : 'extension'}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white font-sans">{plugin.manifest.name}</h4>
                              <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 border border-white/[0.08]">
                                v{plugin.manifest.version}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5 font-sans leading-relaxed">
                              {plugin.manifest.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="text-[10px] font-sans text-zinc-500">By {plugin.manifest.author}</span>
                              {plugin.manifest.capabilities.map((cap) => (
                                <span
                                  key={cap}
                                  className="text-[9px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.08]"
                                >
                                  {cap.replace('-provider', '').replace('-resolver', '')}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          {plugin.manifest.settingsSchema && plugin.manifest.settingsSchema.length > 0 && (
                            <button
                              onClick={() => handleOpenConfig(plugin)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                isConfiguring
                                  ? 'bg-white text-zinc-950 border-white'
                                  : 'text-zinc-400 hover:text-white bg-white/[0.04] border-white/[0.08]'
                              }`}
                              title="Addon Settings"
                            >
                              <span className="material-symbols-outlined text-base">settings</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggle(plugin.manifest.id, plugin.isEnabled)}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border ${
                              plugin.isEnabled
                                ? 'bg-white border-white'
                                : 'bg-white/[0.06] border-white/10'
                            }`}
                            title={plugin.isEnabled ? 'Active (Click to disable)' : 'Disabled (Click to enable)'}
                          >
                            <span
                              className={`absolute top-0.5 w-4.5 h-4.5 rounded-full transition-transform ${
                                plugin.isEnabled
                                  ? 'left-5.5 bg-zinc-950 shadow-sm'
                                  : 'left-0.5 bg-zinc-400'
                              }`}
                            />
                          </button>

                          <button
                            onClick={() => handleUninstall(plugin.manifest.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                            title="Uninstall Addon"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Settings Form */}
                      {isConfiguring && plugin.manifest.settingsSchema && (
                        <div className="mt-3 p-3.5 rounded-xl bg-black/40 border border-white/[0.08] space-y-3">
                          <h5 className="text-xs font-bold text-zinc-300 font-sans">Configuration & Endpoints</h5>
                          {plugin.manifest.settingsSchema.map((field) => (
                            <div key={field.key} className="space-y-1">
                              <label className="text-[11px] font-sans text-zinc-400 block">{field.label}</label>
                              <input
                                type="text"
                                value={String(configSettings[field.key] ?? field.defaultValue ?? '')}
                                onChange={(e) => setConfigSettings({ ...configSettings, [field.key]: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-xs text-white font-sans focus:border-white/40 outline-none"
                              />
                              {field.description && (
                                <span className="text-[10px] text-zinc-500 font-sans">{field.description}</span>
                              )}
                            </div>
                          ))}
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setConfigPluginId(null)}
                              className="px-3 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveConfig}
                              className="px-3 py-1 rounded-lg bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200"
                            >
                              Save Settings
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: INSTALL BY URL */}
          {activeTab === 'install' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
                <h3 className="text-sm font-bold text-white font-sans">Install Addon</h3>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  Enter a hosted manifest URL or paste a raw manifest JSON object:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://example.com/manifest.json or paste { ... } JSON"
                    value={manifestUrl}
                    onChange={(e) => setManifestUrl(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-sans focus:border-white/40 outline-none"
                  />
                  <button
                    onClick={handleInstallFromUrl}
                    disabled={isInstalling || !manifestUrl.trim()}
                    className="px-4 py-2 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5"
                  >
                    {isInstalling ? 'Installing...' : 'Install'}
                  </button>
                </div>

                {installError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-sans">
                    {installError}
                  </div>
                )}

                {installSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-sans">
                    {installSuccess}
                  </div>
                )}
              </div>

              {/* Starter Templates */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-sans">
                  Community Resolvers & Starter Templates
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Monochrome Bridge Template */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/20 transition-all space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-zinc-300">library_music</span>
                      <h5 className="text-xs font-bold text-white font-sans">{MONOCHROME_BRIDGE_TEMPLATE.name}</h5>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans line-clamp-2">
                      {MONOCHROME_BRIDGE_TEMPLATE.description}
                    </p>
                    <button
                      onClick={() => {
                        installPluginFromManifest(MONOCHROME_BRIDGE_TEMPLATE);
                        reloadPlugins();
                        setActiveTab('installed');
                      }}
                      className="w-full py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-bold text-white transition-all cursor-pointer"
                    >
                      Use Monochrome Bridge
                    </button>
                  </div>

                  {/* POST Streamer Template */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/20 transition-all space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-zinc-300">code_blocks</span>
                      <h5 className="text-xs font-bold text-white font-sans">{CUSTOM_POST_STREAMER_TEMPLATE.name}</h5>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans line-clamp-2">
                      {CUSTOM_POST_STREAMER_TEMPLATE.description}
                    </p>
                    <button
                      onClick={() => {
                        installPluginFromManifest(CUSTOM_POST_STREAMER_TEMPLATE);
                        reloadPlugins();
                        setActiveTab('installed');
                      }}
                      className="w-full py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-bold text-white transition-all cursor-pointer"
                    >
                      Use POST Streamer
                    </button>
                  </div>

                  {/* Adaptive Streamer Template */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/20 transition-all space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-zinc-300">tune</span>
                      <h5 className="text-xs font-bold text-white font-sans">{ADAPTIVE_MEDIA_STREAMER_TEMPLATE.name}</h5>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans line-clamp-2">
                      {ADAPTIVE_MEDIA_STREAMER_TEMPLATE.description}
                    </p>
                    <button
                      onClick={() => {
                        installPluginFromManifest(ADAPTIVE_MEDIA_STREAMER_TEMPLATE);
                        reloadPlugins();
                        setActiveTab('installed');
                      }}
                      className="w-full py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-bold text-white transition-all cursor-pointer"
                    >
                      Use Adaptive Streamer
                    </button>
                  </div>

                  {/* Direct Streamer Template */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/20 transition-all space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-zinc-300">stream</span>
                      <h5 className="text-xs font-bold text-white font-sans">{DIRECT_AUDIO_STREAMER_TEMPLATE.name}</h5>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans line-clamp-2">
                      {DIRECT_AUDIO_STREAMER_TEMPLATE.description}
                    </p>
                    <button
                      onClick={() => {
                        installPluginFromManifest(DIRECT_AUDIO_STREAMER_TEMPLATE);
                        reloadPlugins();
                        setActiveTab('installed');
                      }}
                      className="w-full py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-bold text-white transition-all cursor-pointer"
                    >
                      Use Direct Streamer
                    </button>
                  </div>

                  {/* Local Stream Proxy Template */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/20 transition-all space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-zinc-300">dns</span>
                      <h5 className="text-xs font-bold text-white font-sans">{LOCAL_STREAM_PROXY_TEMPLATE.name}</h5>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans line-clamp-2">
                      {LOCAL_STREAM_PROXY_TEMPLATE.description}
                    </p>
                    <button
                      onClick={() => {
                        installPluginFromManifest(LOCAL_STREAM_PROXY_TEMPLATE);
                        reloadPlugins();
                        setActiveTab('installed');
                      }}
                      className="w-full py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-bold text-white transition-all cursor-pointer"
                    >
                      Use Local Stream Proxy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DEVELOPER SANDBOX & TESTER */}
          {activeTab === 'sandbox' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white font-sans">Plugin Manifest Editor</h3>
                  <p className="text-xs text-zinc-400 font-sans">
                    Write, test against sample queries, and verify responses before saving.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSandboxCode(JSON.stringify(CUSTOM_POST_STREAMER_TEMPLATE, null, 2))}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-sans text-zinc-300 border border-white/[0.08]"
                  >
                    POST API
                  </button>
                  <button
                    onClick={() => setSandboxCode(JSON.stringify(ADAPTIVE_MEDIA_STREAMER_TEMPLATE, null, 2))}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-sans text-zinc-300 border border-white/[0.08]"
                  >
                    Adaptive API
                  </button>
                  <button
                    onClick={() => setSandboxCode(JSON.stringify(DIRECT_AUDIO_STREAMER_TEMPLATE, null, 2))}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-sans text-zinc-300 border border-white/[0.08]"
                  >
                    Direct Stream
                  </button>
                  <button
                    onClick={() => setSandboxCode(JSON.stringify(LOCAL_STREAM_PROXY_TEMPLATE, null, 2))}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-sans text-zinc-300 border border-white/[0.08]"
                  >
                    Local Proxy
                  </button>
                </div>
              </div>

              {/* Code Editor */}
              <div className="rounded-xl overflow-hidden border border-white/[0.1] bg-black/60 font-sans text-xs">
                <textarea
                  value={sandboxCode}
                  onChange={(e) => setSandboxCode(e.target.value)}
                  rows={12}
                  className="w-full p-3.5 bg-transparent text-zinc-200 outline-none resize-y font-sans leading-relaxed"
                  spellCheck={false}
                />
              </div>

              {/* Test Parameters Bar */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 font-sans">Test Parameters</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-sans uppercase">Source ID</label>
                    <input
                      type="text"
                      value={sandboxQuery.sourceId || sandboxQuery.youtubeId || ''}
                      onChange={(e) => setSandboxQuery({ ...sandboxQuery, sourceId: e.target.value, youtubeId: e.target.value })}
                      className="w-full px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.1] text-xs text-white font-sans outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 font-sans uppercase">Track Title</label>
                    <input
                      type="text"
                      value={sandboxQuery.title || ''}
                      onChange={(e) => setSandboxQuery({ ...sandboxQuery, title: e.target.value })}
                      className="w-full px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.1] text-xs text-white font-sans outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 font-sans uppercase">Artist</label>
                    <input
                      type="text"
                      value={sandboxQuery.artist || ''}
                      onChange={(e) => setSandboxQuery({ ...sandboxQuery, artist: e.target.value })}
                      className="w-full px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.1] text-xs text-white font-sans outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={handleInstallSandboxManifest}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-bold text-white transition-all cursor-pointer"
                  >
                    Install to Studio
                  </button>

                  <button
                    onClick={handleRunSandboxTest}
                    disabled={sandboxTesting}
                    className="px-4 py-1.5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                    <span>{sandboxTesting ? 'Testing...' : 'Test Endpoint'}</span>
                  </button>
                </div>
              </div>

              {/* Test Results Output */}
              {sandboxResult && (
                <div
                  className={`p-4 rounded-xl border font-sans text-xs space-y-2 ${
                    sandboxResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-red-500/10 border-red-500/30 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>
                      {sandboxResult.success ? '✅ Stream Resolved Successfully' : '❌ Resolution Failed'}
                    </span>
                    <span className="text-[11px] opacity-80">{sandboxResult.latencyMs}ms latency</span>
                  </div>
                  {sandboxResult.error && (
                    <p className="text-red-300 font-sans text-xs">{sandboxResult.error}</p>
                  )}
                  {sandboxResult.result && (
                    <div className="pt-2 border-t border-white/[0.08] space-y-1 text-zinc-300">
                      <div>Stream URL: <span className="text-white break-all">{sandboxResult.result.streamUrl}</span></div>
                      <div>Type: <span className="text-white">{sandboxResult.result.mimeType || 'audio/mp4'}</span></div>
                      <div>Playback Mode: <span className="text-white">{sandboxResult.result.playbackMode}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
