import React, { useMemo, useState } from 'react';
import {
  Download,
  ExternalLink,
  Search,
  RefreshCw,
  CheckCircle2,
  ArrowUpCircle,
  History,
  HardDrive,
  FolderOpen,
  Play,
  AlertCircle,
  Wrench,
} from 'lucide-react';
import {
  AppConfig,
  DownloadTask,
  DriverCatalogResult,
  DriverItem,
  GpuAdapter,
  LocalDriverStoreItem,
  VENDOR_META,
} from '../types/gpu';

interface DriverManagerPageProps {
  activeGpu: GpuAdapter | undefined;
  catalog: DriverCatalogResult | null;
  loadingCatalog: boolean;
  localStore: LocalDriverStoreItem[];
  downloads: DownloadTask[];
  config: AppConfig | null;
  onReloadCatalog: (seriesId?: string, productId?: string) => void;
  onDownloadDriver: (driver: DriverItem) => void;
  onPickDownloadDir: () => void;
  onLaunchInstaller: (filePath: string) => void;
  onRevealFile: (filePath: string) => void;
  onInstallLocalDriver: (publishedName: string) => void;
}

export const DriverManagerPage: React.FC<DriverManagerPageProps> = ({
  activeGpu,
  catalog,
  loadingCatalog,
  localStore,
  downloads,
  config,
  onReloadCatalog,
  onDownloadDriver,
  onPickDownloadDir,
  onLaunchInstaller,
  onRevealFile,
  onInstallLocalDriver,
}) => {
  const [tab, setTab] = useState<'online' | 'local'>('online');
  const [channelFilter, setChannelFilter] = useState<'all' | 'Game Ready' | 'Studio'>('all');
  const [search, setSearch] = useState('');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  const effectiveSeriesId = selectedSeriesId || catalog?.matchedSeriesId || '';
  const effectiveProductId = selectedProductId || catalog?.matchedProductId || '';

  const filteredProducts = useMemo(() => {
    if (!catalog?.productList) return [];
    if (!effectiveSeriesId) return catalog.productList.slice(0, 80);
    return catalog.productList.filter((p) => p.parentId === effectiveSeriesId);
  }, [catalog?.productList, effectiveSeriesId]);

  const filteredDrivers = useMemo(() => {
    if (!catalog?.drivers) return [];
    return catalog.drivers.filter((d) => {
      if (channelFilter !== 'all' && d.channel !== channelFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          d.version.toLowerCase().includes(q) ||
          d.name.toLowerCase().includes(q) ||
          d.releaseDate.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [catalog?.drivers, channelFilter, search]);

  const vendorMeta = VENDOR_META[activeGpu?.vendor || 'nvidia'];

  const findCompletedDownload = (url: string) =>
    downloads.find((dl) => dl.url === url && dl.status === 'completed');

  const findActiveDownload = (url: string) =>
    downloads.find((dl) => dl.url === url && dl.status === 'downloading');

  return (
    <div className="p-6 space-y-5 max-w-[1380px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            01 / DRIVER MANAGER
          </div>
          <h1 className="text-2xl font-bold text-white mt-0.5">显卡驱动下载 · 更新 · 版本回退</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {config && (
            <button
              onClick={onPickDownloadDir}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs text-zinc-300 transition"
              title={config.downloadDir}
            >
              <FolderOpen className="w-3.5 h-3.5 accent-text" />
              <span className="max-w-[200px] truncate">目录: {config.downloadDir}</span>
            </button>
          )}
          {catalog?.officialPageUrl && (
            <button
              onClick={() => window.gpuLab.openExternal(catalog.officialPageUrl)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs text-zinc-200 transition"
            >
              <ExternalLink className="w-3.5 h-3.5 accent-text" />
              <span>官方驱动官网</span>
            </button>
          )}
          <button
            onClick={() => onReloadCatalog(effectiveSeriesId || undefined, effectiveProductId || undefined)}
            disabled={loadingCatalog}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl accent-bg font-bold text-xs transition disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingCatalog ? 'animate-spin' : ''}`} />
            <span>{loadingCatalog ? '获取中...' : '刷新驱动目录'}</span>
          </button>
        </div>
      </div>

      {/* Matched Hardware Summary Bar */}
      <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${vendorMeta.dotClass}`} />
          <div>
            <div className="text-xs text-zinc-400">
              当前目标显卡 · 匹配模型：<strong className="text-white">{catalog?.matchedModelName || activeGpu?.name}</strong>
            </div>
            <div className="text-xs font-mono text-zinc-400 mt-0.5">
              当前已安装版本: <span className="accent-text font-semibold">{activeGpu?.friendlyVersion || '未知'}</span>
              {' '}（WDDM {activeGpu?.driverVersion}）
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/[0.07]">
          <button
            onClick={() => setTab('online')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === 'online' ? 'accent-bg' : 'text-zinc-400 hover:text-white'
            }`}
          >
            在线官方驱动库 ({catalog?.drivers.length || 0})
          </button>
          <button
            onClick={() => setTab('local')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === 'local' ? 'accent-bg' : 'text-zinc-400 hover:text-white'
            }`}
          >
            本地存储与回退 ({localStore.length})
          </button>
        </div>
      </div>

      {tab === 'online' ? (
        <>
          {/* Filter / Model Override Bar */}
          <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索版本号（如 621.24 / 26.10.1）或日期..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/[0.08] focus:border-[var(--accent-border)] outline-none text-xs text-zinc-100 placeholder:text-zinc-600"
                />
              </div>

              {activeGpu?.vendor === 'nvidia' && (
                <div className="flex items-center gap-1.5">
                  {(['all', 'Game Ready', 'Studio'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setChannelFilter(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                        channelFilter === c
                          ? 'accent-soft'
                          : 'bg-white/[0.02] border-white/[0.07] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {c === 'all' ? '全部类型' : c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Optional NVIDIA manual model picker */}
            {activeGpu?.vendor === 'nvidia' && catalog?.seriesList && catalog.seriesList.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06] text-xs">
                <span className="text-zinc-500">手动切换查询型号：</span>
                <select
                  value={effectiveSeriesId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setSelectedSeriesId(sid);
                    const firstProd = catalog.productList?.find((p) => p.parentId === sid);
                    if (firstProd) {
                      setSelectedProductId(firstProd.id);
                      onReloadCatalog(sid, firstProd.id);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-zinc-200 outline-none"
                >
                  {catalog.seriesList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={effectiveProductId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedProductId(pid);
                    onReloadCatalog(effectiveSeriesId, pid);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-zinc-200 outline-none"
                >
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {catalog?.warning && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>{catalog.warning}</span>
              </div>
            )}
          </div>

          {/* Driver List */}
          <div className="space-y-2.5">
            {loadingCatalog && filteredDrivers.length === 0 ? (
              <div className="p-10 rounded-2xl bg-[#101512] border border-white/[0.08] text-center text-sm text-zinc-400">
                正在同步官方驱动版本列表...
              </div>
            ) : filteredDrivers.length === 0 ? (
              <div className="p-10 rounded-2xl bg-[#101512] border border-white/[0.08] text-center text-sm text-zinc-400">
                未找到匹配的驱动版本，请调整筛选条件或点击右上角「官方驱动官网」。
              </div>
            ) : (
              filteredDrivers.map((drv) => {
                const done = findCompletedDownload(drv.downloadUrl);
                const active = findActiveDownload(drv.downloadUrl);
                return (
                  <div
                    key={drv.id}
                    className={`rounded-2xl bg-[#101512] border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                      drv.relation === 'current'
                        ? 'border-[var(--accent-border)] bg-[#121a14]'
                        : 'border-white/[0.08] hover:border-white/[0.16]'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold font-mono text-white">v{drv.version}</span>
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-[11px] font-medium text-zinc-200">
                          {drv.channel}
                        </span>
                        {drv.isWhql && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-300">
                            WHQL
                          </span>
                        )}
                        {drv.relation === 'newer' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full accent-soft border text-[11px] font-semibold">
                            <ArrowUpCircle className="w-3 h-3" />
                            可更新新版
                          </span>
                        )}
                        {drv.relation === 'current' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            当前安装版本
                          </span>
                        )}
                        {drv.relation === 'older' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/12 border border-amber-500/30 text-amber-300 text-[11px] font-medium">
                            <History className="w-3 h-3" />
                            历史回退版本
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-zinc-400">
                        {drv.name} · 发布日期 <span className="font-mono text-zinc-300">{drv.releaseDate}</span> · 大小{' '}
                        <span className="font-mono text-zinc-300">{drv.fileSize}</span>
                      </div>
                      {drv.notes && <div className="text-[11px] text-zinc-500">{drv.notes}</div>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {drv.releaseNotesUrl && (
                        <button
                          onClick={() => window.gpuLab.openExternal(drv.releaseNotesUrl!)}
                          className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-zinc-300 transition"
                        >
                          发行说明
                        </button>
                      )}

                      {done ? (
                        <>
                          <button
                            onClick={() => onRevealFile(done.filePath)}
                            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-300 transition"
                            title="打开所在目录"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onLaunchInstaller(done.filePath)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg font-bold text-xs transition"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>运行安装</span>
                          </button>
                        </>
                      ) : active ? (
                        <div className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-mono accent-text">
                          下载中 {active.percent}%...
                        </div>
                      ) : (
                        <button
                          onClick={() => onDownloadDriver(drv)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition ${
                            drv.relation === 'newer'
                              ? 'accent-bg'
                              : 'bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-white'
                          }`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{drv.relation === 'older' ? '下载此版本回退' : '下载安装包'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        /* Local Driver Store & Rollback Tab */
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#101512] border border-white/[0.08] p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 text-xs text-zinc-300">
              <div className="font-bold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 accent-text" />
                <span>Windows Driver Store 已缓存显示驱动包 (pnputil)</span>
              </div>
              <p className="text-zinc-400">
                你可以在这里重新部署本地缓存的旧版驱动 INF 包，或者打开 Windows「设备管理器 → 显示适配器 → 属性 → 驱动程序 → 回退驱动程序」。
              </p>
            </div>
            <button
              onClick={() => window.gpuLab.openSystemTool('devmgmt')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white transition"
            >
              <Wrench className="w-3.5 h-3.5 accent-text" />
              <span>打开设备管理器回退</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {localStore.map((pkg) => (
              <div
                key={pkg.publishedName}
                className="rounded-2xl bg-[#101512] border border-white/[0.08] p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-white">{pkg.publishedName}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/40 border border-white/10 text-zinc-300">
                      {pkg.originalName}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 truncate">
                    提供程序: <span className="text-zinc-200">{pkg.providerName}</span>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500">
                    版本 {pkg.driverVersion} · 日期 {pkg.driverDate} · {pkg.attributes}
                  </div>
                </div>

                <button
                  onClick={() => onInstallLocalDriver(pkg.publishedName)}
                  className="shrink-0 px-3.5 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.1] text-xs font-semibold text-white transition"
                >
                  部署此版本
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
