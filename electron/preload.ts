import { contextBridge, ipcRenderer } from 'electron';
import {
  ActionResult,
  AppConfig,
  BootStatus,
  DduLaunchOptions,
  DduStatus,
  DownloadTask,
  DriverCatalogResult,
  GpuDetectionSummary,
  GpuVendor,
  LocalDriverStoreItem,
  NvidiaTelemetry,
  SafeModeScheduleResult,
  ShaderCacheFolder,
  ShaderCleanResult,
  VendorToolsStatus,
} from './types';

const gpuLabApi = {
  // Window
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: (): Promise<boolean> => ipcRenderer.invoke('window:maximize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isWindowMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  onWindowMaximized: (cb: (isMax: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isMax: boolean) => cb(isMax);
    ipcRenderer.on('window:maximized', handler);
    return () => ipcRenderer.removeListener('window:maximized', handler);
  },

  // Config
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),
  updateConfig: (partial: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke('config:update', partial),
  pickDownloadDir: (): Promise<AppConfig | null> => ipcRenderer.invoke('config:pickDownloadDir'),

  // GPU
  detectGpus: (): Promise<GpuDetectionSummary> => ipcRenderer.invoke('gpu:detect'),
  getNvidiaTelemetry: (): Promise<NvidiaTelemetry> => ipcRenderer.invoke('gpu:telemetry'),

  // Drivers & Downloads
  getDriverCatalog: (params: {
    vendor: GpuVendor;
    gpuName: string;
    installedFriendlyVersion: string;
    seriesId?: string;
    productId?: string;
  }): Promise<DriverCatalogResult> => ipcRenderer.invoke('driver:catalog', params),
  getLocalDriverStore: (): Promise<LocalDriverStoreItem[]> => ipcRenderer.invoke('driver:localStore'),
  installLocalDriver: (publishedName: string): Promise<ActionResult> =>
    ipcRenderer.invoke('driver:installLocal', publishedName),

  startDownload: (params: {
    url: string;
    filename?: string;
    category: 'driver' | 'ddu' | 'tool';
    referer?: string;
  }): Promise<DownloadTask> => ipcRenderer.invoke('download:start', params),
  cancelDownload: (id: string): Promise<boolean> => ipcRenderer.invoke('download:cancel', id),
  listDownloads: (): Promise<DownloadTask[]> => ipcRenderer.invoke('download:list'),
  revealFile: (filePath: string): Promise<boolean> => ipcRenderer.invoke('download:revealFile', filePath),
  launchInstaller: (filePath: string): Promise<ActionResult> => ipcRenderer.invoke('download:launchInstaller', filePath),
  onDownloadProgress: (cb: (task: DownloadTask) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, task: DownloadTask) => cb(task);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },

  // DDU & Safe Mode
  getDduStatus: (): Promise<DduStatus> => ipcRenderer.invoke('ddu:status'),
  getBootStatus: (): Promise<BootStatus> => ipcRenderer.invoke('ddu:bootStatus'),
  downloadAndExtractDdu: (): Promise<{ success: boolean; message: string; status: DduStatus }> =>
    ipcRenderer.invoke('ddu:downloadAndExtract'),
  bindDduDirectory: (): Promise<{ success: boolean; message: string; status: DduStatus }> =>
    ipcRenderer.invoke('ddu:bindDirDialog'),
  launchDdu: (options: DduLaunchOptions): Promise<ActionResult> => ipcRenderer.invoke('ddu:launch', options),
  scheduleSafeMode: (rebootNow: boolean): Promise<SafeModeScheduleResult> =>
    ipcRenderer.invoke('ddu:scheduleSafeMode', rebootNow),
  cancelSafeMode: (rebootNow?: boolean): Promise<ActionResult> =>
    ipcRenderer.invoke('ddu:cancelSafeMode', rebootNow),

  // Vendor Exclusive Tools
  getVendorToolsStatus: (): Promise<VendorToolsStatus> => ipcRenderer.invoke('vendor:status'),
  openNvcpStore: (): Promise<ActionResult> => ipcRenderer.invoke('vendor:openNvcpStore'),
  launchNvcp: (): Promise<ActionResult> => ipcRenderer.invoke('vendor:launchNvcp'),
  uninstallNvcp: (): Promise<ActionResult> => ipcRenderer.invoke('vendor:uninstallNvcp'),
  launchNvidiaApp: (): Promise<ActionResult> => ipcRenderer.invoke('vendor:launchNvidiaApp'),
  downloadNvidiaApp: (): Promise<DownloadTask> => ipcRenderer.invoke('vendor:downloadNvidiaApp'),
  launchAmdAdrenalin: (): Promise<ActionResult> => ipcRenderer.invoke('vendor:launchAmdAdrenalin'),
  downloadOrLaunchAmdCleanup: (): Promise<ActionResult> => ipcRenderer.invoke('vendor:downloadOrLaunchAmdCleanup'),
  launchIntelTool: (): Promise<ActionResult> => ipcRenderer.invoke('vendor:launchIntelTool'),
  openIntelStore: (): Promise<ActionResult> => ipcRenderer.invoke('vendor:openIntelStore'),
  setHags: (enabled: boolean): Promise<ActionResult> => ipcRenderer.invoke('vendor:setHags', enabled),
  setMpoDisabled: (disabled: boolean): Promise<ActionResult> => ipcRenderer.invoke('vendor:setMpoDisabled', disabled),

  // System Utilities
  openExternal: (url: string): Promise<ActionResult> => ipcRenderer.invoke('system:openExternal', url),
  openSystemTool: (tool: 'dxdiag' | 'devmgmt' | 'msinfo32' | 'msconfig'): Promise<ActionResult> =>
    ipcRenderer.invoke('system:openTool', tool),

  // Shader Cache
  scanShaderCaches: (): Promise<ShaderCacheFolder[]> => ipcRenderer.invoke('shader:scan'),
  openShaderCacheFolder: (id: string): Promise<ActionResult> => ipcRenderer.invoke('shader:openFolder', id),
  cleanShaderCaches: (ids?: string[]): Promise<ShaderCleanResult> => ipcRenderer.invoke('shader:clean', ids),
};

contextBridge.exposeInMainWorld('gpuLab', gpuLabApi);
