import React from 'react';
import { Minus, Square, Copy, X, ShieldCheck, ShieldAlert, Cpu } from 'lucide-react';
import { BootStatus } from '../types/gpu';

interface TitleBarProps {
  bootStatus: BootStatus | null;
  isMaximized: boolean;
  onOpenSafeModeModal: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  bootStatus,
  isMaximized,
  onOpenSafeModeModal,
}) => {
  return (
    <header className="drag-region h-10 shrink-0 bg-[#070a08] border-b border-white/[0.06] flex items-center justify-between px-3.5 select-none">
      <div className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded-md accent-bg flex items-center justify-center shadow-sm">
          <Cpu className="w-3.5 h-3.5" />
        </div>
        <span className="text-[12px] font-semibold tracking-wider text-zinc-200">
          GPU LAB <span className="accent-text font-mono">PRO</span>
        </span>
        <span className="text-[11px] text-zinc-500 hidden sm:inline">· 显卡调试中心</span>
      </div>

      <div className="no-drag flex items-center gap-2">
        {bootStatus && (
          <button
            onClick={onOpenSafeModeModal}
            title="点击查看或切换 Windows 安全模式"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
              bootStatus.isSafeMode
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                : bootStatus.isSafeBootScheduled
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                : 'bg-zinc-900/80 text-zinc-400 border-white/[0.08] hover:border-white/20 hover:text-zinc-200'
            }`}
          >
            {bootStatus.isSafeMode ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>当前：安全模式</span>
              </>
            ) : bootStatus.isSafeBootScheduled ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>已预约安全模式</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <span>正常模式</span>
              </>
            )}
          </button>
        )}

        {bootStatus && (
          <div
            className={`hidden md:flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border ${
              bootStatus.isAdmin
                ? 'bg-white/[0.03] text-zinc-300 border-white/[0.08]'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
            }`}
            title={bootStatus.isAdmin ? '当前已获取管理员权限' : '部分系统操作会请求 UAC 提权'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${bootStatus.isAdmin ? 'bg-lime-400' : 'bg-amber-400'}`} />
            <span>{bootStatus.isAdmin ? '管理员就绪' : '标准权限'}</span>
          </div>
        )}

        <div className="flex items-center ml-2 border-l border-white/[0.07] pl-2">
          <button
            onClick={() => window.gpuLab.minimizeWindow()}
            className="w-8 h-7 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition"
            aria-label="最小化"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => window.gpuLab.maximizeWindow()}
            className="w-8 h-7 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition"
            aria-label="最大化"
          >
            {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
          </button>
          <button
            onClick={() => window.gpuLab.closeWindow()}
            className="w-8 h-7 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-rose-500/80 transition"
            aria-label="关闭"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
