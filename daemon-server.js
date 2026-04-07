// True daemon with single-instance guard
// Survives parent process death via double-fork
// Auto-restores .env from .credentials if missing
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const PID_FILE = path.join(__dirname, '.zscripts', 'daemon.pid');
const LOG_FILE = path.join(__dirname, '.zscripts', 'server.log');

function log(msg) {
  try {
    fs.appendFileSync(LOG_FILE, `[daemon ${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

// Load .env from file into env object
function loadEnv(envPath) {
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  }
  return env;
}

// ─── Parent process: double-fork and exit ───
if (!process.argv.includes('--child')) {
  // Check if already running
  if (fs.existsSync(PID_FILE)) {
    const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    try {
      process.kill(oldPid, 0); // still alive?
      console.log(`Daemon already running (PID ${oldPid}). Not starting a new one.`);
      process.exit(0);
    } catch {
      // Old PID dead, stale file — proceed
    }
  }

  // Kill any leftover next-server processes on port 3000
  try {
    execSync('fuser -k 3000/tcp 2>/dev/null', { timeout: 3000 });
  } catch {}

  const child = spawn(process.execPath, [__filename, '--child'], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
    cwd: __dirname,
  });

  child.unref();
  try { child.disconnect(); } catch {}
  console.log(`Daemon started (child PID: ${child.pid})`);
  process.exit(0);
}

// ─── Child process (the actual daemon) ───
log(`Daemon started, PID=${process.pid}`);

// Write PID file
fs.writeFileSync(PID_FILE, String(process.pid));

// Step 1: Ensure .env exists (restore from .credentials if needed)
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  log('.env missing, running ensure-env.sh to restore from .credentials...');
  try {
    execSync(`bash ${path.join(__dirname, 'ensure-env.sh')}`, { timeout: 5000 });
    log('.env restored successfully');
  } catch (e) {
    log(`WARNING: ensure-env.sh failed: ${e.message}`);
  }
}

// Step 2: Load env
const env = loadEnv(envPath);
log(`Loaded env with ${Object.keys(env).length} vars`);

// Step 3: Also write .env to standalone dir
const standaloneEnv = path.join(__dirname, '.next', 'standalone', '.env');
try {
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, standaloneEnv);
    log(`Copied .env to standalone dir`);
  }
} catch {}

// Step 3.5: Ensure static files and public dir are available in standalone
const standaloneDir = path.join(__dirname, '.next', 'standalone');
const staticSrc = path.join(__dirname, '.next', 'static');
const staticDst = path.join(standaloneDir, '.next', 'static');
const publicSrc = path.join(__dirname, 'public');
const publicDst = path.join(standaloneDir, 'public');

try {
  if (!fs.existsSync(staticDst) || fs.statSync(staticSrc).mtimeMs > fs.statSync(staticDst).mtimeMs) {
    execSync(`cp -r ${staticSrc} ${staticDst}`, { timeout: 10000 });
    log(`Copied .next/static to standalone dir`);
  }
} catch (e) {
  try {
    execSync(`cp -r ${staticSrc} ${staticDst}`, { timeout: 10000 });
    log(`Copied .next/static to standalone dir (fallback)`);
  } catch (e2) {
    log(`WARNING: Failed to copy static files: ${e2.message}`);
  }
}

try {
  if (!fs.existsSync(publicDst) || fs.statSync(publicSrc).mtimeMs > fs.statSync(publicDst).mtimeMs) {
    execSync(`cp -r ${publicSrc} ${publicDst}`, { timeout: 10000 });
    log(`Copied public to standalone dir`);
  }
} catch (e) {
  try {
    execSync(`cp -r ${publicSrc} ${publicDst}`, { timeout: 10000 });
    log(`Copied public to standalone dir (fallback)`);
  } catch (e2) {
    log(`WARNING: Failed to copy public dir: ${e2.message}`);
  }
}

// Step 4: Start the standalone server
const logFd = fs.openSync(LOG_FILE, 'a');

const server = spawn(process.execPath, [
  path.join(__dirname, '.next', 'standalone', 'server.js')
], {
  stdio: ['ignore', logFd, logFd],
  env,
  cwd: __dirname,
});

log(`Standalone server started, PID=${server.pid}`);

server.on('exit', (code, signal) => {
  log(`Server exited (code=${code}, signal=${signal})`);
  try { fs.unlinkSync(PID_FILE); } catch {}
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down...');
  server.kill('SIGTERM');
});
