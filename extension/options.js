// Options page script for Brows VPN

let profilesState = [];
let activeProfileIdState = null;
let pendingImportSettings = null;

document.addEventListener('DOMContentLoaded', async () => {
  await BrowsTheme.loadAndApply();
  loadSettings();

  document.getElementById('themeMode').addEventListener('change', async (e) => {
    await BrowsTheme.save(e.target.value);
    showToast('Тема сохранена', 'success');
  });

  document.getElementById('restartOnboardingBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  });

  document.getElementById('addProfileBtn').addEventListener('click', () => {
    const id = BrowsValidators.generateProfileId();
    const n = profilesState.length + 1;
    const url = document.getElementById('vlessConfig').value.trim();
    profilesState.push({
      id,
      name: `Профиль ${n}`,
      protocol: 'vless',
      vless_url: url
    });
    activeProfileIdState = id;
    renderProfileList();
    saveProfilesToStorage();
    showToast('Профиль добавлен', 'success');
  });

  document.getElementById('saveConfig').addEventListener('click', async () => {
    const vlessConfig = document.getElementById('vlessConfig').value;

    if (vlessConfig) {
      try {
        const v = BrowsValidators.validateVlessUrl(vlessConfig);
        if (!v.ok) throw new Error(v.errors.join('; '));

        await syncActiveProfileUrl(vlessConfig);
        await chrome.storage.local.set({ vlessConfig });
        await chrome.runtime.sendMessage({
          action: 'updateSettings',
          vlessConfig,
          profiles: profilesState,
          activeProfileId: activeProfileIdState
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

  document.getElementById('saveExclude').addEventListener('click', async () => {
    const text = document.getElementById('excludeList').value;
    const parsed = BrowsValidators.validateDomainList(text);
    if (!parsed.ok) {
      showToast(parsed.errors.join('; '), 'error');
      return;
    }
    await chrome.storage.local.set({ excludeList: parsed.domains });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      excludeDomains: parsed.domains
    });
    showToast(`Сохранено исключений: ${parsed.domains.length}`, 'success');
  });

  document.getElementById('clearExclude').addEventListener('click', async () => {
    document.getElementById('excludeList').value = '';
    await chrome.storage.local.set({ excludeList: [] });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      excludeDomains: []
    });
    showToast('Список исключений очищен', 'success');
  });

  document.getElementById('saveRouting').addEventListener('click', async () => {
    const parsed = BrowsValidators.parseRoutingRulesText(
      document.getElementById('routingRules').value
    );
    if (!parsed.ok) {
      showToast(parsed.errors.join('; '), 'error');
      return;
    }
    const routingPresets = readRoutingPresets();
    await chrome.storage.local.set({
      routingPresets,
      routingRulesCustom: parsed.rules
    });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      routingPresets,
      routingRulesCustom: parsed.rules
    });
    const total = BrowsValidators.buildRoutingRules(routingPresets, parsed.rules).length;
    showToast(`Сохранено правил: ${total}`, 'success');
  });

  document.getElementById('clearRouting').addEventListener('click', async () => {
    document.getElementById('routingRules').value = '';
    const routingPresets = readRoutingPresets();
    await chrome.storage.local.set({ routingRulesCustom: [] });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      routingPresets,
      routingRulesCustom: []
    });
    showToast('Свои правила очищены', 'success');
  });

  document.getElementById('exportSettingsBtn').addEventListener('click', async () => {
    try {
      const stored = await chrome.storage.local.get(null);
      const payload = BrowsValidators.buildSettingsExport(stored);
      const json = JSON.stringify(payload, null, 2);
      await navigator.clipboard.writeText(json);
      showToast('Настройки скопированы в буфер обмена', 'success');
    } catch (error) {
      showToast('Не удалось экспортировать: ' + error.message, 'error');
    }
  });

  document.getElementById('downloadExportBtn').addEventListener('click', async () => {
    try {
      const stored = await chrome.storage.local.get(null);
      const payload = BrowsValidators.buildSettingsExport(stored);
      const json = JSON.stringify(payload, null, 2);
      const stamp = new Date().toISOString().slice(0, 10);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `brows-vpn-settings-${stamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Файл загружен', 'success');
    } catch (error) {
      showToast('Не удалось скачать: ' + error.message, 'error');
    }
  });

  document.getElementById('importFileBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      document.getElementById('importJson').value = text;
      previewImport(text);
    } catch (error) {
      showToast('Не удалось прочитать файл: ' + error.message, 'error');
    } finally {
      event.target.value = '';
    }
  });

  document.getElementById('previewImportBtn').addEventListener('click', () => {
    previewImport(document.getElementById('importJson').value);
  });

  document.getElementById('applyImportBtn').addEventListener('click', async () => {
    if (!pendingImportSettings) {
      showToast('Сначала выполните предпросмотр импорта', 'error');
      return;
    }
    const btn = document.getElementById('applyImportBtn');
    setButtonLoading(btn, true);
    try {
      await applyImportedSettings(pendingImportSettings);
      pendingImportSettings = null;
      document.getElementById('applyImportBtn').disabled = true;
      document.getElementById('importJson').value = '';
      hideImportPreview();
      showToast('Настройки импортированы', 'success');
    } catch (error) {
      showToast('Ошибка импорта: ' + error.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
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

  function readRoutingPresets() {
    return {
      tld_ru: document.getElementById('presetTldRu').checked,
      tld_local: document.getElementById('presetTldLocal').checked,
      localhost: document.getElementById('presetLocalhost').checked
    };
  }

  function setRoutingPresets(presets) {
    const p = presets || {};
    document.getElementById('presetTldRu').checked = !!p.tld_ru;
    document.getElementById('presetTldLocal').checked = !!p.tld_local;
    document.getElementById('presetLocalhost').checked = !!p.localhost;
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
      'logLevel',
      'autoReconnect',
      'debugLogging',
      'theme'
    ]);

    const migrated = BrowsValidators.migrateProfilesFromLegacy(
      data.profiles,
      data.vlessConfig,
      data.activeProfileId
    );
    profilesState = migrated.profiles;
    activeProfileIdState = migrated.activeProfileId;

    const activeUrl = BrowsValidators.activeProfileVlessUrl(profilesState, activeProfileIdState);
    document.getElementById('vlessConfig').value = activeUrl || data.vlessConfig || '';
    renderProfileList();

    if (data.operationMode) {
      setSelectedMode(data.operationMode);
    }

    if (data.domainList && Array.isArray(data.domainList)) {
      document.getElementById('domainList').value = data.domainList.join('\n');
    }

    if (data.excludeList && Array.isArray(data.excludeList)) {
      document.getElementById('excludeList').value = data.excludeList.join('\n');
    }

    setRoutingPresets(data.routingPresets);
    if (Array.isArray(data.routingRulesCustom) && data.routingRulesCustom.length) {
      document.getElementById('routingRules').value = data.routingRulesCustom
        .map((r) => `${r.pattern} ${r.action}`)
        .join('\n');
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

    const themeMode = data.theme || 'system';
    document.getElementById('themeMode').value = themeMode;
    BrowsTheme.apply(themeMode);

    refreshDiagnostics();
  }

  function renderProfileList() {
    const list = document.getElementById('profileList');
    list.innerHTML = '';

    if (!profilesState.length) {
      const empty = document.createElement('li');
      empty.className = 'profile-empty';
      empty.textContent = 'Нет профилей — нажмите «+ Новый» или сохраните VLESS URL';
      list.appendChild(empty);
      return;
    }

    for (const profile of profilesState) {
      const li = document.createElement('li');
      li.className = 'profile-item' + (profile.id === activeProfileIdState ? ' active' : '');

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'activeProfile';
      radio.value = profile.id;
      radio.checked = profile.id === activeProfileIdState;
      radio.addEventListener('change', () => selectProfile(profile.id));

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'profile-name-input';
      nameInput.value = profile.name;
      nameInput.title = 'Название профиля';
      nameInput.addEventListener('change', () => {
        profile.name = nameInput.value.trim() || profile.name;
        saveProfilesToStorage();
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'profile-delete';
      delBtn.textContent = 'Удалить';
      delBtn.addEventListener('click', () => deleteProfile(profile.id));

      li.append(radio, nameInput, delBtn);
      list.appendChild(li);
    }
  }

  function selectProfile(profileId) {
    activeProfileIdState = profileId;
    const profile = profilesState.find((p) => p.id === profileId);
    if (profile) {
      document.getElementById('vlessConfig').value = profile.vless_url || '';
    }
    renderProfileList();
    saveProfilesToStorage();
  }

  async function syncActiveProfileUrl(url) {
    if (!activeProfileIdState) {
      const id = BrowsValidators.generateProfileId();
      profilesState.push({
        id,
        name: 'Основной',
        protocol: 'vless',
        vless_url: url
      });
      activeProfileIdState = id;
    } else {
      const idx = profilesState.findIndex((p) => p.id === activeProfileIdState);
      if (idx >= 0) {
        profilesState[idx] = { ...profilesState[idx], vless_url: url };
      }
    }
    renderProfileList();
  }

  function deleteProfile(profileId) {
    if (profilesState.length <= 1) {
      showToast('Нельзя удалить единственный профиль', 'error');
      return;
    }
    profilesState = profilesState.filter((p) => p.id !== profileId);
    if (activeProfileIdState === profileId) {
      activeProfileIdState = profilesState[0]?.id || null;
      const profile = profilesState[0];
      document.getElementById('vlessConfig').value = profile?.vless_url || '';
    }
    renderProfileList();
    saveProfilesToStorage();
    showToast('Профиль удалён', 'success');
  }

  async function saveProfilesToStorage() {
    await chrome.storage.local.set({
      profiles: profilesState,
      activeProfileId: activeProfileIdState,
      vlessConfig: BrowsValidators.activeProfileVlessUrl(profilesState, activeProfileIdState)
    });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      profiles: profilesState,
      activeProfileId: activeProfileIdState,
      vlessConfig: BrowsValidators.activeProfileVlessUrl(profilesState, activeProfileIdState)
    });
  }

  function hideImportPreview() {
    const el = document.getElementById('importPreview');
    el.hidden = true;
    el.className = 'import-preview';
    el.innerHTML = '';
  }

  function previewImport(text) {
    const result = BrowsValidators.parseSettingsImportText(text);
    const el = document.getElementById('importPreview');
    el.hidden = false;

    if (!result.ok) {
      pendingImportSettings = null;
      document.getElementById('applyImportBtn').disabled = true;
      el.className = 'import-preview error';
      el.innerHTML =
        '<strong>Импорт невозможен</strong><ul>' +
        result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('') +
        '</ul>';
      return;
    }

    pendingImportSettings = result.settings;
    document.getElementById('applyImportBtn').disabled = false;
    el.className = 'import-preview';
    const p = result.preview;
    const modeLabels = {
      selective: 'Выборочный',
      global: 'Глобальный',
      global_exclude: 'Глобальный с исключениями',
      disabled: 'Отключён'
    };
    el.innerHTML = `
      <strong>Будет применено</strong>
      <ul>
        <li>Режим: ${escapeHtml(modeLabels[p.mode] || p.mode)}</li>
        <li>Доменов в whitelist: ${p.domainCount}</li>
        <li>Исключений: ${p.excludeCount}</li>
        <li>Правил маршрутизации: ${p.routingRuleCount}</li>
        <li>Профилей VLESS: ${p.profileCount}${p.profileNames.length ? ' (' + escapeHtml(p.profileNames.join(', ')) + ')' : ''}</li>
        <li>SOCKS-порт: ${p.socksPort}</li>
        <li>Автопереподключение: ${p.autoReconnect ? 'да' : 'нет'}</li>
        ${p.exportedAt ? `<li>Дата экспорта: ${escapeHtml(p.exportedAt)}</li>` : ''}
      </ul>
      ${
        result.warnings.length
          ? '<p class="preview-warn">' + result.warnings.map((w) => escapeHtml(w)).join('<br>') + '</p>'
          : ''
      }
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function applyImportedSettings(settings) {
    profilesState = settings.profiles || [];
    activeProfileIdState = settings.activeProfileId;

    await chrome.storage.local.set({
      operationMode: settings.operationMode,
      domainList: settings.domainList,
      excludeList: settings.excludeList,
      routingPresets: settings.routingPresets,
      routingRulesCustom: settings.routingRulesCustom,
      socksPort: settings.socksPort,
      logLevel: settings.logLevel,
      autoReconnect: settings.autoReconnect,
      theme: settings.theme,
      profiles: settings.profiles,
      activeProfileId: settings.activeProfileId,
      vlessConfig: settings.vlessConfig
    });

    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      mode: settings.operationMode,
      domains: settings.domainList,
      excludeDomains: settings.excludeList,
      routingPresets: settings.routingPresets,
      routingRulesCustom: settings.routingRulesCustom,
      socksPort: settings.socksPort,
      profiles: settings.profiles,
      activeProfileId: settings.activeProfileId,
      vlessConfig: settings.vlessConfig
    });

    await loadSettings();
    BrowsTheme.apply(settings.theme || 'system');
  }
});
