// Popup script for Brows VPN

document.addEventListener('DOMContentLoaded', async () => {
  const powerToggle = document.getElementById('powerToggle');
  const statusText = document.getElementById('statusText');
  const modeHint = document.getElementById('modeHint');
  const errorBox = document.getElementById('errorBox');
  const settingsBtn = document.getElementById('settingsBtn');

  let lastMode = 'selective';
  let lastDomainCount = 0;

  function formatModeHint(mode, domainCount) {
    if (mode === 'global') return 'Глобальный · весь трафик';
    if (mode === 'disabled') return 'Режим отключён в настройках';
    if (domainCount === 0) return 'Выборочный · список доменов пуст';
    const n = domainCount;
    const word = n % 10 === 1 && n % 100 !== 11 ? 'сайт' :
      n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'сайта' : 'сайтов';
    return `Выборочный · ${n} ${word}`;
  }

  function updateStatus(enabled, mode, domainCount) {
    powerToggle.classList.toggle('on', enabled);
    powerToggle.classList.toggle('off', !enabled);
    powerToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    powerToggle.setAttribute('aria-label', enabled ? 'Выключить VPN' : 'Включить VPN');

    statusText.textContent = enabled ? 'VPN включён' : 'VPN выключен';
    modeHint.textContent = formatModeHint(mode, domainCount);

    if (enabled) hideError();
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
        updateStatus(response.enabled, lastMode, lastDomainCount);
        if (response.error) {
          showError(response.error);
        }
      }
    } catch (error) {
      showError('Нет связи с фоновым скриптом: ' + error.message);
      updateStatus(false, lastMode, lastDomainCount);
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
        updateStatus(!isOn, lastMode, lastDomainCount);
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

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  await loadProxyStatus();
});
