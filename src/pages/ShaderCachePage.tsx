import React, { useMemo, useState } from 'react';
import {
  FolderOpen,
  Trash2,
  RefreshCw,
  BookOpen,
  HardDrive,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import { ShaderCacheFolder, formatBytes } from '../types/gpu';

interface ShaderCachePageProps {
  folders: ShaderCacheFolder[];
  scanning: boolean;
  cleaning: boolean;
  onRescan: () => void;
  onOpenFolder: (id: string) => void;
  onCleanFolders: (ids?: string[]) => void;
  onOpenGuide: () => void;
}

export const ShaderCachePage: React.FC<ShaderCachePageProps> = ({
  folders,
  scanning,
  cleaning,
  onRescan,
  onOpenFolder,
  onCleanFolders,
  onOpenGuide,
}) => {
  const [vendorFilter, setVendorFilter] = useState<'all' | 'directx' | 'nvidia' | 'amd' | 'intel'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return folders.filter((f) => vendorFilter === 'all' || f.vendor === vendorFilter);
  }, [folders, vendorFilter]);

  const totalBytes = folders.reduce((sum, f) => sum + f.sizeBytes, 0);
  const totalFiles = folders.reduce((sum, f) => sum + f.fileCount, 0);
  const selectedBytes = folders
    .filter((f) => selectedIds.includes(f.id))
    .reduce((sum, f) => sum + f.sizeBytes, 0);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const selectAllExisting = () => {
    const existing = filtered.filter((f) => f.exists).map((f) => f.id);
    if (existing.every((id) => selectedIds.includes(id))) {
      setSelectedIds((prev) => prev.filter((id) => !existing.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...existing])));
    }
  };

  const vendorBadge = (v: ShaderCacheFolder['vendor']) => {
    if (v === 'nvidia') return 'bg-lime-400/15 text-lime-300 border-lime-400/30';
    if (v === 'amd') return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    if (v === 'intel') return 'bg-sky-400/15 text-sky-300 border-sky-400/30';
    return 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
  };

  return (
    <div className="p-6 space-y-5 max-w-[1380px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            04 / SHADER CACHE CLEANER
          </div>
          <h1 className="text-2xl font-bold text-white mt-0.5">显卡着色器缓存 · 目录查看与深度清理</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs text-zinc-300 transition"
          >
            <BookOpen className="w-3.5 h-3.5 accent-text" />
            <span>清理后必读</span>
          </button>
          <button
            onClick={onRescan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-medium text-white transition disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin accent-text' : ''}`} />
            <span>{scanning ? '扫描中...' : '重新扫描占用'}</span>
          </button>
        </div>
      </div>

      {/* Overview Strip */}
      <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl accent-soft border flex items-center justify-center shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-zinc-400">当前全盘扫描着色器缓存总计</div>
            <div className="text-2xl font-extrabold font-mono text-white mt-0.5">
              {formatBytes(totalBytes)}
              <span className="text-xs font-normal text-zinc-400 ml-2.5">
                ({totalFiles.toLocaleString()} 个缓存文件 · {folders.filter((f) => f.exists).length} 个存在目录)
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={selectAllExisting}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-medium text-zinc-200 transition"
          >
            <CheckSquare className="w-3.5 h-3.5 accent-text" />
            <span>全选 / 取消当前存在目录</span>
          </button>

          {selectedIds.length > 0 && (
            <button
              disabled={cleaning}
              onClick={() => onCleanFolders(selectedIds)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.1] hover:bg-white/[0.16] border border-white/15 text-white font-bold text-xs transition disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5 accent-text" />
              <span>清理所选 ({selectedIds.length} 项 · {formatBytes(selectedBytes)})</span>
            </button>
          )}

          <button
            disabled={cleaning || totalBytes === 0}
            onClick={() => onCleanFolders(undefined)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl accent-bg font-bold text-xs transition disabled:opacity-40"
          >
            <Sparkles className="w-4 h-4" />
            <span>{cleaning ? '正在清理缓存...' : '一键清理全部着色器缓存'}</span>
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'all', label: '全部目录' },
            { id: 'directx', label: 'DirectX' },
            { id: 'nvidia', label: 'NVIDIA' },
            { id: 'amd', label: 'AMD' },
            { id: 'intel', label: 'Intel' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            onClick={() => setVendorFilter(item.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition ${
              vendorFilter === item.id
                ? 'accent-soft'
                : 'bg-[#101512] border-white/[0.07] text-zinc-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Folder Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {filtered.map((folder) => {
          const isSelected = selectedIds.includes(folder.id);
          const pct = totalBytes > 0 ? Math.min(100, Math.round((folder.sizeBytes / totalBytes) * 100)) : 0;

          return (
            <div
              key={folder.id}
              className={`rounded-2xl bg-[#101512] border p-4 flex flex-col justify-between gap-3 transition ${
                isSelected ? 'border-[var(--accent-border)] bg-[#121a14]' : 'border-white/[0.08]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    disabled={!folder.exists}
                    onClick={() => toggleId(folder.id)}
                    className="mt-0.5 text-zinc-400 hover:text-white disabled:opacity-30 transition"
                    title="勾选用于批量清理"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 accent-text" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white">{folder.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${vendorBadge(
                          folder.vendor
                        )}`}
                      >
                        {folder.vendor}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{folder.description}</p>
                    <div className="text-[11px] font-mono text-zinc-500 mt-1 break-all">{folder.path}</div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold font-mono text-white">
                    {folder.exists ? formatBytes(folder.sizeBytes) : '未生成'}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500">
                    {folder.exists ? `${folder.fileCount} 文件` : '目录不存在'}
                  </div>
                </div>
              </div>

              {/* Size bar & actions */}
              <div className="space-y-2.5">
                <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full accent-bg rounded-full" style={{ width: `${pct}%` }} />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onOpenFolder(folder.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-zinc-200 transition"
                  >
                    <FolderOpen className="w-3.5 h-3.5 accent-text" />
                    <span>打开目录</span>
                  </button>
                  <button
                    disabled={!folder.exists || folder.sizeBytes === 0 || cleaning}
                    onClick={() => onCleanFolders([folder.id])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/12 hover:bg-rose-500/22 border border-rose-500/25 text-xs text-rose-300 transition disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>清理此项</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
