import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { loadConfig, saveConfig } from './services/configService';
import { detectGpus, getNvidiaTelemetry } from './services/gpuDetector';
import {
  cancelDownload,
  getDriverCatalog,
  getLocalDriverStore,
  installLocalDriver,
  listDownloads,
  startDownload,
} from './services/driverService';
import {
  bindDduDirectory,
  cancelSafeMode,
  downloadAndExtractDdu,
  getBootStatus,
  getDduStatus,
  launchDdu,
  scheduleSafeMode,
} from './services/dduService';
import {
  downloadNvidiaApp,
  downloadOrLaunchAmdCleanup,
  getVendorToolsStatus,
  launchAmdAdrenalin,
  launchIntelGraphicsTool,
  launchNvidiaApp,
  launchNvidiaControlPanel,
  openSystemUtility,
  setHagsEnabled,
  setMpoDisabled,
  uninstallNvidiaControlPanel,
} from './services/vendorToolsService';
import { cleanShaderCaches, getShaderCacheTarget, scanShaderCaches } from './services/shaderCacheService';
import { isProcessAdmin, runPowerShell } from './services/psRunner';
import { AppConfig, DduLaunchOptions, DownloadTask, GpuVendor } from './types';

let mainWindow: BrowserWindow | null = null;
const isSmokeTest = process.argv.includes('--smoke-test');

function sendDownloadProgress(task: DownloadTask): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download:progress', task);
  }
}

function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return ['https:', 'http:', 'ms-windows-store:', 'ms-settings:'].includes(u.protocol);
  } catch {
    return false;
  }
}

function createWindow(): void {
  const iconPath = path.join(__dirname, '../build/icon.ico');
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 820,
    minWidth: 1120,
    minHeight: 700,
    frame: false,
    backgroundColor: '#090c0a',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: !isSmokeTest,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized', false);
  });

  if (isSmokeTest) {
    let errorCount = 0;
    mainWindow.webContents.on('console-message', (_event, level, message) => {
      if (level >= 3) {
        errorCount += 1;
        console.error('[RendererError]', message);
      }
    });
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      console.error('[SmokeTest] Renderer crashed:', details);
      app.exit(1);
    });
    mainWindow.webContents.on('did-finish-load', async () => {
      // Wait briefly for initial React hydration & IPC calls
      setTimeout(async () => {
        try {
          const title = await mainWindow?.webContents.executeJavaScript('document.title');
          const rootLen = await mainWindow?.webContents.executeJavaScript(
            'document.getElementById("root")?.innerHTML?.length || 0'
          );
          console.log(`[SmokeTest] title="${title}", rootHtmlLen=${rootLen}, consoleErrors=${errorCount}`);
          app.exit(rootLen > 100 && errorCount === 0 ? 0 : 1);
        } catch (err) {
          console.error('[SmokeTest] eval failed:', err);
          app.exit(1);
        }
      }, 2200);
    });
  }

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

const gotLock = isSmokeTest ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

function registerIpcHandlers(): void {
  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  // Config
  ipcMain.handle('config:get', () => loadConfig());
  ipcMain.handle('config:update', (_e, partial: Partial<AppConfig>) => saveConfig(partial));
  ipcMain.handle('config:pickDownloadDir', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: '选择驱动与工具下载保存目录',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return saveConfig({ downloadDir: res.filePaths[0] });
  });

  // GPU Detection & Telemetry
  ipcMain.handle('gpu:detect', () => detectGpus());
  ipcMain.handle('gpu:telemetry', () => getNvidiaTelemetry());

  // Driver Manager & Downloads
  ipcMain.handle(
    'driver:catalog',
    (
      _e,
      params: {
        vendor: GpuVendor;
        gpuName: string;
        installedFriendlyVersion: string;
        seriesId?: string;
        productId?: string;
      }
    ) => getDriverCatalog(params)
  );
  ipcMain.handle('driver:localStore', () => getLocalDriverStore());
  ipcMain.handle('driver:installLocal', (_e, publishedName: string) => installLocalDriver(publishedName));

  ipcMain.handle(
    'download:start',
    (_e, params: { url: string; filename?: string; category: 'driver' | 'ddu' | 'tool'; referer?: string }) =>
      startDownload(params, sendDownloadProgress)
  );
  ipcMain.handle('download:cancel', (_e, id: string) => cancelDownload(id));
  ipcMain.handle('download:list', () => listDownloads());
  ipcMain.handle('download:revealFile', (_e, filePath: string) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return true;
    }
    return false;
  });
  ipcMain.handle('download:launchInstaller', async (_e, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, message: '安装程序文件不存在或已被移动' };
    }
    const admin = await isProcessAdmin();
    if (admin) {
      const child = spawn(filePath, [], { detached: true, stdio: 'ignore' });
      child.unref();
      return { success: true, message: `已启动安装程序: ${path.basename(filePath)}` };
    }
    const escaped = filePath.replace(/'/g, "''");
    const res = await runPowerShell(`Start-Process -FilePath '${escaped}' -Verb RunAs`, 10000);
    if (res.exitCode === 0) {
      return { success: true, message: `已以管理员身份启动: ${path.basename(filePath)}` };
    }
    const openErr = await shell.openPath(filePath);
    return openErr
      ? { success: false, message: `启动失败: ${openErr}` }
      : { success: true, message: `已打开: ${path.basename(filePath)}` };
  });

  // DDU & Safe Mode
  ipcMain.handle('ddu:status', () => getDduStatus());
  ipcMain.handle('ddu:bootStatus', () => getBootStatus());
  ipcMain.handle('ddu:downloadAndExtract', () => downloadAndExtractDdu(sendDownloadProgress));
  ipcMain.handle('ddu:bindDirDialog', async () => {
    if (!mainWindow) return { success: false, message: '窗口未就绪', status: await getDduStatus() };
    const res = await dialog.showOpenDialog(mainWindow, {
      title: '选择已解压的 Display Driver Uninstaller (DDU) 目录',
      properties: ['openDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) {
      return { success: false, message: '已取消选择', status: await getDduStatus() };
    }
    return bindDduDirectory(res.filePaths[0]);
  });
  ipcMain.handle('ddu:launch', (_e, options: DduLaunchOptions) => launchDdu(options));
  ipcMain.handle('ddu:scheduleSafeMode', (_e, rebootNow: boolean) => scheduleSafeMode(rebootNow));
  ipcMain.handle('ddu:cancelSafeMode', (_e, rebootNow?: boolean) => cancelSafeMode(Boolean(rebootNow)));

  // Vendor Exclusive Tools
  ipcMain.handle('vendor:status', () => getVendorToolsStatus());
  ipcMain.handle('vendor:openNvcpStore', async () => {
    await shell.openExternal('ms-windows-store://pdp/?ProductId=9NF8H0H7WMLT');
    return { success: true, message: '已调起 Microsoft Store 中的 NVIDIA 控制面板安装页' };
  });
  ipcMain.handle('vendor:launchNvcp', () => launchNvidiaControlPanel());
  ipcMain.handle('vendor:uninstallNvcp', () => uninstallNvidiaControlPanel());
  ipcMain.handle('vendor:launchNvidiaApp', () => launchNvidiaApp());
  ipcMain.handle('vendor:downloadNvidiaApp', () => downloadNvidiaApp(sendDownloadProgress));
  ipcMain.handle('vendor:launchAmdAdrenalin', () => launchAmdAdrenalin());
  ipcMain.handle('vendor:downloadOrLaunchAmdCleanup', () => downloadOrLaunchAmdCleanup(sendDownloadProgress));
  ipcMain.handle('vendor:launchIntelTool', () => launchIntelGraphicsTool());
  ipcMain.handle('vendor:openIntelStore', async () => {
    await shell.openExternal('ms-windows-store://pdp/?ProductId=9PLFNLNT3G5G');
    return { success: true, message: '已调起 Microsoft Store 中的 Intel 显卡控制中心' };
  });
  ipcMain.handle('vendor:setHags', (_e, enabled: boolean) => setHagsEnabled(enabled));
  ipcMain.handle('vendor:setMpoDisabled', (_e, disabled: boolean) => setMpoDisabled(disabled));

  // System utilities
  ipcMain.handle('system:openExternal', async (_e, url: string) => {
    if (!isAllowedExternalUrl(url)) {
      return { success: false, message: '不支持的链接协议' };
    }
    await shell.openExternal(url);
    return { success: true, message: '已在系统默认应用打开' };
  });
  ipcMain.handle('system:openTool', (_e, tool: 'dxdiag' | 'devmgmt' | 'msinfo32' | 'msconfig') =>
    openSystemUtility(tool)
  );

  // Shader Cache
  ipcMain.handle('shader:scan', () => scanShaderCaches());
  ipcMain.handle('shader:openFolder', async (_e, id: string) => {
    const target = getShaderCacheTarget(id);
    if (!target) return { success: false, message: '未知缓存目录' };
    if (fs.existsSync(target.path)) {
      const err = await shell.openPath(target.path);
      return err ? { success: false, message: err } : { success: true, message: `已打开 ${target.label}` };
    }
    const parent = path.dirname(target.path);
    if (fs.existsSync(parent)) {
      await shell.openPath(parent);
      return { success: true, message: `${target.label} 目录暂未生成，已打开其上级目录` };
    }
    return { success: false, message: `${target.path} 当前不存在（尚未生成对应缓存）` };
  });
  ipcMain.handle('shader:clean', (_e, ids?: string[]) => cleanShaderCaches(ids));
}
