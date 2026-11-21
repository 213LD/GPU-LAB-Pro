import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function runStep(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: rootDir, shell: true, stdio: 'inherit' });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

function waitForVite(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(check, 300);
    };
    check();
  });
}

async function main() {
  console.log('[GPU LAB] Compiling Electron TypeScript...');
  await runStep('npx', ['tsc', '-p', 'tsconfig.electron.json']);

  console.log('[GPU LAB] Starting Vite dev server...');
  const viteProc = spawn('npx', ['vite', '--port', '5173'], {
    cwd: rootDir,
    shell: true,
    stdio: 'inherit',
  });

  const cleanup = () => {
    try {
      viteProc.kill();
    } catch {
      // ignore
    }
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  await waitForVite('http://localhost:5173');
  console.log('[GPU LAB] Launching Electron...');

  const electronBin = path.join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');
  const electronProc = spawn(`"${electronBin}"`, ['.'], {
    cwd: rootDir,
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: 'http://localhost:5173',
    },
  });

  electronProc.on('close', (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
