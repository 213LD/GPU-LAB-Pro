import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  Terminal,
  CheckCircle2,
} from 'lucide-react';
import { BootStatus } from '../types/gpu';

interface SafeModeModalProps {
  open: boolean;
  onClose: () => void;
  bootStatus: BootStatus | null;
  onRefreshBoot: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const SafeModeModal: React.FC<SafeModeModalProps> = ({
  open,
  onClose,
  bootStatus,
  onRefreshBoot,
  onNotify,
}) => {
  const [busy, setBusy] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [manualReason, setManualReason] = useState('');

  if (!open) return null;

  const handleSchedule = async (rebootNow: boolean) => {
    setBusy(true);
    try {
      const res = await window.gpuLab.scheduleSafeMode(rebootNow);
      await onRefreshBoot();
      if (res.success) {
        onNotify('success', res.message);
        if (!rebootNow) onClose();
      } else {
        setManualReason(res.message);
        setShowManualGuide(true);
        onNotify('error', res.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSafeMode = async (rebootNow: boolean) => {
    setBusy(true);
    try {
      const res = await window.gpuLab.cancelSafeMode(rebootNow);
      await onRefreshBoot();
      onNotify(res.success ? 'success' : 'error', res.message);
      if (res.success && !rebootNow) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-[600px] rounded-2xl bg-[#111512] border border-white/15 shadow-[0_24px_64px_rgba(0,0,0,0.85)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#0b0e0c] border-b border-white/[0.08]">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            {bootStatus?.isSafeMode ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            )}
            <span>Windows 安全模式管理与重启引导</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Status Banner */}
          {bootStatus?.isSafeMode ? (
            <div className="p-4 rounded-xl bg-emerald-500/12 border border-emerald-500/35 space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>当前系统已处于 Windows 安全模式（{bootStatus.safeModeType === 'network' ? '带网络' : '最小化'}）</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                这是运行 DDU 进行显卡驱动彻底卸载的最佳环境。卸载完成后，点击下方按钮即可清除安全模式引导项并重启回到正常 Windows 桌面。
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  disabled={busy}
                  onClick={() => handleCancelSafeMode(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition disabled:opacity-50"
                >
                  清除引导并重启回正常模式
                </button>
                <button
                  disabled={busy}
                  onClick={() => handleCancelSafeMode(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium transition disabled:opacity-50"
                >
                  仅恢复正常启动项（稍后手动重启）
                </button>
              </div>
            </div>
          ) : bootStatus?.isSafeBootScheduled ? (
            <div className="p-4 rounded-xl bg-amber-500/12 border border-amber-500/35 space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>已预约「下次开机自动进入安全模式」</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                当前 `bcdedit` 已写入 `safeboot minimal`。请保存好正在编辑的文件后重启计算机，系统将自动进入安全模式。
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => handleSchedule(true)}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs transition"
                >
                  立即重启进入安全模式
                </button>
                <button
                  disabled={busy}
                  onClick={() => handleCancelSafeMode(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium transition"
                >
                  取消预约（恢复正常启动）
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300 space-y-1.5 leading-relaxed">
                  <div className="font-bold text-amber-200">进入安全模式前的安全提示（重要）</div>
                  <p>1. 若系统开启了 <strong className="text-white">BitLocker 磁盘加密</strong>，请提前确认恢复密钥可用。</p>
                  <p>2. 安全模式下部分系统可能要求使用 <strong className="text-white">微软账户密码</strong> 而非 PIN 登录。</p>
                  <p>3. 使用完 DDU 清理后，本工具支持在安全模式下一键执行「恢复正常模式」。</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  disabled={busy}
                  onClick={() => handleSchedule(true)}
                  className="flex flex-col items-start p-4 rounded-xl accent-bg transition text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <RotateCcw className="w-4 h-4" />
                    <span>一键配置并立即重启进入安全模式</span>
                  </div>
                  <span className="text-[11px] opacity-80 mt-1">
                    自动写入 BCD safeboot minimal 并倒计时 5 秒重启
                  </span>
                </button>

                <button
                  disabled={busy}
                  onClick={() => handleSchedule(false)}
                  className="flex flex-col items-start p-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-zinc-100 transition text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <ShieldCheck className="w-4 h-4 accent-text" />
                    <span>仅预约下次重启进入安全模式</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 mt-1">
                    先写入引导配置，稍后保存工作再手动重启
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Toggle or Fallback Manual Guide */}
          <div className="border-t border-white/[0.08] pt-3">
            <button
              onClick={() => setShowManualGuide((s) => !s)}
              className="text-xs accent-text hover:underline font-medium"
            >
              {showManualGuide ? '收起手动进入安全模式引导 ▲' : '如果自动重启失败？查看手动进入安全模式分步引导 ▼'}
            </button>

            {showManualGuide && (
              <div className="mt-3 p-4 rounded-xl bg-black/40 border border-white/[0.08] space-y-3 text-xs text-zinc-300">
                {manualReason && (
                  <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200">
                    {manualReason}
                  </div>
                )}

                <div className="font-bold text-white">方法一：通过 Windows 设置「高级启动」（最稳妥，无需密码改写 BCD）</div>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                  <li>点击下方按钮打开 Windows 恢复设置，找到「高级启动」→ 点击「立即重新启动」。</li>
                  <li>蓝屏恢复界面依次选择：<span className="text-zinc-200">疑难解答 → 高级选项 → 启动设置 → 重启</span>。</li>
                  <li>重启后按键盘数字键 <span className="text-white font-mono">4</span> 或 <span className="text-white font-mono">F4</span> 即可进入安全模式。</li>
                </ol>

                <div className="font-bold text-white pt-1">方法二：通过系统配置 (msconfig) 勾选安全引导</div>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                  <li>打开下方的「系统配置 (msconfig)」，切换到 <span className="text-zinc-200">引导 (Boot)</span> 选项卡。</li>
                  <li>勾选 <span className="text-zinc-200">安全引导 (Safe boot) → 最小</span>，确定后重启。</li>
                  <li>清理完驱动后，务必再次打开 msconfig 取消勾选「安全引导」。</li>
                </ol>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => window.gpuLab.openExternal('ms-settings:recovery')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 accent-text" />
                    <span>打开 Windows 恢复设置</span>
                  </button>
                  <button
                    onClick={() => window.gpuLab.openSystemTool('msconfig')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition"
                  >
                    <Terminal className="w-3.5 h-3.5 accent-text" />
                    <span>打开系统配置 (msconfig)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
