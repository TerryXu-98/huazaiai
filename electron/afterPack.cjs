const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function findRcedit(dir, depth = 0) {
  if (!dir || depth > 5 || !fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === 'rcedit-x64.exe') return full;
    if (entry.isDirectory()) {
      const found = findRcedit(full, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, 'electron', 'build-resources', 'icon.ico');
  const cacheRoot = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign');
  const rcedit = findRcedit(cacheRoot);

  if (!fs.existsSync(exePath) || !fs.existsSync(iconPath) || !rcedit) {
    console.warn('[afterPack] skip Windows icon resource update');
    return;
  }

  try {
    execFileSync(rcedit, [
      exePath,
      '--set-icon',
      iconPath,
    ]);
  } catch (error) {
    console.warn('[afterPack] Windows icon resource update will be applied by the release packaging step when needed');
  }
};
