import React, { useState } from 'react';
import { X, RotateCcw, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { ShaderCleanResult, formatBytes } from '../types/gpu';

interface PostCleanupModalProps {
  open: boolean;
  onClose: () => void;
  cleanResult?: ShaderCleanResult | null;
}

export const PostCleanupModal: React.FC<PostCleanupModalProps> = ({
  open,
  onClose,
  cleanResult,
}) => {
  const [showGameTips, setShowGameTips] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-[540px] rounded-2xl bg-[#111512] border border-white/15 shadow-[0_24px_64px_rgba(0,0,0,0.85)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Window-style Modal Header matching Screenshot 1 */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0b0e0c] border-b border-white/[0.08]">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-4 h-4 rounded accent-bg flex items-center justify-center text-[10px] font-black">
              !
            </span>
            <span className="font-medium text-zinc-300">使用前必读 · 清理后操作指南</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {cleanResult && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl accent-soft border">
              <Sparkles className="w-5 h-5 shrink-0" />
              <div className="text-xs leading-relaxed">
                <div className="font-bold text-white">
                  着色器缓存清理完成：共释放 {formatBytes(cleanResult.freedBytes)}（删除 {cleanResult.deletedFiles} 个文件）
                </div>
                {cleanResult.skippedFiles > 0 && (
                  <div className="text-zinc-300/80 mt-0.5">
                    另有 {cleanResult.skippedFiles} 个正在被系统或游戏占用的文件已安全跳过（重启后可彻底释放）。
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              清理后，请完成这两步
            </h2>
            <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
              使用清理显卡着色器缓存，或使用 DDU 清理显卡驱动后，需要：
            </p>
          </div>

          <div className="space-y-2.5 bg-black/35 border border-white/[0.07] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full accent-soft border text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div>
                <div className="text-sm font-semibold text-white">重启计算机。</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  让 Windows 重新初始化显示驱动堆栈并释放系统占用的旧着色器句柄。
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <span className="w-6 h-6 rounded-full accent-soft border text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div>
                <div className="text-sm font-semibold text-white">
                  在游戏平台中验证游戏文件完整性。
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  防止因旧着色器索引残留导致游戏启动报错或闪退。
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            清理驱动后，请安装与显卡及系统匹配的驱动，再进入游戏。首次运行游戏时，着色器可能需要重新编译（短暂卡顿属正常现象）。
          </p>

          {/* Collapsible platform tips */}
          <div className="border border-white/[0.07] rounded-xl overflow-hidden bg-white/[0.02]">
            <button
              onClick={() => setShowGameTips((s) => !s)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-zinc-300 hover:text-white transition"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 accent-text" />
                常见游戏平台「验证文件完整性」快捷路径说明
              </span>
              {showGameTips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showGameTips && (
              <div className="px-3.5 pb-3 pt-1 text-[11.5px] text-zinc-400 space-y-1.5 border-t border-white/[0.06]">
                <div>• <strong className="text-zinc-200">Steam</strong>：右键游戏 → 属性 → 已安装文件 → 验证游戏文件的完整性</div>
                <div>• <strong className="text-zinc-200">Epic Games</strong>：游戏右下角「···」→ 管理 → 验证文件</div>
                <div>• <strong className="text-zinc-200">WeGame / 战网</strong>：游戏修复 / 扫描和修复</div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => window.gpuLab.openSystemTool('dxdiag')}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>打开 DirectX 诊断 (dxdiag)</span>
            </button>

            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl accent-bg font-bold text-sm shadow-lg transition active:scale-[0.98]"
            >
              我已了解
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
