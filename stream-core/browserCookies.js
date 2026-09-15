/**
 * Utility to extract cookies from Chrome / Edge / Brave / Chromium / Firefox / Opera / Vivaldi
 * on Windows, macOS, and Linux.
 * When the app runs on the user's desktop (Electron or native), it automatically detects installed
 * browsers and leverages active YouTube cookies so users are never blocked by bot detection.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function getAvailableBrowsers() {
  const platform = process.platform;
  const home = os.homedir();
  const browsers = [];

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

    if (fs.existsSync(path.join(localAppData, 'Google', 'Chrome', 'User Data'))) browsers.push('chrome');
    if (fs.existsSync(path.join(localAppData, 'Microsoft', 'Edge', 'User Data'))) browsers.push('edge');
    if (fs.existsSync(path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data'))) browsers.push('brave');
    if (fs.existsSync(path.join(appData, 'Opera Software', 'Opera Stable'))) browsers.push('opera');
    if (fs.existsSync(path.join(localAppData, 'Vivaldi', 'User Data'))) browsers.push('vivaldi');
    if (fs.existsSync(path.join(appData, 'Mozilla', 'Firefox', 'Profiles'))) browsers.push('firefox');
  } else if (platform === 'darwin') {
    const appSupport = path.join(home, 'Library', 'Application Support');

    if (fs.existsSync(path.join(appSupport, 'Google', 'Chrome'))) browsers.push('chrome');
    if (fs.existsSync(path.join(appSupport, 'Microsoft Edge'))) browsers.push('edge');
    if (fs.existsSync(path.join(appSupport, 'BraveSoftware', 'Brave-Browser'))) browsers.push('brave');
    if (fs.existsSync(path.join(appSupport, 'com.operasoftware.Opera'))) browsers.push('opera');
    if (fs.existsSync(path.join(appSupport, 'Vivaldi'))) browsers.push('vivaldi');
    if (fs.existsSync(path.join(appSupport, 'Firefox', 'Profiles'))) browsers.push('firefox');
  } else {
    // Linux
    const configDir = path.join(home, '.config');
    const mozillaDir = path.join(home, '.mozilla', 'firefox');

    if (fs.existsSync(path.join(configDir, 'google-chrome'))) browsers.push('chrome');
    if (fs.existsSync(path.join(configDir, 'chromium'))) browsers.push('chromium');
    if (fs.existsSync(path.join(configDir, 'BraveSoftware', 'Brave-Browser'))) browsers.push('brave');
    if (fs.existsSync(path.join(configDir, 'microsoft-edge'))) browsers.push('edge');
    if (fs.existsSync(path.join(configDir, 'opera'))) browsers.push('opera');
    if (fs.existsSync(path.join(configDir, 'vivaldi'))) browsers.push('vivaldi');
    if (fs.existsSync(mozillaDir)) browsers.push('firefox');
  }

  return browsers;
}

export function getPrimaryBrowser() {
  const browsers = getAvailableBrowsers();
  if (browsers.includes('chrome')) return 'chrome';
  if (browsers.includes('edge')) return 'edge';
  if (browsers.includes('brave')) return 'brave';
  if (browsers.includes('firefox')) return 'firefox';
  if (browsers.includes('opera')) return 'opera';
  if (browsers.includes('vivaldi')) return 'vivaldi';
  if (browsers.includes('chromium')) return 'chromium';
  if (browsers.length > 0) return browsers[0];
  return null; // Return null if no browser profile is found locally, preventing error crashes
}
