export type GpuVendor = 'nvidia' | 'amd' | 'intel' | 'virtual' | 'unknown';

export interface GpuAdapter {
  id: string;
  name: string;
  vendor: GpuVendor;
  isVirtual: boolean;
  isDiscrete: boolean;
  driverVersion: string;
  friendlyVersion: string;
  driverDate: string;
  vramBytes: number;
  vramLabel: string;
  status: string;
  pnpDeviceId: string;
  adapterCompatibility: string;
  releaseVersion?: string;
}

export interface GpuDetectionSummary {
  adapters: GpuAdapter[];
  physicalCount: number;
  virtualCount: number;
  osVersion: string;
  osBuild: number;
  detectedAt: string;
}

export interface NvidiaTelemetry {
  available: boolean;
  gpuName: string;
  driverVersion: string;
  temperatureC: number | null;
  fanSpeedPercent: number | null;
  utilizationPercent: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  powerDrawW: number | null;
  powerLimitW: number | null;
  graphicsClockMhz: number | null;
  memoryClockMhz: number | null;
}

export type DriverRelation = 'newer' | 'current' | 'older' | 'unknown';

export interface DriverItem {
  id: string;
  vendor: 'nvidia' | 'amd' | 'intel';
  version: string;
  name: string;
  channel: string;
  isWhql: boolean;
  releaseDate: string;
  fileSize: string;
  downloadUrl: string;
  referer?: string;
  releaseNotesUrl?: string;
  relation: DriverRelation;
  notes?: string;
}

export interface DriverSeriesOption {
  id: string;
  name: string;
}

export interface DriverProductOption {
  id: string;
  parentId: string;
  name: string;
}

export interface DriverCatalogResult {
  vendor: GpuVendor;
  matchedModelName: string;
  matchedSeriesId?: string;
  matchedProductId?: string;
  installedFriendlyVersion: string;
  drivers: DriverItem[];
  seriesList?: DriverSeriesOption[];
  productList?: DriverProductOption[];
  officialPageUrl: string;
  source: 'live-api' | 'verified-catalog';
  warning?: string;
}

export interface LocalDriverStoreItem {
  publishedName: string;
  originalName: string;
  providerName: string;
  driverDate: string;
  driverVersion: string;
  signerName: string;
  attributes: string;
}

export interface DownloadTask {
  id: string;
  filename: string;
  url: string;
  category: 'driver' | 'ddu' | 'tool';
  receivedBytes: number;
  totalBytes: number;
  percent: number;
  speedBps: number;
  status: 'downloading' | 'completed' | 'failed' | 'cancelled';
  filePath: string;
  error?: string;
}

export interface BootStatus {
  isSafeMode: boolean;
  safeModeType: 'normal' | 'minimal' | 'network';
  isSafeBootScheduled: boolean;
  isAdmin: boolean;
  canModifyBcd: boolean;
  bootupStateRaw: string;
}

export interface DduStatus {
  ready: boolean;
  dduDir: string;
  dduExePath: string;
  installedVersion: string;
  latestVersion: string;
  latestDownloadUrl: string;
  source: 'auto' | 'manual' | 'none';
}

export interface DduLaunchOptions {
  mode: 'gui' | 'preset';
  vendor?: 'nvidia' | 'amd' | 'intel' | 'all';
  removeMonitors?: boolean;
  removeVulkan?: boolean;
  removeControlPanel?: boolean;
  enableLogging?: boolean;
  postAction?: 'none' | 'restart' | 'shutdown';
  silent?: boolean;
  noSafeModeMsg?: boolean;
}

export interface VendorToolsStatus {
  nvidia: {
    controlPanelInstalled: boolean;
    controlPanelVersion: string;
    controlPanelFamilyName: string;
    controlPanelLegacyPath: string;
    nvidiaAppInstalled: boolean;
    nvidiaAppVersion: string;
    nvidiaAppPath: string;
  };
  amd: {
    adrenalinInstalled: boolean;
    adrenalinVersion: string;
    adrenalinPath: string;
    cleanupUtilityDownloaded: boolean;
    cleanupUtilityPath: string;
  };
  intel: {
    igccInstalled: boolean;
    igccVersion: string;
    igccFamilyName: string;
    graphicsSoftwareInstalled: boolean;
    graphicsSoftwarePath: string;
    arcControlInstalled: boolean;
    arcControlPath: string;
  };
  tweaks: {
    hagsEnabled: boolean | null;
    mpoDisabled: boolean;
  };
}

export interface ShaderCacheFolder {
  id: string;
  vendor: 'directx' | 'nvidia' | 'amd' | 'intel';
  label: string;
  description: string;
  path: string;
  exists: boolean;
  sizeBytes: number;
  fileCount: number;
}

export interface ShaderCleanResult {
  freedBytes: number;
  deletedFiles: number;
  skippedFiles: number;
  perFolder: {
    id: string;
    label: string;
    freedBytes: number;
    deletedFiles: number;
    skippedFiles: number;
  }[];
}

export interface ActionResult {
  success: boolean;
  message: string;
  detail?: string;
}

export interface SafeModeScheduleResult {
  success: boolean;
  scheduled: boolean;
  rebooting: boolean;
  message: string;
  needsManualGuide?: boolean;
}

export interface AppConfig {
  dduDir: string;
  dduExePath: string;
  dduVersion: string;
  dduSource: 'auto' | 'manual' | 'none';
  downloadDir: string;
  hasSeenPostCleanupGuide: boolean;
}

export type ActivePage = 'overview' | 'drivers' | 'ddu' | 'vendor' | 'shader';

export interface GpuLabApi {
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
  onWindowMaximized: (cb: (isMax: boolean) => void) => () => void;

  getConfig: () => Promise<AppConfig>;
  updateConfig: (partial: Partial<AppConfig>) => Promise<AppConfig>;
  pickDownloadDir: () => Promise<AppConfig | null>;

  detectGpus: () => Promise<GpuDetectionSummary>;
  getNvidiaTelemetry: () => Promise<NvidiaTelemetry>;

  getDriverCatalog: (params: {
    vendor: GpuVendor;
    gpuName: string;
    installedFriendlyVersion: string;
    seriesId?: string;
    productId?: string;
  }) => Promise<DriverCatalogResult>;
  getLocalDriverStore: () => Promise<LocalDriverStoreItem[]>;
  installLocalDriver: (publishedName: string) => Promise<ActionResult>;

  startDownload: (params: {
    url: string;
    filename?: string;
    category: 'driver' | 'ddu' | 'tool';
    referer?: string;
  }) => Promise<DownloadTask>;
  cancelDownload: (id: string) => Promise<boolean>;
  listDownloads: () => Promise<DownloadTask[]>;
  revealFile: (filePath: string) => Promise<boolean>;
  launchInstaller: (filePath: string) => Promise<ActionResult>;
  onDownloadProgress: (cb: (task: DownloadTask) => void) => () => void;

  getDduStatus: () => Promise<DduStatus>;
  getBootStatus: () => Promise<BootStatus>;
  downloadAndExtractDdu: () => Promise<{ success: boolean; message: string; status: DduStatus }>;
  bindDduDirectory: () => Promise<{ success: boolean; message: string; status: DduStatus }>;
  launchDdu: (options: DduLaunchOptions) => Promise<ActionResult>;
  scheduleSafeMode: (rebootNow: boolean) => Promise<SafeModeScheduleResult>;
  cancelSafeMode: (rebootNow?: boolean) => Promise<ActionResult>;

  getVendorToolsStatus: () => Promise<VendorToolsStatus>;
  openNvcpStore: () => Promise<ActionResult>;
  launchNvcp: () => Promise<ActionResult>;
  uninstallNvcp: () => Promise<ActionResult>;
  launchNvidiaApp: () => Promise<ActionResult>;
  downloadNvidiaApp: () => Promise<DownloadTask>;
  launchAmdAdrenalin: () => Promise<ActionResult>;
  downloadOrLaunchAmdCleanup: () => Promise<ActionResult>;
  launchIntelTool: () => Promise<ActionResult>;
  openIntelStore: () => Promise<ActionResult>;
  setHags: (enabled: boolean) => Promise<ActionResult>;
  setMpoDisabled: (disabled: boolean) => Promise<ActionResult>;

  openExternal: (url: string) => Promise<ActionResult>;
  openSystemTool: (tool: 'dxdiag' | 'devmgmt' | 'msinfo32' | 'msconfig') => Promise<ActionResult>;

  scanShaderCaches: () => Promise<ShaderCacheFolder[]>;
  openShaderCacheFolder: (id: string) => Promise<ActionResult>;
  cleanShaderCaches: (ids?: string[]) => Promise<ShaderCleanResult>;
}

declare global {
  interface Window {
    gpuLab: GpuLabApi;
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val >= 100 || idx === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

export function formatSpeed(bps: number): string {
  if (!bps || bps <= 0) return '0 KB/s';
  return `${formatBytes(bps)}/s`;
}

export const VENDOR_META: Record<
  GpuVendor,
  {
    label: string;
    shortLabel: string;
    accentHex: string;
    badgeClass: string;
    dotClass: string;
    panelName: string;
  }
> = {
  nvidia: {
    label: 'NVIDIA GeForce',
    shortLabel: 'NVIDIA',
    accentHex: '#a3e635',
    badgeClass: 'bg-lime-400/15 text-lime-300 border-lime-400/30',
    dotClass: 'bg-lime-400 shadow-[0_0_8px_#a3e635]',
    panelName: 'NVIDIA 专属工具集',
  },
  amd: {
    label: 'AMD Radeon',
    shortLabel: 'AMD',
    accentHex: '#fb7185',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dotClass: 'bg-rose-500 shadow-[0_0_8px_#f43f5e]',
    panelName: 'AMD 专属工具集',
  },
  intel: {
    label: 'Intel Arc / Graphics',
    shortLabel: 'Intel',
    accentHex: '#38bdf8',
    badgeClass: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
    dotClass: 'bg-sky-400 shadow-[0_0_8px_#38bdf8]',
    panelName: 'Intel 专属工具集',
  },
  virtual: {
    label: '虚拟显示适配器',
    shortLabel: 'Virtual',
    accentHex: '#94a3b8',
    badgeClass: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    dotClass: 'bg-zinc-400',
    panelName: '显卡专属工具集',
  },
  unknown: {
    label: '未知显卡',
    shortLabel: 'GPU',
    accentHex: '#a3e635',
    badgeClass: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    dotClass: 'bg-zinc-400',
    panelName: '显卡专属工具集',
  },
};
