#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXT = path.join(ROOT, 'extension');
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK: ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fileExists(relPath) {
  const full = path.join(EXT, relPath);
  if (!fs.existsSync(full)) {
    fail(`Missing file: ${relPath}`);
    return false;
  }
  ok(`found ${relPath}`);
  return true;
}

function readPngSize(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24 || !buf.slice(0, 8).equals(PNG_SIG)) {
    throw new Error('not a PNG file (bad magic bytes)');
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20)
  };
}

function validateIcon(relPath, expectedSize) {
  const full = path.join(EXT, relPath);
  if (!fs.existsSync(full)) {
    fail(`Missing icon: ${relPath}`);
    return;
  }
  try {
    const { width, height } = readPngSize(full);
    if (width !== expectedSize || height !== expectedSize) {
      fail(`${relPath}: expected ${expectedSize}x${expectedSize}, got ${width}x${height}`);
      return;
    }
    ok(`${relPath} is PNG ${width}x${height}`);
  } catch (err) {
    fail(`${relPath}: ${err.message}`);
  }
}

function collectHtmlAssets(htmlRelPath) {
  const html = fs.readFileSync(path.join(EXT, htmlRelPath), 'utf8');
  const scriptMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)];
  const cssMatches = [...html.matchAll(/<link[^>]+href=["']([^"']+)["']/gi)];
  const assets = [];
  for (const match of scriptMatches) assets.push(match[1]);
  for (const match of cssMatches) assets.push(match[1]);
  return assets;
}

function main() {
  const manifestPath = path.join(EXT, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fail('extension/manifest.json missing');
    process.exit(1);
  }

  const manifest = readJson(manifestPath);
  ok(`manifest.json version ${manifest.version}`);

  const serviceWorker = manifest.background && manifest.background.service_worker;
  if (!serviceWorker) {
    fail('manifest.background.service_worker is missing');
  } else {
    fileExists(serviceWorker);
  }

  const popup = manifest.action && manifest.action.default_popup;
  if (!popup) {
    fail('manifest.action.default_popup is missing');
  } else {
    fileExists(popup);
    for (const asset of collectHtmlAssets(popup)) fileExists(asset);
  }

  if (!manifest.options_page) {
    fail('manifest.options_page is missing');
  } else {
    fileExists(manifest.options_page);
    for (const asset of collectHtmlAssets(manifest.options_page)) fileExists(asset);
  }

  if (!manifest.icons || typeof manifest.icons !== 'object') {
    fail('manifest.icons is missing');
  }

  const iconSets = [manifest.icons, manifest.action && manifest.action.default_icon].filter(Boolean);
  const iconPaths = new Set();
  for (const set of iconSets) {
    for (const rel of Object.values(set)) iconPaths.add(rel);
  }

  for (const rel of iconPaths) {
    const match = rel.match(/icon(\d+)\.png$/);
    if (!match) {
      fail(`Unexpected icon path: ${rel}`);
      continue;
    }
    validateIcon(rel, Number(match[1], 10));
  }

  if (process.exitCode) {
    process.exit(1);
  }

  console.log('All extension asset checks passed.');
}

main();
