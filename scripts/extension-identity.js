'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ID_REGEX = /^[a-p]{32}$/;
const ROOT = path.join(__dirname, '..');
const EXT_DIR = path.join(ROOT, 'extension');
const MANIFEST_PATH = path.join(EXT_DIR, 'manifest.json');
const ID_FILE_PATH = path.join(EXT_DIR, 'EXTENSION_ID.txt');
const PEM_PATH = path.join(ROOT, 'secrets', 'chrome-extension-github.pem');

function computeExtensionIdFromManifestKey(keyBase64) {
  const der = Buffer.from(String(keyBase64).replace(/\s/g, ''), 'base64');
  const hash = crypto.createHash('sha256').update(der).digest();
  let id = '';
  for (let i = 0; i < 16; i += 1) {
    const byte = hash[i];
    id += String.fromCharCode(97 + (byte >> 4));
    id += String.fromCharCode(97 + (byte & 0x0f));
  }
  return id;
}

function isValidExtensionId(id) {
  return ID_REGEX.test(String(id || '').trim());
}

function readExtensionManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function resolveGitHubExtensionId() {
  const manifest = readExtensionManifest();
  if (manifest.key) {
    const id = computeExtensionIdFromManifestKey(manifest.key);
    if (!isValidExtensionId(id)) {
      throw new Error(`Computed invalid extension ID from manifest.key: ${id}`);
    }
    return id;
  }
  if (fs.existsSync(ID_FILE_PATH)) {
    const id = fs.readFileSync(ID_FILE_PATH, 'utf8').trim();
    if (!isValidExtensionId(id)) {
      throw new Error(`Invalid extension ID in EXTENSION_ID.txt: ${id}`);
    }
    return id;
  }
  return null;
}

function exportPublicKeyDerFromPrivatePem(privatePem) {
  const privateKey = crypto.createPrivateKey(privatePem);
  return crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
}

function ensurePrivateKeyPem() {
  const secretsDir = path.dirname(PEM_PATH);
  if (!fs.existsSync(secretsDir)) {
    fs.mkdirSync(secretsDir, { recursive: true });
  }
  if (fs.existsSync(PEM_PATH)) {
    return fs.readFileSync(PEM_PATH, 'utf8');
  }
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  fs.writeFileSync(PEM_PATH, privateKey, { mode: 0o600 });
  return privateKey;
}

function initExtensionIdentity() {
  const privatePem = ensurePrivateKeyPem();
  const publicDer = exportPublicKeyDerFromPrivatePem(privatePem);
  const keyBase64 = publicDer.toString('base64');
  const extensionId = computeExtensionIdFromManifestKey(keyBase64);
  if (!isValidExtensionId(extensionId)) {
    throw new Error(`Generated invalid extension ID: ${extensionId}`);
  }

  const manifest = readExtensionManifest();
  manifest.key = keyBase64;
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(ID_FILE_PATH, `${extensionId}\n`, 'utf8');

  return { extensionId, keyBase64, pemPath: PEM_PATH };
}

function verifyExtensionIdentity() {
  const manifest = readExtensionManifest();
  if (!manifest.key) {
    throw new Error('manifest.json is missing "key"');
  }
  const computed = computeExtensionIdFromManifestKey(manifest.key);
  if (!isValidExtensionId(computed)) {
    throw new Error(`Computed invalid extension ID: ${computed}`);
  }
  if (!fs.existsSync(ID_FILE_PATH)) {
    throw new Error('extension/EXTENSION_ID.txt is missing');
  }
  const expected = fs.readFileSync(ID_FILE_PATH, 'utf8').trim();
  if (!isValidExtensionId(expected)) {
    throw new Error(`EXTENSION_ID.txt contains invalid ID: ${expected}`);
  }
  if (computed !== expected) {
    throw new Error(`Extension ID mismatch: manifest.key => ${computed}, EXTENSION_ID.txt => ${expected}`);
  }
  return { extensionId: computed };
}

module.exports = {
  ID_REGEX,
  ROOT,
  EXT_DIR,
  MANIFEST_PATH,
  ID_FILE_PATH,
  PEM_PATH,
  computeExtensionIdFromManifestKey,
  isValidExtensionId,
  resolveGitHubExtensionId,
  initExtensionIdentity,
  verifyExtensionIdentity
};

if (require.main === module) {
  const cmd = process.argv[2] || 'resolve';
  try {
    if (cmd === 'resolve') {
      const id = resolveGitHubExtensionId();
      if (!id) {
        console.error('Extension ID not found. Run scripts/init-extension-identity.ps1 first.');
        process.exit(1);
      }
      process.stdout.write(`${id}\n`);
    } else if (cmd === 'init') {
      const result = initExtensionIdentity();
      console.log(`Extension ID: ${result.extensionId}`);
      console.log(`Updated: ${MANIFEST_PATH}`);
      console.log(`Updated: ${ID_FILE_PATH}`);
      console.log(`Private key: ${result.pemPath} (not committed)`);
    } else if (cmd === 'verify') {
      const result = verifyExtensionIdentity();
      console.log(`OK: extension ID ${result.extensionId}`);
    } else {
      console.error(`Unknown command: ${cmd}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`FAIL: ${err.message}`);
    process.exit(1);
  }
}
