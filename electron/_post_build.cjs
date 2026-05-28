'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UNPACKED = path.join(ROOT, 'dist_electron', 'win-unpacked');
const RES = path.join(UNPACKED, 'resources');

function rel(p) {
  return path.relative(UNPACKED, p);
}

function checkFile(p) {
  if (!fs.existsSync(p)) {
    console.error(`  MISSING ${rel(p)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  OK ${rel(p)}`);
}

function removePlainBackend() {
  const candidates = [
    path.join(RES, 'app', 'backend', 'src'),
    path.join(RES, 'backend', 'src'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      console.log(`  removing plaintext backend: ${rel(dir)}`);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

function main() {
  console.log('==========================================');
  console.log('[post-build] verifying Liang package');
  console.log('==========================================');

  if (!fs.existsSync(UNPACKED)) {
    console.error('dist_electron/win-unpacked does not exist.');
    process.exit(1);
  }

  console.log('[1] encrypted backend');
  checkFile(path.join(RES, 'backend-enc', 'server.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'config.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'canvas.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'settings.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'proxy.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'files.t8c'));
  checkFile(path.join(RES, 'backend-enc', 'routes', 'imageOps.t8c'));

  console.log('[2] frontend');
  checkFile(path.join(RES, 'frontend', 'index.html'));
  checkFile(path.join(RES, 'frontend', 'assets'));

  console.log('[3] cleanup');
  removePlainBackend();

  if (process.exitCode) {
    console.error('[post-build] failed');
    process.exit(process.exitCode);
  }
  console.log('[post-build] done');
}

if (require.main === module) main();
