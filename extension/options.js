// Options page script for Brows VPN

let profilesState = [];
let activeProfileIdState = null;
let pendingImportSettings = null;
let profileModalEditId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await BrowsTheme.loadAndApply();
  await loadSettings();

  document.getElementById('themeMode').addEventListener('change', async (e) => {
    await BrowsTheme.save(e.target.value);
    showToast('Тема сохранена', 'success');
  });

  setupModal('profileModal', { cancelIds: ['profileModalCancel'] });
  setupModal('connectionModal');
  setupModal('importExportModal');
  setupModal('diagnosticsModal');

  document.getElementById('openConnectionBtn').addEventListener('click', () => openModal('connectionModal'));
  document.getElementById('openImportExportBtn').addEventListener('click', () => openModal('importExportModal'));
  document.getElementById('openDiagnosticsBtn').addEventListener('click', async () => {
    openModal('diagnosticsModal');
    await refreshIdentityPanel();
    await refreshDiagnostics();
  });

  document.getElementById('restartOnboardingBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  });

  document.getElementById('debugLogging').addEventListener('change', async (e) => {
    const checkbox = e.target;
    if (checkbox.checked && !(await requestDebugRequestPermission())) {
      checkbox.checked = false;
      await chrome.runtime.sendMessage({ action: 'setDebugLogging', enabled: false });
      showToast('Разрешение на трассировку запросов не выдано', 'error');
      return;
    }

    const result = await chrome.runtime.sendMessage({
      action: 'setDebugLogging',
      enabled: checkbox.checked
    });
    if (result?.success === false) {
      checkbox.checked = false;
      showToast(result.error || 'Не удалось включить подробные логи', 'error');
      return;
    }
    showToast(checkbox.checked ? 'Подробные логи включены' : 'Подробные логи выключены', 'success');
  });

  document.getElementById('refreshLogsBtn').addEventListener('click', () => refreshDiagnostics());
  document.getElementById('clearLogsBtn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'clearDiagnosticLogs' });
    document.getElementById('diagnosticLog').value = '';
    showToast('Журнал очищен', 'success');
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

  document.querySelectorAll('input[name="operationMode"]').forEach((input) => {
    input.addEventListener('change', () => updateModeSections(getSelectedMode()));
  });

  document.getElementById('addProfileBtn').addEventListener('click', () => openProfileModal());

  document.getElementById('profileModalCancel').addEventListener('click', closeProfileModal);
  document.getElementById('profileModalValidate').addEventListener('click', validateProfileModal);
  document.getElementById('profileModalSave').addEventListener('click', saveProfileModal);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('profileModal').hidden) closeProfileModal();
    else closeTopModal();
  });

  document.getElementById('saveMode').addEventListener('click', async () => {
    const operationMode = getSelectedMode();

    await chrome.storage.local.set({ operationMode });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      mode: operationMode
    });

    updateModeSections(operationMode);
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

  document.getElementById('downloadExportBtn').addEventListener('click', async () => {
    if (!window.confirm('JSON будет содержать VLESS URL. Не публикуйте этот файл. Продолжить скачивание?')) {
      return;
    }
    await downloadSettingsExport(true);
  });

  document.getElementById('downloadExportSafeBtn').addEventListener('click', async () => {
    await downloadSettingsExport(false);
  });

  document.getElementById('exportClipboardBtn').addEventListener('click', async () => {
    const includeSecrets = document.getElementById('exportIncludeSecrets').checked;
    if (includeSecrets && !window.confirm('JSON будет содержать VLESS URL. Продолжить копирование в буфер обмена?')) {
      return;
    }
    try {
      const stored = await chrome.storage.local.get(null);
      const payload = BrowsValidators.buildSettingsExport(stored, { includeSecrets });
      const json = JSON.stringify(payload, null, 2);
      await navigator.clipboard.writeText(json);
      showToast(
        includeSecrets ? 'Настройки (с секретами) скопированы' : 'Настройки без секретов скопированы',
        'success'
      );
    } catch (error) {
      showToast('Не удалось скопировать: ' + error.message, 'error');
    }
  });

  async function downloadSettingsExport(includeSecrets) {
    try {
      const stored = await chrome.storage.local.get(null);
      const payload = BrowsValidators.buildSettingsExport(stored, { includeSecrets });
      const json = JSON.stringify(payload, null, 2);
      const stamp = new Date().toISOString().slice(0, 10);
      const suffix = includeSecrets ? '' : '-no-secrets';
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `brows-vpn-settings${suffix}-${stamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(includeSecrets ? 'Файл загружен' : 'Файл без секретов загружен', 'success');
    } catch (error) {
      showToast('Не удалось скачать: ' + error.message, 'error');
    }
  }

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

  function getSelectedMode() {
    const checked = document.querySelector('input[name="operationMode"]:checked');
    return checked ? checked.value : 'selective';
  }

  function setSelectedMode(mode) {
    const input = document.querySelector(`input[name="operationMode"][value="${mode}"]`);
    if (input) input.checked = true;
  }

  function updateModeSections(mode) {
    document.querySelectorAll('.section-mode').forEach((el) => {
      const modes = (el.dataset.modes || '').split(/\s+/).filter(Boolean);
      el.hidden = !modes.includes(mode);
    });
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

  async function requestDebugRequestPermission() {
    if (!chrome.permissions?.request) {
      return false;
    }
    try {
      return await chrome.permissions.request({
        permissions: ['webRequest'],
        origins: ['http://*/*', 'https://*/*']
      });
    } catch (_) {
      return false;
    }
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
      'theme'
    ]);

    const migrated = BrowsValidators.migrateProfilesFromLegacy(
      data.profiles,
      data.vlessConfig,
      data.activeProfileId
    );
    profilesState = migrated.profiles;
    activeProfileIdState = migrated.activeProfileId;
    renderProfileList();

    const mode = data.operationMode || 'selective';
    setSelectedMode(mode);
    updateModeSections(mode);

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
  }

  function renderProfileList() {
    const list = document.getElementById('profileList');
    list.innerHTML = '';

    if (!profilesState.length) {
      const empty = document.createElement('li');
      empty.className = 'profile-empty';
      empty.textContent = 'Нет профилей — нажмите «+ Новый»';
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

      const meta = document.createElement('div');
      meta.className = 'profile-meta';

      const nameEl = document.createElement('span');
      nameEl.className = 'profile-name-display';
      nameEl.textContent = profile.name || 'Без названия';

      const hintEl = document.createElement('span');
      hintEl.className = 'profile-url-hint';
      hintEl.textContent = formatProfileUrlHint(profile.vless_url);

      meta.append(nameEl, hintEl);

      const actions = document.createElement('div');
      actions.className = 'profile-item-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'profile-edit';
      editBtn.textContent = 'Изменить';
      editBtn.addEventListener('click', () => openProfileModal(profile.id));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'profile-delete';
      delBtn.textContent = 'Удалить';
      delBtn.addEventListener('click', () => deleteProfile(profile.id));

      actions.append(editBtn, delBtn);
      li.append(radio, meta, actions);
      list.appendChild(li);
    }
  }

  function formatProfileUrlHint(url) {
    if (!url || !url.trim()) return 'URL не задан';
    const trimmed = url.trim();
    if (trimmed.length <= 48) return trimmed;
    return trimmed.slice(0, 24) + '…' + trimmed.slice(-16);
  }

  function selectProfile(profileId) {
    activeProfileIdState = profileId;
    renderProfileList();
    saveProfilesToStorage();
  }

  function openProfileModal(profileId = null) {
    profileModalEditId = profileId;
    const modal = document.getElementById('profileModal');
    const title = document.getElementById('profileModalTitle');
    const nameInput = document.getElementById('profileModalName');
    const vlessInput = document.getElementById('profileModalVless');
    const errorEl = document.getElementById('profileModalError');

    if (profileId) {
      const profile = profilesState.find((p) => p.id === profileId);
      title.textContent = 'Редактирование профиля';
      nameInput.value = profile?.name || '';
      vlessInput.value = profile?.vless_url || '';
    } else {
      title.textContent = 'Новый профиль';
      nameInput.value = '';
      vlessInput.value = '';
    }

    errorEl.hidden = true;
    errorEl.textContent = '';
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    nameInput.focus();
  }

  function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    profileModalEditId = null;
  }

  function showProfileModalError(message) {
    const errorEl = document.getElementById('profileModalError');
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function validateProfileModal() {
    const vless = document.getElementById('profileModalVless').value.trim();
    if (!vless) {
      showProfileModalError('Введите VLESS URL');
      return false;
    }
    const v = BrowsValidators.validateVlessUrl(vless);
    if (!v.ok) {
      showProfileModalError(v.errors.join('; '));
      return false;
    }
    if (v.warnings.length) {
      showToast('Формат корректен. Предупреждения: ' + v.warnings.join('; '), 'success');
    } else {
      showToast('Формат конфигурации корректен', 'success');
    }
    showProfileModalError('');
    return true;
  }

  async function saveProfileModal() {
    const name = document.getElementById('profileModalName').value.trim();
    const vless = document.getElementById('profileModalVless').value.trim();

    if (!vless) {
      showProfileModalError('Введите VLESS URL');
      return;
    }

    const v = BrowsValidators.validateVlessUrl(vless);
    if (!v.ok) {
      showProfileModalError(v.errors.join('; '));
      return;
    }

    if (profileModalEditId) {
      const idx = profilesState.findIndex((p) => p.id === profileModalEditId);
      if (idx >= 0) {
        profilesState[idx] = {
          ...profilesState[idx],
          name: name || profilesState[idx].name,
          vless_url: vless
        };
      }
    } else {
      const id = BrowsValidators.generateProfileId();
      const n = profilesState.length + 1;
      profilesState.push({
        id,
        name: name || `Профиль ${n}`,
        protocol: 'vless',
        vless_url: vless
      });
      activeProfileIdState = id;
    }

    await saveProfilesToStorage();
    renderProfileList();

    const wasEdit = !!profileModalEditId;
    closeProfileModal();

    const msg = v.warnings.length
      ? 'Профиль сохранён. Предупреждения: ' + v.warnings.join('; ')
      : wasEdit ? 'Профиль обновлён' : 'Профиль добавлен';
    showToast(msg, 'success');
  }

  function deleteProfile(profileId) {
    if (profilesState.length <= 1) {
      showToast('Нельзя удалить единственный профиль', 'error');
      return;
    }
    profilesState = profilesState.filter((p) => p.id !== profileId);
    if (activeProfileIdState === profileId) {
      activeProfileIdState = profilesState[0]?.id || null;
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

  const MODAL_STACK = ['diagnosticsModal', 'importExportModal', 'connectionModal', 'profileModal'];

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  function closeTopModal() {
    for (const id of MODAL_STACK) {
      const modal = document.getElementById(id);
      if (modal && !modal.hidden) {
        if (id === 'profileModal') closeProfileModal();
        else closeModal(id);
        return;
      }
    }
  }

  function setupModal(id, { cancelIds = [] } = {}) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.querySelectorAll('[data-close="' + id + '"]').forEach((el) => {
      el.addEventListener('click', () => {
        if (id === 'profileModal') closeProfileModal();
        else closeModal(id);
      });
    });
    for (const cancelId of cancelIds) {
      const btn = document.getElementById(cancelId);
      if (btn) {
        btn.addEventListener('click', () => {
          if (id === 'profileModal') closeProfileModal();
          else closeModal(id);
        });
      }
    }
  }

  function formatChecks(report) {
    if (!report) return '(нет данных)';
    if (report.error) return report.error;
    return (report.checks || []).map((c) => `[${c.ok ? 'OK' : c.level}] ${c.id}: ${c.message}`).join('\n');
  }

  async function refreshIdentityPanel() {
    const runtimeId = chrome.runtime.id;
    document.getElementById('diagRuntimeId').textContent = runtimeId;

    let expectedId = '—';
    try {
      const resp = await fetch(chrome.runtime.getURL('EXTENSION_ID.txt'));
      if (resp.ok) {
        expectedId = (await resp.text()).trim();
      }
    } catch (_err) {
      expectedId = '(не найден EXTENSION_ID.txt)';
    }
    document.getElementById('diagExpectedId').textContent = expectedId;

    const mismatchEl = document.getElementById('diagIdMismatch');
    if (expectedId && /^[a-p]{32}$/.test(expectedId) && runtimeId !== expectedId) {
      mismatchEl.hidden = false;
      mismatchEl.textContent =
        `ID не совпадает. Переустановите native host: .\\install.ps1 -ExtensionId ${runtimeId} -Build`;
    } else {
      mismatchEl.hidden = true;
      mismatchEl.textContent = '';
    }

    const statusEl = document.getElementById('diagNativeHostStatus');
    statusEl.textContent = 'Проверка…';
    try {
      const probe = await chrome.runtime.sendMessage({ action: 'probeNativeHost' });
      if (probe?.ok) {
        statusEl.textContent = probe.connected ? 'Подключён' : 'Недоступен';
        statusEl.className = probe.connected ? 'diag-status ok' : 'diag-status warn';
      } else {
        statusEl.textContent = probe?.error || 'Ошибка проверки';
        statusEl.className = 'diag-status error';
      }
    } catch (err) {
      statusEl.textContent = err.message || 'Ошибка проверки';
      statusEl.className = 'diag-status error';
    }
  }

  async function refreshDiagnostics(testHost = '') {
    const result = await chrome.runtime.sendMessage({
      action: 'getDiagnostics',
      testHost: testHost || document.getElementById('testHost').value.trim()
    });
    document.getElementById('diagnosticLog').value = result.text || '(нет данных)';
  }

  function showPacResult(message, type) {
    const el = document.getElementById('pacTestResult');
    el.hidden = false;
    el.textContent = message;
    el.className = 'result-banner ' + type;
  }

  if (location.hash === '#diagnostics') {
    openModal('diagnosticsModal');
    await refreshIdentityPanel();
    await refreshDiagnostics();
    history.replaceState(null, '', location.pathname);
  }
});
