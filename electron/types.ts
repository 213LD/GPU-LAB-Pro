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
