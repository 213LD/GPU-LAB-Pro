import os from 'os';
import { runCommandSimple, runPowerShell } from './psRunner';
import { GpuAdapter, GpuDetectionSummary, GpuVendor, NvidiaTelemetry } from '../types';

interface RawGpuRecord {
  Name?: string;
  AdapterCompatibility?: string;
  DriverVersion?: string;
  DriverDate?: string;
  PNPDeviceID?: string;
  AdapterRAM?: number;
  Status?: string;
  QwMemorySize?: number;
  RadeonSoftwareVersion?: string;
  ReleaseVersion?: string;
}

function classifyVendor(name: string, compat: string, pnp: string): { vendor: GpuVendor; isVirtual: boolean } {
  const upperName = (name || '').toUpperCase();
  const upperCompat = (compat || '').toUpperCase();
  const upperPnp = (pnp || '').toUpperCase();

  const virtualKeywords = [
    'PARSEC',
    'GAMEVIEWER',
    'VIRTUAL',
    'MICROSOFT BASIC DISPLAY',
    'CITRIX',
    'VMWARE',
    'QXL',
    'ORAY',
    'SPLASHTOP',
    'ANYDESK',
    'TEAMVIEWER',
    'IDD',
    'SUNSHINE',
  ];

  if (upperPnp.startsWith('ROOT\\DISPLAY') || virtualKeywords.some((kw) => upperName.includes(kw) || upperCompat.includes(kw))) {
    return { vendor: 'virtual', isVirtual: true };
  }

  if (upperPnp.includes('VEN_10DE') || upperCompat.includes('NVIDIA') || upperName.includes('NVIDIA') || upperName.includes('GEFORCE') || upperName.includes('QUADRO') || upperName.includes('RTX ')) {
    return { vendor: 'nvidia', isVirtual: false };
  }

  if (upperPnp.includes('VEN_1002') || upperCompat.includes('AMD') || upperCompat.includes('ADVANCED MICRO DEVICES') || upperCompat.includes('ATI') || upperName.includes('RADEON') || upperName.includes('AMD ')) {
    return { vendor: 'amd', isVirtual: false };
  }

  if (upperPnp.includes('VEN_8086') || upperCompat.includes('INTEL') || upperName.includes('INTEL') || upperName.includes('ARC ') || upperName.includes('IRIS') || upperName.includes('UHD GRAPHICS')) {
    return { vendor: 'intel', isVirtual: false };
  }

  return { vendor: 'unknown', isVirtual: false };
}

function formatWddmToNvidia(wddm: string): string {
  const parts = (wddm || '').split('.');
  if (parts.length !== 4) return wddm || '未知';
  const third = parts[2];
  const fourth = parts[3].padStart(4, '0');
  const major = third.slice(-1) + fourth.slice(0, 2);
  const minor = fourth.slice(2, 4);
  const numMajor = parseInt(major, 10);
  if (Number.isNaN(numMajor)) return wddm;
  return `${numMajor}.${minor}`;
}

function formatWddmToIntel(wddm: string): string {
  const parts = (wddm || '').split('.');
  if (parts.length === 4) {
    return `${parts[2]}.${parts[3]}`;
  }
  return wddm || '未知';
}

function formatVramLabel(bytes: number, isVirtual: boolean): string {
  if (isVirtual || !bytes || bytes <= 0) {
    return isVirtual ? '虚拟显示' : '共享显存';
  }
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 0.9) {
    const rounded = Math.round(gb);
    if (Math.abs(gb - rounded) <= 0.25) {
      return `${rounded} GB`;
    }
    return `${gb.toFixed(1)} GB`;
  }
  const mb = Math.round(bytes / (1024 * 1024));
  return `${mb} MB`;
}

function formatDriverDate(raw: string): string {
  if (!raw) return '未知';
  // WMI serialized date or ISO string
  const match = raw.match(/(\d{4})[-/]?(\d{2})[-/]?(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return raw;
}

export async function getNvidiaTelemetry(): Promise<NvidiaTelemetry> {
  const empty: NvidiaTelemetry = {
    available: false,
    gpuName: '',
    driverVersion: '',
    temperatureC: null,
    fanSpeedPercent: null,
    utilizationPercent: null,
    memoryUsedMb: null,
    memoryTotalMb: null,
    powerDrawW: null,
    powerLimitW: null,
    graphicsClockMhz: null,
    memoryClockMhz: null,
  };

  const res = await runCommandSimple(
    'nvidia-smi',
    [
      '--query-gpu=name,driver_version,temperature.gpu,fan.speed,utilization.gpu,memory.used,memory.total,power.draw,power.limit,clocks.gr,clocks.mem',
      '--format=csv,noheader,nounits',
    ],
    4000
  );

  if (res.exitCode !== 0 || !res.stdout) {
    return empty;
  }

  const line = res.stdout.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!line) return empty;

  const cols = line.split(',').map((s) => s.trim());
  if (cols.length < 7) return empty;

  const numOrNull = (val?: string): number | null => {
    if (!val || /N\/A|Not Supported|Unknown/i.test(val)) return null;
    const n = parseFloat(val);
    return Number.isFinite(n) ? n : null;
  };

  return {
    available: true,
    gpuName: cols[0] || '',
    driverVersion: cols[1] || '',
    temperatureC: numOrNull(cols[2]),
    fanSpeedPercent: numOrNull(cols[3]),
    utilizationPercent: numOrNull(cols[4]),
    memoryUsedMb: numOrNull(cols[5]),
    memoryTotalMb: numOrNull(cols[6]),
    powerDrawW: numOrNull(cols[7]),
    powerLimitW: numOrNull(cols[8]),
    graphicsClockMhz: numOrNull(cols[9]),
    memoryClockMhz: numOrNull(cols[10]),
  };
}

export async function detectGpus(): Promise<GpuDetectionSummary> {
  const psScript = `
$regEntries = @()
$classPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'
if (Test-Path $classPath) {
  Get-ChildItem $classPath -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^\\d{4}$' } | ForEach-Object {
    $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
    if ($p) {
      $qw = 0
      $rawMem = $p.'HardwareInformation.qwMemorySize'
      if ($rawMem -is [byte[]] -and $rawMem.Length -ge 8) {
        $qw = [BitConverter]::ToUInt64($rawMem, 0)
      } elseif ($rawMem -ne $null) {
        try { $qw = [uint64]$rawMem } catch { $qw = 0 }
      }
      $regEntries += [PSCustomObject]@{
        DriverDesc = [string]$p.DriverDesc
        DriverVersion = [string]$p.DriverVersion
        QwMemorySize = $qw
        RadeonSoftwareVersion = [string]$p.RadeonSoftwareVersion
        ReleaseVersion = [string]$p.ReleaseVersion
      }
    }
  }
}

$gpus = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | ForEach-Object {
  $name = [string]$_.Name
  $ver = [string]$_.DriverVersion
  $match = $regEntries | Where-Object {
    ($_.DriverDesc -eq $name -or ($_.DriverVersion -eq $ver -and $ver -ne ''))
  } | Select-Object -First 1

  $dateStr = ''
  if ($_.DriverDate) {
    try { $dateStr = $_.DriverDate.ToString('yyyy-MM-dd') } catch { $dateStr = [string]$_.DriverDate }
  }

  [PSCustomObject]@{
    Name = $name
    AdapterCompatibility = [string]$_.AdapterCompatibility
    DriverVersion = $ver
    DriverDate = $dateStr
    PNPDeviceID = [string]$_.PNPDeviceID
    AdapterRAM = if ($_.AdapterRAM) { [uint64]$_.AdapterRAM } else { 0 }
    Status = [string]$_.Status
    QwMemorySize = if ($match) { [uint64]$match.QwMemorySize } else { 0 }
    RadeonSoftwareVersion = if ($match) { [string]$match.RadeonSoftwareVersion } else { '' }
    ReleaseVersion = if ($match) { [string]$match.ReleaseVersion } else { '' }
  }
}

$osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue | Select-Object -First 1
[PSCustomObject]@{
  Gpus = @($gpus)
  OsCaption = if ($osInfo) { [string]$osInfo.Caption } else { 'Windows' }
  OsBuild = if ($osInfo) { [int]$osInfo.BuildNumber } else { 0 }
} | ConvertTo-Json -Depth 5
`;

  const [psRes, nvsmi] = await Promise.all([runPowerShell(psScript, 15000), getNvidiaTelemetry()]);

  let rawGpus: RawGpuRecord[] = [];
  let osCaption = 'Windows 11';
  let osBuild = parseInt(os.release().split('.')[2] || '22621', 10) || 22621;

  if (psRes.stdout) {
    try {
      const parsed = JSON.parse(psRes.stdout);
      if (Array.isArray(parsed.Gpus)) {
        rawGpus = parsed.Gpus;
      } else if (parsed.Gpus) {
        rawGpus = [parsed.Gpus];
      }
      if (parsed.OsCaption) osCaption = String(parsed.OsCaption).replace(/^Microsoft\s+/i, '').trim();
      if (parsed.OsBuild) osBuild = Number(parsed.OsBuild) || osBuild;
    } catch {
      // ignore parse fallback
    }
  }

  const adapters: GpuAdapter[] = rawGpus.map((raw, idx) => {
    const name = raw.Name || `显示适配器 #${idx + 1}`;
    const compat = raw.AdapterCompatibility || '';
    const pnp = raw.PNPDeviceID || '';
    const { vendor, isVirtual } = classifyVendor(name, compat, pnp);

    const vramBytes = raw.QwMemorySize && raw.QwMemorySize > 0
      ? Number(raw.QwMemorySize)
      : Number(raw.AdapterRAM || 0);

    let friendlyVersion = raw.DriverVersion || '未知';
    if (vendor === 'nvidia') {
      if (nvsmi.available && nvsmi.driverVersion) {
        friendlyVersion = nvsmi.driverVersion;
      } else {
        friendlyVersion = formatWddmToNvidia(raw.DriverVersion || '');
      }
    } else if (vendor === 'amd') {
      if (raw.RadeonSoftwareVersion) {
        friendlyVersion = raw.RadeonSoftwareVersion;
      }
    } else if (vendor === 'intel') {
      friendlyVersion = formatWddmToIntel(raw.DriverVersion || '');
    }

    const isDiscrete = !isVirtual && (
      vendor === 'nvidia' ||
      (vendor === 'amd' && /RX\s+\d|PRO\s+W|R9|R7|VEGA/i.test(name)) ||
      (vendor === 'intel' && /ARC\s+[AB]\d+/i.test(name)) ||
      vramBytes >= 6 * 1024 * 1024 * 1024
    );

    return {
      id: pnp || `gpu-${idx}`,
      name,
      vendor,
      isVirtual,
      isDiscrete,
      driverVersion: raw.DriverVersion || '未知',
      friendlyVersion,
      driverDate: formatDriverDate(raw.DriverDate || ''),
      vramBytes,
      vramLabel: formatVramLabel(vramBytes, isVirtual),
      status: raw.Status || 'OK',
      pnpDeviceId: pnp,
      adapterCompatibility: compat,
      releaseVersion: raw.ReleaseVersion || undefined,
    };
  });

  // Sort: physical discrete first (highest VRAM), then integrated, then virtual
  adapters.sort((a, b) => {
    if (a.isVirtual !== b.isVirtual) return a.isVirtual ? 1 : -1;
    if (a.isDiscrete !== b.isDiscrete) return a.isDiscrete ? -1 : 1;
    return b.vramBytes - a.vramBytes;
  });

  const physicalCount = adapters.filter((a) => !a.isVirtual).length;
  const virtualCount = adapters.filter((a) => a.isVirtual).length;

  return {
    adapters,
    physicalCount,
    virtualCount,
    osVersion: osCaption,
    osBuild,
    detectedAt: new Date().toISOString(),
  };
}
