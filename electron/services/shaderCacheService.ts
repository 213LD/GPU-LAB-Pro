import fs from 'fs';
import path from 'path';
import os from 'os';
import { ShaderCacheFolder, ShaderCleanResult } from '../types';

interface CacheTargetDef {
  id: string;
  vendor: 'directx' | 'nvidia' | 'amd' | 'intel';
  label: string;
  description: string;
  path: string;
}

function getCacheTargetDefs(): CacheTargetDef[] {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const roamingAppData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');

  return [
    {
      id: 'dx-cache',
      vendor: 'directx',
      label: 'DirectX 通用着色器缓存',
      description: 'Windows 系统级 D3D11 / D3D12 管线编译缓存（通用）',
      path: path.join(localAppData, 'D3DSCache'),
    },
    {
      id: 'nv-dx',
      vendor: 'nvidia',
      label: 'NVIDIA DXCache',
      description: 'NVIDIA GeForce DirectX 11/12 驱动级着色器缓存',
      path: path.join(localAppData, 'NVIDIA', 'DXCache'),
    },
    {
      id: 'nv-gl',
      vendor: 'nvidia',
      label: 'NVIDIA GLCache',
      description: 'NVIDIA OpenGL 与部分 Vulkan 应用着色器缓存',
      path: path.join(localAppData, 'NVIDIA', 'GLCache'),
    },
    {
      id: 'nv-compute',
      vendor: 'nvidia',
      label: 'NVIDIA ComputeCache',
      description: 'NVIDIA CUDA / 计算核心编译二进制缓存',
      path: path.join(roamingAppData, 'NVIDIA', 'ComputeCache'),
    },
    {
      id: 'nv-temp',
      vendor: 'nvidia',
      label: 'NVIDIA Temp NV_Cache',
      description: '旧版 / 临时目录中的 NVIDIA 着色器缓存',
      path: path.join(localAppData, 'Temp', 'NVIDIA Corporation', 'NV_Cache'),
    },
    {
      id: 'amd-dx',
      vendor: 'amd',
      label: 'AMD Radeon DxCache',
      description: 'AMD Adrenalin DirectX 着色器缓存目录',
      path: path.join(localAppData, 'AMD', 'DxCache'),
    },
    {
      id: 'amd-gl',
      vendor: 'amd',
      label: 'AMD Radeon GLCache',
      description: 'AMD Adrenalin OpenGL 着色器缓存目录',
      path: path.join(localAppData, 'AMD', 'GLCache'),
    },
    {
      id: 'amd-vk',
      vendor: 'amd',
      label: 'AMD Radeon VkCache',
      description: 'AMD Vulkan 管线与着色器缓存目录',
      path: path.join(localAppData, 'AMD', 'VkCache'),
    },
    {
      id: 'intel-shader',
      vendor: 'intel',
      label: 'Intel ShaderCache',
      description: 'Intel Arc / Iris Xe 图形驱动着色器缓存',
      path: path.join(localAppData, 'Intel', 'ShaderCache'),
    },
  ];
}

function measureDir(dirPath: string): { sizeBytes: number; fileCount: number } {
  let sizeBytes = 0;
  let fileCount = 0;

  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile()) {
          const stat = fs.statSync(full);
          sizeBytes += stat.size;
          fileCount += 1;
        }
      } catch {
        // Skip locked or inaccessible entries
      }
    }
  }

  return { sizeBytes, fileCount };
}

export async function scanShaderCaches(): Promise<ShaderCacheFolder[]> {
  const defs = getCacheTargetDefs();
  return defs.map((def) => {
    const exists = fs.existsSync(def.path);
    if (!exists) {
      return {
        ...def,
        exists: false,
        sizeBytes: 0,
        fileCount: 0,
      };
    }
    const { sizeBytes, fileCount } = measureDir(def.path);
    return {
      ...def,
      exists: true,
      sizeBytes,
      fileCount,
    };
  });
}

export function getShaderCacheTarget(id: string): CacheTargetDef | undefined {
  return getCacheTargetDefs().find((t) => t.id === id);
}

function cleanSingleDirectory(rootDir: string): { freedBytes: number; deletedFiles: number; skippedFiles: number } {
  let freedBytes = 0;
  let deletedFiles = 0;
  let skippedFiles = 0;

  if (!fs.existsSync(rootDir)) {
    return { freedBytes, deletedFiles, skippedFiles };
  }

  const walkAndDelete = (dir: string, isRoot: boolean) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkAndDelete(full, false);
        try {
          const remaining = fs.readdirSync(full);
          if (remaining.length === 0) {
            fs.rmdirSync(full);
          }
        } catch {
          // ignore non-empty or locked subdir
        }
      } else if (entry.isFile()) {
        let size = 0;
        try {
          size = fs.statSync(full).size;
        } catch {
          // ignore
        }
        try {
          fs.unlinkSync(full);
          freedBytes += size;
          deletedFiles += 1;
        } catch {
          skippedFiles += 1;
        }
      }
    }

    if (!isRoot) {
      try {
        const remaining = fs.readdirSync(dir);
        if (remaining.length === 0) {
          fs.rmdirSync(dir);
        }
      } catch {
        // ignore
      }
    }
  };

  walkAndDelete(rootDir, true);
  return { freedBytes, deletedFiles, skippedFiles };
}

export async function cleanShaderCaches(ids?: string[]): Promise<ShaderCleanResult> {
  const defs = getCacheTargetDefs();
  const selected = ids && ids.length > 0
    ? defs.filter((d) => ids.includes(d.id))
    : defs;

  let totalFreed = 0;
  let totalDeleted = 0;
  let totalSkipped = 0;
  const perFolder: ShaderCleanResult['perFolder'] = [];

  for (const target of selected) {
    if (!fs.existsSync(target.path)) continue;
    const res = cleanSingleDirectory(target.path);
    totalFreed += res.freedBytes;
    totalDeleted += res.deletedFiles;
    totalSkipped += res.skippedFiles;
    perFolder.push({
      id: target.id,
      label: target.label,
      ...res,
    });
  }

  return {
    freedBytes: totalFreed,
    deletedFiles: totalDeleted,
    skippedFiles: totalSkipped,
    perFolder,
  };
}
