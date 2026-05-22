#!/usr/bin/env node
/**
 * Verifies selective whitelist: every listed domain is routed via SOCKS in PAC.
 * Run: node scripts/test-pac-whitelist.js
 */

const path = require('path');
const BrowsValidators = require(path.join(__dirname, '../extension/validators.js'));

const SOCKS = 10808;
const PROXY = `SOCKS5 127.0.0.1:${SOCKS}`;
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

const domains = ['2ip.ru', 'google.com', 'yandex.ru', '*.twitter.com'];
const mode = 'selective';

console.log('=== Whitelist routing (pacRouteForHost) ===');

for (const pattern of domains) {
  const host = BrowsValidators.sampleHostForPattern(pattern);
  const route = BrowsValidators.pacRouteForHost(host, mode, domains, SOCKS);
  assert(route === PROXY, `${pattern} → ${host} expected SOCKS, got ${route}`);
  console.log(`OK  ${pattern} → ${host} → ${route}`);
}

assert(
  BrowsValidators.pacRouteForHost('example.org', mode, domains, SOCKS) === 'DIRECT',
  'example.org should be DIRECT'
);
console.log('OK  example.org → DIRECT');

console.log('\n=== PAC script contains all whitelist entries ===');
const pac = BrowsValidators.generatePACScript(mode, domains, SOCKS);
for (const d of domains) {
  assert(pac.includes(JSON.stringify(d).slice(1, -1)) || pac.includes(`"${d}"`), `PAC missing ${d}`);
}
assert(
  (pac.match(/2ip\.ru/g) || []).length >= 1 && (pac.match(/google\.com/g) || []).length >= 1,
  'PAC should list multiple domains'
);
console.log('OK  all domains present in generated PAC');

console.log('\n=== PAC evaluation (FindProxyForURL) ===');
const cases = [
  ['2ip.ru', '2ip.ru', PROXY],
  ['google.com', 'www.google.com', PROXY],
  ['yandex.ru', 'yandex.ru', PROXY],
  ['*.twitter.com', 'api.twitter.com', PROXY],
  ['not-in-list', 'example.org', 'DIRECT']
];

for (const [pattern, host, expected] of cases) {
  if (pattern !== 'not-in-list') {
    const verify = BrowsValidators.verifyWhitelistRoutes(mode, domains, SOCKS);
    assert(verify.ok, 'verifyWhitelistRoutes should pass for full list');
  }
  const route = BrowsValidators.evaluatePacRoute(pac, `https://${host}/`, host);
  assert(route === expected, `${host} expected ${expected}, got ${route}`);
  console.log(`OK  ${host} → ${route}`);
}

console.log('\n=== validateDomainList (multi-line input) ===');
const parsed = BrowsValidators.validateDomainList('2ip.ru\ngoogle.com\nyandex.ru\n');
assert(parsed.ok && parsed.domains.length === 3, 'expected 3 domains from textarea');
const multiCheck = BrowsValidators.verifyWhitelistRoutes(mode, parsed.domains, SOCKS);
assert(multiCheck.ok, 'all parsed domains must route via SOCKS');
console.log('OK  3 domains parsed and verified');

console.log('=== toWhitelistDomain ===');
assert(BrowsValidators.toWhitelistDomain('www.2ip.ru').domain === '2ip.ru', 'www.2ip.ru → 2ip.ru');
assert(BrowsValidators.toWhitelistDomain('sub.2ip.ru').domain === '2ip.ru', 'sub.2ip.ru → 2ip.ru');
assert(BrowsValidators.hostnameFromUrl('chrome://settings') === null, 'chrome URL null');
console.log('OK  apex domain extraction');

console.log('\n=== global_exclude (blacklist) ===');
const excludes = ['2ip.ru', 'localhost'];
const modeEx = 'global_exclude';
assert(
  BrowsValidators.pacRouteForHost('2ip.ru', modeEx, [], SOCKS, excludes) === 'DIRECT',
  'excluded 2ip.ru → DIRECT'
);
assert(
  BrowsValidators.pacRouteForHost('google.com', modeEx, [], SOCKS, excludes).includes('SOCKS'),
  'google.com → SOCKS'
);
const pacEx = BrowsValidators.generatePACScript(modeEx, [], SOCKS, excludes);
assert(
  BrowsValidators.evaluatePacRoute(pacEx, 'https://2ip.ru/', '2ip.ru') === 'DIRECT',
  'PAC exclude 2ip.ru'
);
assert(
  BrowsValidators.evaluatePacRoute(pacEx, 'https://yandex.ru/', 'yandex.ru').includes('SOCKS'),
  'PAC yandex via SOCKS'
);
const exVerify = BrowsValidators.verifyExcludeRoutes(modeEx, excludes, SOCKS);
assert(exVerify.ok, 'verifyExcludeRoutes');
console.log('OK  global_exclude routing');

console.log('\n=== Smart routing rules (priority over whitelist) ===');
const rulesRuDirect = [{ pattern: '*.ru', action: 'direct' }];
const rulesWithProxy = [
  { pattern: '*.ru', action: 'direct' },
  { pattern: 'google.com', action: 'proxy' }
];
assert(
  BrowsValidators.pacRouteForHost('yandex.ru', mode, domains, SOCKS, [], rulesRuDirect) === 'DIRECT',
  'rule *.ru → yandex.ru DIRECT even if in whitelist'
);
assert(
  BrowsValidators.pacRouteForHost('google.com', mode, domains, SOCKS, [], rulesRuDirect) === PROXY,
  'google.com still SOCKS via whitelist'
);
assert(
  BrowsValidators.pacRouteForHost('google.com', mode, [], SOCKS, [], rulesWithProxy) === PROXY,
  'custom rule google.com proxy without whitelist'
);
const pacRules = BrowsValidators.generatePACScript(mode, domains, SOCKS, [], rulesRuDirect);
assert(
  BrowsValidators.evaluatePacRoute(pacRules, 'https://yandex.ru/', 'yandex.ru') === 'DIRECT',
  'PAC with *.ru rule'
);
console.log('OK  smart routing rules');

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
