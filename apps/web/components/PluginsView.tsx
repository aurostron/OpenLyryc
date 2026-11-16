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
import {
  CUSTOM_POST_STREAMER_TEMPLATE,
  ADAPTIVE_MEDIA_STREAMER_TEMPLATE,
  DIRECT_AUDIO_STREAMER_TEMPLATE,
  LOCAL_STREAM_PROXY_TEMPLATE,
  MONOCHROME_BRIDGE_TEMPLATE,
} from './PluginsModal';
import {
  ArrowLeft,
  Puzzle,
  Plus,
  Play,
  Settings,
  Trash2,
  Check,
  AlertCircle,
  Code2,
  Download,
  Terminal,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';

interface PluginsViewProps {
  onBack: () => void;
}

export const PluginsView: React.FC<PluginsViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'installed' | 'install' | 'sandbox'>('installed');
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [manifestUrl, setManifestUrl] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installSuccess, setInstallSuccess] = useState<string | null>(null);

  // Plugin Settings Configuration
  const [configPluginId, setConfigPluginId] = useState<string | null>(null);
  const [configSettings, setConfigSettings] = useState<Record<string, any>>({});

  // Developer Sandbox State
  const [sandboxCode, setSandboxCode] = useState<string>(
    JSON.stringify(CUSTOM_POST_STREAMER_TEMPLATE, null, 2)
  );
  const [testSourceId, setTestSourceId] = useState('dQw4w9WgXcQ');
  const [testTrackTitle, setTestTrackTitle] = useState('Never Gonna Give You Up');
  const [testArtist, setTestArtist] = useState('Rick Astley');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const reloadPlugins = () => {
    setPlugins(getInstalledPlugins());
  };

  useEffect(() => {
    reloadPlugins();
  }, []);

  const handleToggle = (id: string, currentlyEnabled: boolean) => {
    togglePlugin(id, !currentlyEnabled);
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
      setInstallError(err.message || 'Failed to install manifest from URL.');
    } finally {
      setIsInstalling(false);
    }
  };

  const handleRunSandboxTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const manifest: OpenLyrycPluginManifest = JSON.parse(sandboxCode);
      const query: PluginExecutionQuery = {
        sourceId: testSourceId,
        title: testTrackTitle,
        artist: testArtist,
      };
      const result = await testPluginResolver(manifest, query);
      setTestResult(result);
    } catch (e: any) {
      setTestResult({
        success: false,
        error: `Sandbox execution error: ${e.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleInstallFromSandbox = () => {
    try {
      const manifest: OpenLyrycPluginManifest = JSON.parse(sandboxCode);
      installPluginFromManifest(manifest);
      reloadPlugins();
      setActiveTab('installed');
    } catch (e: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        error: `Manifest Error: ${e.message}`,
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-zinc-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-13 bg-[#111115] border-b border-white/[0.08] px-6 flex items-center justify-between shrink-0 gap-4 studio-chrome">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer text-xs font-medium"
            title="Back to Editor"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.25]" />
            <span>Back</span>
          </button>
          <div className="md:hidden h-4 w-[1px] bg-white/[0.1]" />
          <div className="flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-zinc-300" />
            <h1 className="text-sm font-bold text-white tracking-tight">Plugins</h1>
          </div>
        </div>

        {/* Tab Switcher in Header */}
        <div className="flex items-center gap-1.5 bg-[#17171d] p-1 rounded-xl border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setActiveTab('installed')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'installed'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Installed ({plugins.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('install')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'install'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Add Plugin
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sandbox')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'sandbox'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Test Plugin
          </button>
        </div>
      </header>

      {/* Main Full-Screen Body */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* TAB 1: INSTALLED PLUGINS */}
          {activeTab === 'installed' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Installed</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Plugins that run when you stream audio into the editor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('install')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add Plugin</span>
                </button>
              </div>

              {plugins.length === 0 ? (
                <div className="text-center py-16 bg-[#121217] border border-white/[0.08] rounded-2xl p-8 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-500 mx-auto">
                    <Puzzle className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-white">No plugins installed</h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Add a plugin to pull audio from a custom source — SoundCloud, a local proxy, or your own server.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('install')}
                      className="px-4 py-2 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
                    >
                      Browse Templates
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {plugins.map((plugin) => (
                    <div
                      key={plugin.manifest.id}
                      className="p-5 rounded-2xl bg-[#121217] border border-white/[0.08] space-y-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{plugin.manifest.name}</span>
                            <span className="text-[10px] font-sans px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-400 border border-white/[0.08]">
                              v{plugin.manifest.version}
                            </span>
                            {plugin.isEnabled ? (
                              <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Active
                              </span>
                            ) : (
                              <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
                                Disabled
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed">
                            {plugin.manifest.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {plugin.manifest.settingsSchema && plugin.manifest.settingsSchema.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenConfig(plugin)}
                              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
                              title="Configure Settings"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggle(plugin.manifest.id, plugin.isEnabled)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                              plugin.isEnabled
                                ? 'bg-white/[0.06] text-zinc-300 border-white/[0.1] hover:bg-white/[0.1]'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            }`}
                          >
                            {plugin.isEnabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUninstall(plugin.manifest.id)}
                            className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Uninstall Plugin"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Inline Configuration Card if open */}
                      {configPluginId === plugin.manifest.id && (
                        <div className="pt-3 border-t border-white/[0.06] space-y-3">
                          <h4 className="text-xs font-bold text-white">Plugin Configuration</h4>
                          {plugin.manifest.settingsSchema?.map((schema) => (
                            <div key={schema.key} className="space-y-1">
                              <label className="text-[11px] font-medium text-zinc-300">
                                {schema.label}
                              </label>
                              <input
                                type={schema.type === 'number' ? 'number' : 'text'}
                                value={configSettings[schema.key] ?? schema.defaultValue ?? ''}
                                onChange={(e) =>
                                  setConfigSettings({
                                    ...configSettings,
                                    [schema.key]: e.target.value,
                                  })
                                }
                                placeholder={schema.description}
                                className="w-full bg-[#181820] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-white/30"
                              />
                            </div>
                          ))}
                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setConfigPluginId(null)}
                              className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveConfig}
                              className="px-4 py-1.5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200"
                            >
                              Save Settings
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INSTALL ADDON */}
          {activeTab === 'install' && (
            <div className="space-y-6">
              <section className="bg-[#121217] border border-white/[0.08] rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Install from URL or Manifest</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Enter the HTTPS URL to a plugin manifest or paste the raw JSON manifest directly.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={manifestUrl}
                    onChange={(e) => setManifestUrl(e.target.value)}
                    placeholder="https://example.com/openlyryc-plugin.json or { ... }"
                    className="flex-1 bg-[#181820] border border-white/[0.08] focus:border-white/30 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleInstallFromUrl}
                    disabled={isInstalling || !manifestUrl.trim()}
                    className="px-5 py-2 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                  >
                    {isInstalling ? 'Installing...' : 'Install Manifest'}
                  </button>
                </div>

                {installSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{installSuccess}</span>
                  </div>
                )}

                {installError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{installError}</span>
                  </div>
                )}
              </section>

              {/* Preset Templates */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Quick Install Presets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    MONOCHROME_BRIDGE_TEMPLATE,
                    CUSTOM_POST_STREAMER_TEMPLATE,
                    ADAPTIVE_MEDIA_STREAMER_TEMPLATE,
                    DIRECT_AUDIO_STREAMER_TEMPLATE,
                    LOCAL_STREAM_PROXY_TEMPLATE,
                  ].map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-4 rounded-2xl bg-[#121217] border border-white/[0.08] flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{tpl.name}</span>
                          <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400">
                            Preset
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          installPluginFromManifest(tpl);
                          reloadPlugins();
                          setActiveTab('installed');
                        }}
                        className="w-full py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-zinc-200 hover:text-white transition-colors cursor-pointer"
                      >
                        Install Preset
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DEVELOPER SANDBOX */}
          {activeTab === 'sandbox' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Developer Plugin Sandbox</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Test and prototype custom stream resolver manifests against real track metadata.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300">Manifest JSON</label>
                <textarea
                  value={sandboxCode}
                  onChange={(e) => setSandboxCode(e.target.value)}
                  rows={12}
                  className="w-full bg-[#07070a] border border-white/[0.08] focus:border-white/30 rounded-2xl p-4 font-sans text-xs text-zinc-200 outline-none custom-scrollbar"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunSandboxTest}
                    disabled={isTesting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isTesting ? 'Testing...' : 'Test Resolver'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleInstallFromSandbox}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Install This Manifest</span>
                  </button>
                </div>
              </div>

              {testResult && (
                <div className="p-4 rounded-2xl bg-[#08080a] border border-white/[0.08] space-y-2 font-sans text-xs">
                  <span className="text-zinc-500 text-[11px]">Execution Result:</span>
                  <pre className="text-zinc-300 overflow-x-auto select-text whitespace-pre-wrap">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
