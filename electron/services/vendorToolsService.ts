import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ActionResult, DownloadTask, VendorToolsStatus } from '../types';
import { ensureDir, getDataBaseDir } from './configService';
import { httpGetText, startDownload } from './driverService';
import { isProcessAdmin, runPowerShell } from './psRunner';

const FALLBACK_NVAPP_URL =
  'https://us.download.nvidia.com/nvapp/client/11.0.9.585/x64/NVIDIA_app_v11.0.9.585_x64.exe';
const AMD_CLEANUP_URL = 'https://drivers.amd.com/drivers/amdcleanuputility.exe';

function getAmdCleanupLocalPath(): string {
  return path.join(getDataBaseDir(), 'tools', 'amd', 'amdcleanuputility.exe');
}

export async function getVendorToolsStatus(): Promise<VendorToolsStatus> {
  const amdCleanupPath = getAmdCleanupLocalPath();

  const psScript = `
$nvcpPkg = Get-AppxPackage -Name '*NVIDIAControlPanel*' -ErrorAction SilentlyContinue | Select-Object -First 1
$nvcpLegacy = "$env:ProgramFiles\\NVIDIA Corporation\\Control Panel Client\\nvcplui.exe"
$nvAppExe = "$env:ProgramFiles\\NVIDIA Corporation\\NVIDIA App\\CEF\\NVIDIA App.exe"
$nvAppVer = ''
if (Test-Path $nvAppExe) {
  $nvAppVer = (Get-Item -LiteralPath $nvAppExe -ErrorAction SilentlyContinue).VersionInfo.ProductVersion
}

$amdExe = "$env:ProgramFiles\\AMD\\CNext\\CNext\\RadeonSoftware.exe"
$amdVer = (Get-ItemProperty 'HKLM:\\SOFTWARE\\AMD\\CN' -ErrorAction SilentlyContinue).CNVersion
$amdClassVer = ''
$classPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'
if (Test-Path $classPath) {
  $amdKey = Get-ChildItem $classPath -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^\\d{4}$' } | ForEach-Object { Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue } | Where-Object { $_.RadeonSoftwareVersion } | Select-Object -First 1
  if ($amdKey) { $amdClassVer = [string]$amdKey.RadeonSoftwareVersion }
}

$igccPkg = Get-AppxPackage -Name '*IntelGraphicsExperience*' -ErrorAction SilentlyContinue | Select-Object -First 1
$intelGsExe = "$env:ProgramFiles\\Intel\\Intel Graphics Software\\IntelGraphicsSoftware.exe"
$intelArcExe = "$env:ProgramFiles\\Intel\\Intel Arc Control\\ArcControl.exe"

$hagsVal = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -ErrorAction SilentlyContinue).HwSchMode
$mpoVal = (Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm' -Name 'OverlayTestMode' -ErrorAction SilentlyContinue).OverlayTestMode

[PSCustomObject]@{
  NvcpPkgInstalled = [bool]($nvcpPkg -ne $null)
  NvcpVersion = if ($nvcpPkg) { [string]$nvcpPkg.Version } else { '' }
  NvcpFamily = if ($nvcpPkg) { [string]$nvcpPkg.PackageFamilyName } else { '' }
  NvcpLegacyExists = (Test-Path $nvcpLegacy)
  NvcpLegacyPath = if (Test-Path $nvcpLegacy) { $nvcpLegacy } else { '' }
  NvAppInstalled = (Test-Path $nvAppExe)
  NvAppVersion = [string]$nvAppVer
  NvAppPath = if (Test-Path $nvAppExe) { $nvAppExe } else { '' }
  AmdInstalled = (Test-Path $amdExe)
  AmdVersion = if ($amdClassVer) { $amdClassVer } elseif ($amdVer) { [string]$amdVer } else { '' }
  AmdPath = if (Test-Path $amdExe) { $amdExe } else { '' }
  IgccInstalled = [bool]($igccPkg -ne $null)
  IgccVersion = if ($igccPkg) { [string]$igccPkg.Version } else { '' }
  IgccFamily = if ($igccPkg) { [string]$igccPkg.PackageFamilyName } else { '' }
  IntelGsInstalled = (Test-Path $intelGsExe)
  IntelGsPath = if (Test-Path $intelGsExe) { $intelGsExe } else { '' }
  IntelArcInstalled = (Test-Path $intelArcExe)
  IntelArcPath = if (Test-Path $intelArcExe) { $intelArcExe } else { '' }
  HwSchMode = if ($hagsVal -ne $null) { [int]$hagsVal } else { -1 }
  OverlayTestMode = if ($mpoVal -ne $null) { [int]$mpoVal } else { 0 }
} | ConvertTo-Json -Depth 3
`;

  const res = await runPowerShell(psScript, 12000);
  const cleanupExists = fs.existsSync(amdCleanupPath);

  if (res.stdout) {
    try {
      const p = JSON.parse(res.stdout);
      const hagsRaw = Number(p.HwSchMode);
      return {
        nvidia: {
          controlPanelInstalled: Boolean(p.NvcpPkgInstalled || p.NvcpLegacyExists),
          controlPanelVersion: p.NvcpVersion || '',
          controlPanelFamilyName: p.NvcpFamily || '',
          controlPanelLegacyPath: p.NvcpLegacyPath || '',
          nvidiaAppInstalled: Boolean(p.NvAppInstalled),
          nvidiaAppVersion: p.NvAppVersion || '',
          nvidiaAppPath: p.NvAppPath || '',
        },
        amd: {
          adrenalinInstalled: Boolean(p.AmdInstalled),
          adrenalinVersion: p.AmdVersion || '',
          adrenalinPath: p.AmdPath || '',
          cleanupUtilityDownloaded: cleanupExists,
          cleanupUtilityPath: cleanupExists ? amdCleanupPath : '',
        },
        intel: {
          igccInstalled: Boolean(p.IgccInstalled),
          igccVersion: p.IgccVersion || '',
          igccFamilyName: p.IgccFamily || '',
          graphicsSoftwareInstalled: Boolean(p.IntelGsInstalled),
          graphicsSoftwarePath: p.IntelGsPath || '',
          arcControlInstalled: Boolean(p.IntelArcInstalled),
          arcControlPath: p.IntelArcPath || '',
        },
        tweaks: {
          hagsEnabled: hagsRaw === 2 ? true : hagsRaw === 1 ? false : null,
          mpoDisabled: Number(p.OverlayTestMode) === 5,
        },
      };
    } catch {
      // fallback
    }
  }

  return {
    nvidia: {
      controlPanelInstalled: false,
      controlPanelVersion: '',
      controlPanelFamilyName: '',
      controlPanelLegacyPath: '',
      nvidiaAppInstalled: false,
      nvidiaAppVersion: '',
      nvidiaAppPath: '',
    },
    amd: {
      adrenalinInstalled: false,
      adrenalinVersion: '',
      adrenalinPath: '',
      cleanupUtilityDownloaded: cleanupExists,
      cleanupUtilityPath: cleanupExists ? amdCleanupPath : '',
    },
    intel: {
      igccInstalled: false,
      igccVersion: '',
      igccFamilyName: '',
      graphicsSoftwareInstalled: false,
      graphicsSoftwarePath: '',
      arcControlInstalled: false,
      arcControlPath: '',
    },
    tweaks: {
      hagsEnabled: null,
      mpoDisabled: false,
    },
  };
}

function spawnDetached(exePath: string, args: string[] = []): void {
  const child = spawn(exePath, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

export async function launchNvidiaControlPanel(): Promise<ActionResult> {
  const status = await getVendorToolsStatus();
  if (status.nvidia.controlPanelFamilyName) {
    spawnDetached('explorer.exe', [`shell:AppsFolder\\${status.nvidia.controlPanelFamilyName}!NVIDIACorp.NVIDIAControlPanel`]);
    return { success: true, message: '正在启动 NVIDIA 控制面板 (UWP)...' };
  }
  if (status.nvidia.controlPanelLegacyPath && fs.existsSync(status.nvidia.controlPanelLegacyPath)) {
    spawnDetached(status.nvidia.controlPanelLegacyPath);
    return { success: true, message: '正在启动 NVIDIA 控制面板...' };
  }
  return {
    success: false,
    message: '未检测到已安装的 NVIDIA 控制面板，请先从 Microsoft Store 安装。',
  };
}

export async function uninstallNvidiaControlPanel(): Promise<ActionResult> {
  const res = await runPowerShell(
    `$pkgs = Get-AppxPackage -Name '*NVIDIAControlPanel*' -ErrorAction SilentlyContinue; if (-not $pkgs) { 'NOT_FOUND' } else { $pkgs | Remove-AppxPackage; 'REMOVED' }`,
    20000
  );
  if (res.stdout.includes('REMOVED')) {
    return { success: true, message: '已卸载 Microsoft Store 版 NVIDIA 控制面板' };
  }
  if (res.stdout.includes('NOT_FOUND')) {
    return { success: false, message: '未找到 Microsoft Store 版 NVIDIA 控制面板（可能为传统随驱动安装版）' };
  }
  return { success: false, message: `卸载失败: ${res.stderr || '未知错误'}` };
}

export async function launchNvidiaApp(): Promise<ActionResult> {
  const status = await getVendorToolsStatus();
  if (status.nvidia.nvidiaAppPath && fs.existsSync(status.nvidia.nvidiaAppPath)) {
    spawnDetached(status.nvidia.nvidiaAppPath);
    return { success: true, message: '正在启动 NVIDIA App...' };
  }
  // Fallback via shell:AppsFolder
  spawnDetached('explorer.exe', ['shell:AppsFolder\\com.nvidia.nvapp']);
  return { success: true, message: '正在尝试通过系统应用列表启动 NVIDIA App...' };
}

export async function downloadNvidiaApp(onProgress: (task: DownloadTask) => void): Promise<DownloadTask> {
  let url = FALLBACK_NVAPP_URL;
  try {
    const html = await httpGetText('https://www.nvidia.com/en-us/software/nvidia-app/', {}, 8000);
    const match = html.match(/https:\/\/[^"'\s]+NVIDIA_app[^"'\s]*x64\.exe/i);
    if (match) url = match[0];
  } catch {
    // use verified fallback
  }
  return startDownload({ url, category: 'tool' }, onProgress);
}

export async function launchAmdAdrenalin(): Promise<ActionResult> {
  const status = await getVendorToolsStatus();
  if (status.amd.adrenalinPath && fs.existsSync(status.amd.adrenalinPath)) {
    spawnDetached(status.amd.adrenalinPath);
    return { success: true, message: '正在启动 AMD Software: Adrenalin Edition...' };
  }
  return {
    success: false,
    message: '未检测到 RadeonSoftware.exe，请先安装完整的 AMD Adrenalin 驱动套件。',
  };
}

export async function downloadOrLaunchAmdCleanup(
  onProgress: (task: DownloadTask) => void
): Promise<ActionResult> {
  const targetDir = ensureDir(path.join(getDataBaseDir(), 'tools', 'amd'));
  const targetFile = getAmdCleanupLocalPath();

  if (!fs.existsSync(targetFile)) {
    const task = await startDownload(
      {
        url: AMD_CLEANUP_URL,
        filename: 'amdcleanuputility.exe',
        category: 'tool',
        referer: 'https://www.amd.com/',
        destDir: targetDir,
      },
      onProgress
    );
    if (task.status !== 'completed') {
      return { success: false, message: `下载 AMD Cleanup Utility 失败: ${task.error}` };
    }
  }

  const admin = await isProcessAdmin();
  if (admin) {
    spawnDetached(targetFile);
    return { success: true, message: '已启动官方 AMD Cleanup Utility' };
  }
  const escaped = targetFile.replace(/'/g, "''");
  const psRes = await runPowerShell(`Start-Process -FilePath '${escaped}' -Verb RunAs`, 12000);
  if (psRes.exitCode === 0) {
    return { success: true, message: '已以管理员身份启动官方 AMD Cleanup Utility' };
  }
  return { success: false, message: '启动 AMD Cleanup Utility 被取消或权限不足' };
}

export async function launchIntelGraphicsTool(): Promise<ActionResult> {
  const status = await getVendorToolsStatus();
  if (status.intel.graphicsSoftwareInstalled && status.intel.graphicsSoftwarePath) {
    spawnDetached(status.intel.graphicsSoftwarePath);
    return { success: true, message: '正在启动 Intel Graphics Software...' };
  }
  if (status.intel.arcControlInstalled && status.intel.arcControlPath) {
    spawnDetached(status.intel.arcControlPath);
    return { success: true, message: '正在启动 Intel Arc Control...' };
  }
  if (status.intel.igccInstalled && status.intel.igccFamilyName) {
    spawnDetached('explorer.exe', [`shell:AppsFolder\\${status.intel.igccFamilyName}!App`]);
    return { success: true, message: '正在启动 Intel 显卡控制中心 (IGCC)...' };
  }
  return {
    success: false,
    message: '未检测到 Intel 显卡控制软件，可点击「微软商店下载」安装 Intel Graphics Command Center。',
  };
}

export async function setHagsEnabled(enabled: boolean): Promise<ActionResult> {
  const val = enabled ? 2 : 1;
  const cmd = `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value ${val} -Type DWord -Force`;
  const admin = await isProcessAdmin();
  if (admin) {
    const res = await runPowerShell(cmd, 8000);
    if (res.exitCode === 0) {
      return { success: true, message: `已将硬件加速 GPU 计划 (HAGS) 设为「${enabled ? '开启' : '关闭'}」，重启计算机后生效。` };
    }
    return { success: false, message: `设置 HAGS 失败: ${res.stderr}` };
  }

  const encoded = Buffer.from(cmd, 'utf16le').toString('base64');
  const res = await runPowerShell(
    `$p = Start-Process powershell.exe -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','${encoded}' -Verb RunAs -PassThru -Wait; $p.ExitCode`,
    15000
  );
  if (res.exitCode === 0 && res.stdout.trim() === '0') {
    return { success: true, message: `已将硬件加速 GPU 计划 (HAGS) 设为「${enabled ? '开启' : '关闭'}」，重启后生效。` };
  }
  return { success: false, message: '修改注册表需要管理员权限（可能已取消 UAC）' };
}

export async function setMpoDisabled(disabled: boolean): Promise<ActionResult> {
  const cmd = disabled
    ? `New-Item -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm' -Force | Out-Null; Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm' -Name 'OverlayTestMode' -Value 5 -Type DWord -Force`
    : `Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm' -Name 'OverlayTestMode' -ErrorAction SilentlyContinue`;

  const admin = await isProcessAdmin();
  if (admin) {
    const res = await runPowerShell(cmd, 8000);
    if (res.exitCode === 0) {
      return {
        success: true,
        message: disabled ? '已禁用 Windows MPO (OverlayTestMode=5)，重启后生效，可缓解黑屏/闪屏/掉帧。' : '已恢复 Windows 默认 MPO 状态，重启后生效。',
      };
    }
    return { success: false, message: `设置 MPO 失败: ${res.stderr}` };
  }

  const encoded = Buffer.from(cmd, 'utf16le').toString('base64');
  const res = await runPowerShell(
    `$p = Start-Process powershell.exe -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','${encoded}' -Verb RunAs -PassThru -Wait; $p.ExitCode`,
    15000
  );
  if (res.exitCode === 0 && res.stdout.trim() === '0') {
    return {
      success: true,
      message: disabled ? '已禁用 Windows MPO，重启后生效。' : '已恢复 Windows 默认 MPO 状态，重启后生效。',
    };
  }
  return { success: false, message: '修改 MPO 注册表需要管理员权限' };
}

export function openSystemUtility(tool: 'dxdiag' | 'devmgmt' | 'msinfo32' | 'msconfig'): ActionResult {
  if (tool === 'dxdiag') {
    spawnDetached('dxdiag.exe');
    return { success: true, message: '已打开 DirectX 诊断工具 (dxdiag)' };
  }
  if (tool === 'devmgmt') {
    spawnDetached('mmc.exe', ['devmgmt.msc']);
    return { success: true, message: '已打开设备管理器 (devmgmt.msc)' };
  }
  if (tool === 'msinfo32') {
    spawnDetached('msinfo32.exe');
    return { success: true, message: '已打开系统信息 (msinfo32)' };
  }
  spawnDetached('msconfig.exe');
  return { success: true, message: '已打开系统配置 (msconfig)' };
}
