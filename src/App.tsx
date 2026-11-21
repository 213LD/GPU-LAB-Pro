import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivePage,
  AppConfig,
  BootStatus,
  DduLaunchOptions,
  DduStatus,
  DownloadTask,
  DriverCatalogResult,
  DriverItem,
  GpuDetectionSummary,
  LocalDriverStoreItem,
  NvidiaTelemetry,
  ShaderCacheFolder,
  ShaderCleanResult,
  VendorToolsStatus,
} from './types/gpu';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { PostCleanupModal } from './components/PostCleanupModal';
import { SafeModeModal } from './components/SafeModeModal';
import { DownloadTray } from './components/DownloadTray';
import { OverviewPage } from './pages/OverviewPage';
import { DriverManagerPage } from './pages/DriverManagerPage';
import { DduPage } from './pages/DduPage';
import { VendorHubPage } from './pages/VendorHubPage';
import { ShaderCachePage } from './pages/ShaderCachePage';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<ActivePage>('overview');
  const [isMaximized, setIsMaximized] = useState(false);

  const [config, setConfig] = useState<AppConfig | null>(null);
  const [detection, setDetection] = useState<GpuDetectionSummary | null>(null);
  const [selectedGpuId, setSelectedGpuId] = useState<string>('');
  const [telemetry, setTelemetry] = useState<NvidiaTelemetry | null>(null);

  const [driverCatalog, setDriverCatalog] = useState<DriverCatalogResult | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [localStore, setLocalStore] = useState<LocalDriverStoreItem[]>([]);

  const [dduStatus, setDduStatus] = useState<DduStatus | null>(null);
  const [bootStatus, setBootStatus] = useState<BootStatus | null>(null);
  const [vendorTools, setVendorTools] = useState<VendorToolsStatus | null>(null);
  const [shaderFolders, setShaderFolders] = useState<ShaderCacheFolder[]>([]);

  const [downloads, setDownloads] = useState<DownloadTask[]>([]);
  const [trayExpanded, setTrayExpanded] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [downloadingDdu, setDownloadingDdu] = useState(false);
  const [scanningShaders, setScanningShaders] = useState(false);
  const [cleaningShaders, setCleaningShaders] = useState(false);

  const [guideOpen, setGuideOpen] = useState(false);
  const [lastCleanResult, setLastCleanResult] = useState<ShaderCleanResult | null>(null);
  const [safeModeModalOpen, setSafeModeModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  }, []);

  const activeGpu = useMemo(() => {
    if (!detection?.adapters.length) return undefined;
    return detection.adapters.find((a) => a.id === selectedGpuId) || detection.adapters[0];
  }, [detection, selectedGpuId]);

  const loadCatalogForGpu = useCallback(
    async (
      gpu: NonNullable<typeof activeGpu>,
      seriesId?: string,
      productId?: string
    ) => {
      setLoadingCatalog(true);
      try {
        const res = await window.gpuLab.getDriverCatalog({
          vendor: gpu.vendor,
          gpuName: gpu.name,
          installedFriendlyVersion: gpu.friendlyVersion,
          seriesId,
          productId,
        });
        setDriverCatalog(res);
      } catch (err) {
        notify('error', `获取驱动列表失败: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoadingCatalog(false);
      }
    },
    [notify]
  );

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [cfg, det, tel, ddu, boot, tools, caches, store, dls] = await Promise.all([
        window.gpuLab.getConfig(),
        window.gpuLab.detectGpus(),
        window.gpuLab.getNvidiaTelemetry(),
        window.gpuLab.getDduStatus(),
        window.gpuLab.getBootStatus(),
        window.gpuLab.getVendorToolsStatus(),
        window.gpuLab.scanShaderCaches(),
        window.gpuLab.getLocalDriverStore(),
        window.gpuLab.listDownloads(),
      ]);

      setConfig(cfg);
      setDetection(det);
      setTelemetry(tel);
      setDduStatus(ddu);
      setBootStatus(boot);
      setVendorTools(tools);
      setShaderFolders(caches);
      setLocalStore(store);
      setDownloads(dls);

      setSelectedGpuId((prev) => {
        if (prev && det.adapters.some((a) => a.id === prev)) return prev;
        return det.adapters[0]?.id || '';
      });

      if (!cfg.hasSeenPostCleanupGuide) {
        setGuideOpen(true);
      }
    } catch (err) {
      notify('error', `刷新系统状态失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRefreshing(false);
    }
  }, [notify]);

  useEffect(() => {
    refreshAll();
    window.gpuLab.isWindowMaximized().then(setIsMaximized).catch(() => {});
    const unsubMax = window.gpuLab.onWindowMaximized(setIsMaximized);
    const unsubDl = window.gpuLab.onDownloadProgress((task) => {
      setDownloads((prev) => {
        const idx = prev.findIndex((p) => p.id === task.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = task;
          return copy;
        }
        return [task, ...prev];
      });
      if (task.status === 'completed') {
        notify('success', `下载完成: ${task.filename}`);
      } else if (task.status === 'failed' && task.error) {
        notify('error', `下载失败 (${task.filename}): ${task.error}`);
      }
    });

    return () => {
      unsubMax();
      unsubDl();
    };
  }, [refreshAll, notify]);

  // Reload driver catalog whenever active physical GPU changes
  useEffect(() => {
    if (activeGpu) {
      loadCatalogForGpu(activeGpu);
    }
  }, [activeGpu?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic live telemetry refresh for NVIDIA cards on overview / vendor pages
  useEffect(() => {
    if (activeGpu?.vendor !== 'nvidia' || (activePage !== 'overview' && activePage !== 'vendor')) {
      return;
    }
    const timer = setInterval(async () => {
      try {
        const tel = await window.gpuLab.getNvidiaTelemetry();
        setTelemetry(tel);
      } catch {
        // ignore poll error
      }
    }, 4500);
    return () => clearInterval(timer);
  }, [activeGpu?.vendor, activePage]);

  const handleCloseGuide = async () => {
    setGuideOpen(false);
    setLastCleanResult(null);
    if (config && !config.hasSeenPostCleanupGuide) {
      const updated = await window.gpuLab.updateConfig({ hasSeenPostCleanupGuide: true });
      setConfig(updated);
    }
  };

  const handleAction = async (fn: () => Promise<{ success: boolean; message: string }>) => {
    try {
      const res = await fn();
      notify(res.success ? 'success' : 'error', res.message);
      const tools = await window.gpuLab.getVendorToolsStatus();
      setVendorTools(tools);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : String(err));
    }
  };

  const handleDownloadDriver = async (drv: DriverItem) => {
    setTrayExpanded(true);
    notify('info', `开始下载 ${drv.name} (${drv.version})...`);
    await window.gpuLab.startDownload({
      url: drv.downloadUrl,
      category: 'driver',
      referer: drv.referer,
    });
  };

  const handleDownloadAndExtractDdu = async () => {
    setDownloadingDdu(true);
    setTrayExpanded(true);
    try {
      const res = await window.gpuLab.downloadAndExtractDdu();
      setDduStatus(res.status);
      notify(res.success ? 'success' : 'error', res.message);
    } finally {
      setDownloadingDdu(false);
    }
  };

  const handleBindDduDir = async () => {
    const res = await window.gpuLab.bindDduDirectory();
    setDduStatus(res.status);
    if (res.message !== '已取消选择') {
      notify(res.success ? 'success' : 'error', res.message);
    }
  };

  const handleLaunchDdu = async (opts: DduLaunchOptions) => {
    const res = await window.gpuLab.launchDdu(opts);
    notify(res.success ? 'success' : 'error', res.message);
  };

  const handleQuickLaunchDdu = () => {
    handleLaunchDdu({ mode: 'gui' });
  };

  const handleRescanShaders = async () => {
    setScanningShaders(true);
    try {
      const list = await window.gpuLab.scanShaderCaches();
      setShaderFolders(list);
    } finally {
      setScanningShaders(false);
    }
  };

  const handleCleanShaders = async (ids?: string[]) => {
    setCleaningShaders(true);
    try {
      const res = await window.gpuLab.cleanShaderCaches(ids);
      setLastCleanResult(res);
      setGuideOpen(true);
      const updated = await window.gpuLab.scanShaderCaches();
      setShaderFolders(updated);
    } catch (err) {
      notify('error', `清理缓存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCleaningShaders(false);
    }
  };

  const handleDownloadNvidiaApp = async () => {
    setTrayExpanded(true);
    notify('info', '正在获取并下载最新版 NVIDIA App 安装程序...');
    await window.gpuLab.downloadNvidiaApp();
  };

  const activeDownloadsCount = downloads.filter((d) => d.status === 'downloading').length;

  return (
    <div
      data-vendor={activeGpu?.vendor || 'nvidia'}
      className="h-screen w-screen flex flex-col bg-[#090c0a] text-zinc-100 overflow-hidden"
    >
      <TitleBar
        bootStatus={bootStatus}
        isMaximized={isMaximized}
        onOpenSafeModeModal={() => setSafeModeModalOpen(true)}
      />

      <div className="flex-1 flex min-h-0">
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          adapters={detection?.adapters || []}
          selectedGpuId={activeGpu?.id || ''}
          onSelectGpu={(id) => setSelectedGpuId(id)}
          bootStatus={bootStatus}
          onOpenGuide={() => {
            setLastCleanResult(null);
            setGuideOpen(true);
          }}
          activeDownloadsCount={activeDownloadsCount}
        />

        <main className="flex-1 min-w-0 overflow-y-auto relative bg-[#090c0a]">
          {activePage === 'overview' && (
            <OverviewPage
              detection={detection}
              activeGpu={activeGpu}
              telemetry={telemetry}
              driverCatalog={driverCatalog}
              dduStatus={dduStatus}
              bootStatus={bootStatus}
              vendorTools={vendorTools}
              shaderFolders={shaderFolders}
              refreshing={refreshing}
              cleaningCache={cleaningShaders}
              onRefreshAll={refreshAll}
              onNavigate={setActivePage}
              onQuickLaunchDdu={handleQuickLaunchDdu}
              onOpenSafeModeModal={() => setSafeModeModalOpen(true)}
              onQuickCleanShaders={() => handleCleanShaders(undefined)}
              onAction={handleAction}
              onDownloadNvidiaApp={handleDownloadNvidiaApp}
            />
          )}

          {activePage === 'drivers' && (
            <DriverManagerPage
              activeGpu={activeGpu}
              catalog={driverCatalog}
              loadingCatalog={loadingCatalog}
              localStore={localStore}
              downloads={downloads}
              config={config}
              onReloadCatalog={(sid, pid) => activeGpu && loadCatalogForGpu(activeGpu, sid, pid)}
              onDownloadDriver={handleDownloadDriver}
              onPickDownloadDir={async () => {
                const updated = await window.gpuLab.pickDownloadDir();
                if (updated) {
                  setConfig(updated);
                  notify('success', `下载目录已切换为: ${updated.downloadDir}`);
                }
              }}
              onLaunchInstaller={(fp) => handleAction(() => window.gpuLab.launchInstaller(fp))}
              onRevealFile={(fp) => window.gpuLab.revealFile(fp)}
              onInstallLocalDriver={(pub) => handleAction(() => window.gpuLab.installLocalDriver(pub))}
            />
          )}

          {activePage === 'ddu' && (
            <DduPage
              activeGpu={activeGpu}
              dduStatus={dduStatus}
              bootStatus={bootStatus}
              onDownloadAndExtractDdu={handleDownloadAndExtractDdu}
              onBindDduDir={handleBindDduDir}
              onLaunchDdu={handleLaunchDdu}
              onOpenSafeModeModal={() => setSafeModeModalOpen(true)}
              onOpenGuide={() => {
                setLastCleanResult(null);
                setGuideOpen(true);
              }}
              downloadingDdu={downloadingDdu}
            />
          )}

          {activePage === 'vendor' && (
            <VendorHubPage
              activeGpu={activeGpu}
              telemetry={telemetry}
              vendorTools={vendorTools}
              onAction={handleAction}
              onDownloadNvidiaApp={handleDownloadNvidiaApp}
              onRefreshTelemetry={async () => {
                const tel = await window.gpuLab.getNvidiaTelemetry();
                setTelemetry(tel);
                notify('info', tel.available ? 'NVIDIA 传感器已更新' : '未检测到 nvidia-smi 数据');
              }}
            />
          )}

          {activePage === 'shader' && (
            <ShaderCachePage
              folders={shaderFolders}
              scanning={scanningShaders}
              cleaning={cleaningShaders}
              onRescan={handleRescanShaders}
              onOpenFolder={(id) => handleAction(() => window.gpuLab.openShaderCacheFolder(id))}
              onCleanFolders={handleCleanShaders}
              onOpenGuide={() => {
                setLastCleanResult(null);
                setGuideOpen(true);
              }}
            />
          )}
        </main>
      </div>

      {/* Toast Stack */}
      <div className="fixed top-14 right-5 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-md shadow-xl text-xs max-w-md ${
              t.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100'
                : t.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-100'
                : 'bg-zinc-900/95 border-white/15 text-zinc-100'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : t.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 accent-text shrink-0" />
            )}
            <span className="flex-1 leading-relaxed">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <DownloadTray
        downloads={downloads}
        expanded={trayExpanded}
        onToggleExpand={() => setTrayExpanded((e) => !e)}
        onCancel={(id) => window.gpuLab.cancelDownload(id)}
        onReveal={(fp) => window.gpuLab.revealFile(fp)}
        onLaunch={(fp) => handleAction(() => window.gpuLab.launchInstaller(fp))}
      />

      <PostCleanupModal
        open={guideOpen}
        onClose={handleCloseGuide}
        cleanResult={lastCleanResult}
      />

      <SafeModeModal
        open={safeModeModalOpen}
        onClose={() => setSafeModeModalOpen(false)}
        bootStatus={bootStatus}
        onRefreshBoot={async () => {
          const b = await window.gpuLab.getBootStatus();
          setBootStatus(b);
        }}
        onNotify={notify}
      />
    </div>
  );
};

export default App;
