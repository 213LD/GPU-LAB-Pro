import fs from 'fs';
import path from 'path';
import os from 'os';
import { AppConfig } from '../types';

let customBaseDir: string | null = null;

export function setDataBaseDir(dir: string): void {
  customBaseDir = dir;
}

export function getDataBaseDir(): string {
  if (customBaseDir) {
    return customBaseDir;
  }
  try {
    // Dynamically resolve electron app userData when running inside Electron
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    if (electron?.app?.getPath) {
      return electron.app.getPath('userData');
    }
  } catch {
    // Running outside Electron (e.g. verification script)
  }
  return path.join(os.homedir(), 'AppData', 'Roaming', 'gpu-lab-pro');
}

export function getDefaultDownloadDir(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    if (electron?.app?.getPath) {
      return path.join(electron.app.getPath('downloads'), 'GPU-LAB');
    }
  } catch {
    // fallback
  }
  return path.join(os.homedir(), 'Downloads', 'GPU-LAB');
}

export function getConfigPath(): string {
  return path.join(getDataBaseDir(), 'config.json');
}

export function getDefaultConfig(): AppConfig {
  return {
    dduDir: '',
    dduExePath: '',
    dduVersion: '',
    dduSource: 'none',
    downloadDir: getDefaultDownloadDir(),
    hasSeenPostCleanupGuide: false,
  };
}

export function loadConfig(): AppConfig {
  const configPath = getConfigPath();
  const defaults = getDefaultConfig();
  try {
    if (!fs.existsSync(configPath)) {
      return defaults;
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      ...defaults,
      ...parsed,
    };
  } catch {
    return defaults;
  }
}

export function saveConfig(partial: Partial<AppConfig>): AppConfig {
  const current = loadConfig();
  const merged: AppConfig = { ...current, ...partial };
  const dir = path.dirname(getConfigPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

export function ensureDir(dirPath: string): string {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}
