// setup.js — build (download) step: fetch the upstream xray binary at build time.
// Fetches the latest xray release for linux-64 only (Heroku-style stack),
// extracts the binary, and stores it as ./xray (executable).
// Keep this file because it is referenced by the "build" script in package.json.
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'xray-setup' } }, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    // Use curl if available — fastest path for large binaries.
    execFile('curl', ['-fL', '-o', dest, url], err => {
      if (!err) return resolve();
      https.get(url, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: ${res.statusCode}`));
          res.resume();
          return;
        }
        const out = fs.createWriteStream(dest);
        res.pipe(out);
        out.on('finish', () => out.close(resolve));
        out.on('error', reject);
      }).on('error', reject);
    });
  });
}

async function main() {
  const release = await fetchJson(
    'https://api.github.com/repos/XTLS/Xray-core/releases/latest'
  );
  const asset = release.assets.find(a => a.name === 'Xray-linux-64.zip');
  if (!asset) throw new Error('Xray-linux-64.zip asset not found in latest release');
  const zip = path.join(__dirname, 'xray.zip');
  await download(asset.browser_download_url, zip);
  await execFileAsync('unzip', ['-o', zip, 'xray', '-d', __dirname]);
  fs.chmodSync(path.join(__dirname, 'xray'), 0o755);
  fs.unlinkSync(zip);
  console.log('xray binary ready');
}

main().catch(err => { console.error(err); process.exit(1); });
