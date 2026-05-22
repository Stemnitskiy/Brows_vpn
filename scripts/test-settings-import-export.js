#!/usr/bin/env node
/**
 * Verifies settings import/export validation.
 * Run: node scripts/test-settings-import-export.js
 */

const path = require('path');
const BrowsValidators = require(path.join(__dirname, '../extension/validators.js'));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    return;
  }
  failed++;
  console.error('FAIL:', message);
}

const sampleVless =
  'vless://11111111-1111-1111-1111-111111111111@example.com:443?type=grpc&security=reality&pbk=abc&sni=example.com&serviceName=grpc';

const stored = {
  operationMode: 'selective',
  domainList: ['2ip.ru', 'google.com'],
  excludeList: ['localhost'],
  routingPresets: { tld_ru: true },
  routingRulesCustom: [{ pattern: 'google.com', action: 'proxy' }],
  socksPort: 10808,
  logLevel: 'info',
  autoReconnect: true,
  profiles: [{ id: 'prof_a', name: 'Main', protocol: 'vless', vless_url: sampleVless }],
  activeProfileId: 'prof_a',
  vlessConfig: sampleVless
};

console.log('=== buildSettingsExport ===');
const exported = BrowsValidators.buildSettingsExport(stored);
assert(exported.version === 1, 'export version');
assert(exported.app === 'Brows VPN', 'export app');
assert(exported.settings.domainList.length === 2, 'export domains');
assert(exported.settings.profiles.length === 1, 'export profiles');
console.log('OK  export shape');

console.log('\n=== validateSettingsImport ===');
const valid = BrowsValidators.validateSettingsImport(exported);
assert(valid.ok, 'valid import: ' + (valid.errors || []).join('; '));
assert(valid.preview.domainCount === 2, 'preview domain count');
assert(valid.settings.operationMode === 'selective', 'normalized mode');
console.log('OK  valid import');

console.log('\n=== invalid import ===');
const bad = BrowsValidators.parseSettingsImportText('{not json');
assert(!bad.ok, 'reject bad json');

const wrongVersion = BrowsValidators.validateSettingsImport({ version: 99, settings: {} });
assert(!wrongVersion.ok, 'reject wrong version');

const badMode = BrowsValidators.validateSettingsImport({
  version: 1,
  settings: { operationMode: 'invalid', domainList: [], profiles: [] }
});
assert(!badMode.ok, 'reject bad mode');
console.log('OK  invalid cases');

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
