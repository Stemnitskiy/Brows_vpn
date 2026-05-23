// Onboarding wizard for Brows VPN

const TOTAL_STEPS = 7;
let currentStep = 0;

document.addEventListener('DOMContentLoaded', async () => {
  await BrowsTheme.loadAndApply();
  renderProgress();
  showStep(0);
  await refreshSetupStatus();
  bindNavigation();
  bindCopyButtons();
  bindActions();
});

function renderProgress() {
  const container = document.getElementById('wizardProgress');
  container.innerHTML = '';
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const dot = document.createElement('span');
    dot.className = 'wizard-dot';
    dot.dataset.index = String(i);
    container.appendChild(dot);
  }
  updateProgress();
}

function updateProgress() {
  document.querySelectorAll('.wizard-dot').forEach((dot, index) => {
    dot.classList.toggle('active', index === currentStep);
    dot.classList.toggle('done', index < currentStep);
  });
}

function showStep(index) {
  currentStep = Math.max(0, Math.min(TOTAL_STEPS - 1, index));
  document.querySelectorAll('.wizard-step').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.step) === currentStep);
  });
  document.getElementById('wizardBack').disabled = currentStep === 0;
  document.getElementById('wizardNext').textContent =
    currentStep === TOTAL_STEPS - 1 ? 'Готово' : 'Далее';
  updateProgress();
  if (currentStep === 3) {
    refreshSetupStatus();
  }
}

function bindNavigation() {
  document.getElementById('wizardBack').addEventListener('click', () => showStep(currentStep - 1));
  document.getElementById('wizardNext').addEventListener('click', () => {
    if (currentStep === TOTAL_STEPS - 1) {
      finishOnboarding();
    } else {
      showStep(currentStep + 1);
    }
  });
}

async function refreshSetupStatus() {
  const runtimeId = chrome.runtime.id;
  document.getElementById('extensionId').textContent = runtimeId;

  let expectedId = '—';
  try {
    const resp = await fetch(chrome.runtime.getURL('EXTENSION_ID.txt'));
    if (resp.ok) {
      expectedId = (await resp.text()).trim();
    }
  } catch (_err) {
    expectedId = '(не найден EXTENSION_ID.txt)';
  }
  document.getElementById('expectedExtensionId').textContent = expectedId;

  const mismatchEl = document.getElementById('idMismatchHint');
  const originsCmd = document.getElementById('cmdOrigins');
  originsCmd.textContent = `cd proxy-service\n.\\install.ps1 -ExtensionId ${runtimeId} -Build`;

  if (expectedId && /^[a-p]{32}$/.test(expectedId) && runtimeId !== expectedId) {
    mismatchEl.hidden = false;
    mismatchEl.className = 'step-result error';
    mismatchEl.textContent =
      'ID не совпадает с GitHub/unpacked каналом. Переустановите native host командой ниже и перезапустите Chrome.';
  } else if (expectedId && /^[a-p]{32}$/.test(expectedId)) {
    mismatchEl.hidden = false;
    mismatchEl.className = 'step-result success';
    mismatchEl.textContent =
      'Extension ID совпадает с ожидаемым — native host настраивается автоматически через install.bat.';
  } else {
    mismatchEl.hidden = true;
    mismatchEl.textContent = '';
  }

  const statusEl = document.getElementById('onboardingNativeHostStatus');
  statusEl.textContent = 'Проверка…';
  statusEl.className = 'diag-status';
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

function bindCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const text = document.getElementById(targetId)?.textContent || '';
      copyText(text, btn);
    });
  });

  document.getElementById('copyExtensionId').addEventListener('click', () => {
    const text = document.getElementById('extensionId').textContent;
    copyText(text, document.getElementById('copyExtensionId'));
  });
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text.trim());
    const prev = btn.textContent;
    btn.textContent = 'Скопировано';
    setTimeout(() => {
      btn.textContent = prev;
    }, 1500);
  } catch (error) {
    showToast('Не удалось скопировать: ' + error.message, 'error');
  }
}

function bindActions() {
  document.getElementById('skipOnboarding').addEventListener('click', () => finishOnboarding(true));
  document.getElementById('finishOnboarding').addEventListener('click', () => finishOnboarding());
  document.getElementById('openSettingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  document.getElementById('refreshSetupStatusBtn').addEventListener('click', () => {
    refreshSetupStatus();
  });

  document.getElementById('validateVlessBtn').addEventListener('click', () => {
    const url = document.getElementById('onboardingVless').value.trim();
    showStepResult(
      'vlessStepResult',
      validateVlessMessage(url),
      BrowsValidators.validateVlessUrl(url).ok ? 'success' : 'error'
    );
  });

  document.getElementById('saveVlessBtn').addEventListener('click', async () => {
    const url = document.getElementById('onboardingVless').value.trim();
    const v = BrowsValidators.validateVlessUrl(url);
    if (!v.ok) {
      showStepResult('vlessStepResult', v.errors.join('; '), 'error');
      return;
    }

    const profiles = [{
      id: 'prof_onboarding',
      name: 'Основной',
      protocol: 'vless',
      vless_url: url
    }];

    await chrome.storage.local.set({
      vlessConfig: url,
      profiles,
      activeProfileId: 'prof_onboarding'
    });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      vlessConfig: url,
      profiles,
      activeProfileId: 'prof_onboarding'
    });

    const msg = v.warnings.length
      ? 'VLESS сохранён. ' + v.warnings.join('; ')
      : 'VLESS URL сохранён';
    showStepResult('vlessStepResult', msg, 'success');
    showToast(msg, 'success');
  });

  document.getElementById('runPreflightOnboarding').addEventListener('click', async () => {
    const btn = document.getElementById('runPreflightOnboarding');
    btn.disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({ action: 'runPreflight' });
      const extOk = result.local?.ok;
      const nativeOk = result.native?.ok;
      const lines = [];
      if (result.local?.checks) {
        lines.push('Расширение: ' + formatChecks(result.local));
      }
      if (result.native?.checks) {
        lines.push('Go-сервис: ' + formatChecks(result.native));
      } else if (result.native?.error) {
        lines.push('Go-сервис: ' + result.native.error);
      }
      showStepResult(
        'testStepResult',
        lines.join('\n\n') || 'Проверка завершена',
        extOk && nativeOk ? 'success' : 'error'
      );
    } catch (error) {
      showStepResult('testStepResult', error.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('enableVpnOnboarding').addEventListener('click', async () => {
    const btn = document.getElementById('enableVpnOnboarding');
    btn.disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({ action: 'enableVPN' });
      if (result?.success) {
        showStepResult('testStepResult', 'VPN успешно включён', 'success');
        showToast('VPN включён', 'success');
      } else {
        showStepResult('testStepResult', result?.error || 'Не удалось включить VPN', 'error');
      }
    } catch (error) {
      showStepResult('testStepResult', error.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  chrome.storage.local.get(['vlessConfig']).then((data) => {
    if (data.vlessConfig) {
      document.getElementById('onboardingVless').value = data.vlessConfig;
    }
  });
}

function validateVlessMessage(url) {
  if (!url) return 'Введите VLESS URL';
  const v = BrowsValidators.validateVlessUrl(url);
  if (!v.ok) return v.errors.join('; ');
  if (v.warnings.length) return 'Формат OK. ' + v.warnings.join('; ');
  return 'Формат конфигурации корректен';
}

function formatChecks(report) {
  if (!report?.checks) return report?.error || '(нет данных)';
  return report.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.message}`).join('; ');
}

function showStepResult(elementId, message, type) {
  const el = document.getElementById(elementId);
  el.hidden = false;
  el.className = 'step-result ' + type;
  el.textContent = message;
}

async function finishOnboarding(skipped = false) {
  await chrome.runtime.sendMessage({ action: 'completeOnboarding', skipped });
  showToast(skipped ? 'Мастер пропущен' : 'Настройка завершена', 'success');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.remove(tab.id);
      return;
    }
  } catch (_e) {
    // fall through
  }
  window.close();
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
