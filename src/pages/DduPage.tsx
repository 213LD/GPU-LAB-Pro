import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  FolderSearch,
  ArrowUpRight,
  Terminal,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  BootStatus,
  DduLaunchOptions,
  DduStatus,
  GpuAdapter,
} from '../types/gpu';

interface DduPageProps {
  activeGpu: GpuAdapter | undefined;
  dduStatus: DduStatus | null;
  bootStatus: BootStatus | null;
  onDownloadAndExtractDdu: () => Promise<void>;
  onBindDduDir: () => Promise<void>;
  onLaunchDdu: (opts: DduLaunchOptions) => Promise<void>;
  onOpenSafeModeModal: () => void;
  onOpenGuide: () => void;
  downloadingDdu: boolean;
}

export const DduPage: React.FC<DduPageProps> = ({
  activeGpu,
  dduStatus,
  bootStatus,
  onDownloadAndExtractDdu,
  onBindDduDir,
  onLaunchDdu,
  onOpenSafeModeModal,
  onOpenGuide,
  downloadingDdu,
}) => {
  const defaultVendor =
    activeGpu?.vendor === 'amd' || activeGpu?.vendor === 'intel' || activeGpu?.vendor === 'nvidia'
      ? activeGpu.vendor
      : 'nvidia';

  const [vendor, setVendor] = useState<'nvidia' | 'amd' | 'intel' | 'all'>(defaultVendor);
  const [removeMonitors, setRemoveMonitors] = useState(true);
  const [removeVulkan, setRemoveVulkan] = useState(false);
  const [removeControlPanel, setRemoveControlPanel] = useState(false);
  const [enableLogging, setEnableLogging] = useState(true);
  const [silent, setSilent] = useState(false);
  const [noSafeModeMsg, setNoSafeModeMsg] = useState(false);
  const [postAction, setPostAction] = useState<'none' | 'restart' | 'shutdown'>('restart');

  useEffect(() => {
    if (activeGpu?.vendor === 'nvidia' || activeGpu?.vendor === 'amd' || activeGpu?.vendor === 'intel') {
      setVendor(activeGpu.vendor);
    }
  }, [activeGpu?.vendor]);

  const previewArgs = [
    silent ? '-silent' : '',
    noSafeModeMsg ? '-nosafemodemsg' : '',
    enableLogging ? '-logging' : '',
    vendor === 'nvidia'
      ? '-CleanNvidia'
      : vendor === 'amd'
      ? '-CleanAmd'
      : vendor === 'intel'
      ? '-CleanIntel'
      : '-CleanAllGpus',
    removeMonitors ? '-removemonitors' : '',
    removeVulkan ? '-RemoveVulkan' : '',
    removeControlPanel
      ? vendor === 'nvidia'
        ? '-RemoveNVCP'
        : vendor === 'amd'
        ? '-RemoveAMDCP'
        : vendor === 'intel'
        ? '-RemoveINTELCP'
        : ''
      : '',
    postAction === 'restart' ? '-restart' : postAction === 'shutdown' ? '-shutdown' : '',
  ].filter(Boolean);

  return (
    <div className="p-6 space-y-5 max-w-[1380px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            02 / DISPLAY DRIVER UNINSTALLER
          </div>
          <h1 className="text-2xl font-bold text-white mt-0.5">DDU 驱动洁净卸载与安全模式中心</h1>
        </div>
        <button
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-medium text-zinc-200 transition"
        >
          <BookOpen className="w-3.5 h-3.5 accent-text" />
          <span>清理后操作指南</span>
        </button>
      </div>

      {/* Safe Mode Status Banner */}
      {bootStatus?.isSafeMode ? (
        <div className="rounded-2xl bg-emerald-500/12 border border-emerald-500/35 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-200">
                安全模式检测通过：当前正运行在 Windows 安全模式
              </div>
              <p className="text-xs text-zinc-300 mt-1">
                驱动文件与内核服务未处于锁定状态，此时使用 DDU 卸载驱动可获得最彻底的清理效果。
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSafeModeModal}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition"
          >
            清理完毕？恢复正常启动
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-200">
                当前运行在「正常 Windows 模式」— 强烈建议先进入安全模式再运行 DDU
              </div>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                在正常模式下卸载显卡驱动容易导致注册表或着色器文件占用残留。点击右侧按钮可一键写入安全模式引导并重启（支持失败时分步引导）。
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSafeModeModal}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{bootStatus?.isSafeBootScheduled ? '已预约安全模式（去重启）' : '一键重启进入安全模式'}</span>
          </button>
        </div>
      )}

      {/* DDU Auto Download / Bind Card */}
      <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-base font-bold text-white">Display Driver Uninstaller (Wagnardsoft 官方)</span>
            {dduStatus?.ready ? (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                已就绪 v{dduStatus.installedVersion}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-700/40 border border-white/10 text-zinc-300 text-[11px]">
                尚未安装/绑定
              </span>
            )}
          </div>

          <div className="text-xs text-zinc-400 font-mono truncate">
            {dduStatus?.ready
              ? `可执行路径: ${dduStatus.dduExePath}`
              : `官方最新版本: v${dduStatus?.latestVersion || '18.1.6.3'} · 支持一键自动下载自解压，或绑定你本地已下载的 DDU 文件夹`}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            disabled={downloadingDdu}
            onClick={onDownloadAndExtractDdu}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl accent-bg font-bold text-xs transition disabled:opacity-60"
          >
            {downloadingDdu ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>
              {downloadingDdu
                ? '正在下载并解压 DDU...'
                : dduStatus?.ready
                ? `更新 / 重装 DDU (v${dduStatus.latestVersion})`
                : `自动下载并解压 DDU (v${dduStatus?.latestVersion || '18.1.6.3'})`}
            </span>
          </button>

          <button
            onClick={onBindDduDir}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-zinc-100 transition"
          >
            <FolderSearch className="w-4 h-4 accent-text" />
            <span>手动绑定 DDU 目录</span>
          </button>
        </div>
      </div>

      {/* Launch Modes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Standard GUI Launch */}
        <div className="lg:col-span-5 rounded-2xl bg-[#101512] border border-white/[0.08] p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-base font-bold text-white">标准交互式启动（推荐新手）</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              以管理员权限直接打开原版 DDU 图形界面，可在 DDU 内手动选择设备类型（GPU → NVIDIA / AMD / Intel）并点击「清除并重启」。
            </p>
            <div className="p-3.5 rounded-xl bg-black/35 border border-white/[0.06] space-y-1.5 text-xs text-zinc-300">
              <div className="font-semibold text-white">标准操作流程：</div>
              <div>1. 先准备目标版本显卡安装包（可在「驱动管理器」提前下载）。</div>
              <div>2. 重启进入安全模式后启动 DDU → 点击「清除并重启」。</div>
              <div>3. 回到正常桌面后断网（防 Windows 自动抢装旧驱动）并安装新驱动。</div>
            </div>
          </div>

          <button
            disabled={!dduStatus?.ready}
            onClick={() => onLaunchDdu({ mode: 'gui' })}
            className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.09] hover:bg-white/[0.15] border border-white/[0.14] text-white font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>启动 DDU 图形界面</span>
            <ArrowUpRight className="w-4 h-4 accent-text" />
          </button>
        </div>

        {/* Right: CLI Preset Automation */}
        <div className="lg:col-span-7 rounded-2xl bg-[#101512] border border-white/[0.08] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 accent-text" />
                <span>预设命令行一键清理（进阶）</span>
              </h3>
              <span className="text-[11px] font-mono text-zinc-500">CLI AUTOMATION</span>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">目标清理厂商</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'nvidia', label: 'NVIDIA' },
                    { id: 'amd', label: 'AMD Radeon' },
                    { id: 'intel', label: 'Intel Graphics' },
                    { id: 'all', label: '全部厂商 GPU' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setVendor(item.id)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                      vendor === item.id
                        ? 'accent-soft'
                        : 'bg-black/30 border-white/[0.07] text-zinc-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {[
                { label: '清理残留监视器配置文件 (-removemonitors)', val: removeMonitors, set: setRemoveMonitors },
                { label: '同时清理 Vulkan 运行时 (-RemoveVulkan)', val: removeVulkan, set: setRemoveVulkan },
                { label: '同时移除厂商控制面板 (-Remove*CP)', val: removeControlPanel, set: setRemoveControlPanel },
                { label: '生成详细清理日志 (-logging)', val: enableLogging, set: setEnableLogging },
                { label: '静默无弹窗直接执行 (-silent)', val: silent, set: setSilent },
                { label: '跳过安全模式警告 (-nosafemodemsg)', val: noSafeModeMsg, set: setNoSafeModeMsg },
              ].map((opt) => (
                <label
                  key={opt.label}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/30 border border-white/[0.06] cursor-pointer hover:border-white/15 transition"
                >
                  <input
                    type="checkbox"
                    checked={opt.val}
                    onChange={(e) => opt.set(e.target.checked)}
                    className="accent-[var(--accent)] w-3.5 h-3.5 rounded"
                  />
                  <span className="text-zinc-300">{opt.label}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">清理完成后动作</label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'restart', label: '清理后自动重启 (-restart)' },
                    { id: 'shutdown', label: '清理后自动关机（换显卡专用）' },
                    { id: 'none', label: '清理后不重启' },
                  ] as const
                ).map((act) => (
                  <button
                    key={act.id}
                    onClick={() => setPostAction(act.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs transition ${
                      postAction === act.id
                        ? 'accent-soft font-semibold'
                        : 'bg-black/30 border-white/[0.07] text-zinc-400 hover:text-white'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/50 border border-white/[0.07] font-mono text-[11px] text-zinc-300 break-all">
              <span className="text-zinc-500">&gt; </span>
              "Display Driver Uninstaller.exe" {previewArgs.join(' ')}
            </div>
          </div>

          <button
            disabled={!dduStatus?.ready}
            onClick={() =>
              onLaunchDdu({
                mode: 'preset',
                vendor,
                removeMonitors,
                removeVulkan,
                removeControlPanel,
                enableLogging,
                silent,
                noSafeModeMsg,
                postAction,
              })
            }
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl accent-bg font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>按当前预设启动 DDU</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
