import React from 'react';
import { DownloadTask, formatBytes, formatSpeed } from '../types/gpu';
import { X, FolderOpen, Play, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface DownloadTrayProps {
  downloads: DownloadTask[];
  expanded: boolean;
  onToggleExpand: () => void;
  onCancel: (id: string) => void;
  onReveal: (filePath: string) => void;
  onLaunch: (filePath: string) => void;
}

export const DownloadTray: React.FC<DownloadTrayProps> = ({
  downloads,
  expanded,
  onToggleExpand,
  onCancel,
  onReveal,
  onLaunch,
}) => {
  if (downloads.length === 0) return null;

  const activeCount = downloads.filter((d) => d.status === 'downloading').length;
  const latest = downloads[0];

  return (
    <div className="fixed bottom-4 right-5 z-40 w-[390px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#101612]/95 backdrop-blur-md border border-white/15 shadow-2xl overflow-hidden">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] transition text-xs"
      >
        <div className="flex items-center gap-2 min-w-0">
          {activeCount > 0 ? (
            <Loader2 className="w-3.5 h-3.5 accent-text animate-spin shrink-0" />
          ) : latest.status === 'completed' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span className="font-semibold text-zinc-100 truncate">
            {activeCount > 0
              ? `正在下载 (${activeCount}) · ${latest.filename}`
              : `下载任务 (${downloads.length})`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2 text-zinc-400 font-mono">
          {activeCount > 0 && <span>{latest.percent}%</span>}
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.06]">
          {downloads.slice(0, 6).map((task) => (
            <div key={task.id} className="p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-zinc-100 truncate" title={task.filename}>
                    {task.filename}
                  </div>
                  <div className="text-[10.5px] font-mono text-zinc-400 mt-0.5">
                    {task.status === 'downloading' && (
                      <>
                        {formatBytes(task.receivedBytes)}
                        {task.totalBytes > 0 ? ` / ${formatBytes(task.totalBytes)}` : ''} · {formatSpeed(task.speedBps)}
                      </>
                    )}
                    {task.status === 'completed' && (
                      <span className="text-emerald-400">下载完成 · {formatBytes(task.receivedBytes)}</span>
                    )}
                    {task.status === 'failed' && <span className="text-rose-400">{task.error || '下载失败'}</span>}
                    {task.status === 'cancelled' && <span className="text-zinc-500">已取消</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {task.status === 'downloading' && (
                    <button
                      onClick={() => onCancel(task.id)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 transition"
                      title="取消下载"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {task.status === 'completed' && (
                    <>
                      <button
                        onClick={() => onReveal(task.filePath)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 transition"
                        title="在文件夹中显示"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                      {task.category !== 'ddu' && (
                        <button
                          onClick={() => onLaunch(task.filePath)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg accent-bg text-[11px] font-bold transition"
                          title="运行安装程序"
                        >
                          <Play className="w-3 h-3" />
                          <span>运行</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {task.status === 'downloading' && (
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full accent-bg transition-all duration-150"
                    style={{ width: `${Math.max(4, task.percent)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
