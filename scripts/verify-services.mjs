import assert from 'assert';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { setDataBaseDir } = require('../dist-electron/services/configService.js');
const { detectGpus, getNvidiaTelemetry } = require('../dist-electron/services/gpuDetector.js');
const { getDriverCatalog, getLocalDriverStore } = require('../dist-electron/services/driverService.js');
const { getBootStatus, getDduStatus } = require('../dist-electron/services/dduService.js');
const { getVendorToolsStatus } = require('../dist-electron/services/vendorToolsService.js');
const { scanShaderCaches } = require('../dist-electron/services/shaderCacheService.js');

async function main() {
  // Isolate test config directory so user config is not polluted
  setDataBaseDir(path.join(os.tmpdir(), 'gpu-lab-verify'));

  console.log('=== 1. GPU Detection ===');
  const summary = await detectGpus();
  console.log(`OS: ${summary.osVersion} (Build ${summary.osBuild})`);
  console.log(`Adapters: total=${summary.adapters.length}, physical=${summary.physicalCount}, virtual=${summary.virtualCount}`);
  for (const a of summary.adapters) {
    console.log(
      `  - [${a.vendor}${a.isVirtual ? '/virtual' : ''}] ${a.name} | VRAM=${a.vramLabel} (${a.vramBytes}) | WDDM=${a.driverVersion} | Friendly=${a.friendlyVersion} | Date=${a.driverDate}`
    );
  }
  assert(summary.physicalCount >= 1, 'Expected at least 1 physical GPU');

  console.log('\n=== 2. NVIDIA Telemetry ===');
  const telemetry = await getNvidiaTelemetry();
  console.log(JSON.stringify(telemetry, null, 2));

  console.log('\n=== 3. Driver Catalogs & Local Driver Store ===');
  const nvGpu = summary.adapters.find((g) => g.vendor === 'nvidia' && !g.isVirtual);
  if (nvGpu) {
    const nvCatalog = await getDriverCatalog({
      vendor: 'nvidia',
      gpuName: nvGpu.name,
      installedFriendlyVersion: nvGpu.friendlyVersion,
    });
    console.log(`NVIDIA matched="${nvCatalog.matchedModelName}" (psid=${nvCatalog.matchedSeriesId}, pfid=${nvCatalog.matchedProductId}), drivers=${nvCatalog.drivers.length}`);
    for (const d of nvCatalog.drivers.slice(0, 5)) {
      console.log(`  - ${d.version} [${d.channel}] (${d.releaseDate}, ${d.fileSize}) [${d.relation}] -> ${d.downloadUrl}`);
    }
    assert(nvCatalog.drivers.length >= 5, 'Expected >= 5 live NVIDIA drivers');
  }

  const amdGpu = summary.adapters.find((g) => g.vendor === 'amd' && !g.isVirtual);
  if (amdGpu) {
    const amdCatalog = await getDriverCatalog({
      vendor: 'amd',
      gpuName: amdGpu.name,
      installedFriendlyVersion: amdGpu.friendlyVersion,
    });
    console.log(`AMD catalog drivers=${amdCatalog.drivers.length}, installed=${amdCatalog.installedFriendlyVersion}`);
    for (const d of amdCatalog.drivers.slice(0, 3)) {
      console.log(`  - ${d.version} [${d.relation}] (${d.fileSize})`);
    }
    assert(amdCatalog.drivers.length >= 5, 'Expected >= 5 AMD catalog drivers');
  }

  const store = await getLocalDriverStore();
  console.log(`Local Windows Display Driver Store packages: ${store.length}`);
  for (const s of store) {
    console.log(`  - ${s.publishedName} (${s.originalName}) | ${s.providerName} | ${s.driverVersion} (${s.driverDate})`);
  }
  assert(store.length >= 1, 'Expected >= 1 local Display driver package');

  console.log('\n=== 4. Safe Mode & DDU Status ===');
  const boot = await getBootStatus();
  console.log('BootStatus:', JSON.stringify(boot));
  const ddu = await getDduStatus();
  console.log('DduStatus:', JSON.stringify(ddu));
  assert(ddu.latestVersion && ddu.latestDownloadUrl.includes('download.wagnardsoft.com'), 'Expected valid latest DDU URL');

  console.log('\n=== 5. Vendor Tools Status ===');
  const tools = await getVendorToolsStatus();
  console.log(JSON.stringify(tools, null, 2));

  console.log('\n=== 6. Shader Cache Scan (Read-Only) ===');
  const caches = await scanShaderCaches();
  let totalBytes = 0;
  for (const c of caches) {
    totalBytes += c.sizeBytes;
    console.log(`  - [${c.vendor}] ${c.label}: exists=${c.exists}, files=${c.fileCount}, bytes=${c.sizeBytes}`);
  }
  console.log(`Total scanned cache bytes: ${totalBytes}`);
  assert(caches.some((c) => c.exists), 'Expected at least 1 existing shader cache directory');

  console.log('\nALL BACKEND SERVICE CHECKS PASSED.');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
