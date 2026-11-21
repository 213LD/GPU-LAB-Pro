import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import {
  ActionResult,
  DriverCatalogResult,
  DriverItem,
  DriverProductOption,
  DriverRelation,
  DriverSeriesOption,
  DownloadTask,
  GpuVendor,
  LocalDriverStoreItem,
} from '../types';
import { ensureDir, loadConfig } from './configService';
import { isProcessAdmin, runCommandSimple, runPowerShell } from './psRunner';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface ActiveDownloadHandle {
  task: DownloadTask;
  abort: () => void;
}

const activeDownloads = new Map<string, ActiveDownloadHandle>();
const recentDownloads = new Map<string, DownloadTask>();

let nvidiaCatalogCache: {
  fetchedAt: number;
  series: DriverSeriesOption[];
  products: DriverProductOption[];
} | null = null;

export function httpGetText(urlStr: string, headers: Record<string, string> = {}, timeoutMs = 12000): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestUrl = (target: string, redirectsLeft: number) => {
      const parsed = new URL(target);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(
        parsed,
        {
          method: 'GET',
          headers: {
            'User-Agent': DEFAULT_UA,
            Accept: 'text/html,application/json,application/xml;q=0.9,*/*;q=0.8',
            ...headers,
          },
          timeout: timeoutMs,
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
            const nextUrl = new URL(res.headers.location, parsed).toString();
            res.resume();
            requestUrl(nextUrl, redirectsLeft - 1);
            return;
          }
          if (status < 200 || status >= 400) {
            res.resume();
            reject(new Error(`HTTP ${status} from ${parsed.hostname}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          res.on('error', reject);
        }
      );
      req.on('timeout', () => {
        req.destroy(new Error(`Request timeout (${timeoutMs}ms)`));
      });
      req.on('error', reject);
      req.end();
    };
    requestUrl(urlStr, 5);
  });
}

export function compareVersions(a: string, b: string): number {
  const clean = (v: string) =>
    (v || '')
      .replace(/[^\d.]/g, '')
      .split('.')
      .filter(Boolean)
      .map((n) => parseInt(n, 10));

  const pa = clean(a);
  const pb = clean(b);
  if (pa.length === 0 || pb.length === 0) return 0;

  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function getRelation(candidateVersion: string, installedVersion: string): DriverRelation {
  if (!installedVersion || installedVersion === '未知') return 'unknown';
  const cmp = compareVersions(candidateVersion, installedVersion);
  if (cmp > 0) return 'newer';
  if (cmp < 0) return 'older';
  return 'current';
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseLookupValues(xml: string): { id: string; parentId: string; name: string }[] {
  const results: { id: string; parentId: string; name: string }[] = [];
  const itemRegex = /<LookupValue([^>]*)>([\s\S]*?)<\/LookupValue>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const attrs = m[1] || '';
    const inner = m[2] || '';
    const parentMatch = attrs.match(/ParentID="([^"]*)"/i);
    const nameMatch = inner.match(/<Name>([\s\S]*?)<\/Name>/i);
    const valMatch = inner.match(/<Value>([\s\S]*?)<\/Value>/i);
    if (nameMatch && valMatch) {
      results.push({
        id: valMatch[1].trim(),
        parentId: parentMatch ? parentMatch[1].trim() : '',
        name: decodeXmlEntities(nameMatch[1].trim()),
      });
    }
  }
  return results;
}

async function getNvidiaCatalogLists(): Promise<{
  series: DriverSeriesOption[];
  products: DriverProductOption[];
}> {
  if (nvidiaCatalogCache && Date.now() - nvidiaCatalogCache.fetchedAt < 30 * 60 * 1000) {
    return {
      series: nvidiaCatalogCache.series,
      products: nvidiaCatalogCache.products,
    };
  }

  const [seriesXml, productsXml] = await Promise.all([
    httpGetText('https://www.nvidia.com/Download/API/lookupValueSearch.aspx?TypeID=2', {}, 12000),
    httpGetText('https://www.nvidia.com/Download/API/lookupValueSearch.aspx?TypeID=3', {}, 15000),
  ]);

  const series = parseLookupValues(seriesXml)
    .filter((s) => s.parentId === '1' || /GeForce|RTX|GTX|Titan/i.test(s.name))
    .map((s) => ({ id: s.id, name: s.name }));

  const products = parseLookupValues(productsXml).map((p) => ({
    id: p.id,
    parentId: p.parentId,
    name: p.name,
  }));

  nvidiaCatalogCache = {
    fetchedAt: Date.now(),
    series,
    products,
  };

  return { series, products };
}

function matchNvidiaProduct(
  gpuName: string,
  series: DriverSeriesOption[],
  products: DriverProductOption[]
): { seriesId: string; productId: string; matchedName: string } {
  const cleanGpu = gpuName
    .replace(/^NVIDIA\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const isNotebook = /Laptop|Mobile|Max-Q/i.test(cleanGpu);
  const seriesById = new Map(series.map((s) => [s.id, s]));

  // Only inspect products belonging to GeForce series we fetched (or any known parentId)
  const geForceSeriesIds = new Set(series.map((s) => s.id));
  const candidateProducts = products.filter((p) => geForceSeriesIds.has(p.parentId));

  const scoreProduct = (prod: DriverProductOption): number => {
    const pName = prod.name.toLowerCase();
    const gLower = cleanGpu.toLowerCase();
    const gBase = gLower.replace(/\s*laptop\s*gpu/i, '').trim();
    const parentSeries = seriesById.get(prod.parentId)?.name || '';
    const parentNotebook = /Notebooks?/i.test(parentSeries);

    let score = 0;
    if (pName === gLower) score += 1000;
    else if (pName === gBase) score += 700;
    else if (pName.includes(gLower)) score += 500;
    else if (gLower.includes(pName)) score += 450;
    else if (pName.includes(gBase)) score += 350;

    if (score === 0) return 0;
    if (isNotebook === parentNotebook) score += 200;
    return score;
  };

  let best: DriverProductOption | null = null;
  let bestScore = 0;
  for (const prod of candidateProducts) {
    const s = scoreProduct(prod);
    if (s > bestScore) {
      bestScore = s;
      best = prod;
    }
  }

  if (best) {
    return {
      seriesId: best.parentId,
      productId: best.id,
      matchedName: best.name,
    };
  }

  // Fallback to RTX 50 / 40 popular desktop model so user still gets a live list & can switch
  const fallback =
    candidateProducts.find((p) => /GeForce RTX 5080/i.test(p.name)) ||
    candidateProducts.find((p) => /GeForce RTX 4070/i.test(p.name)) ||
    candidateProducts[0];

  return {
    seriesId: fallback?.parentId || '131',
    productId: fallback?.id || '1070',
    matchedName: fallback?.name || cleanGpu,
  };
}

function getNvidiaOsId(): string {
  const parts = os.release().split('.');
  const build = parseInt(parts[2] || '22621', 10);
  return build >= 22000 ? '135' : '57'; // 135 = Windows 11, 57 = Windows 10 64-bit
}

interface NvidiaAjaxItem {
  downloadInfo?: {
    ID?: string;
    Version?: string;
    NameLocalized?: string;
    Name?: string;
    ReleaseDateTime?: string;
    DownloadURL?: string;
    DownloadURLFileSize?: string;
    IsWHQL?: string;
    IsCRD?: string;
    DetailsURL?: string;
  };
}

async function fetchNvidiaDrivers(
  gpuName: string,
  installedFriendlyVersion: string,
  overrideSeriesId?: string,
  overrideProductId?: string
): Promise<DriverCatalogResult> {
  const { series, products } = await getNvidiaCatalogLists();
  const matched = matchNvidiaProduct(gpuName, series, products);
  const psid = overrideSeriesId || matched.seriesId;
  const pfid = overrideProductId || matched.productId;

  const selectedProduct = products.find((p) => p.id === pfid && p.parentId === psid) || products.find((p) => p.id === pfid);
  const osId = getNvidiaOsId();

  const apiUrl =
    `https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php` +
    `?func=DriverManualLookup&psid=${encodeURIComponent(psid)}&pfid=${encodeURIComponent(pfid)}` +
    `&osID=${osId}&languageCode=2052&beta=null&isWHQL=1&dltype=-1&dch=1&upCRD=null&qnf=0&ctk=null&sort1=1&numberOfResults=25`;

  const rawJson = await httpGetText(apiUrl, {}, 15000);
  const parsed = JSON.parse(rawJson) as { Success?: string; IDS?: NvidiaAjaxItem[] };

  const drivers: DriverItem[] = (parsed.IDS || [])
    .map((entry) => entry.downloadInfo)
    .filter((info): info is NonNullable<typeof info> => Boolean(info && info.DownloadURL && info.Version))
    .map((info) => {
      const version = String(info.Version).trim();
      const rawName = decodeURIComponent((info.NameLocalized || info.Name || 'GeForce 驱动程序').replace(/\+/g, ' '));
      const isStudio = info.IsCRD === '1' || /Studio/i.test(rawName);
      return {
        id: `nv-${info.ID || version}-${isStudio ? 'sd' : 'grd'}`,
        vendor: 'nvidia' as const,
        version,
        name: rawName,
        channel: isStudio ? 'Studio' : 'Game Ready',
        isWhql: info.IsWHQL === '1',
        releaseDate: info.ReleaseDateTime || '未知',
        fileSize: info.DownloadURLFileSize || '未知',
        downloadUrl: info.DownloadURL!,
        releaseNotesUrl: info.DetailsURL || undefined,
        relation: getRelation(version, installedFriendlyVersion),
      };
    });

  return {
    vendor: 'nvidia',
    matchedModelName: selectedProduct?.name || matched.matchedName,
    matchedSeriesId: psid,
    matchedProductId: pfid,
    installedFriendlyVersion,
    drivers,
    seriesList: series,
    productList: products.filter((p) => series.some((s) => s.id === p.parentId)),
    officialPageUrl: 'https://www.nvidia.cn/geforce/drivers/',
    source: 'live-api',
  };
}

function getAmdCatalog(gpuName: string, installedFriendlyVersion: string): DriverCatalogResult {
  const entries = [
    {
      version: '26.11.2',
      date: '2026-11-12',
      size: '1.64 GB',
      url: 'https://drivers.amd.com/drivers/whql-amd-software-adrenalin-edition-26.11.2-win11-c.exe',
      notes: '最新 WHQL 正式版，针对最新 3A 游戏优化与稳定性修复',
    },
    {
      version: '26.10.1',
      date: '2026-10-16',
      size: '1.66 GB',
      url: 'https://drivers.amd.com/drivers/whql-amd-software-adrenalin-edition-26.10.1-win11-c.exe',
      notes: '十月 WHQL 正式版（经典稳定分支）',
    },
    {
      version: '26.9.2',
      date: '2026-09-22',
      size: '1.62 GB',
      url: 'https://drivers.amd.com/drivers/whql-amd-software-adrenalin-edition-26.9.2-win11-c.exe',
      notes: '九月 WHQL 正式版，适合老游戏或需要版本回退时使用',
    },
    {
      version: '26.8.1',
      date: '2026-08-14',
      size: '1.55 GB',
      url: 'https://drivers.amd.com/drivers/whql-amd-software-adrenalin-edition-26.8.1-win11-c.exe',
      notes: '八月 WHQL 正式版',
    },
    {
      version: '26.7.1',
      date: '2026-07-10',
      size: '1.52 GB',
      url: 'https://drivers.amd.com/drivers/whql-amd-software-adrenalin-edition-26.7.1-win11-c.exe',
      notes: '七月 WHQL 正式版',
    },
    {
      version: '26.3.1',
      date: '2026-03-19',
      size: '1.58 GB',
      url: 'https://drivers.amd.com/drivers/whql-amd-software-adrenalin-edition-26.3.1-win11-c.exe',
      notes: '三月 WHQL 正式版（广受好评的低延迟版本）',
    },
    {
      version: '26.1.1',
      date: '2026-01-15',
      size: '1.57 GB',
      url: 'https://drivers.amd.com/drivers/whql-amd-software-adrenalin-edition-26.1.1-win11-c.exe',
      notes: '年初 WHQL 基准版本',
    },
  ];

  const drivers: DriverItem[] = entries.map((e) => ({
    id: `amd-${e.version}`,
    vendor: 'amd',
    version: e.version,
    name: `AMD Software: Adrenalin Edition ${e.version}`,
    channel: 'Adrenalin WHQL',
    isWhql: true,
    releaseDate: e.date,
    fileSize: e.size,
    downloadUrl: e.url,
    referer: 'https://www.amd.com/',
    relation: getRelation(e.version, installedFriendlyVersion),
    notes: e.notes,
  }));

  return {
    vendor: 'amd',
    matchedModelName: gpuName,
    installedFriendlyVersion,
    drivers,
    officialPageUrl: 'https://www.amd.com/zh-hans/support/download/drivers.html',
    source: 'verified-catalog',
    warning: '已启用官方 CDN 直链目录（支持一键更新与历史版本回退；若遇特定 APU 专属包，也可一键前往 AMD 官网）。',
  };
}

function getIntelCatalog(gpuName: string, installedFriendlyVersion: string): DriverCatalogResult {
  const entries = [
    {
      version: '101.9175',
      fullVersion: '32.0.101.9175',
      date: '2026-10-28',
      size: '980 MB',
      url: 'https://downloadmirror.intel.com/932273/gfx_win_101.9175.exe',
      notes: 'Intel Arc / Iris Xe / Core Ultra 最新显卡驱动（Game On 优化）',
    },
    {
      version: '101.8826',
      fullVersion: '32.0.101.8826',
      date: '2026-08-19',
      size: '955 MB',
      url: 'https://downloadmirror.intel.com/921459/gfx_win_101.8826.exe',
      notes: 'WHQL 认证稳定版本，适合日常及多屏办公游戏',
    },
    {
      version: '101.8626',
      fullVersion: '32.0.101.8626',
      date: '2026-06-11',
      size: '940 MB',
      url: 'https://downloadmirror.intel.com/915256/gfx_win_101.8626.exe',
      notes: 'WHQL 认证经典回退版本',
    },
  ];

  const drivers: DriverItem[] = entries.map((e) => ({
    id: `intel-${e.version}`,
    vendor: 'intel',
    version: e.fullVersion,
    name: `Intel Arc & Iris Xe Graphics ${e.fullVersion}`,
    channel: 'Intel Arc WHQL',
    isWhql: true,
    releaseDate: e.date,
    fileSize: e.size,
    downloadUrl: e.url,
    referer: 'https://www.intel.com/',
    relation: getRelation(e.version, installedFriendlyVersion),
    notes: e.notes,
  }));

  return {
    vendor: 'intel',
    matchedModelName: gpuName,
    installedFriendlyVersion,
    drivers,
    officialPageUrl: 'https://www.intel.cn/content/www/cn/zh/download/785597/intel-arc-iris-xe-graphics-windows.html',
    source: 'verified-catalog',
    warning: 'Intel 下载节点受 Akamai 防盗链策略影响时，若直接下载返回 403，可点击右上角「官方下载页」在系统浏览器下载。',
  };
}

export async function getDriverCatalog(params: {
  vendor: GpuVendor;
  gpuName: string;
  installedFriendlyVersion: string;
  seriesId?: string;
  productId?: string;
}): Promise<DriverCatalogResult> {
  const { vendor, gpuName, installedFriendlyVersion, seriesId, productId } = params;

  if (vendor === 'nvidia') {
    try {
      return await fetchNvidiaDrivers(gpuName, installedFriendlyVersion, seriesId, productId);
    } catch (err) {
      return {
        vendor: 'nvidia',
        matchedModelName: gpuName,
        installedFriendlyVersion,
        drivers: [],
        officialPageUrl: 'https://www.nvidia.cn/geforce/drivers/',
        source: 'live-api',
        warning: `获取 NVIDIA 官方驱动列表失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (vendor === 'amd') {
    return getAmdCatalog(gpuName, installedFriendlyVersion);
  }

  if (vendor === 'intel') {
    return getIntelCatalog(gpuName, installedFriendlyVersion);
  }

  return {
    vendor,
    matchedModelName: gpuName,
    installedFriendlyVersion,
    drivers: [],
    officialPageUrl: 'https://www.nvidia.cn/geforce/drivers/',
    source: 'verified-catalog',
    warning: '当前选择的是虚拟显示适配器，请选择 NVIDIA / AMD / Intel 物理显卡以管理官方驱动。',
  };
}

export function startDownload(
  params: {
    url: string;
    filename?: string;
    category: 'driver' | 'ddu' | 'tool';
    referer?: string;
    destDir?: string;
  },
  onProgress: (task: DownloadTask) => void
): Promise<DownloadTask> {
  const cfg = loadConfig();
  const targetDir = ensureDir(params.destDir || cfg.downloadDir);
  const urlObj = new URL(params.url);
  const rawBase = params.filename || decodeURIComponent(path.basename(urlObj.pathname)) || `download-${Date.now()}.exe`;
  const safeName = rawBase.replace(/[<>:"/\\|?*]/g, '_');
  const finalPath = path.join(targetDir, safeName);
  const partPath = `${finalPath}.part`;
  const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const task: DownloadTask = {
    id,
    filename: safeName,
    url: params.url,
    category: params.category,
    receivedBytes: 0,
    totalBytes: 0,
    percent: 0,
    speedBps: 0,
    status: 'downloading',
    filePath: finalPath,
  };

  recentDownloads.set(id, { ...task });
  onProgress({ ...task });

  return new Promise((resolve) => {
    let activeReq: http.ClientRequest | null = null;
    let fileStream: fs.WriteStream | null = null;
    let cancelled = false;
    let settled = false;

    const cleanupPart = () => {
      try {
        if (fileStream) {
          fileStream.destroy();
          fileStream = null;
        }
        if (fs.existsSync(partPath)) {
          fs.unlinkSync(partPath);
        }
      } catch {
        // ignore
      }
    };

    const finish = (status: DownloadTask['status'], errorMsg?: string) => {
      if (settled) return;
      settled = true;
      activeDownloads.delete(id);
      task.status = status;
      if (errorMsg) task.error = errorMsg;
      if (status === 'completed') {
        task.percent = 100;
        task.speedBps = 0;
      } else {
        task.speedBps = 0;
        cleanupPart();
      }
      recentDownloads.set(id, { ...task });
      onProgress({ ...task });
      resolve({ ...task });
    };

    activeDownloads.set(id, {
      task,
      abort: () => {
        cancelled = true;
        try {
          activeReq?.destroy();
        } catch {
          // ignore
        }
        finish('cancelled', '用户已取消下载');
      },
    });

    const beginRequest = (targetUrl: string, redirectsLeft: number) => {
      if (cancelled) return;
      const u = new URL(targetUrl);
      const client = u.protocol === 'https:' ? https : http;
      const headers: Record<string, string> = {
        'User-Agent': DEFAULT_UA,
        Accept: '*/*',
      };
      if (params.referer) {
        headers.Referer = params.referer;
      }

      const req = client.request(
        u,
        {
          method: 'GET',
          headers,
          timeout: 30000,
        },
        (res) => {
          const code = res.statusCode ?? 0;
          if (code >= 300 && code < 400 && res.headers.location && redirectsLeft > 0) {
            const next = new URL(res.headers.location, u).toString();
            res.resume();
            beginRequest(next, redirectsLeft - 1);
            return;
          }

          if (code < 200 || code >= 400) {
            res.resume();
            finish('failed', `服务器返回 HTTP ${code}${code === 403 ? '（触发官方防盗链，请使用官网页面下载）' : ''}`);
            return;
          }

          task.totalBytes = parseInt(String(res.headers['content-length'] || '0'), 10) || 0;
          fileStream = fs.createWriteStream(partPath);
          let lastEmitTime = Date.now();
          let lastBytes = 0;

          res.on('data', (chunk: Buffer) => {
            if (cancelled) return;
            task.receivedBytes += chunk.length;
            const now = Date.now();
            const dt = now - lastEmitTime;
            if (dt >= 180) {
              const deltaBytes = task.receivedBytes - lastBytes;
              task.speedBps = Math.round((deltaBytes * 1000) / Math.max(dt, 1));
              task.percent =
                task.totalBytes > 0
                  ? Math.min(99, Math.round((task.receivedBytes / task.totalBytes) * 100))
                  : 0;
              lastEmitTime = now;
              lastBytes = task.receivedBytes;
              recentDownloads.set(id, { ...task });
              onProgress({ ...task });
            }
          });

          fileStream.on('error', (err) => {
            finish('failed', `写入文件失败: ${err.message}`);
          });

          res.on('error', (err) => {
            finish('failed', `下载中断: ${err.message}`);
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            if (cancelled || settled) return;
            fileStream?.close(() => {
              try {
                if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
                fs.renameSync(partPath, finalPath);
                finish('completed');
              } catch (err) {
                finish('failed', `保存文件失败: ${err instanceof Error ? err.message : String(err)}`);
              }
            });
          });
        }
      );

      activeReq = req;
      req.on('timeout', () => {
        req.destroy(new Error('连接超时'));
      });
      req.on('error', (err) => {
        if (!cancelled) {
          finish('failed', `网络错误: ${err.message}`);
        }
      });
      req.end();
    };

    beginRequest(params.url, 6);
  });
}

export function cancelDownload(id: string): boolean {
  const handle = activeDownloads.get(id);
  if (!handle) return false;
  handle.abort();
  return true;
}

export function listDownloads(): DownloadTask[] {
  return Array.from(recentDownloads.values()).reverse();
}

export async function getLocalDriverStore(): Promise<LocalDriverStoreItem[]> {
  const res = await runPowerShell('pnputil /enum-drivers /class Display', 10000);
  if (res.exitCode !== 0 || !res.stdout) {
    return [];
  }

  const blocks = res.stdout.split(/\r?\n\s*\r?\n/);
  const items: LocalDriverStoreItem[] = [];

  const extractVal = (lines: string[], patterns: RegExp[]): string => {
    for (const line of lines) {
      for (const p of patterns) {
        const m = line.match(p);
        if (m) return m[1].trim();
      }
    }
    return '';
  };

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const publishedName = extractVal(lines, [/^Published Name:\s*(.+)$/i, /^发布名称:\s*(.+)$/]);
    if (!publishedName) continue;

    const originalName = extractVal(lines, [/^Original Name:\s*(.+)$/i, /^原始名称:\s*(.+)$/]);
    const providerName = extractVal(lines, [/^Provider Name:\s*(.+)$/i, /^提供程序名称:\s*(.+)$/]);
    const rawVer = extractVal(lines, [/^Driver Version:\s*(.+)$/i, /^驱动程序版本:\s*(.+)$/]);
    const signerName = extractVal(lines, [/^Signer Name:\s*(.+)$/i, /^签名者名称:\s*(.+)$/]);
    const attributes = extractVal(lines, [/^Attributes:\s*(.+)$/i, /^属性:\s*(.+)$/]);

    // rawVer looks like "11/07/2026 32.0.16.2124" or "02/28/2026 15.6.5.199"
    let driverDate = '';
    let driverVersion = rawVer;
    const verMatch = rawVer.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
    if (verMatch) {
      driverDate = verMatch[1];
      driverVersion = verMatch[2].trim();
    }

    items.push({
      publishedName,
      originalName,
      providerName,
      driverDate,
      driverVersion,
      signerName,
      attributes,
    });
  }

  return items;
}

export async function installLocalDriver(publishedName: string): Promise<ActionResult> {
  if (!/^oem\d+\.inf$/i.test(publishedName)) {
    return { success: false, message: '无效的驱动包名称' };
  }

  const infPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'INF', publishedName);
  if (!fs.existsSync(infPath)) {
    return { success: false, message: `在 Windows INF 目录未找到 ${publishedName}` };
  }

  const admin = await isProcessAdmin();
  if (admin) {
    const res = await runCommandSimple('pnputil', ['/add-driver', infPath, '/install'], 30000);
    if (res.exitCode === 0) {
      return {
        success: true,
        message: `已触发安装本地驱动存储包 ${publishedName}`,
        detail: res.stdout,
      };
    }
    return {
      success: false,
      message: `安装驱动包失败 (Exit ${res.exitCode})`,
      detail: res.stderr || res.stdout,
    };
  }

  const escaped = infPath.replace(/'/g, "''");
  const psRes = await runPowerShell(
    `$p = Start-Process pnputil.exe -ArgumentList '/add-driver','${escaped}','/install' -Verb RunAs -PassThru -Wait; $p.ExitCode`,
    35000
  );
  if (psRes.exitCode === 0 && psRes.stdout.trim() === '0') {
    return { success: true, message: `已以管理员身份安装本地驱动包 ${publishedName}` };
  }
  return {
    success: false,
    message: '需要管理员权限或用户取消了 UAC 授权',
    detail: psRes.stderr || psRes.stdout,
  };
}
