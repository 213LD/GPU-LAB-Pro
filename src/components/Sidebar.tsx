import React, { useState } from 'react';
import {
  LayoutDashboard,
  DownloadCloud,
  Trash2,
  Sliders,
  HardDrive,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Monitor,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ActivePage, BootStatus, GpuAdapter, VENDOR_META } from '../types/gpu';

interface SidebarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  adapters: GpuAdapter[];
  selectedGpuId: string;
  onSelectGpu: (id: string) => void;
  bootStatus: BootStatus | null;
  onOpenGuide: () => void;
  activeDownloadsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  adapters,
  selectedGpuId,
  onSelectGpu,
  bootStatus,
  onOpenGuide,
  activeDownloadsCount,
}) => {
  const [showVirtual, setShowVirtual] = useState(false);

  const physicalGpus = adapters.filter((a) => !a.isVirtual);
  const virtualGpus = adapters.filter((a) => a.isVirtual);
  const activeGpu = adapters.find((a) => a.id === selectedGpuId) || physicalGpus[0] || adapters[0];
  const vendorMeta = VENDOR_META[activeGpu?.vendor || 'nvidia'];

  const navItems: {
    id: ActivePage;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    badge?: string;
  }[] = [
    {
      id: 'overview',
      title: '显卡调试中心',
      subtitle: '总览 · 状态 · 一站式入口',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'drivers',
      title: '驱动管理器',
      subtitle: '下载 · 更新 · 版本回退',
      icon: <DownloadCloud className="w-4 h-4" />,
      badge: activeDownloadsCount > 0 ? `${activeDownloadsCount}` : undefined,
    },
    {
      id: 'ddu',
      title: 'DDU 洁净卸载',
      subtitle: '安全模式 · 彻底清理',
      icon: <Trash2 className="w-4 h-4" />,
    },
    {
      id: 'vendor',
      title: vendorMeta.panelName,
      subtitle:
        activeGpu?.vendor === 'amd'
          ? 'Adrenalin · 官方清理工具'
          : activeGpu?.vendor === 'intel'
          ? 'Arc 控制 · Intel DSA'
          : '控制面板 · NVIDIA App · 监控',
      icon: <Sliders className="w-4 h-4" />,
    },
    {
      id: 'shader',
      title: '着色器缓存',
      subtitle: '目录浏览 · 深度清理',
      icon: <HardDrive className="w-4 h-4" />,
    },
  ];

  const shortenGpuName = (name: string) =>
    name
      .replace(/^NVIDIA\s+GeForce\s+/i, '')
      .replace(/^AMD\s+/i, '')
      .replace(/^Intel\(R\)\s+/i, '')
      .replace(/\(TM\)/gi, '');

  return (
    <aside className="w-[260px] shrink-0 bg-[#0b0f0c] border-r border-white/[0.07] flex flex-col justify-between select-none">
      <div className="flex flex-col min-h-0 overflow-y-auto">
        {/* Brand Block */}
        <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl accent-bg flex items-center justify-center font-black text-base shadow-[0_0_20px_var(--accent-glow)]">
              G
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-wide text-white">GPU LAB</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold accent-soft border">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">图形卡驱动与调试工作台</p>
            </div>
          </div>
        </div>

        {/* Detected GPUs Switcher */}
        <div className="px-3 pt-3.5 pb-2">
          <div className="flex items-center justify-between px-1.5 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              DETECTED GPUS · 已识别显卡
            </span>
            <span className="text-[10px] font-mono text-zinc-500">{physicalGpus.length} 物理</span>
          </div>

          <div className="space-y-1.5">
            {physicalGpus.map((gpu) => {
              const isSelected = gpu.id === activeGpu?.id;
              const meta = VENDOR_META[gpu.vendor];
              return (
                <button
                  key={gpu.id}
                  onClick={() => onSelectGpu(gpu.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl border transition-all duration-200 ${
                    isSelected
                      ? 'bg-[#121a14] border-[var(--accent-border)] shadow-[0_0_16px_-6px_var(--accent-glow)]'
                      : 'bg-white/[0.015] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dotClass}`} />
                      <span
                        className={`text-xs font-semibold truncate ${
                          isSelected ? 'text-white' : 'text-zinc-300'
                        }`}
                      >
                        {shortenGpuName(gpu.name)}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-zinc-300 border border-white/[0.07] shrink-0">
                      {gpu.vramLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 pl-4 text-[10px] text-zinc-500 font-mono">
                    <span>{meta.shortLabel}</span>
                    <span>v{gpu.friendlyVersion}</span>
                  </div>
                </button>
              );
            })}

            {physicalGpus.length === 0 && (
              <div className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-zinc-500">
                正在扫描本地显示适配器...
              </div>
            )}
          </div>

          {virtualGpus.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowVirtual((v) => !v)}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition"
              >
                <span className="flex items-center gap-1.5">
                  <Monitor className="w-3 h-3" />
                  虚拟显示适配器 ({virtualGpus.length})
                </span>
                {showVirtual ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              {showVirtual && (
                <div className="mt-1 space-y-1 pl-1">
                  {virtualGpus.map((vg) => (
                    <button
                      key={vg.id}
                      onClick={() => onSelectGpu(vg.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] border transition ${
                        vg.id === activeGpu?.id
                          ? 'bg-zinc-800/70 border-zinc-600 text-zinc-200'
                          : 'bg-transparent border-white/[0.04] text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <div className="truncate font-medium">{vg.name}</div>
                      <div className="font-mono text-[10px] text-zinc-600">v{vg.driverVersion}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <div className="px-3 pt-3 pb-3">
          <div className="px-1.5 mb-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            WORKSPACE · 工具模块
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 ${
                    isActive
                      ? 'accent-soft shadow-[0_0_20px_-10px_var(--accent-glow)]'
                      : 'border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03]'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'accent-bg' : 'bg-white/[0.04] text-zinc-400'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[13px] font-semibold truncate ${isActive ? 'text-white' : ''}`}>
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono accent-bg font-bold">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-zinc-500 truncate mt-0.5">{item.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Status & Guide */}
      <div className="p-3 border-t border-white/[0.06] bg-[#080b09] space-y-2.5">
        <div className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>本地工作台 · 环境</span>
            <span className="flex items-center gap-1 accent-text">
              <Sparkles className="w-3 h-3" />
              ONLINE
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">
              {bootStatus?.isSafeMode ? '安全模式已激活' : '图形核心已就绪'}
            </span>
            {bootStatus?.isSafeMode && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onOpenGuide}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition"
          >
            <BookOpen className="w-3.5 h-3.5 accent-text" />
            <span>清理后必读指南 ↗</span>
          </button>
          <span className="text-[10px] font-mono text-zinc-600 px-1.5">V2.0</span>
        </div>
      </div>
    </aside>
  );
};
