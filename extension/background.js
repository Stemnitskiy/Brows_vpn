// Background service worker for Brows VPN
importScripts('validators.js');

console.log('Brows VPN background script loaded');

const MAX_LOG_ENTRIES = 300;

class DiagnosticLog {
  static async add(level, component, message, data = null) {
    const stored = await chrome.storage.local.get(['diagnosticLogs', 'debugLogging']);
    const debugOn = !!stored.debugLogging;

    if (level === 'debug' && !debugOn) {
      return;
    }
    if (level === 'info' && !debugOn && component === 'request') {
      return;
    }

    const safeData = data != null ? BrowsValidators.redactDiagnosticData(data) : null;
    const entry = {
      time: new Date().toISOString(),
      level,
      component,
      message,
      data: safeData
    };

    const logs = stored.diagnosticLogs || [];
    logs.push(entry);
    if (logs.length > MAX_LOG_ENTRIES) {
      logs.splice(0, logs.length - MAX_LOG_ENTRIES);
    }
    await chrome.storage.local.set({ diagnosticLogs: logs });

    if (level === 'debug' && !debugOn) return;

    const prefix = `[BrowsVPN:${component}]`;
    const dataSuffix = safeData != null ? (typeof safeData === 'string' ? safeData : JSON.stringify(safeData)) : '';
    if (level === 'error') console.error(prefix, message, dataSuffix);
    else if (level === 'warn') console.warn(prefix, message, dataSuffix);
    else if (debugOn || level === 'error' || level === 'warn') {
      console.log(prefix, message, dataSuffix);
    }
  }
}

function formatNativeHostError(rawMessage) {
  const msg = String(rawMessage || '');
  const runtimeId = chrome.runtime.id;

  if (/forbidden/i.test(msg)) {
    return (
      'Chrome отклонил native host (allowed_origins не совпадает с ID расширения). ' +
      `Текущий ID: ${runtimeId}. ` +
      'Запустите: cd proxy-service && .\\install.ps1 -Build ' +
      `(или .\\install.ps1 -ExtensionId ${runtimeId} -Build), затем перезапустите Chrome.`
    );
  }
  if (/specified native messaging host|native messaging host.*not found|native host.*not found/i.test(msg)) {
    return (
      'Native host не зарегистрирован. ' +
      'Запустите: cd proxy-service && .\\install.bat, затем перезапустите Chrome.'
    );
  }
  if (/access denied for extension origin/i.test(msg)) {
    return (
      'Go-сервис отклонил origin расширения. ' +
      `Переустановите: .\\install.ps1 -ExtensionId ${runtimeId} -Build`
    );
  }
  return msg;
}

function isNativeConnectionError(message) {
  const msg = String(message || '');
  if (/xray binary not found|xray\.exe|preflight|vless/i.test(msg)) {
    return false;
  }
  return (
    /specified native messaging host/i.test(msg) ||
    (/forbidden/i.test(msg) && /native messaging|extension/i.test(msg)) ||
    /access denied for extension origin/i.test(msg) ||
    /native messaging host.*not found/i.test(msg)
  );
}

function formatPreflightFailure(checks) {
  const errors = (checks || []).filter((c) => !c.ok && c.level === 'error');
  if (!errors.length) {
    return 'Проверка Go-сервиса не пройдена';
  }
  const xray = errors.find((c) => c.id === 'xray_binary' || /xray binary not found/i.test(c.message));
  if (xray) {
    return (
      'Не найден xray.exe. Скачайте Xray-core (Windows 64) и положите файл в ' +
      'proxy-service\\xray-core\\xray.exe — https://github.com/XTLS/Xray-core/releases'
    );
  }
  return errors.map((c) => c.message).join('; ');
}

class NativeMessagingClient {
  constructor(hostName = 'com.browsvpn.host') {
    this.hostName = hostName;
    this.port = null;
    this.pending = new Map();
  }

  connect() {
    if (this.port) {
      return Promise.resolve(this.port);
    }

    return new Promise((resolve, reject) => {
      try {
        const port = chrome.runtime.connectNative(this.hostName);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        this.port = port;

        port.onMessage.addListener((response) => {
          const id = response.message_id;
          if (id && this.pending.has(id)) {
            const { resolve: res, reject: rej } = this.pending.get(id);
            this.pending.delete(id);
            if (response.payload?.status === 'error') {
              const err = new Error(response.payload.error?.message || 'Ошибка native host');
              err.nativeData = response.payload.data;
              rej(err);
            } else {
              res(response);
            }
          }
        });

        port.onDisconnect.addListener(() => {
          const err = chrome.runtime.lastError?.message || 'Native host disconnected';
          for (const [, { reject: rej }] of this.pending) {
            rej(new Error(err));
          }
          this.pending.clear();
          this.port = null;
        });

        resolve(port);
      } catch (error) {
        reject(error);
      }
    });
  }

  async sendMessage(message) {
    await this.connect();

    const enhancedMessage = {
      version: '1.0',
      message_type: message.type || 'command',
      timestamp: new Date().toISOString(),
      message_id: this.generateMessageId(),
      payload: message.payload || {}
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(enhancedMessage.message_id);
        reject(new Error('Таймаут native messaging (10 с)'));
      }, 10000);

      this.pending.set(enhancedMessage.message_id, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      try {
        this.port.postMessage(enhancedMessage);
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(enhancedMessage.message_id);
        reject(error);
      }
    });
  }

  generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
  }

  async enableVPN(vlessConfig, mode, socksPort) {
    return this.sendMessage({
      type: 'command',
      payload: {
        command: 'enable_vpn',
        config: { vless_url: vlessConfig, mode, socks_port: socksPort }
      }
    });
  }

  async disableVPN() {
    return this.sendMessage({
      type: 'command',
      payload: { command: 'disable_vpn' }
    });
  }

  async getStatus() {
    return this.sendMessage({
      type: 'command',
      payload: { command: 'get_status' }
    });
  }

  async getLogs() {
    return this.sendMessage({
      type: 'command',
      payload: { command: 'get_logs' }
    });
  }

  async preflight(vlessConfig, socksPort) {
    return this.sendMessage({
      type: 'command',
      payload: {
        command: 'preflight',
        config: { vless_url: vlessConfig, socks_port: socksPort }
      }
    });
  }

  async healthCheck() {
    return this.sendMessage({
      type: 'command',
      payload: { command: 'health_check' }
    });
  }

  async findFreePort(preferredPort = 10808) {
    return this.sendMessage({
      type: 'command',
      payload: { command: 'find_free_port', preferred_port: preferredPort }
    });
  }
}

const nativeMessaging = new NativeMessagingClient();

let vpnState = {
  enabled: false,
  mode: 'selective',
  vlessConfig: null,
  profiles: [],
  activeProfileId: null,
  domains: [],
  excludeDomains: [],
  routingPresets: {},
  routingRulesCustom: [],
  routingRules: [],
  socksPort: 10808,
  connectionStatus: 'disconnected',
  lastError: null,
  autoReconnect: true,
  debugLogging: false,
  lastPacScript: null,
  lastHealth: null
};

const HEALTH_ALARM = 'browsvpn-health-check';
const CONTEXT_MENU_ADD = 'browsvpn-add-domain';
const CONTEXT_MENU_EXCLUDE = 'browsvpn-exclude-domain';
const MAX_RECOVERY_ATTEMPTS = 3;
const RECOVERY_BACKOFF_MS = [2000, 5000, 10000];

let enableInProgress = false;
let recoveryInProgress = false;
let recoveryAttemptCount = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const EXTERNAL_IP_URL = 'https://api.ipify.org?format=text';
const EXTERNAL_IP_TTL_MS = 45000;
const RUNTIME_STATUS_TTL_MS = 15000;

const externalIpCache = { ip: null, fetchedAt: 0 };
const runtimeStatusCache = { data: null, fetchedAt: 0 };

function isValidPublicIP(value) {
  if (!value || typeof value !== 'string') return false;
  const ip = value.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return true;
  if (/^[\da-f:]+$/i.test(ip) && ip.includes(':')) return true;
  return false;
}

function invalidateConnectionCaches() {
  externalIpCache.ip = null;
  externalIpCache.fetchedAt = 0;
  runtimeStatusCache.data = null;
  runtimeStatusCache.fetchedAt = 0;
}

async function fetchExternalIP(force = false) {
  const now = Date.now();
  if (!force && externalIpCache.ip && now - externalIpCache.fetchedAt < EXTERNAL_IP_TTL_MS) {
    return { ip: externalIpCache.ip, cached: true };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(EXTERNAL_IP_URL, {
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    const ip = (await response.text()).trim();
    if (!isValidPublicIP(ip)) {
      throw new Error('Некорректный ответ сервиса IP');
    }

    externalIpCache.ip = ip;
    externalIpCache.fetchedAt = Date.now();
    return { ip, cached: false };
  } catch (error) {
    const stale = externalIpCache.ip && now - externalIpCache.fetchedAt < EXTERNAL_IP_TTL_MS * 2;
    return {
      ip: stale ? externalIpCache.ip : null,
      error: error.name === 'AbortError' ? 'Таймаут запроса IP' : error.message,
      cached: stale
    };
  }
}

async function getRuntimeStatus(force = false) {
  const now = Date.now();
  if (!force && runtimeStatusCache.data && now - runtimeStatusCache.fetchedAt < RUNTIME_STATUS_TTL_MS) {
    return { ...runtimeStatusCache.data, cached: true };
  }

  try {
    const resp = await nativeMessaging.healthCheck();
    const runtime = resp.payload?.data?.runtime;
    const checks = runtime?.checks || [];
    const xrayOk = checks.some((c) => c.id === 'xray_process' && c.ok);
    const socksOk = checks.some((c) => c.id === 'socks_listen' && c.ok);
    const data = {
      xrayOk,
      socksOk,
      nativeOk: runtime?.ok !== false
    };
    runtimeStatusCache.data = data;
    runtimeStatusCache.fetchedAt = now;
    return { ...data, cached: false };
  } catch (error) {
    return {
      xrayOk: false,
      socksOk: false,
      nativeOk: false,
      error: error.message,
      cached: false
    };
  }
}

async function getConnectionInfo(force = false) {
  await loadSettings();

  const ipPromise = fetchExternalIP(force);
  const runtimePromise = vpnState.enabled ? getRuntimeStatus(force) : Promise.resolve(null);
  const [ipResult, runtime] = await Promise.all([ipPromise, runtimePromise]);

  return {
    enabled: vpnState.enabled,
    socksPort: vpnState.socksPort,
    externalIp: ipResult.ip,
    ipCached: !!ipResult.cached,
    ipError: ipResult.error || null,
    xrayOk: runtime?.xrayOk ?? false,
    socksOk: runtime?.socksOk ?? false,
    runtimeCached: !!runtime?.cached,
    runtimeError: runtime?.error || null
  };
}

function runLocalChecks() {
  const checks = [];

  const vless = BrowsValidators.validateVlessUrl(vpnState.vlessConfig || '');
  checks.push({
    id: 'vless_local',
    ok: vless.ok,
    level: vless.ok ? 'info' : 'error',
    message: vless.ok ? 'Формат VLESS URL корректен' : vless.errors.join('; ')
  });

  const port = BrowsValidators.validateSocksPort(vpnState.socksPort);
  checks.push({
    id: 'socks_port_local',
    ok: port.ok && port.warnings.length === 0,
    level: port.errors.length ? 'error' : (port.warnings.length ? 'warn' : 'info'),
    message: port.errors.concat(port.warnings).join('; ') || `SOCKS-порт ${port.port} в порядке`
  });

  if (vpnState.mode === 'selective') {
    if (vpnState.domains.length === 0) {
      checks.push({ id: 'whitelist', ok: false, level: 'error', message: 'Выборочный режим: список доменов пуст' });
    } else {
      checks.push({ id: 'whitelist', ok: true, level: 'info', message: `В белом списке ${vpnState.domains.length} домен(ов)` });
    }
    if (vpnState.routingRules.length) {
      checks.push({
        id: 'routing_rules',
        ok: true,
        level: 'info',
        message: `Правил маршрутизации: ${vpnState.routingRules.length}`
      });
    }
  }

  if (vpnState.mode === 'global_exclude') {
    checks.push({
      id: 'exclude_list',
      ok: true,
      level: 'info',
      message: vpnState.excludeDomains.length
        ? `В исключениях ${vpnState.excludeDomains.length} домен(ов)`
        : 'Исключений нет — весь трафик через VPN'
    });
  }

  if (vpnState.mode === 'disabled') {
    checks.push({ id: 'mode', ok: false, level: 'error', message: 'Режим работы — «Отключён»' });
  }

  const ok = checks.every((c) => c.ok || c.level === 'warn');
  return { ok, checks };
}

async function verifyProxySettings(expectedMode) {
  const current = await chrome.proxy.settings.get({});
  const level = current.value?.mode;
  const hasPac = level === 'pac_script' && current.value?.pacScript?.data;
  await DiagnosticLog.add(hasPac ? 'info' : 'error', 'proxy-verify', 'Proxy settings verification', {
    level,
    hasPac,
    expectedMode
  });
  return { ok: !!hasPac, level, pacLength: current.value?.pacScript?.data?.length || 0 };
}

async function runHealthMonitor() {
  if (!vpnState.enabled) return;

  await loadSettings();
  const local = runLocalChecks();
  let nativeOk = true;
  let nativeMsg = '';

  try {
    const resp = await nativeMessaging.healthCheck();
    const runtime = resp.payload?.data?.runtime;
    nativeOk = runtime?.ok !== false;
    if (!nativeOk && runtime?.checks) {
      nativeMsg = runtime.checks.filter((c) => !c.ok).map((c) => c.message).join('; ');
    }
  } catch (e) {
    nativeOk = false;
    nativeMsg = e.message;
  }

  const proxy = await verifyProxySettings(vpnState.mode);
  vpnState.lastHealth = { local, nativeOk, nativeMsg, proxy, at: new Date().toISOString() };

  if (!nativeOk || !proxy.ok) {
    vpnState.connectionStatus = 'error';
    vpnState.lastError = nativeMsg || 'Сбой проверки работоспособности';
    await DiagnosticLog.add('error', 'health', 'Health monitor failed', vpnState.lastHealth);
    if (vpnState.autoReconnect && !recoveryInProgress && !enableInProgress) {
      recoveryInProgress = true;
      await DiagnosticLog.add('info', 'health', 'Starting recovery sequence');
      try {
        await attemptRecovery();
      } finally {
        recoveryInProgress = false;
      }
    }
  } else {
    recoveryAttemptCount = 0;
    await DiagnosticLog.add('debug', 'health', 'Health OK');
  }
}

async function giveUpRecovery(message) {
  recoveryAttemptCount = 0;
  await DiagnosticLog.add('error', 'recovery', 'Recovery exhausted — disabling VPN', { message });
  await disableVPN();
  vpnState.lastError = message;
  vpnState.connectionStatus = 'error';
}

async function attemptRecovery() {
  await loadSettings();

  const local = runLocalChecks();
  if (!local.ok) {
    const err = local.checks.filter((c) => !c.ok && c.level === 'error').map((c) => c.message).join('; ');
    await giveUpRecovery(
      err || 'Автовосстановление отменено: исправьте настройки (VLESS, режим, списки доменов)'
    );
    return;
  }

  for (let attempt = 1; attempt <= MAX_RECOVERY_ATTEMPTS; attempt++) {
    recoveryAttemptCount = attempt;
    const backoff = RECOVERY_BACKOFF_MS[attempt - 1] || 10000;
    await DiagnosticLog.add('info', 'recovery', `Попытка ${attempt}/${MAX_RECOVERY_ATTEMPTS}`, {
      backoffMs: attempt > 1 ? backoff : 0
    });

    if (attempt > 1) {
      await sleep(backoff);
    }

    const result = await enableVPN({ isRecovery: true });
    if (result.success) {
      recoveryAttemptCount = 0;
      vpnState.connectionStatus = 'enabled';
      vpnState.lastError = null;
      await DiagnosticLog.add('info', 'recovery', 'Соединение восстановлено');
      return;
    }

    await DiagnosticLog.add('warn', 'recovery', `Попытка ${attempt} не удалась`, { error: result.error });
  }

  await giveUpRecovery(
    'VPN отключён: не удалось восстановить соединение после ' + MAX_RECOVERY_ATTEMPTS + ' попыток'
  );
}

function startHealthAlarm() {
  chrome.alarms.create(HEALTH_ALARM, { periodInMinutes: 1 });
}

function stopHealthAlarm() {
  chrome.alarms.clear(HEALTH_ALARM);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEALTH_ALARM) {
    runHealthMonitor();
  }
});

let webRequestListener = null;

function pacRouteForHost(host, mode, domains) {
  return BrowsValidators.pacRouteForHost(
    host, mode, domains, vpnState.socksPort, vpnState.excludeDomains, vpnState.routingRules
  );
}

async function setProxy(mode, domains = [], socksPort = 10808, excludeDomains = [], routingRules = []) {
  const safePort = BrowsValidators.sanitizeSocksPort(socksPort, vpnState.socksPort);
  const pacScript = BrowsValidators.generatePACScript(
    mode, domains, safePort, excludeDomains, routingRules
  );
  vpnState.lastPacScript = pacScript;

  if (vpnState.debugLogging) {
    await DiagnosticLog.add('debug', 'proxy', 'Applying PAC', {
      mode,
      socksPort: safePort,
      domainCount: domains.length,
      excludeCount: excludeDomains.length,
      routingRuleCount: routingRules.length
    });
  }

  const proxyValue = {
    mode: 'pac_script',
    pacScript: { data: pacScript, mandatory: true }
  };

  await chrome.proxy.settings.set({ scope: 'regular', value: proxyValue });

  if (await chrome.extension.isAllowedIncognitoAccess()) {
    await chrome.proxy.settings.set({ scope: 'incognito', value: proxyValue });
  }

  return pacScript;
}

async function clearProxy() {
  await chrome.proxy.settings.clear({ scope: 'regular' });
  if (await chrome.extension.isAllowedIncognitoAccess()) {
    await chrome.proxy.settings.clear({ scope: 'incognito' });
  }
  await restoreWebRtcPolicy();
  await DiagnosticLog.add('info', 'proxy', 'Proxy settings cleared');
}

const WEBRTC_POLICY_VPN = 'disable_non_proxied_udp';
let webRtcPolicyBeforeVpn = null;

async function applyWebRtcPolicyForVpn() {
  if (!chrome.privacy?.network?.webRTCIPHandlingPolicy) return;
  try {
    if (webRtcPolicyBeforeVpn === null) {
      webRtcPolicyBeforeVpn = await chrome.privacy.network.webRTCIPHandlingPolicy.get({});
    }
    await chrome.privacy.network.webRTCIPHandlingPolicy.set({
      value: WEBRTC_POLICY_VPN,
      scope: 'regular'
    });
    if (await chrome.extension.isAllowedIncognitoAccess()) {
      await chrome.privacy.network.webRTCIPHandlingPolicy.set({
        value: WEBRTC_POLICY_VPN,
        scope: 'incognito'
      });
    }
  } catch (e) {
    await DiagnosticLog.add('warn', 'privacy', 'WebRTC policy not applied', { error: e.message });
  }
}

async function restoreWebRtcPolicy() {
  if (!chrome.privacy?.network?.webRTCIPHandlingPolicy || webRtcPolicyBeforeVpn === null) return;
  try {
    const prev = webRtcPolicyBeforeVpn.value || 'default';
    await chrome.privacy.network.webRTCIPHandlingPolicy.set({
      value: prev,
      scope: 'regular'
    });
    if (await chrome.extension.isAllowedIncognitoAccess()) {
      await chrome.privacy.network.webRTCIPHandlingPolicy.set({
        value: prev,
        scope: 'incognito'
      });
    }
  } catch (_) { /* ignore */ }
  webRtcPolicyBeforeVpn = null;
}

async function loadSettings() {
  const data = await chrome.storage.local.get([
    'vlessConfig',
    'profiles',
    'activeProfileId',
    'operationMode',
    'domainList',
    'excludeList',
    'routingPresets',
    'routingRulesCustom',
    'socksPort',
    'autoReconnect',
    'debugLogging'
  ]);

  const migrated = BrowsValidators.migrateProfilesFromLegacy(
    data.profiles,
    data.vlessConfig,
    data.activeProfileId
  );
  vpnState.profiles = migrated.profiles;
  vpnState.activeProfileId = migrated.activeProfileId;
  vpnState.vlessConfig = BrowsValidators.activeProfileVlessUrl(
    vpnState.profiles,
    vpnState.activeProfileId
  ) || data.vlessConfig || null;

  if (data.operationMode) vpnState.mode = data.operationMode;
  if (data.domainList) vpnState.domains = data.domainList;
  if (Array.isArray(data.excludeList)) vpnState.excludeDomains = data.excludeList;
  vpnState.routingPresets = data.routingPresets && typeof data.routingPresets === 'object'
    ? data.routingPresets
    : {};
  vpnState.routingRulesCustom = Array.isArray(data.routingRulesCustom) ? data.routingRulesCustom : [];
  vpnState.routingRules = BrowsValidators.buildRoutingRules(
    vpnState.routingPresets,
    vpnState.routingRulesCustom
  );
  if (data.socksPort) {
    vpnState.socksPort = BrowsValidators.sanitizeSocksPort(data.socksPort);
  }
  if (data.autoReconnect !== undefined) vpnState.autoReconnect = data.autoReconnect;
  if (data.debugLogging !== undefined) vpnState.debugLogging = data.debugLogging;

  updateWebRequestDebug(vpnState.debugLogging);
}

function updateWebRequestDebug(enabled) {
  if (webRequestListener) {
    chrome.webRequest.onBeforeRequest.removeListener(webRequestListener);
    webRequestListener = null;
  }
  if (!enabled) return;

  webRequestListener = (details) => {
    if (!vpnState.enabled) return;
    try {
      const host = new URL(details.url).hostname;
      const route = pacRouteForHost(host, vpnState.mode, vpnState.domains);
      DiagnosticLog.add('debug', 'request', `${details.method} ${host}`, {
        route,
        url: details.url,
        tabId: details.tabId
      });
    } catch (_) { /* ignore */ }
  };

  chrome.webRequest.onBeforeRequest.addListener(
    webRequestListener,
    { urls: ['http://*/*', 'https://*/*'] }
  );
}

async function enableVPN(options = {}) {
  const isRecovery = !!options.isRecovery;
  if (enableInProgress) {
    return { success: false, error: 'Включение VPN уже выполняется' };
  }
  enableInProgress = true;
  await loadSettings();
  if (!isRecovery) {
    recoveryAttemptCount = 0;
  }
  vpnState.lastError = null;

  try {
    const local = runLocalChecks();
    await DiagnosticLog.add('info', 'preflight', 'Extension checks', local);
    if (!local.ok) {
      const err = local.checks.filter((c) => !c.ok && c.level === 'error').map((c) => c.message).join('; ');
      throw new Error(err || 'Локальная проверка не пройдена');
    }

    if (!vpnState.vlessConfig) {
      throw new Error('VLESS не настроен. Откройте настройки и сохраните vless:// URL.');
    }

    await DiagnosticLog.add('info', 'vpn', 'Enabling VPN', {
      mode: vpnState.mode,
      socksPort: vpnState.socksPort,
      domains: vpnState.domains
    });

    let preflightResp;
    try {
      preflightResp = await nativeMessaging.preflight(vpnState.vlessConfig, vpnState.socksPort);
      const pf = preflightResp.payload?.data?.preflight;
      await DiagnosticLog.add(pf?.ok ? 'info' : 'error', 'preflight', pf?.ok ? 'Native preflight OK' : 'Native preflight failed', pf);
      if (pf && !pf.ok) {
        throw new Error(formatPreflightFailure(pf.checks));
      }
    } catch (e) {
      if (isNativeConnectionError(e.message)) {
        throw new Error('Нет связи с Go-сервисом: ' + formatNativeHostError(e.message));
      }
      throw e;
    }

    const response = await nativeMessaging.enableVPN(
      vpnState.vlessConfig,
      vpnState.mode,
      vpnState.socksPort
    );

    await DiagnosticLog.add('info', 'native', 'enable_vpn response', response.payload?.data);

    if (response.payload?.status !== 'success') {
      const detail = response.payload?.data?.runtime || response.payload?.data?.preflight;
      const extra = detail?.checks?.filter((c) => !c.ok).map((c) => c.message).join('; ');
      throw new Error(response.payload?.error?.message || extra || 'Ошибка native host');
    }

    const pacScript = await setProxy(
      vpnState.mode,
      vpnState.domains,
      vpnState.socksPort,
      vpnState.excludeDomains,
      vpnState.routingRules
    );
    const proxyVerify = await verifyProxySettings(vpnState.mode);
    if (!proxyVerify.ok) {
      throw new Error('PAC-прокси не применился в Chrome');
    }

    const whitelistCheck = BrowsValidators.verifyWhitelistRoutes(
      vpnState.mode,
      vpnState.domains,
      vpnState.socksPort,
      vpnState.excludeDomains,
      vpnState.routingRules
    );
    if (!whitelistCheck.ok) {
      const detail = whitelistCheck.failures
        .map((f) => `${f.pattern} (${f.host} → ${f.route})`)
        .join('; ');
      throw new Error('Не все домены из белого списка идут через VPN: ' + detail);
    }

    const excludeCheck = BrowsValidators.verifyExcludeRoutes(
      vpnState.mode, vpnState.excludeDomains, vpnState.socksPort
    );
    if (!excludeCheck.ok) {
      const detail = excludeCheck.failures
        .map((f) => `${f.pattern} (${f.host} → ${f.route})`)
        .join('; ');
      throw new Error('Ошибка списка исключений: ' + detail);
    }

    await applyWebRtcPolicyForVpn();

    for (const domain of vpnState.domains) {
      const host = BrowsValidators.sampleHostForPattern(domain);
      const route = BrowsValidators.pacRouteForHost(
        host,
        vpnState.mode,
        vpnState.domains,
        vpnState.socksPort,
        vpnState.excludeDomains,
        vpnState.routingRules
      );
      await DiagnosticLog.add('info', 'pac-test', `Whitelist "${domain}"`, { host, route });
    }

    vpnState.enabled = true;
    vpnState.connectionStatus = 'enabled';
    invalidateConnectionCaches();
    startHealthAlarm();
    await updateActionBadge();
    await DiagnosticLog.add('info', 'vpn', 'VPN enabled', { pacLength: pacScript.length });
    return { success: true };
  } catch (error) {
    await DiagnosticLog.add('error', 'vpn', isRecovery ? 'Recovery enable failed' : 'Enable failed', {
      error: error.message,
      attempt: isRecovery ? recoveryAttemptCount : null
    });
    vpnState.connectionStatus = 'error';
    vpnState.lastError = error.message;
    if (!isRecovery) {
      stopHealthAlarm();
    }
    return { success: false, error: error.message, details: error.nativeData };
  } finally {
    enableInProgress = false;
    await updateActionBadge();
  }
}

async function disableVPN() {
  try {
    stopHealthAlarm();
    await nativeMessaging.disableVPN().catch((e) => {
      DiagnosticLog.add('warn', 'native', 'disable_vpn error', { error: e.message });
    });
    await clearProxy();
    invalidateConnectionCaches();
    vpnState.enabled = false;
    vpnState.connectionStatus = 'disabled';
    vpnState.lastError = null;
    await updateActionBadge();
    await DiagnosticLog.add('info', 'vpn', 'VPN disabled');
    return { success: true };
  } catch (error) {
    vpnState.lastError = error.message;
    return { success: false, error: error.message };
  }
}

async function getDiagnostics(testHost = '') {
  await loadSettings();

  const lines = [];
  const push = (title, body) => {
    lines.push(`=== ${title} ===`);
    const safe =
      typeof body === 'string'
        ? body
        : JSON.stringify(BrowsValidators.redactDiagnosticData(body), null, 2);
    lines.push(safe);
    lines.push('');
  };

  push('Состояние VPN', {
    enabled: vpnState.enabled,
    mode: vpnState.mode,
    socksPort: vpnState.socksPort,
    domainCount: vpnState.domains.length,
    excludeCount: vpnState.excludeDomains.length,
    routingRuleCount: vpnState.routingRules.length,
    vlessConfig: BrowsValidators.redactVlessUrl(vpnState.vlessConfig),
    status: vpnState.connectionStatus,
    lastError: vpnState.lastError,
    recoveryAttemptCount
  });

  push('Локальная проверка', runLocalChecks());

  if (testHost) {
    push(`PAC: ${testHost}`, pacRouteForHost(testHost, vpnState.mode, vpnState.domains));
  }

  try {
    const proxySettings = await chrome.proxy.settings.get({ incognito: false });
    push('Настройки proxy Chrome', {
      levelOfControl: proxySettings.levelOfControl,
      mode: proxySettings.value?.mode
    });
  } catch (e) {
    push('Настройки proxy Chrome', e.message);
  }

  try {
    const pf = await nativeMessaging.preflight(vpnState.vlessConfig || '', vpnState.socksPort);
    push('Preflight Go-сервиса', pf.payload?.data?.preflight);
  } catch (e) {
    push('Preflight Go-сервиса', `ОШИБКА: ${e.message}`);
  }

  try {
    const hc = await nativeMessaging.healthCheck();
    push('Health check', hc.payload?.data);
  } catch (e) {
    push('Health check', `ОШИБКА: ${e.message}`);
  }

  try {
    const status = await nativeMessaging.getStatus();
    push('Статус Go-сервиса', status.payload?.data);
  } catch (e) {
    push('Статус Go-сервиса', `ОШИБКА: ${e.message}`);
  }

  try {
    const logs = await nativeMessaging.getLogs();
    const data = logs.payload?.data || {};
    push('Xray запущен', data.xray_running);
    push('Xray error.log (хвост, redacted)', data.error_log || '(нет)');
    push('Go app.log (хвост, redacted)', data.app_log || '(нет)');
    push('Примечание', 'access.log и полный PAC намеренно скрыты. Включите debug для подробных логов.');
  } catch (e) {
    push('Логи Go-сервиса', `ОШИБКА: ${e.message}`);
  }

  const stored = await chrome.storage.local.get(['diagnosticLogs']);
  const extLogs = (stored.diagnosticLogs || [])
    .slice(-80)
    .map((e) => {
      const dataStr = e.data ? ' ' + JSON.stringify(BrowsValidators.redactDiagnosticData(e.data)) : '';
      return `${e.time} [${e.level}] ${e.component}: ${e.message}${dataStr}`;
    })
    .join('\n');
  push('Лог расширения (последние 80)', extLogs || '(пусто)');

  return { text: lines.join('\n') };
}

async function persistProfiles() {
  await chrome.storage.local.set({
    profiles: vpnState.profiles,
    activeProfileId: vpnState.activeProfileId,
    vlessConfig: vpnState.vlessConfig
  });
}

async function setActiveProfile(profileId) {
  await loadSettings();
  const profile = vpnState.profiles.find((p) => p.id === profileId);
  if (!profile) {
    return { success: false, error: 'Профиль не найден' };
  }
  vpnState.activeProfileId = profileId;
  vpnState.vlessConfig = profile.vless_url;
  await persistProfiles();
  invalidateConnectionCaches();
  if (vpnState.enabled) {
    await reapplyProxyIfEnabled();
  }
  return { success: true, profileId, profileName: profile.name };
}

async function reapplyProxyIfEnabled() {
  if (!vpnState.enabled) return;
  await setProxy(
    vpnState.mode,
    vpnState.domains,
    vpnState.socksPort,
    vpnState.excludeDomains,
    vpnState.routingRules
  );
  await DiagnosticLog.add('info', 'proxy', 'PAC re-applied after settings change');
  await updateActionBadge();
}

async function getActiveTabHost() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  const hostname = BrowsValidators.hostnameFromUrl(tab.url);
  if (!hostname) return null;
  const apex = BrowsValidators.toWhitelistDomain(hostname);
  if (!apex.ok) return { hostname, domain: null, tabId: tab.id, error: apex.error };
  return { hostname, domain: apex.domain, tabId: tab.id };
}

async function updateActionBadge(tabHostname = null) {
  try {
    if (!vpnState.enabled) {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }

    if (vpnState.mode === 'global') {
      await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
      await chrome.action.setBadgeText({ text: 'ON' });
      return;
    }

    if (vpnState.mode === 'global_exclude') {
      let host = tabHostname;
      if (!host) {
        const tab = await getActiveTabHost();
        host = tab?.hostname || null;
      }
      if (!host) {
        await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
        await chrome.action.setBadgeText({ text: 'ON' });
        return;
      }
      const viaVpn = BrowsValidators.isHostProxied(
        host,
        vpnState.mode,
        vpnState.domains,
        vpnState.socksPort,
        vpnState.excludeDomains,
        vpnState.routingRules
      );
      if (viaVpn) {
        await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
        await chrome.action.setBadgeText({ text: 'OK' });
      } else {
        await chrome.action.setBadgeBackgroundColor({ color: '#64748B' });
        await chrome.action.setBadgeText({ text: '--' });
      }
      return;
    }

    if (vpnState.mode === 'disabled') {
      await chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
      await chrome.action.setBadgeText({ text: '!' });
      return;
    }

    let host = tabHostname;
    if (!host) {
      const tab = await getActiveTabHost();
      host = tab?.hostname || null;
    }

    if (!host) {
      await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
      await chrome.action.setBadgeText({ text: 'ON' });
      return;
    }

    const viaVpn = BrowsValidators.isHostProxied(
      host,
      vpnState.mode,
      vpnState.domains,
      vpnState.socksPort,
      vpnState.excludeDomains,
      vpnState.routingRules
    );

    if (viaVpn) {
      await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
      await chrome.action.setBadgeText({ text: 'OK' });
    } else {
      await chrome.action.setBadgeBackgroundColor({ color: '#64748B' });
      await chrome.action.setBadgeText({ text: '--' });
    }
  } catch (e) {
    console.warn('[BrowsVPN] badge update failed', e);
  }
}

async function addDomainToWhitelist(domain) {
  await loadSettings();

  if (vpnState.mode !== 'selective') {
    return { success: false, error: 'Добавление сайтов доступно только в выборочном режиме' };
  }

  const normalized = BrowsValidators.normalizeDomain(domain);
  if (!normalized.ok) {
    return { success: false, error: normalized.error };
  }

  const d = normalized.domain;
  const exact = vpnState.domains.some((x) => x.toLowerCase() === d);

  const probeHost = d.startsWith('*.') ? 'www.' + d.slice(2) : 'www.' + d;
  const covered = BrowsValidators.pacRouteForHost(
    probeHost,
    'selective',
    vpnState.domains,
    vpnState.socksPort,
    [],
    vpnState.routingRules
  ).includes('SOCKS');

  if (exact || covered) {
    return {
      success: true,
      alreadyListed: true,
      domain: d,
      domainCount: vpnState.domains.length
    };
  }

  vpnState.domains = [...vpnState.domains, d];
  await chrome.storage.local.set({ domainList: vpnState.domains });
  await reapplyProxyIfEnabled();
  await DiagnosticLog.add('info', 'whitelist', `Added domain ${d}`, { domains: vpnState.domains });

  return {
    success: true,
    alreadyListed: false,
    domain: d,
    domainCount: vpnState.domains.length
  };
}

async function addCurrentTabToWhitelist() {
  const tab = await getActiveTabHost();
  if (!tab) {
    return { success: false, error: 'Нет активной вкладки с сайтом' };
  }
  if (!tab.domain) {
    return { success: false, error: tab.error || 'Не удалось определить домен' };
  }
  const result = await addDomainToWhitelist(tab.domain);
  return { ...result, hostname: tab.hostname };
}

async function addDomainToExcludeList(domain) {
  await loadSettings();

  if (vpnState.mode !== 'global_exclude') {
    return {
      success: false,
      error: 'Исключения доступны только в режиме «Глобальный с исключениями»'
    };
  }

  const normalized = BrowsValidators.normalizeDomain(domain);
  if (!normalized.ok) {
    return { success: false, error: normalized.error };
  }

  const d = normalized.domain;
  if (vpnState.excludeDomains.some((x) => x.toLowerCase() === d)) {
    return {
      success: true,
      alreadyListed: true,
      domain: d,
      excludeCount: vpnState.excludeDomains.length
    };
  }

  vpnState.excludeDomains = [...vpnState.excludeDomains, d];
  await chrome.storage.local.set({ excludeList: vpnState.excludeDomains });
  await reapplyProxyIfEnabled();
  await DiagnosticLog.add('info', 'exclude', `Added exclude ${d}`, {
    excludeDomains: vpnState.excludeDomains
  });

  return {
    success: true,
    alreadyListed: false,
    domain: d,
    excludeCount: vpnState.excludeDomains.length
  };
}

function resolveDomainFromContext(info, tab) {
  const url = info.linkUrl || info.pageUrl || tab?.url;
  if (!url) {
    return { ok: false, error: 'URL страницы недоступен' };
  }
  const hostname = BrowsValidators.hostnameFromUrl(url);
  if (!hostname) {
    return { ok: false, error: 'Контекстное меню работает только на http(s) сайтах' };
  }
  const apex = BrowsValidators.toWhitelistDomain(hostname);
  if (!apex.ok) {
    return { ok: false, error: apex.error };
  }
  return { ok: true, domain: apex.domain, hostname };
}

async function setupContextMenus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ADD,
    title: 'Добавить домен в VPN',
    contexts: ['page', 'link']
  });
  chrome.contextMenus.create({
    id: CONTEXT_MENU_EXCLUDE,
    title: 'Исключить домен из VPN',
    contexts: ['page', 'link']
  });
}

async function updateContextMenuVisibility() {
  await loadSettings();
  const addVisible = vpnState.mode === 'selective';
  const excludeVisible = vpnState.mode === 'global_exclude';
  try {
    await chrome.contextMenus.update(CONTEXT_MENU_ADD, { visible: addVisible });
    await chrome.contextMenus.update(CONTEXT_MENU_EXCLUDE, { visible: excludeVisible });
  } catch (e) {
    await setupContextMenus();
    await chrome.contextMenus.update(CONTEXT_MENU_ADD, { visible: addVisible });
    await chrome.contextMenus.update(CONTEXT_MENU_EXCLUDE, { visible: excludeVisible });
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const resolved = resolveDomainFromContext(info, tab);
  if (!resolved.ok) {
    await DiagnosticLog.add('warn', 'context-menu', resolved.error);
    return;
  }

  let result;
  if (info.menuItemId === CONTEXT_MENU_ADD) {
    result = await addDomainToWhitelist(resolved.domain);
  } else if (info.menuItemId === CONTEXT_MENU_EXCLUDE) {
    result = await addDomainToExcludeList(resolved.domain);
  } else {
    return;
  }

  if (result.success) {
    const msg = result.alreadyListed
      ? `Домен уже в списке: ${resolved.domain}`
      : `Добавлено: ${resolved.domain}`;
    await DiagnosticLog.add('info', 'context-menu', msg, result);
    await updateActionBadge(resolved.hostname);
  } else {
    await DiagnosticLog.add('warn', 'context-menu', result.error, { domain: resolved.domain });
  }
});

async function initExtensionState() {
  await loadSettings();
  await updateContextMenuVisibility();
  await updateActionBadge();
}

async function openOnboardingTab() {
  await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
}

async function openOnboardingIfNeeded(reason) {
  if (reason !== 'install') return;
  const data = await chrome.storage.local.get(['onboardingComplete']);
  if (!data.onboardingComplete) {
    await openOnboardingTab();
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await setupContextMenus();
  await initExtensionState();
  await openOnboardingIfNeeded(details.reason);
});
chrome.runtime.onStartup.addListener(() => initExtensionState());
initExtensionState();

chrome.tabs.onActivated.addListener(() => {
  loadSettings().then(() => updateActionBadge());
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.active || !tab.url) return;
  const host = BrowsValidators.hostnameFromUrl(tab.url);
  loadSettings().then(() => updateActionBadge(host));
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const privilegedActions = new Set([
    'enableVPN',
    'disableVPN',
    'updateSettings',
    'getDiagnostics',
    'setDebugLogging',
    'clearDiagnosticLogs',
    'findFreePort',
    'runPreflight',
    'setActiveProfile'
  ]);
  if (privilegedActions.has(request.action) && sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Forbidden' });
    return false;
  }

  if (request.action === 'completeOnboarding') {
    chrome.storage.local.set({ onboardingComplete: true }).then(async () => {
      await DiagnosticLog.add('info', 'onboarding', request.skipped ? 'Onboarding skipped' : 'Onboarding completed');
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'getOnboardingStatus') {
    chrome.storage.local.get(['onboardingComplete']).then((data) => {
      sendResponse({ complete: !!data.onboardingComplete });
    });
    return true;
  }

  if (request.action === 'setActiveProfile') {
    setActiveProfile(request.profileId).then(sendResponse);
    return true;
  }

  if (request.action === 'getConnectionInfo') {
    getConnectionInfo(!!request.force).then(sendResponse);
    return true;
  }

  if (request.action === 'getProxyStatus') {
    loadSettings().then(async () => {
      const tab = await getActiveTabHost();
      let inList = false;
      let whitelisted = false;
      if (tab?.hostname) {
        whitelisted = BrowsValidators.hostMatchesAnyPattern(tab.hostname, vpnState.domains);
        inList = BrowsValidators.isHostProxied(
          tab.hostname,
          vpnState.mode,
          vpnState.domains,
          vpnState.socksPort,
          vpnState.excludeDomains,
          vpnState.routingRules
        );
      }
      sendResponse({
        enabled: vpnState.enabled,
        mode: vpnState.mode,
        status: vpnState.connectionStatus,
        error: vpnState.lastError,
        domainCount: vpnState.domains.length,
        excludeCount: vpnState.excludeDomains.length,
        routingRuleCount: vpnState.routingRules.length,
        profiles: vpnState.profiles.map((p) => ({ id: p.id, name: p.name })),
        activeProfileId: vpnState.activeProfileId,
        currentTab: tab
          ? {
              hostname: tab.hostname,
              domain: tab.domain,
              inList,
              whitelisted,
              error: tab.error || null
            }
          : null,
        canAddSite: vpnState.mode === 'selective' && !!tab?.domain
      });
    });
    return true;
  }

  if (request.action === 'addCurrentSite') {
    addCurrentTabToWhitelist().then(sendResponse);
    return true;
  }

  if (request.action === 'enableVPN') {
    enableVPN().then(sendResponse);
    return true;
  }

  if (request.action === 'disableVPN') {
    disableVPN().then(sendResponse);
    return true;
  }

  if (request.action === 'findFreePort') {
    loadSettings().then(async () => {
      const preferred = request.preferredPort || vpnState.socksPort || 10808;
      try {
        const resp = await nativeMessaging.findFreePort(preferred);
        const port = resp.payload?.data?.port;
        if (port) {
          vpnState.socksPort = port;
          await chrome.storage.local.set({ socksPort: port });
          await reapplyProxyIfEnabled();
          sendResponse({ success: true, port });
        } else {
          sendResponse({ success: false, error: 'Свободный порт не найден' });
        }
      } catch (e) {
        sendResponse({
          success: false,
          error: 'Не удалось подобрать порт: ' + e.message
        });
      }
    });
    return true;
  }

  if (request.action === 'runPreflight') {
    loadSettings().then(async () => {
      const local = runLocalChecks();
      let native = null;
      try {
        const r = await nativeMessaging.preflight(vpnState.vlessConfig || '', vpnState.socksPort);
        native = r.payload?.data?.preflight;
      } catch (e) {
        native = { ok: false, error: e.message };
      }
      sendResponse({ local, native });
    });
    return true;
  }

  if (request.action === 'probeNativeHost') {
    nativeMessaging
      .getStatus()
      .then((response) => {
        const connected = response?.payload?.status === 'success';
        sendResponse({ ok: true, connected, data: response?.payload?.data || null });
      })
      .catch((error) => {
        sendResponse({ ok: true, connected: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'getDiagnostics') {
    getDiagnostics(request.testHost || '').then(sendResponse);
    return true;
  }

  if (request.action === 'clearDiagnosticLogs') {
    chrome.storage.local.set({ diagnosticLogs: [] }).then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === 'setDebugLogging') {
    vpnState.debugLogging = !!request.enabled;
    chrome.storage.local.set({ debugLogging: vpnState.debugLogging }).then(() => {
      updateWebRequestDebug(vpnState.debugLogging);
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'updateSettings') {
    loadSettings().then(async () => {
      const patch = {
        vlessConfig: request.vlessConfig,
        profiles: request.profiles,
        activeProfileId: request.activeProfileId,
        mode: request.mode,
        domains: request.domains,
        excludeDomains: request.excludeDomains,
        routingPresets: request.routingPresets,
        routingRulesCustom: request.routingRulesCustom,
        socksPort: request.socksPort
      };
      Object.keys(patch).forEach((k) => {
        if (patch[k] === undefined) delete patch[k];
      });

      const result = BrowsValidators.applySettingsUpdate(vpnState, patch);
      if (!result.ok) {
        sendResponse({ success: false, error: result.errors.join('; ') });
        return;
      }

      const s = result.state;
      vpnState.vlessConfig = s.vlessConfig;
      vpnState.profiles = s.profiles;
      vpnState.activeProfileId = s.activeProfileId;
      vpnState.mode = s.mode;
      vpnState.domains = s.domains;
      vpnState.excludeDomains = s.excludeDomains;
      vpnState.routingPresets = s.routingPresets;
      vpnState.routingRulesCustom = s.routingRulesCustom;
      vpnState.routingRules = s.routingRules;
      vpnState.socksPort = s.socksPort;

      await chrome.storage.local.set({
        vlessConfig: vpnState.vlessConfig,
        profiles: vpnState.profiles,
        activeProfileId: vpnState.activeProfileId,
        operationMode: vpnState.mode,
        domainList: vpnState.domains,
        excludeList: vpnState.excludeDomains,
        routingPresets: vpnState.routingPresets,
        routingRulesCustom: vpnState.routingRulesCustom,
        socksPort: vpnState.socksPort
      });

      await reapplyProxyIfEnabled();
      await updateContextMenuVisibility();
      sendResponse({ success: true, warnings: result.warnings });
    });
    return true;
  }

  return false;
});

chrome.proxy.onProxyError.addListener(async (error) => {
  await DiagnosticLog.add('error', 'proxy-error', 'Chrome proxy error', error);
  if (vpnState.enabled && vpnState.autoReconnect && !recoveryInProgress && !enableInProgress) {
    recoveryInProgress = true;
    try {
      await attemptRecovery();
    } finally {
      recoveryInProgress = false;
    }
  }
});
