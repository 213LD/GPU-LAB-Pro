import React from 'react';
import {
  RefreshCw,
  ArrowRight,
  ArrowUpRight,
  Download,
  Trash2,
  FolderOpen,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Store,
  Play,
  Thermometer,
  Activity,
} from 'lucide-react';
import {
  ActivePage,
  BootStatus,
  DduStatus,
  DriverCatalogResult,
  GpuAdapter,
  GpuDetectionSummary,
  NvidiaTelemetry,
  ShaderCacheFolder,
  VENDOR_META,
  VendorToolsStatus,
  formatBytes,
} from '../types/gpu';
import { GpuVisualCard } from '../components/GpuVisualCard';

interface OverviewPageProps {
  detection: GpuDetectionSummary | null;
  activeGpu: GpuAdapter | undefined;
  telemetry: NvidiaTelemetry | null;
  driverCatalog: DriverCatalogResult | null;
  dduStatus: DduStatus | null;
  bootStatus: BootStatus | null;
  vendorTools: VendorToolsStatus | null;
  shaderFolders: ShaderCacheFolder[];
  refreshing: boolean;
  cleaningCache: boolean;
  onRefreshAll: () => void;
  onNavigate: (page: ActivePage) => void;
  onQuickLaunchDdu: () => void;
  onOpenSafeModeModal: () => void;
  onQuickCleanShaders: () => void;
  onAction: (fn: () => Promise<{ success: boolean; message: string }>) => void;
  onDownloadNvidiaApp: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  detection,
  activeGpu,
  telemetry,
  driverCatalog,
  dduStatus,
  bootStatus,
  vendorTools,
  shaderFolders,
  refreshing,
  cleaningCache,
  onRefreshAll,
  onNavigate,
  onQuickLaunchDdu,
  onOpenSafeModeModal,
  onQuickCleanShaders,
  onAction,
  onDownloadNvidiaApp,
}) => {
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(
    today.getDate()
  ).padStart(2, '0')} / 本地`;

  const vendor = activeGpu?.vendor || 'nvidia';
  const meta = VENDOR_META[vendor];

  const totalCacheBytes = shaderFolders.reduce((acc, f) => acc + f.sizeBytes, 0);
  const totalCacheFiles = shaderFolders.reduce((acc, f) => acc + f.fileCount, 0);
  const existingFoldersCount = shaderFolders.filter((f) => f.exists).length;

  const newerDriver = driverCatalog?.drivers.find((d) => d.relation === 'newer');
  const driverRange =
    driverCatalog && driverCatalog.drivers.length > 1
      ? `${driverCatalog.drivers[driverCatalog.drivers.length - 1].version} - ${driverCatalog.drivers[0].version}`
      : driverCatalog?.drivers[0]?.version || '在线同步官方目录';

  // Panel KPI summary text
  let panelKpiTitle = '未检测';
  let panelKpiSub = '点击右侧专属工具查看';
  if (vendor === 'nvidia' && vendorTools) {
    panelKpiTitle = vendorTools.nvidia.controlPanelInstalled
      ? `控制面板 v${vendorTools.nvidia.controlPanelVersion || '已安装'}`
      : vendorTools.nvidia.nvidiaAppInstalled
      ? `NVIDIA App v${vendorTools.nvidia.nvidiaAppVersion || '已安装'}`
      : '未安装控制面板';
    panelKpiSub = vendorTools.nvidia.nvidiaAppInstalled
      ? `NVIDIA App 已就绪 (${vendorTools.nvidia.controlPanelInstalled ? '双面板可用' : '可补装经典控制面板'})`
      : '支持一键从 Microsoft Store 安装控制面板';
  } else if (vendor === 'amd' && vendorTools) {
    panelKpiTitle = vendorTools.amd.adrenalinInstalled
      ? `Adrenalin ${vendorTools.amd.adrenalinVersion || '已安装'}`
      : '未安装 Adrenalin';
    panelKpiSub = vendorTools.amd.cleanupUtilityDownloaded
      ? '官方 AMD Cleanup Utility 已就绪'
      : '支持一键启动控制中心与清理工具';
  } else if (vendor === 'intel' && vendorTools) {
    panelKpiTitle = vendorTools.intel.graphicsSoftwareInstalled
      ? 'Intel Graphics Software'
      : vendorTools.intel.igccInstalled
      ? `IGCC v${vendorTools.intel.igccVersion}`
      : '未安装 Intel 控制中心';
    panelKpiSub = '支持一键前往微软商店安装控制中心';
  }

  return (
    <div className="p-6 space-y-5 max-w-[1380px] mx-auto">
      {/* Top Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            GRAPHICS CONTROL / 显卡工具
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">显卡调试中心</h1>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-mono text-zinc-400 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            {dateStr}
          </span>
          <button
            onClick={onOpenSafeModeModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
              bootStatus?.isSafeMode
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-zinc-300'
            }`}
          >
            {bootStatus?.isSafeMode ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{bootStatus?.isSafeMode ? '安全模式中' : '安全模式重启'}</span>
          </button>
          <button
            onClick={onRefreshAll}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-medium text-zinc-100 transition disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin accent-text' : ''}`} />
            <span>{refreshing ? '扫描中...' : '刷新状态'}</span>
          </button>
        </div>
      </div>

      {/* Hero GPU Banner */}
      <section className="hero-surface rounded-2xl border border-white/[0.1] p-6 relative z-20">
        <div className="tactical-grid absolute inset-0 rounded-2xl overflow-hidden pointer-events-none opacity-65" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.22em] accent-text font-semibold">
                YOUR GRAPHICS, YOUR CONTROL
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${meta.badgeClass}`}>
                {meta.label}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {activeGpu ? activeGpu.name : '正在识别显卡...'}
            </h2>

            <p className="text-xs sm:text-sm text-zinc-300">
              Windows 显示状态: <span className="text-white font-mono">{activeGpu?.status || 'OK'}</span>
              {' · '}
              {detection
                ? `共检测到 ${detection.adapters.length} 个显示适配器（${detection.physicalCount} 张物理显卡 · ${detection.virtualCount} 个虚拟适配器）`
                : '正在枚举显示适配器...'}
            </p>

            {/* Quick Spec & Live Telemetry Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {activeGpu && (
                <>
                  <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-zinc-200">
                    显存: <strong className="accent-text">{activeGpu.vramLabel}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-zinc-300">
                    日期: {activeGpu.driverDate}
                  </span>
                </>
              )}
              {vendor === 'nvidia' && telemetry?.available && (
                <>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-zinc-200">
                    <Thermometer className="w-3 h-3 accent-text" />
                    {telemetry.temperatureC !== null ? `${telemetry.temperatureC.toFixed(0)}°C` : '--'}
                  </span>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-zinc-200">
                    <Activity className="w-3 h-3 accent-text" />
                    负载 {telemetry.utilizationPercent ?? '--'}%
                  </span>
                </>
              )}
            </div>
          </div>

          <GpuVisualCard gpu={activeGpu} telemetry={telemetry} />
        </div>
      </section>

      {/* 3-Column KPI Strip */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>当前驱动版本</span>
            {newerDriver ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono accent-soft border">
                有新版 {newerDriver.version}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                已对齐最新
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-xl font-bold font-mono text-white">
              {activeGpu?.driverVersion || '读取中...'}
            </span>
            {activeGpu?.friendlyVersion && activeGpu.friendlyVersion !== activeGpu.driverVersion && (
              <span className="text-xs font-mono accent-text">({activeGpu.friendlyVersion})</span>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>内置工具状态</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                dduStatus?.ready
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {dduStatus?.ready ? 'DDU READY' : '待下载/绑定'}
            </span>
          </div>
          <div className="mt-2 text-lg font-bold text-white truncate">
            {dduStatus?.ready
              ? `全部就绪 · DDU v${dduStatus.installedVersion}`
              : `DDU 未配置 · 最新 v${dduStatus?.latestVersion || '18.1.6.3'}`}
          </div>
        </div>

        <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{meta.shortLabel} 控制中心</span>
            <button
              onClick={() => onNavigate('vendor')}
              className="text-[11px] accent-text hover:underline font-medium"
            >
              专属中心 →
            </button>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-white truncate">{panelKpiTitle}</div>
            <div className="text-[11px] text-zinc-500 truncate mt-0.5">{panelKpiSub}</div>
          </div>
        </div>
      </section>

      {/* 2x2 Core Tool Grid: 工具集合 ALL IN ONE */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-white">工具集合</h3>
            <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-zinc-400">
              ALL IN ONE
            </span>
          </div>
          <span className="text-xs text-zinc-500">
            多厂商自动识别 · 点击任意模块立即执行或进入深度控制台
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 01 / DRIVER */}
          <div className="rounded-2xl bg-[#101512] border border-white/[0.08] hover:border-white/[0.16] p-5 flex flex-col justify-between transition">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-white">驱动选择器</h4>
                <span className="text-[11px] font-mono text-zinc-500">01 / DRIVER</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                显卡驱动管理 · 匹配 <span className="text-zinc-200">{activeGpu?.name || '当前显卡'}</span>，支持最新版更新与历史 WHQL 版本回退。
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="text-zinc-300">{driverRange}</span>
                <span className="text-zinc-600">·</span>
                <span className="accent-text">
                  {driverCatalog?.source === 'live-api' ? '官方实时接口直连' : '官方直链目录'}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => onNavigate('drivers')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl accent-bg font-bold text-xs transition active:scale-[0.98]"
              >
                <span>选择驱动版本</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {newerDriver && (
                <button
                  onClick={() => onNavigate('drivers')}
                  className="px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-zinc-200 transition"
                >
                  可更新至 {newerDriver.version}
                </button>
              )}
            </div>
          </div>

          {/* 02 / CLEAN */}
          <div className="rounded-2xl bg-[#101512] border border-white/[0.08] hover:border-white/[0.16] p-5 flex flex-col justify-between transition">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-white">DDU 驱动卸载</h4>
                <span className="text-[11px] font-mono text-zinc-500">02 / CLEAN</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                {dduStatus?.ready
                  ? `Display Driver Uninstaller ${dduStatus.installedVersion} 已就绪（${dduStatus.source === 'auto' ? '内置托管' : '手动绑定'}）。`
                  : `Display Driver Uninstaller 最新版本 v${dduStatus?.latestVersion || '18.1.6.3'} 可一键自动下载解压或绑定本地目录。`}
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/[0.06] text-[11px] text-zinc-300">
                {bootStatus?.isSafeMode ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">当前已处于安全模式，可放心运行 DDU</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>推荐重启至 Windows 安全模式后彻底卸载驱动</span>
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {dduStatus?.ready ? (
                <button
                  onClick={onQuickLaunchDdu}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-white font-semibold text-xs transition"
                >
                  <span>启动 DDU</span>
                  <ArrowUpRight className="w-3.5 h-3.5 accent-text" />
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('ddu')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg font-bold text-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载 / 绑定 DDU</span>
                </button>
              )}
              <button
                onClick={onOpenSafeModeModal}
                className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs text-zinc-300 transition"
              >
                {bootStatus?.isSafeMode ? '安全模式管理' : '一键安全模式重启'}
              </button>
              <button
                onClick={() => onNavigate('ddu')}
                className="px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-white transition"
              >
                高级清理选项 →
              </button>
            </div>
          </div>

          {/* 03 / PANEL (Vendor Adaptive) */}
          <div className="rounded-2xl bg-[#101512] border border-white/[0.08] hover:border-white/[0.16] p-5 flex flex-col justify-between transition">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-white">
                  {vendor === 'amd'
                    ? 'AMD Adrenalin 控制中心'
                    : vendor === 'intel'
                    ? 'Intel 显卡控制中心'
                    : 'NVIDIA 控制面板'}
                </h4>
                <span className="text-[11px] font-mono text-zinc-500">03 / PANEL</span>
              </div>

              {vendor === 'nvidia' && (
                <div className="mt-2 space-y-1 text-xs text-zinc-400">
                  <div>
                    控制面板状态：
                    <span className="text-zinc-200 font-mono ml-1">
                      {vendorTools?.nvidia.controlPanelInstalled
                        ? `内置 ${vendorTools.nvidia.controlPanelVersion || '已安装'}（桌面右键 / 独立控制）`
                        : '未安装经典控制面板（可从微软商店一键补装）'}
                    </span>
                  </div>
                  <div>
                    NVIDIA App：
                    <span className="text-zinc-200 font-mono ml-1">
                      {vendorTools?.nvidia.nvidiaAppInstalled
                        ? `已安装 v${vendorTools.nvidia.nvidiaAppVersion}`
                        : '未安装（支持一键下载官方安装包）'}
                    </span>
                  </div>
                </div>
              )}

              {vendor === 'amd' && (
                <div className="mt-2 space-y-1 text-xs text-zinc-400">
                  <div>
                    Adrenalin 状态：
                    <span className="text-zinc-200 font-mono ml-1">
                      {vendorTools?.amd.adrenalinInstalled
                        ? `已安装 v${vendorTools.amd.adrenalinVersion}`
                        : '未检测到 RadeonSoftware.exe'}
                    </span>
                  </div>
                  <div>
                    官方清理工具：
                    <span className="text-zinc-200 font-mono ml-1">
                      {vendorTools?.amd.cleanupUtilityDownloaded ? 'AMD Cleanup Utility 已就绪' : '支持一键下载并运行'}
                    </span>
                  </div>
                </div>
              )}

              {vendor === 'intel' && (
                <div className="mt-2 space-y-1 text-xs text-zinc-400">
                  <div>
                    控制中心状态：
                    <span className="text-zinc-200 font-mono ml-1">
                      {vendorTools?.intel.graphicsSoftwareInstalled
                        ? 'Intel Graphics Software 已安装'
                        : vendorTools?.intel.igccInstalled
                        ? `IGCC v${vendorTools.intel.igccVersion} 已安装`
                        : '未检测到控制中心'}
                    </span>
                  </div>
                  <div>支持从 Microsoft Store 安装或打开 Intel DSA 官方驱动助手</div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {vendor === 'nvidia' && (
                <>
                  <button
                    onClick={() => onAction(() => window.gpuLab.openNvcpStore())}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-zinc-100 transition"
                  >
                    <Store className="w-3.5 h-3.5 accent-text" />
                    <span>商店下载控制面板</span>
                  </button>
                  {vendorTools?.nvidia.controlPanelInstalled && (
                    <button
                      onClick={() => onAction(() => window.gpuLab.launchNvcp())}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl accent-bg font-bold text-xs transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>打开控制面板</span>
                    </button>
                  )}
                  {vendorTools?.nvidia.nvidiaAppInstalled ? (
                    <button
                      onClick={() => onAction(() => window.gpuLab.launchNvidiaApp())}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-semibold text-white transition"
                    >
                      <span>打开 NVIDIA App</span>
                      <ArrowUpRight className="w-3.5 h-3.5 accent-text" />
                    </button>
                  ) : (
                    <button
                      onClick={onDownloadNvidiaApp}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs text-zinc-200 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>下载 NVIDIA App</span>
                    </button>
                  )}
                  {vendorTools?.nvidia.controlPanelInstalled && (
                    <button
                      onClick={() => onAction(() => window.gpuLab.uninstallNvcp())}
                      className="px-3 py-2 rounded-xl bg-rose-500/12 hover:bg-rose-500/22 border border-rose-500/25 text-xs text-rose-300 transition"
                    >
                      卸载
                    </button>
                  )}
                </>
              )}

              {vendor === 'amd' && (
                <>
                  <button
                    onClick={() => onAction(() => window.gpuLab.launchAmdAdrenalin())}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg font-bold text-xs transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>打开 AMD Adrenalin</span>
                  </button>
                  <button
                    onClick={() => onAction(() => window.gpuLab.downloadOrLaunchAmdCleanup())}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs text-zinc-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>AMD 官方清理工具</span>
                  </button>
                  <button
                    onClick={() => onNavigate('vendor')}
                    className="px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-white transition"
                  >
                    更多专属工具 →
                  </button>
                </>
              )}

              {vendor === 'intel' && (
                <>
                  <button
                    onClick={() => onAction(() => window.gpuLab.openIntelStore())}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs text-zinc-100 transition"
                  >
                    <Store className="w-3.5 h-3.5 accent-text" />
                    <span>商店安装控制中心</span>
                  </button>
                  <button
                    onClick={() => onAction(() => window.gpuLab.launchIntelTool())}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg font-bold text-xs transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>打开 Intel 控制软件</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 04 / CACHE */}
          <div className="rounded-2xl bg-[#101512] border border-white/[0.08] hover:border-white/[0.16] p-5 flex flex-col justify-between transition">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-white">着色器缓存</h4>
                <span className="text-[11px] font-mono text-zinc-500">04 / CACHE</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                清理 DirectX / NVIDIA / AMD / Intel 多厂商着色器缓存，解决更新驱动或游戏版本后的卡顿与贴图异常。
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/[0.08] text-white">
                  总占用 <strong className="accent-text">{formatBytes(totalCacheBytes)}</strong>
                </span>
                <span className="text-zinc-400">
                  {existingFoldersCount} 个活跃目录 · {totalCacheFiles.toLocaleString()} 个文件
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => onNavigate('shader')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-zinc-100 transition"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>查看 / 打开目录</span>
              </button>
              <button
                disabled={cleaningCache}
                onClick={onQuickCleanShaders}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg font-bold text-xs transition active:scale-[0.98] disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{cleaningCache ? '清理中...' : '一键清理缓存'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
