// Options page script for Brows VPN

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  document.getElementById('saveConfig').addEventListener('click', async () => {
    const vlessConfig = document.getElementById('vlessConfig').value;

    if (vlessConfig) {
      try {
        const v = BrowsValidators.validateVlessUrl(vlessConfig);
        if (!v.ok) throw new Error(v.errors.join('; '));

        await chrome.storage.local.set({ vlessConfig });
        await chrome.runtime.sendMessage({
          action: 'updateSettings',
          vlessConfig: vlessConfig
        });

        const msg = v.warnings.length
          ? 'Конфигурация сохранена. Предупреждения: ' + v.warnings.join('; ')
          : 'Конфигурация сохранена';
        showToast(msg, 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    } else {
      showToast('Введите VLESS URL', 'error');
    }
  });

  document.getElementById('validateConfig').addEventListener('click', () => {
    const vlessConfig = document.getElementById('vlessConfig').value;

    if (vlessConfig) {
      const v = BrowsValidators.validateVlessUrl(vlessConfig);
      if (v.ok) {
        const msg = v.warnings.length
          ? 'Формат корректен. Предупреждения: ' + v.warnings.join('; ')
          : 'Формат конфигурации корректен';
        showToast(msg, 'success');
      } else {
        showToast(v.errors.join('; '), 'error');
      }
    } else {
      showToast('Введите VLESS URL', 'error');
    }
  });

  document.getElementById('saveMode').addEventListener('click', async () => {
    const operationMode = getSelectedMode();

    await chrome.storage.local.set({ operationMode });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      mode: operationMode
    });

    showToast('Режим работы сохранён', 'success');
  });

  document.getElementById('saveDomains').addEventListener('click', async () => {
    const domainListText = document.getElementById('domainList').value;
    const parsed = BrowsValidators.validateDomainList(domainListText);
    if (!parsed.ok) {
      showToast(parsed.errors.join('; '), 'error');
      return;
    }
    const domainList = parsed.domains;

    await chrome.storage.local.set({ domainList });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      domains: domainList
    });

    showToast(`Сохранено доменов: ${domainList.length}`, 'success');
  });

  document.getElementById('clearDomains').addEventListener('click', async () => {
    document.getElementById('domainList').value = '';
    await chrome.storage.local.set({ domainList: [] });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      domains: []
    });

    showToast('Список доменов очищен', 'success');
  });

  document.getElementById('saveSettings').addEventListener('click', async () => {
    const socksPort = parseInt(document.getElementById('socksPort').value, 10);
    const portCheck = BrowsValidators.validateSocksPort(socksPort);
    if (!portCheck.ok) {
      showToast(portCheck.errors.join('; '), 'error');
      return;
    }
    const logLevel = document.getElementById('logLevel').value;
    const autoReconnect = document.getElementById('autoReconnect').checked;

    await chrome.storage.local.set({
      socksPort,
      logLevel,
      autoReconnect
    });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      socksPort
    });

    showToast(
      'Настройки подключения сохранены' +
        (portCheck.warnings.length ? '. Предупреждение: ' + portCheck.warnings.join('; ') : ''),
      'success'
    );
  });

  document.getElementById('autoPortBtn').addEventListener('click', async () => {
    const btn = document.getElementById('autoPortBtn');
    setButtonLoading(btn, true);
    try {
      const preferred = parseInt(document.getElementById('socksPort').value, 10) || 10808;
      const result = await chrome.runtime.sendMessage({
        action: 'findFreePort',
        preferredPort: preferred
      });
      if (result?.success && result.port) {
        document.getElementById('socksPort').value = result.port;
        showToast(`Подобран свободный порт: ${result.port}`, 'success');
      } else {
        showToast(result?.error || 'Не удалось подобрать порт', 'error');
      }
    } finally {
      setButtonLoading(btn, false);
    }
  });

  document.getElementById('runPreflightBtn').addEventListener('click', async () => {
    const btn = document.getElementById('runPreflightBtn');
    setButtonLoading(btn, true);
    try {
      const result = await chrome.runtime.sendMessage({ action: 'runPreflight' });
      const lines = ['=== Проверки расширения ===', formatChecks(result.local)];
      lines.push('=== Проверки Go-сервиса ===', formatChecks(result.native));
      document.getElementById('diagnosticLog').value = lines.join('\n');
      const allOk = result.local?.ok && result.native?.ok;
      showPacResult(
        allOk ? 'Все проверки пройдены' : 'Обнаружены проблемы — см. журнал',
        allOk ? 'success' : 'error'
      );
    } finally {
      setButtonLoading(btn, false);
    }
  });

  function formatChecks(report) {
    if (!report) return '(нет данных)';
    if (report.error) return report.error;
    return (report.checks || []).map((c) => `[${c.ok ? 'OK' : c.level}] ${c.id}: ${c.message}`).join('\n');
  }

  document.getElementById('debugLogging').addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({
      action: 'setDebugLogging',
      enabled: e.target.checked
    });
  });

  document.getElementById('refreshLogsBtn').addEventListener('click', () => refreshDiagnostics());

  document.getElementById('clearLogsBtn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'clearDiagnosticLogs' });
    document.getElementById('diagnosticLog').value = '';
    showToast('Журнал очищен', 'success');
  });

  document.getElementById('testPacBtn').addEventListener('click', async () => {
    const testHost = document.getElementById('testHost').value.trim();
    if (!testHost) {
      showPacResult('Введите имя хоста для проверки', 'error');
      return;
    }
    await refreshDiagnostics(testHost);
    const result = await chrome.runtime.sendMessage({
      action: 'getDiagnostics',
      testHost
    });
    const match = result.text.match(/=== PAC:.*?===\n([^\n=]+)/);
    const route = match ? match[1].trim() : 'неизвестно';
    showPacResult(`${testHost} → ${route}`, route.includes('SOCKS') ? 'success' : 'error');
  });

  async function refreshDiagnostics(testHost = '') {
    const result = await chrome.runtime.sendMessage({
      action: 'getDiagnostics',
      testHost: testHost || document.getElementById('testHost').value.trim()
    });
    document.getElementById('diagnosticLog').value = result.text || '(нет данных)';
  }

  function getSelectedMode() {
    const checked = document.querySelector('input[name="operationMode"]:checked');
    return checked ? checked.value : 'selective';
  }

  function setSelectedMode(mode) {
    const input = document.querySelector(`input[name="operationMode"][value="${mode}"]`);
    if (input) input.checked = true;
  }

  function showPacResult(message, type) {
    const el = document.getElementById('pacTestResult');
    el.hidden = false;
    el.textContent = message;
    el.className = 'result-banner ' + type;
  }

  function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast visible ' + type;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.className = 'toast';
      toast.textContent = '';
    }, 4500);
  }

  function setButtonLoading(btn, loading) {
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get([
      'vlessConfig',
      'operationMode',
      'domainList',
      'socksPort',
      'logLevel',
      'autoReconnect',
      'debugLogging'
    ]);

    if (data.vlessConfig) {
      document.getElementById('vlessConfig').value = data.vlessConfig;
    }

    if (data.operationMode) {
      setSelectedMode(data.operationMode);
    }

    if (data.domainList && Array.isArray(data.domainList)) {
      document.getElementById('domainList').value = data.domainList.join('\n');
    }

    if (data.socksPort) {
      document.getElementById('socksPort').value = data.socksPort;
    }

    if (data.logLevel) {
      document.getElementById('logLevel').value = data.logLevel;
    }

    if (data.autoReconnect !== undefined) {
      document.getElementById('autoReconnect').checked = data.autoReconnect;
    }

    if (data.debugLogging !== undefined) {
      document.getElementById('debugLogging').checked = data.debugLogging;
    }

    refreshDiagnostics();
  }
});
