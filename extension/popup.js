// Popup script for Brows VPN

document.addEventListener('DOMContentLoaded', async () => {
  await BrowsTheme.loadAndApply();

  const powerToggle = document.getElementById('powerToggle');
  const statusText = document.getElementById('statusText');
  const modeHint = document.getElementById('modeHint');
  const errorBox = document.getElementById('errorBox');
  const settingsBtn = document.getElementById('settingsBtn');
  const siteSection = document.getElementById('siteSection');
  const currentSiteEl = document.getElementById('currentSite');
  const siteStatusEl = document.getElementById('siteStatus');
  const addSiteBtn = document.getElementById('addSiteBtn');
  const siteHintEl = document.getElementById('siteHint');
  const connInfo = document.getElementById('connInfo');
  const externalIpEl = document.getElementById('externalIp');
  const ipSpinner = document.getElementById('ipSpinner');
  const xrayChip = document.getElementById('xrayChip');
  const socksChip = document.getElementById('socksChip');
  const profileSection = document.getElementById('profileSection');
  const profileSelect = document.getElementById('profileSelect');

  let lastMode = 'selective';
  let lastDomainCount = 0;
  let lastExcludeCount = 0;
  let currentTab = null;
  let vpnEnabled = false;
  let ipLoading = false;
  let lastConnectionInfo = null;
  let profiles = [];
  let activeProfileId = null;

  function formatModeHint(mode, domainCount, excludeCount) {
    if (mode === 'global') return 'Глобальный · весь трафик';
    if (mode === 'global_exclude') {
      if (excludeCount === 0) return 'Глобальный · исключений нет';
      const n = excludeCount;
      const word = n % 10 === 1 && n % 100 !== 11 ? 'исключение' :
        n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'исключения' : 'исключений';
      return `Глобальный · ${n} ${word}`;
    }
    if (mode === 'disabled') return 'Режим отключён в настройках';
    if (domainCount === 0) return 'Выборочный · список доменов пуст';
    const n = domainCount;
    const word = n % 10 === 1 && n % 100 !== 11 ? 'сайт' :
      n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'сайта' : 'сайтов';
    return `Выборочный · ${n} ${word}`;
  }

  function updateProfileSection(enabled) {
    if (enabled || profiles.length <= 1) {
      profileSection.classList.add('hidden');
      return;
    }
    profileSection.classList.remove('hidden');
    profileSelect.innerHTML = '';
    for (const profile of profiles) {
      const opt = document.createElement('option');
      opt.value = profile.id;
      opt.textContent = profile.name;
      if (profile.id === activeProfileId) opt.selected = true;
      profileSelect.appendChild(opt);
    }
    profileSelect.disabled = profileSelect.options.length === 0;
  }

  function setChip(el, text, state) {
    el.textContent = text;
    el.className = 'conn-chip ' + (state || 'off');
  }

  function updateConnectionUI(info, loading) {
    connInfo.classList.remove('hidden');

    ipSpinner.classList.toggle('hidden', !loading);
    externalIpEl.classList.toggle('loading', loading && !info?.externalIp);

    if (loading && !info?.externalIp) {
      externalIpEl.textContent = '…';
      externalIpEl.classList.remove('error');
    } else if (info?.ipError && !info?.externalIp) {
      externalIpEl.textContent = info.ipError;
      externalIpEl.classList.add('error');
    } else if (info?.externalIp) {
      externalIpEl.textContent = info.externalIp;
      externalIpEl.classList.remove('error');
    } else {
      externalIpEl.textContent = '—';
      externalIpEl.classList.remove('error');
    }

    if (!info?.enabled) {
      setChip(xrayChip, 'Xray выкл', 'off');
      setChip(socksChip, 'SOCKS выкл', 'off');
      return;
    }

    setChip(xrayChip, info.xrayOk ? 'Xray ✓' : 'Xray ✗', info.xrayOk ? 'ok' : 'fail');
    const port = info.socksPort || 10808;
    const socksLabel = info.socksOk ? `SOCKS :${port} ✓` : `SOCKS :${port} ✗`;
    setChip(socksChip, socksLabel, info.socksOk ? 'ok' : 'fail');
  }

  async function loadConnectionInfo(force = false) {
    ipLoading = true;
    updateConnectionUI(lastConnectionInfo || { enabled: vpnEnabled }, true);

    try {
      const info = await chrome.runtime.sendMessage({ action: 'getConnectionInfo', force });
      if (info) {
        lastConnectionInfo = info;
        updateConnectionUI(info, false);
      }
    } catch (_error) {
      updateConnectionUI({ enabled: vpnEnabled, ipError: 'Не удалось получить IP' }, false);
    } finally {
      ipLoading = false;
    }
  }

  function updateStatus(enabled, mode, domainCount, excludeCount) {
    vpnEnabled = enabled;
    powerToggle.classList.toggle('on', enabled);
    powerToggle.classList.toggle('off', !enabled);
    powerToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    powerToggle.setAttribute('aria-label', enabled ? 'Выключить VPN' : 'Включить VPN');

    statusText.textContent = enabled ? 'VPN включён' : 'VPN выключен';
    modeHint.textContent = formatModeHint(mode, domainCount, excludeCount);

    if (enabled) hideError();
    updateProfileSection(enabled);
    updateSiteSection(mode);
  }

  function updateSiteSection(mode) {
    if (mode !== 'selective') {
      siteSection.classList.add('hidden');
      if (mode === 'global') {
        siteHintEl.textContent = 'В глобальном режиме все сайты уже через VPN';
      } else if (mode === 'global_exclude') {
        siteHintEl.textContent = 'Исключения настраиваются в разделе «Список исключений»';
      } else {
        siteHintEl.textContent = 'Смените режим в настройках на «Выборочный»';
      }
      return;
    }

    siteSection.classList.remove('hidden');
    siteHintEl.textContent = 'Домен попадёт в белый список (например 2ip.ru)';

    if (!currentTab?.domain) {
      currentSiteEl.textContent = currentTab?.hostname || 'Страница недоступна';
      currentSiteEl.classList.add('muted');
      siteStatusEl.textContent = currentTab?.error || 'Откройте обычный http(s) сайт';
      siteStatusEl.className = 'site-status';
      addSiteBtn.disabled = true;
      addSiteBtn.textContent = 'Добавить сайт';
      addSiteBtn.classList.remove('added');
      return;
    }

    currentSiteEl.classList.remove('muted');
    currentSiteEl.textContent = currentTab.domain;
    if (currentTab.hostname !== currentTab.domain) {
      currentSiteEl.textContent = `${currentTab.domain} (${currentTab.hostname})`;
    }

    if (currentTab.inList) {
      siteStatusEl.textContent = currentTab.whitelisted ? 'В белом списке' : 'Через правило VPN';
      siteStatusEl.className = 'site-status in-list';
      addSiteBtn.disabled = true;
      addSiteBtn.textContent = currentTab.whitelisted ? 'В списке' : 'Через VPN';
      addSiteBtn.classList.add('added');
    } else if (currentTab.whitelisted) {
      siteStatusEl.textContent = 'Правило → напрямую';
      siteStatusEl.className = 'site-status';
      addSiteBtn.disabled = true;
      addSiteBtn.textContent = 'В списке';
      addSiteBtn.classList.add('added');
    } else {
      siteStatusEl.textContent = 'Не проксируется';
      siteStatusEl.className = 'site-status';
      addSiteBtn.disabled = false;
      addSiteBtn.textContent = 'Добавить сайт';
      addSiteBtn.classList.remove('added');
    }
  }

  function setLoading(loading) {
    powerToggle.classList.toggle('loading', loading);
    powerToggle.disabled = loading;
  }

  function showError(message) {
    errorBox.style.display = 'block';
    errorBox.textContent = message;
  }

  function hideError() {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }

  async function loadProxyStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getProxyStatus' });
      if (response) {
        lastMode = response.mode || 'selective';
        lastDomainCount = response.domainCount ?? 0;
        lastExcludeCount = response.excludeCount ?? 0;
        currentTab = response.currentTab || null;
        profiles = response.profiles || [];
        activeProfileId = response.activeProfileId || null;
        updateStatus(response.enabled, lastMode, lastDomainCount, lastExcludeCount);
        loadConnectionInfo();
        if (response.error) {
          showError(response.error);
        }
      }
    } catch (error) {
      showError('Нет связи с фоновым скриптом: ' + error.message);
      updateStatus(false, lastMode, lastDomainCount, lastExcludeCount);
    }
  }

  powerToggle.addEventListener('click', async () => {
    if (powerToggle.classList.contains('loading')) return;

    hideError();
    setLoading(true);
    const isOn = powerToggle.classList.contains('on');

    try {
      const action = isOn ? 'disableVPN' : 'enableVPN';
      const result = await chrome.runtime.sendMessage({ action });

      if (result?.success) {
        await loadProxyStatus();
        await loadConnectionInfo(true);
      } else {
        showError(
          result?.error ||
            (isOn
              ? 'Не удалось выключить VPN'
              : 'Не удалось включить VPN. Откройте настройки и сохраните VLESS URL.')
        );
      }
    } catch (error) {
      showError(error.message || String(error));
    } finally {
      setLoading(false);
    }
  });

  addSiteBtn.addEventListener('click', async () => {
    if (addSiteBtn.disabled) return;
    addSiteBtn.disabled = true;
    hideError();

    try {
      const result = await chrome.runtime.sendMessage({ action: 'addCurrentSite' });
      if (result?.success) {
        lastDomainCount = result.domainCount ?? lastDomainCount + 1;
        if (currentTab) {
          currentTab.inList = true;
          currentTab.domain = result.domain || currentTab.domain;
        }
        modeHint.textContent = formatModeHint(lastMode, lastDomainCount, lastExcludeCount);
        updateSiteSection(lastMode);
        if (!result.alreadyListed) {
          siteStatusEl.textContent = `Добавлено: ${result.domain}`;
          siteStatusEl.className = 'site-status in-list';
        }
      } else {
        showError(result?.error || 'Не удалось добавить сайт');
        addSiteBtn.disabled = false;
      }
    } catch (error) {
      showError(error.message || String(error));
      addSiteBtn.disabled = false;
    }
  });

  profileSelect.addEventListener('change', async () => {
    const profileId = profileSelect.value;
    if (!profileId || profileId === activeProfileId) return;
    profileSelect.disabled = true;
    hideError();
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'setActiveProfile',
        profileId
      });
      if (result?.success) {
        activeProfileId = profileId;
        hideError();
      } else {
        showError(result?.error || 'Не удалось сменить профиль');
        profileSelect.value = activeProfileId || '';
      }
    } catch (error) {
      showError(error.message || String(error));
      profileSelect.value = activeProfileId || '';
    } finally {
      profileSelect.disabled = false;
    }
  });

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  await loadProxyStatus();
});
