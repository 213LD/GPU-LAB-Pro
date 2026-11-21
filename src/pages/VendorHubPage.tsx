import React, { useState } from 'react';
import {
  Store,
  Play,
  Trash2,
  Download,
  ExternalLink,
  Activity,
  Thermometer,
  Fan,
  Zap,
  Cpu,
  Sliders,
  Wrench,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  GpuAdapter,
  NvidiaTelemetry,
  VendorToolsStatus,
} from '../types/gpu';

interface VendorHubPageProps {
  activeGpu: GpuAdapter | undefined;
  telemetry: NvidiaTelemetry | null;
  vendorTools: VendorToolsStatus | null;
  onAction: (fn: () => Promise<{ success: boolean; message: string }>) => void;
  onDownloadNvidiaApp: () => void;
  onRefreshTelemetry: () => void;
}

export const VendorHubPage: React.FC<VendorHubPageProps> = ({
  activeGpu,
  telemetry,
  vendorTools,
  onAction,
  onDownloadNvidiaApp,
  onRefreshTelemetry,
}) => {
  const detectedVendor: 'nvidia' | 'amd' | 'intel' =
    activeGpu?.vendor === 'amd' || activeGpu?.vendor === 'intel' ? activeGpu.vendor : 'nvidia';

  const [manualVendorTab, setManualVendorTab] = useState<'nvidia' | 'amd' | 'intel' | null>(null);
  const currentVendor = manualVendorTab || detectedVendor;

  // Keep user able to view the active GPU's vendor or preview others
  const handleTabSwitch = (v: 'nvidia' | 'amd' | 'intel') => {
    setManualVendorTab(v === detectedVendor ? null : v);
  };

  return (
    <div className="p-6 space-y-5 max-w-[1380px] mx-auto">
      {/* Header + Vendor Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            03 / VENDOR TOOLKIT HUB
          </div>
          <h1 className="text-2xl font-bold text-white mt-0.5">
            {currentVendor === 'nvidia'
              ? 'NVIDIA GeForce 专属工具集'
              : currentVendor === 'amd'
              ? 'AMD Radeon 专属工具集'
              : 'Intel Arc / Graphics 专属工具集'}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 bg-[#101512] p-1 rounded-xl border border-white/[0.08]">
          {(
            [
              { id: 'nvidia', label: 'NVIDIA', dot: 'bg-lime-400' },
              { id: 'amd', label: 'AMD Radeon', dot: 'bg-rose-500' },
              { id: 'intel', label: 'Intel Arc', dot: 'bg-sky-400' },
            ] as const
          ).map((t) => {
            const active = currentVendor === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTabSwitch(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  active ? 'bg-white/12 text-white border border-white/15' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                <span>{t.label}</span>
                {detectedVendor === t.id && (
                  <span className="text-[10px] font-mono text-zinc-400">(本机)</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* NVIDIA EXCLUSIVE SECTION */}
      {currentVendor === 'nvidia' && (
        <div className="space-y-4">
          {/* Live Telemetry Panel */}
          <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-lime-400" />
                <h3 className="text-sm font-bold text-white">NVIDIA-SMI 实时传感器遥测</h3>
                {telemetry?.available && (
                  <span className="text-xs font-mono text-zinc-400">· {telemetry.gpuName}</span>
                )}
              </div>
              <button
                onClick={onRefreshTelemetry}
                className="px-3 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-zinc-300 transition"
              >
                立即采样
              </button>
            </div>

            {telemetry?.available ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  {
                    icon: <Thermometer className="w-3.5 h-3.5 text-lime-400" />,
                    label: '核心温度',
                    val: telemetry.temperatureC !== null ? `${telemetry.temperatureC.toFixed(1)} °C` : '--',
                  },
                  {
                    icon: <Activity className="w-3.5 h-3.5 text-lime-400" />,
                    label: 'GPU 负载',
                    val: telemetry.utilizationPercent !== null ? `${telemetry.utilizationPercent} %` : '--',
                  },
                  {
                    icon: <Fan className="w-3.5 h-3.5 text-lime-400" />,
                    label: '风扇转速',
                    val: telemetry.fanSpeedPercent !== null ? `${telemetry.fanSpeedPercent} %` : '--',
                  },
                  {
                    icon: <Cpu className="w-3.5 h-3.5 text-lime-400" />,
                    label: '已用显存',
                    val:
                      telemetry.memoryUsedMb !== null && telemetry.memoryTotalMb !== null
                        ? `${(telemetry.memoryUsedMb / 1024).toFixed(1)} / ${(telemetry.memoryTotalMb / 1024).toFixed(1)} GB`
                        : '--',
                  },
                  {
                    icon: <Zap className="w-3.5 h-3.5 text-lime-400" />,
                    label: '实时功耗',
                    val:
                      telemetry.powerDrawW !== null
                        ? `${telemetry.powerDrawW.toFixed(0)}W / ${telemetry.powerLimitW?.toFixed(0) || '--'}W`
                        : '--',
                  },
                  {
                    icon: <Sliders className="w-3.5 h-3.5 text-lime-400" />,
                    label: '核心 / 显存频率',
                    val:
                      telemetry.graphicsClockMhz !== null
                        ? `${telemetry.graphicsClockMhz} / ${telemetry.memoryClockMhz || '--'} MHz`
                        : '--',
                  },
                ].map((metric) => (
                  <div key={metric.label} className="p-3 rounded-xl bg-black/35 border border-white/[0.06]">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      {metric.icon}
                      <span>{metric.label}</span>
                    </div>
                    <div className="mt-1.5 text-sm font-bold font-mono text-white">{metric.val}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-zinc-400 py-2">
                未能通过 nvidia-smi 读取传感器（本机未接入 NVIDIA 显卡或驱动尚未安装）。
              </div>
            )}
          </div>

          {/* NVCP + NVIDIA App 2-column */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* NVIDIA Control Panel */}
            <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">NVIDIA 控制面板 (Control Panel)</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
                      vendorTools?.nvidia.controlPanelInstalled
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    {vendorTools?.nvidia.controlPanelInstalled
                      ? `已安装 v${vendorTools.nvidia.controlPanelVersion || '传统版'}`
                      : '未安装'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  DCH 架构驱动默认不再强制内置经典控制面板。若桌面右键找不到「NVIDIA 控制面板」，可直接从 Microsoft Store 一键补装，或在此快速启动 / 卸载重装。
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => onAction(() => window.gpuLab.openNvcpStore())}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs transition"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>从微软商店一键安装</span>
                </button>
                <button
                  onClick={() => onAction(() => window.gpuLab.launchNvcp())}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.1] text-white font-semibold text-xs transition"
                >
                  <Play className="w-3.5 h-3.5 text-lime-400" />
                  <span>打开控制面板</span>
                </button>
                {vendorTools?.nvidia.controlPanelFamilyName && (
                  <button
                    onClick={() => onAction(() => window.gpuLab.uninstallNvcp())}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/12 hover:bg-rose-500/22 border border-rose-500/25 text-rose-300 text-xs transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>卸载商店版</span>
                  </button>
                )}
              </div>
            </div>

            {/* NVIDIA App */}
            <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">NVIDIA App（新一代统一控制中心）</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
                      vendorTools?.nvidia.nvidiaAppInstalled
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : 'bg-zinc-700/40 border-white/10 text-zinc-300'
                    }`}
                  >
                    {vendorTools?.nvidia.nvidiaAppInstalled
                      ? `已安装 v${vendorTools.nvidia.nvidiaAppVersion}`
                      : '未安装'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  集成了 GeForce Experience 游戏优化、ShadowPlay 录屏、RTX 视频超分辨率、DLSS 覆盖与驱动管理。
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {vendorTools?.nvidia.nvidiaAppInstalled && (
                  <button
                    onClick={() => onAction(() => window.gpuLab.launchNvidiaApp())}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>打开 NVIDIA App</span>
                  </button>
                )}
                <button
                  onClick={onDownloadNvidiaApp}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.1] text-white font-semibold text-xs transition"
                >
                  <Download className="w-3.5 h-3.5 text-lime-400" />
                  <span>下载最新 NVIDIA App 安装包</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AMD EXCLUSIVE SECTION */}
      {currentVendor === 'amd' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">AMD Software: Adrenalin Edition</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
                    vendorTools?.amd.adrenalinInstalled
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-zinc-700/40 border-white/10 text-zinc-300'
                  }`}
                >
                  {vendorTools?.amd.adrenalinInstalled
                    ? `已安装 v${vendorTools.amd.adrenalinVersion}`
                    : '未安装'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                管理 AMD Radeon Anti-Lag、AFMF 帧生成、Radeon Chill、超频调压、颜色深度及每款游戏的独立图形配置文件。
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => onAction(() => window.gpuLab.launchAmdAdrenalin())}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs transition"
              >
                <Play className="w-3.5 h-3.5" />
                <span>打开 AMD Adrenalin 控制中心</span>
              </button>
              <button
                onClick={() =>
                  window.gpuLab.openExternal('https://www.amd.com/zh-hans/support/download/drivers.html')
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.1] text-zinc-200 text-xs transition"
              >
                <ExternalLink className="w-3.5 h-3.5 text-rose-400" />
                <span>前往 AMD 官方驱动支持页</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">AMD Cleanup Utility 官方专用清理工具</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-rose-500/15 border border-rose-500/30 text-rose-300">
                  AMD OFFICIAL
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                除 DDU 外，AMD 官方提供的 `amdcleanuputility.exe` 专为彻底清理 Radeon 显卡与芯片组显示组件残留设计（内置一键进入安全模式确认）。
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => onAction(() => window.gpuLab.downloadOrLaunchAmdCleanup())}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-white font-bold text-xs transition"
              >
                <Download className="w-3.5 h-3.5 text-rose-400" />
                <span>
                  {vendorTools?.amd.cleanupUtilityDownloaded
                    ? '立即运行 AMD Cleanup Utility'
                    : '下载并运行 AMD Cleanup Utility'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTEL EXCLUSIVE SECTION */}
      {currentVendor === 'intel' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Intel Graphics Software / Arc Control</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
                    vendorTools?.intel.graphicsSoftwareInstalled ||
                    vendorTools?.intel.arcControlInstalled ||
                    vendorTools?.intel.igccInstalled
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-zinc-700/40 border-white/10 text-zinc-300'
                  }`}
                >
                  {vendorTools?.intel.graphicsSoftwareInstalled
                    ? 'Graphics Software 已安装'
                    : vendorTools?.intel.arcControlInstalled
                    ? 'Arc Control 已安装'
                    : vendorTools?.intel.igccInstalled
                    ? `IGCC v${vendorTools.intel.igccVersion}`
                    : '未安装'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                支持 Intel Arc 独立显卡、Core Ultra 锐炫核显及 Iris Xe 控制面板，管理 XeSS 超分、低延迟模式与显示色彩校准。
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => onAction(() => window.gpuLab.openIntelStore())}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-zinc-950 font-bold text-xs transition"
              >
                <Store className="w-3.5 h-3.5" />
                <span>从微软商店安装 IGCC</span>
              </button>
              <button
                onClick={() => onAction(() => window.gpuLab.launchIntelTool())}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.1] text-white font-semibold text-xs transition"
              >
                <Play className="w-3.5 h-3.5 text-sky-400" />
                <span>打开 Intel 控制软件</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-5 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Intel Arc 性能必检 · DSA 与 Resizable BAR</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Intel Arc 显卡强烈建议在主板 BIOS 中开启 <strong className="text-zinc-200">Resizable BAR / Above 4G Decoding</strong> 以释放完整游戏帧率，并可配合 Intel DSA 自动维护驱动。
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() =>
                  window.gpuLab.openExternal(
                    'https://www.intel.cn/content/www/cn/zh/support/intel-driver-support-assistant.html'
                  )
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.1] text-xs font-semibold text-white transition"
              >
                <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                <span>下载 Intel 驱动程序和支持助理 (DSA)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Windows Graphics Tweaks & Diagnostics */}
      <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Windows 图形调度优化与系统诊断</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              适用于 NVIDIA / AMD / Intel 全平台显卡的常见黑屏、闪屏、掉帧排障开关（修改注册表需重启生效）
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* HAGS */}
          <div className="p-4 rounded-xl bg-black/35 border border-white/[0.07] flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">硬件加速 GPU 计划 (HAGS)</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-zinc-300">
                  {vendorTools?.tweaks.hagsEnabled === true
                    ? '当前: 已开启'
                    : vendorTools?.tweaks.hagsEnabled === false
                    ? '当前: 已关闭'
                    : '当前: 系统默认'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                RTX 40/50 系开启 DLSS 帧生成通常需要启用 HAGS；老显卡如遇桌面卡顿可尝试关闭。
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => onAction(() => window.gpuLab.setHags(true))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  vendorTools?.tweaks.hagsEnabled === true
                    ? 'accent-soft'
                    : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-zinc-200'
                }`}
              >
                开启
              </button>
              <button
                onClick={() => onAction(() => window.gpuLab.setHags(false))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  vendorTools?.tweaks.hagsEnabled === false
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                    : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-zinc-300'
                }`}
              >
                关闭
              </button>
            </div>
          </div>

          {/* MPO */}
          <div className="p-4 rounded-xl bg-black/35 border border-white/[0.07] flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Windows 多平面叠加 (MPO)</span>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                    vendorTools?.tweaks.mpoDisabled
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-white/[0.06] text-zinc-300'
                  }`}
                >
                  {vendorTools?.tweaks.mpoDisabled ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> 已禁用 MPO
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3 text-amber-400" /> 默认启用
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                禁用 MPO (`OverlayTestMode=5`) 是 NVIDIA/AMD 社区公认解决浏览器硬解黑屏、多屏闪烁与游戏切屏卡顿的经典方案。
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => onAction(() => window.gpuLab.setMpoDisabled(true))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  vendorTools?.tweaks.mpoDisabled
                    ? 'accent-soft'
                    : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-zinc-200'
                }`}
              >
                禁用 MPO
              </button>
              <button
                onClick={() => onAction(() => window.gpuLab.setMpoDisabled(false))}
                className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-zinc-300 transition"
              >
                恢复默认
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            onClick={() => window.gpuLab.openSystemTool('dxdiag')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs text-zinc-300 transition"
          >
            <Wrench className="w-3.5 h-3.5 accent-text" />
            <span>DirectX 诊断 (dxdiag)</span>
          </button>
          <button
            onClick={() => window.gpuLab.openSystemTool('devmgmt')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs text-zinc-300 transition"
          >
            <Wrench className="w-3.5 h-3.5 accent-text" />
            <span>设备管理器 (devmgmt)</span>
          </button>
          <button
            onClick={() => window.gpuLab.openExternal('ms-settings:display-advancedgraphics')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs text-zinc-300 transition"
          >
            <ExternalLink className="w-3.5 h-3.5 accent-text" />
            <span>Windows 图形性能设置</span>
          </button>
        </div>
      </div>
    </div>
  );
};
