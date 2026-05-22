// Background service worker for Brows VPN
importScripts('validators.js');

console.log('Brows VPN background script loaded');

const MAX_LOG_ENTRIES = 300;

class DiagnosticLog {
  static async add(level, component, message, data = null) {
    const entry = {
      time: new Date().toISOString(),
      level,
      component,
      message,
      data
    };
    const stored = await chrome.storage.local.get(['diagnosticLogs', 'debugLogging']);
    const logs = stored.diagnosticLogs || [];
    logs.push(entry);
    if (logs.length > MAX_LOG_ENTRIES) {
      logs.splice(0, logs.length - MAX_LOG_ENTRIES);
    }
    await chrome.storage.local.set({ diagnosticLogs: logs });

    const prefix = `[BrowsVPN:${component}]`;
    if (level === 'error') console.error(prefix, message, data || '');
    else if (level === 'warn') console.warn(prefix, message, data || '');
    else console.log(prefix, message, data || '');
  }
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
  domains: [],
  socksPort: 10808,
  connectionStatus: 'disconnected',
  lastError: null,
  autoReconnect: true,
  debugLogging: false,
  lastPacScript: null,
  lastHealth: null
};

const HEALTH_ALARM = 'browsvpn-health-check';
let enableInProgress = false;
let recoveryInProgress = false;

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
      checks.push({ id: 'whitelist', ok: true, level: 'info', message: `В списке ${vpnState.domains.length} домен(ов)` });
    }
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
      await DiagnosticLog.add('info', 'health', 'Attempting recovery reconnect');
      try {
        await enableVPN();
      } finally {
        recoveryInProgress = false;
      }
    }
  } else {
    await DiagnosticLog.add('debug', 'health', 'Health OK');
  }
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
  return BrowsValidators.pacRouteForHost(host, mode, domains, vpnState.socksPort);
}

async function setProxy(mode, domains = [], socksPort = 10808) {
  const pacScript = BrowsValidators.generatePACScript(mode, domains, socksPort);
  vpnState.lastPacScript = pacScript;

  await DiagnosticLog.add('info', 'proxy', 'Applying PAC', {
    mode,
    socksPort,
    domains,
    pacPreview: pacScript.slice(0, 500)
  });

  await chrome.proxy.settings.set({
    scope: 'regular',
    value: {
      mode: 'pac_script',
      pacScript: { data: pacScript, mandatory: true }
    }
  });

  const current = await chrome.proxy.settings.get({ incognito: false });
  await DiagnosticLog.add('info', 'proxy', 'Chrome proxy settings after set', current);

  return pacScript;
}

async function clearProxy() {
  await chrome.proxy.settings.clear({ scope: 'regular' });
  await DiagnosticLog.add('info', 'proxy', 'Proxy settings cleared');
}

async function loadSettings() {
  const data = await chrome.storage.local.get([
    'vlessConfig',
    'operationMode',
    'domainList',
    'socksPort',
    'autoReconnect',
    'debugLogging'
  ]);

  if (data.vlessConfig) vpnState.vlessConfig = data.vlessConfig;
  if (data.operationMode) vpnState.mode = data.operationMode;
  if (data.domainList) vpnState.domains = data.domainList;
  if (data.socksPort) vpnState.socksPort = data.socksPort;
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

async function enableVPN() {
  if (enableInProgress) {
    return { success: false, error: 'Включение VPN уже выполняется' };
  }
  enableInProgress = true;
  await loadSettings();
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
      await DiagnosticLog.add(pf?.ok ? 'info' : 'error', 'preflight', 'Native preflight', pf);
      if (pf && !pf.ok) {
        const err = (pf.checks || []).filter((c) => !c.ok && c.level === 'error').map((c) => c.message).join('; ');
        throw new Error(err || 'Проверка Go-сервиса не пройдена');
      }
    } catch (e) {
      if (e.message.includes('Native messaging') || e.message.includes('native')) {
        throw new Error('Нет связи с Go-сервисом: ' + e.message + '. Соберите: go build -o browsvpn-proxy.exe ./cmd');
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

    const pacScript = await setProxy(vpnState.mode, vpnState.domains, vpnState.socksPort);
    const proxyVerify = await verifyProxySettings(vpnState.mode);
    if (!proxyVerify.ok) {
      throw new Error('PAC-прокси не применился в Chrome');
    }

    const whitelistCheck = BrowsValidators.verifyWhitelistRoutes(
      vpnState.mode, vpnState.domains, vpnState.socksPort
    );
    if (!whitelistCheck.ok) {
      const detail = whitelistCheck.failures
        .map((f) => `${f.pattern} (${f.host} → ${f.route})`)
        .join('; ');
      throw new Error('Не все домены из белого списка идут через VPN: ' + detail);
    }

    for (const domain of vpnState.domains) {
      const host = BrowsValidators.sampleHostForPattern(domain);
      const route = BrowsValidators.pacRouteForHost(
        host, vpnState.mode, vpnState.domains, vpnState.socksPort
      );
      await DiagnosticLog.add('info', 'pac-test', `Whitelist "${domain}"`, { host, route });
    }

    vpnState.enabled = true;
    vpnState.connectionStatus = 'enabled';
    startHealthAlarm();
    await DiagnosticLog.add('info', 'vpn', 'VPN enabled', { pacLength: pacScript.length });
    return { success: true };
  } catch (error) {
    await DiagnosticLog.add('error', 'vpn', 'Enable failed', { error: error.message });
    vpnState.connectionStatus = 'error';
    vpnState.lastError = error.message;
    stopHealthAlarm();
    return { success: false, error: error.message, details: error.nativeData };
  } finally {
    enableInProgress = false;
  }
}

async function disableVPN() {
  try {
    stopHealthAlarm();
    await nativeMessaging.disableVPN().catch((e) => {
      DiagnosticLog.add('warn', 'native', 'disable_vpn error', { error: e.message });
    });
    await clearProxy();
    vpnState.enabled = false;
    vpnState.connectionStatus = 'disabled';
    vpnState.lastError = null;
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
    lines.push(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    lines.push('');
  };

  push('Состояние VPN', {
    enabled: vpnState.enabled,
    mode: vpnState.mode,
    socksPort: vpnState.socksPort,
    domains: vpnState.domains,
    status: vpnState.connectionStatus,
    lastError: vpnState.lastError,
    lastHealth: vpnState.lastHealth
  });

  push('Локальная проверка', runLocalChecks());

  if (testHost) {
    push(`PAC: ${testHost}`, pacRouteForHost(testHost, vpnState.mode, vpnState.domains));
  }

  try {
    const proxySettings = await chrome.proxy.settings.get({ incognito: false });
    push('Настройки proxy Chrome', proxySettings);
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
    push('Xray access.log (хвост)', data.access_log || '(нет)');
    push('Xray error.log (хвост)', data.error_log || '(нет)');
    push('Go app.log (хвост)', data.app_log || '(нет)');
  } catch (e) {
    push('Логи Go-сервиса', `ОШИБКА: ${e.message}`);
  }

  const stored = await chrome.storage.local.get(['diagnosticLogs']);
  const extLogs = (stored.diagnosticLogs || [])
    .slice(-80)
    .map((e) => `${e.time} [${e.level}] ${e.component}: ${e.message}${e.data ? ' ' + JSON.stringify(e.data) : ''}`)
    .join('\n');
  push('Лог расширения (последние 80)', extLogs || '(пусто)');

  if (vpnState.lastPacScript) {
    push('Текущий PAC-скрипт', vpnState.lastPacScript);
  }

  return { text: lines.join('\n') };
}

async function reapplyProxyIfEnabled() {
  if (!vpnState.enabled) return;
  await setProxy(vpnState.mode, vpnState.domains, vpnState.socksPort);
  await DiagnosticLog.add('info', 'proxy', 'PAC re-applied after settings change');
}

chrome.runtime.onInstalled.addListener(() => loadSettings());
chrome.runtime.onStartup.addListener(() => loadSettings());
loadSettings();

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'getProxyStatus') {
    loadSettings().then(() => {
      sendResponse({
        enabled: vpnState.enabled,
        mode: vpnState.mode,
        status: vpnState.connectionStatus,
        error: vpnState.lastError,
        domainCount: vpnState.domains.length
      });
    });
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
      if (request.vlessConfig) vpnState.vlessConfig = request.vlessConfig;
      if (request.mode) vpnState.mode = request.mode;
      if (request.domains) vpnState.domains = request.domains;
      if (request.socksPort) vpnState.socksPort = request.socksPort;

      await chrome.storage.local.set({
        vlessConfig: vpnState.vlessConfig,
        operationMode: vpnState.mode,
        domainList: vpnState.domains,
        socksPort: vpnState.socksPort
      });

      await reapplyProxyIfEnabled();
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});

chrome.proxy.onProxyError.addListener(async (error) => {
  await DiagnosticLog.add('error', 'proxy-error', 'Chrome proxy error', error);
  if (vpnState.enabled && vpnState.autoReconnect) {
    setTimeout(() => enableVPN(), 5000);
  }
});
