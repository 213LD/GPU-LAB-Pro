import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import {
  ActionResult,
  BootStatus,
  DduLaunchOptions,
  DduStatus,
  DownloadTask,
  SafeModeScheduleResult,
} from '../types';
import { ensureDir, getDataBaseDir, loadConfig, saveConfig } from './configService';
import { httpGetText, startDownload } from './driverService';
import { isProcessAdmin, runCommandSimple, runPowerShell } from './psRunner';

const FALLBACK_DDU_VERSION = '18.1.6.3';

export async function getBootStatus(): Promise<BootStatus> {
  const psScript = `
$cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue | Select-Object -First 1
$bootRaw = if ($cs) { [string]$cs.BootupState } else { 'Normal boot' }
$opt = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SafeBoot\\Option' -ErrorAction SilentlyContinue).OptionValue
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$bcdOut = ''
try { $bcdOut = (bcdedit /enum '{current}' 2>$null | Out-String) } catch {}
[PSCustomObject]@{
  BootupStateRaw = $bootRaw
  OptionValue = if ($opt -ne $null) { [int]$opt } else { 0 }
  IsAdmin = [bool]$isAdmin
  BcdHasSafeBoot = ($bcdOut -match '(?m)^safeboot\\s+')
  BcdAccessible = ($bcdOut -match 'identifier')
} | ConvertTo-Json -Depth 3
`;

  const res = await runPowerShell(psScript, 10000);
  if (res.stdout) {
    try {
      const parsed = JSON.parse(res.stdout);
      const optVal = Number(parsed.OptionValue || 0);
      const bootRaw = String(parsed.BootupStateRaw || 'Normal boot');
      let safeModeType: BootStatus['safeModeType'] = 'normal';
      if (optVal === 1 || /Fail-safe boot$/i.test(bootRaw)) safeModeType = 'minimal';
      else if (optVal === 2 || /network/i.test(bootRaw)) safeModeType = 'network';

      const isSafeMode = safeModeType !== 'normal' || /fail-safe/i.test(bootRaw);
      return {
        isSafeMode,
        safeModeType,
        isSafeBootScheduled: Boolean(parsed.BcdHasSafeBoot),
        isAdmin: Boolean(parsed.IsAdmin),
        canModifyBcd: Boolean(parsed.BcdAccessible) || Boolean(parsed.IsAdmin),
        bootupStateRaw: bootRaw,
      };
    } catch {
      // fall through
    }
  }

  const admin = await isProcessAdmin();
  return {
    isSafeMode: false,
    safeModeType: 'normal',
    isSafeBootScheduled: false,
    isAdmin: admin,
    canModifyBcd: admin,
    bootupStateRaw: 'Normal boot',
  };
}

export async function scheduleSafeMode(rebootNow: boolean): Promise<SafeModeScheduleResult> {
  const admin = await isProcessAdmin();
  let setOk = false;
  let errorDetail = '';

  if (admin) {
    const res = await runCommandSimple('bcdedit', ['/set', '{current}', 'safeboot', 'minimal'], 10000);
    setOk = res.exitCode === 0;
    errorDetail = res.stderr || res.stdout;
  } else {
    const res = await runPowerShell(
      `$p = Start-Process bcdedit.exe -ArgumentList '/set','{current}','safeboot','minimal' -Verb RunAs -PassThru -Wait; $p.ExitCode`,
      20000
    );
    setOk = res.exitCode === 0 && res.stdout.trim() === '0';
    errorDetail = res.stderr || res.stdout;
  }

  const verify = await getBootStatus();
  if (!setOk && !verify.isSafeBootScheduled) {
    return {
      success: false,
      scheduled: false,
      rebooting: false,
      needsManualGuide: true,
      message: `无法自动写入安全模式启动项（${errorDetail || '权限不足或引导配置受保护'}），请按下方引导手动进入安全模式。`,
    };
  }

  if (rebootNow) {
    const rb = await runCommandSimple(
      'shutdown',
      ['/r', '/t', '5', '/c', 'GPU LAB Pro: 即将重启进入 Windows 安全模式以使用 DDU'],
      8000
    );
    if (rb.exitCode !== 0) {
      return {
        success: true,
        scheduled: true,
        rebooting: false,
        needsManualGuide: false,
        message: '已设置下次启动进入安全模式，但自动触发重启失败，请手动重启计算机。',
      };
    }
    return {
      success: true,
      scheduled: true,
      rebooting: true,
      message: '已配置安全模式引导，系统将在 5 秒后重启进入安全模式！清理完成后请记得点击「恢复正常启动」。',
    };
  }

  return {
    success: true,
    scheduled: true,
    rebooting: false,
    message: '已设置下次开机自动进入「安全模式 (最小化)」，你可在保存工作后随时重启电脑。',
  };
}

export async function cancelSafeMode(rebootNow = false): Promise<ActionResult> {
  const admin = await isProcessAdmin();
  let ok = false;
  let errMsg = '';

  if (admin) {
    const res = await runCommandSimple('bcdedit', ['/deletevalue', '{current}', 'safeboot'], 10000);
    ok = res.exitCode === 0 || /not found|找不到/i.test(res.stderr + res.stdout);
    errMsg = res.stderr || res.stdout;
  } else {
    const res = await runPowerShell(
      `$p = Start-Process bcdedit.exe -ArgumentList '/deletevalue','{current}','safeboot' -Verb RunAs -PassThru -Wait; $p.ExitCode`,
      20000
    );
    ok = res.exitCode === 0 && (res.stdout.trim() === '0' || res.stdout.trim() === '1');
    errMsg = res.stderr || res.stdout;
  }

  const verify = await getBootStatus();
  if (verify.isSafeBootScheduled && !ok) {
    return {
      success: false,
      message: `取消安全模式引导失败: ${errMsg || '请以管理员身份运行 msconfig 取消勾选「安全引导」'}`,
    };
  }

  if (rebootNow) {
    await runCommandSimple(
      'shutdown',
      ['/r', '/t', '5', '/c', 'GPU LAB Pro: 已恢复正常启动配置，正在重启系统'],
      8000
    );
    return {
      success: true,
      message: '已恢复正常 Windows 启动项，系统将在 5 秒后重启。',
    };
  }

  return {
    success: true,
    message: '已移除安全模式启动项，下次重启将恢复正常 Windows 模式。',
  };
}

function findDduExecutable(rootDir: string, maxDepth = 3): string | null {
  if (!rootDir || !fs.existsSync(rootDir)) return null;

  const targetName = 'display driver uninstaller.exe';
  const queue: { dir: string; depth: number }[] = [{ dir: rootDir, depth: 0 }];

  while (queue.length > 0) {
    const { dir, depth } = queue.shift()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase() === targetName) {
        return path.join(dir, entry.name);
      }
    }

    if (depth < maxDepth) {
      for (const entry of entries) {
        if (entry.isDirectory()) {
          queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
        }
      }
    }
  }
  return null;
}

async function getExeVersion(exePath: string): Promise<string> {
  const escaped = exePath.replace(/'/g, "''");
  const res = await runPowerShell(
    `$v = (Get-Item -LiteralPath '${escaped}' -ErrorAction SilentlyContinue).VersionInfo; if ($v) { $v.FileVersion }`,
    6000
  );
  return res.stdout.trim() || '未知';
}

export async function checkLatestDdu(): Promise<{ version: string; downloadUrl: string }> {
  try {
    const html = await httpGetText('https://www.wagnardsoft.com/display-driver-uninstaller-ddu', {}, 10000);
    // Look for dotted version e.g. "DDU 18.1.6.3" or "v18.1.6.3"
    const verMatch =
      html.match(/Display Driver Uninstaller \(DDU\)\s*(?:v|V)?(\d+\.\d+\.\d+\.\d+)/i) ||
      html.match(/DDU\s*v?(\d+\.\d+\.\d+\.\d+)/i) ||
      html.match(/Download-Display-Driver-Uninstaller-DDU-(\d)(\d)(\d)(\d)/i);

    let version = FALLBACK_DDU_VERSION;
    if (verMatch) {
      if (verMatch.length >= 5) {
        version = `${verMatch[1]}.${verMatch[2]}.${verMatch[3]}.${verMatch[4]}`;
      } else if (verMatch[1]) {
        version = verMatch[1];
      }
    } else {
      // Try fetching the first release page linked from /display-driver-uninstaller-ddu
      const slugMatch = html.match(/href="(\/content\/Download-Display-Driver-Uninstaller-DDU-[^"]+)"/i);
      if (slugMatch) {
        const subHtml = await httpGetText(`https://www.wagnardsoft.com${slugMatch[1]}`, {}, 8000);
        const subVer = subHtml.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (subVer) version = subVer[1];
      }
    }

    return {
      version,
      downloadUrl: `https://download.wagnardsoft.com/DDU/DDU%20v${version}.exe`,
    };
  } catch {
    return {
      version: FALLBACK_DDU_VERSION,
      downloadUrl: `https://download.wagnardsoft.com/DDU/DDU%20v${FALLBACK_DDU_VERSION}.exe`,
    };
  }
}

export async function getDduStatus(): Promise<DduStatus> {
  const cfg = loadConfig();
  let exePath = cfg.dduExePath;
  let dduDir = cfg.dduDir;
  let source = cfg.dduSource;

  if (exePath && !fs.existsSync(exePath)) {
    exePath = '';
  }

  if (!exePath && dduDir && fs.existsSync(dduDir)) {
    const found = findDduExecutable(dduDir, 3);
    if (found) {
      exePath = found;
      saveConfig({ dduExePath: found });
    }
  }

  // Also check auto-managed directory
  if (!exePath) {
    const autoDir = path.join(getDataBaseDir(), 'tools', 'ddu');
    const found = findDduExecutable(autoDir, 3);
    if (found) {
      exePath = found;
      dduDir = path.dirname(found);
      source = 'auto';
      saveConfig({ dduDir, dduExePath: exePath, dduSource: 'auto' });
    }
  }

  const [installedVersion, latest] = await Promise.all([
    exePath ? getExeVersion(exePath) : Promise.resolve(''),
    checkLatestDdu(),
  ]);

  if (exePath && installedVersion && installedVersion !== cfg.dduVersion) {
    saveConfig({ dduVersion: installedVersion });
  }

  return {
    ready: Boolean(exePath && fs.existsSync(exePath)),
    dduDir: exePath ? path.dirname(exePath) : dduDir,
    dduExePath: exePath,
    installedVersion: installedVersion || cfg.dduVersion || '',
    latestVersion: latest.version,
    latestDownloadUrl: latest.downloadUrl,
    source: exePath ? (source === 'none' ? 'manual' : source) : 'none',
  };
}

export async function bindDduDirectory(dirPath: string): Promise<{ status: DduStatus; message: string; success: boolean }> {
  const found = findDduExecutable(dirPath, 3);
  if (!found) {
    return {
      success: false,
      message: '所选目录下未找到 Display Driver Uninstaller.exe，请选择解压后的 DDU 文件夹。',
      status: await getDduStatus(),
    };
  }

  const version = await getExeVersion(found);
  saveConfig({
    dduDir: path.dirname(found),
    dduExePath: found,
    dduVersion: version,
    dduSource: 'manual',
  });

  return {
    success: true,
    message: `已成功绑定 DDU v${version} (${path.dirname(found)})`,
    status: await getDduStatus(),
  };
}

function runSfxExtraction(sfxPath: string, targetDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Wagnardsoft DDU uses 7-Zip SFX (-y -o"<dir>")
    const child = spawn(sfxPath, ['-y', `-o${targetDir}`], {
      cwd: targetDir,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore
      }
      reject(new Error('DDU 解压超时'));
    }, 30000);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 || findDduExecutable(targetDir, 3)) {
        resolve();
      } else {
        reject(new Error(`自解压退出码 ${code}`));
      }
    });
  });
}

export async function downloadAndExtractDdu(
  onProgress: (task: DownloadTask) => void
): Promise<{ success: boolean; message: string; status: DduStatus }> {
  const latest = await checkLatestDdu();
  const baseToolsDir = ensureDir(path.join(getDataBaseDir(), 'tools', 'ddu'));
  const extractDir = ensureDir(path.join(baseToolsDir, `DDU-v${latest.version}`));
  const sfxFilename = `DDU v${latest.version}.exe`;

  const task = await startDownload(
    {
      url: latest.downloadUrl,
      filename: sfxFilename,
      category: 'ddu',
      destDir: baseToolsDir,
    },
    onProgress
  );

  if (task.status !== 'completed') {
    return {
      success: false,
      message: `下载 DDU 失败: ${task.error || '未知网络错误'}`,
      status: await getDduStatus(),
    };
  }

  try {
    await runSfxExtraction(task.filePath, extractDir);
  } catch (err) {
    return {
      success: false,
      message: `自动解压 DDU 失败: ${err instanceof Error ? err.message : String(err)}。你可手动运行 ${task.filePath} 解压后点击「绑定 DDU 目录」。`,
      status: await getDduStatus(),
    };
  }

  const exePath = findDduExecutable(extractDir, 3) || findDduExecutable(baseToolsDir, 3);
  if (!exePath) {
    return {
      success: false,
      message: '解压完成但未检测到 Display Driver Uninstaller.exe，请手动绑定解压目录。',
      status: await getDduStatus(),
    };
  }

  const ver = await getExeVersion(exePath);
  saveConfig({
    dduDir: path.dirname(exePath),
    dduExePath: exePath,
    dduVersion: ver !== '未知' ? ver : latest.version,
    dduSource: 'auto',
  });

  return {
    success: true,
    message: `已自动下载并解压 DDU v${ver !== '未知' ? ver : latest.version}`,
    status: await getDduStatus(),
  };
}

export function buildDduArgs(options: DduLaunchOptions): string[] {
  if (options.mode === 'gui') {
    return [];
  }

  const args: string[] = [];
  if (options.silent) args.push('-silent');
  if (options.noSafeModeMsg) args.push('-nosafemodemsg');
  if (options.enableLogging !== false) args.push('-logging');

  if (options.vendor === 'nvidia') args.push('-CleanNvidia');
  else if (options.vendor === 'amd') args.push('-CleanAmd');
  else if (options.vendor === 'intel') args.push('-CleanIntel');
  else if (options.vendor === 'all') args.push('-CleanAllGpus');

  if (options.removeMonitors) args.push('-removemonitors');
  if (options.removeVulkan) args.push('-RemoveVulkan');

  if (options.removeControlPanel) {
    if (options.vendor === 'nvidia') args.push('-RemoveNVCP');
    else if (options.vendor === 'amd') args.push('-RemoveAMDCP');
    else if (options.vendor === 'intel') args.push('-RemoveINTELCP');
  }

  if (options.postAction === 'restart') args.push('-restart');
  else if (options.postAction === 'shutdown') args.push('-shutdown');

  return args;
}

export async function launchDdu(options: DduLaunchOptions): Promise<ActionResult> {
  const status = await getDduStatus();
  if (!status.ready || !status.dduExePath) {
    return {
      success: false,
      message: '尚未就绪：请先点击「自动下载并解压 DDU」或手动绑定 DDU 目录。',
    };
  }

  const args = buildDduArgs(options);
  const admin = await isProcessAdmin();

  if (admin) {
    try {
      const child = spawn(status.dduExePath, args, {
        cwd: path.dirname(status.dduExePath),
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return {
        success: true,
        message: args.length > 0 ? `已启动 DDU (参数: ${args.join(' ')})` : '已启动 Display Driver Uninstaller (GUI)',
      };
    } catch (err) {
      return {
        success: false,
        message: `启动 DDU 失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  const escapedExe = status.dduExePath.replace(/'/g, "''");
  const escapedDir = path.dirname(status.dduExePath).replace(/'/g, "''");
  const argPart =
    args.length > 0
      ? `-ArgumentList ${args.map((a) => `'${a.replace(/'/g, "''")}'`).join(',')}`
      : '';

  const psRes = await runPowerShell(
    `Start-Process -FilePath '${escapedExe}' -WorkingDirectory '${escapedDir}' ${argPart} -Verb RunAs`,
    15000
  );

  if (psRes.exitCode === 0) {
    return {
      success: true,
      message: args.length > 0 ? `已以管理员身份启动 DDU (${args.join(' ')})` : '已以管理员身份启动 DDU',
    };
  }

  return {
    success: false,
    message: '启动 DDU 需要管理员权限（用户可能取消了 UAC 提示）',
    detail: psRes.stderr,
  };
}
