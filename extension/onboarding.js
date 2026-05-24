// Onboarding wizard for Brows VPN

const TOTAL_STEPS = 7;
let currentStep = 0;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (typeof BrowsTheme !== 'undefined') {
      await BrowsTheme.loadAndApply();
    }
  } catch (_err) {
    // Local browser previews do not expose chrome.storage.
  }
  renderProgress();
  showStep(0);
  await refreshSetupStatus();
  bindNavigation();
  bindCopyButtons();
  bindActions();
});

function hasExtensionRuntime() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.storage;
}

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
  if (currentStep === 5) {
    runOnboardingPreflight({ silent: true });
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
  if (!hasExtensionRuntime()) {
    document.getElementById('extensionId').textContent = '(preview mode)';
    document.getElementById('expectedExtensionId').textContent = '(доступно после загрузки расширения)';
    document.getElementById('cmdOrigins').textContent = 'cd proxy-service\n.\\install.ps1 -ExtensionId <EXTENSION_ID> -Build';
    const statusEl = document.getElementById('onboardingNativeHostStatus');
    statusEl.textContent = 'Проверяется только в Chrome extension context';
    statusEl.className = 'diag-status warn';
    return;
  }

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
    if (!btn) return;
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
  document.getElementById('openSettingsBtn').addEventListener('click', () => {
    if (hasExtensionRuntime()) {
      chrome.runtime.openOptionsPage();
    } else {
      showToast('Settings доступны после загрузки расширения в Chrome.', 'error');
    }
  });
  document.getElementById('refreshSetupStatusBtn').addEventListener('click', () => {
    refreshSetupStatus();
  });
  document.getElementById('openExtensionsPageBtn').addEventListener('click', () => {
    openUrl('chrome://extensions/');
  });
  document.querySelectorAll('.external-link').forEach((btn) => {
    btn.addEventListener('click', () => openUrl(btn.dataset.url));
  });
  document.getElementById('setupActionPrimary').addEventListener('click', () => runSetupAction('primary'));
  document.getElementById('setupActionSecondary').addEventListener('click', () => runSetupAction('secondary'));

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
    await runOnboardingPreflight();
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

  if (hasExtensionRuntime()) {
    chrome.storage.local.get(['vlessConfig']).then((data) => {
      if (data.vlessConfig) {
        document.getElementById('onboardingVless').value = data.vlessConfig;
      }
    });
  }
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
  return report.checks.map((c) => `${c.ok ? 'OK' : 'FAIL'} ${c.message}`).join('; ');
}

async function runOnboardingPreflight(options = {}) {
  const silent = !!options.silent;
  const btn = document.getElementById('runPreflightOnboarding');
  if (!silent) btn.disabled = true;
  setSetupStatus('statusExtension', 'unknown', 'Проверка...');
  setSetupStatus('statusNative', 'unknown', 'Проверка...');
  setSetupStatus('statusXray', 'unknown', 'Проверка...');
  setSetupStatus('statusVless', 'unknown', 'Проверка...');
  hideRepairCommand();

  if (!hasExtensionRuntime()) {
    setSetupStatus('statusExtension', 'warn', 'Preview');
    setSetupStatus('statusNative', 'unknown', 'Только в Chrome');
    setSetupStatus('statusXray', 'unknown', 'Нет данных');
    setSetupStatus('statusVless', 'unknown', 'Нет данных');
    showRepairCommand('cd proxy-service\n.\\install.bat');
    renderSetupActions({
      primaryAction: { type: 'copy', target: 'repairCommand', label: 'Копировать install command' },
      secondaryAction: { type: 'url', url: 'https://github.com/XTLS/Xray-core/releases', label: 'Открыть Xray releases' }
    });
    if (!silent) {
      showStepResult('testStepResult', 'Проверка зависимостей доступна после загрузки расширения в Chrome.', 'info');
    }
    if (!silent) btn.disabled = false;
    return false;
  }

  try {
    const result = await chrome.runtime.sendMessage({ action: 'runPreflight' });
    const summary = summarizePreflight(result);
    setSetupStatus('statusExtension', summary.extension.status, summary.extension.text);
    setSetupStatus('statusNative', summary.native.status, summary.native.text);
    setSetupStatus('statusXray', summary.xray.status, summary.xray.text);
    setSetupStatus('statusVless', summary.vless.status, summary.vless.text);

    if (summary.repairCommand) {
      showRepairCommand(summary.repairCommand);
    }
    renderSetupActions(summary);
    if (!silent || !summary.ok) {
      showStepResult(
        'testStepResult',
        summary.message,
        summary.ok ? 'success' : 'error'
      );
    }
    return summary.ok;
  } catch (error) {
    setSetupStatus('statusExtension', 'error', 'Ошибка');
    setSetupStatus('statusNative', 'error', 'Ошибка');
    setSetupStatus('statusXray', 'unknown', 'Нет данных');
    setSetupStatus('statusVless', 'unknown', 'Нет данных');
    showRepairCommand('cd proxy-service\n.\\install.bat');
    renderSetupActions({
      primaryAction: { type: 'copy', target: 'repairCommand', label: 'Копировать install command' },
      secondaryAction: { type: 'url', url: 'https://github.com/XTLS/Xray-core/releases', label: 'Открыть Xray releases' }
    });
    showStepResult('testStepResult', error.message, 'error');
    return false;
  } finally {
    if (!silent) btn.disabled = false;
  }
}

function summarizePreflight(result) {
  const local = result?.local;
  const native = result?.native;
  const localChecks = local?.checks || [];
  const nativeChecks = native?.checks || [];
  const runtimeId = chrome.runtime.id;

  const localVless = localChecks.find((c) => c.id === 'vless_local');
  const nativeXray = nativeChecks.find((c) => c.id === 'xray_binary' || /xray/i.test(c.message || ''));
  const nativeConnected = !native?.error;
  const nativeOk = native?.ok === true;
  const localOk = local?.ok === true;
  const xrayOk = nativeXray ? !!nativeXray.ok : nativeOk;
  const vlessOk = localVless ? !!localVless.ok : false;

  let repairCommand = '';
  let primaryAction = null;
  let secondaryAction = null;
  if (!nativeConnected || /not found|forbidden|denied|native host/i.test(native?.error || '')) {
    repairCommand = `cd proxy-service\n.\\install.ps1 -ExtensionId ${runtimeId} -Build`;
    primaryAction = { type: 'copy', target: 'repairCommand', label: 'Копировать install command' };
    secondaryAction = { type: 'url', url: 'chrome://extensions/', label: 'Открыть extensions' };
  } else if (!xrayOk) {
    repairCommand = 'cd proxy-service\npowershell -File ..\\scripts\\check-env.ps1\n# Скачайте Xray-core и положите xray.exe в .\\xray-core\\';
    primaryAction = { type: 'url', url: 'https://github.com/XTLS/Xray-core/releases', label: 'Открыть Xray releases' };
    secondaryAction = { type: 'copy', target: 'repairCommand', label: 'Копировать команду' };
  } else if (!vlessOk) {
    repairCommand = '# Вернитесь на шаг VLESS URL и сохраните валидную vless:// ссылку';
    primaryAction = { type: 'step', step: 4, label: 'К шагу VLESS' };
  } else if (localOk && nativeOk) {
    primaryAction = { type: 'settings', label: 'Открыть настройки' };
  }

  const lines = [];
  if (localChecks.length) lines.push('Расширение: ' + formatChecks(local));
  if (nativeChecks.length) lines.push('Go-сервис: ' + formatChecks(native));
  else if (native?.error) lines.push('Go-сервис: ' + native.error);

  return {
    ok: localOk && nativeOk,
    extension: {
      status: localOk ? 'ok' : 'error',
      text: localOk ? 'OK' : 'Есть ошибки'
    },
    native: {
      status: nativeConnected ? (nativeOk ? 'ok' : 'error') : 'error',
      text: nativeConnected ? (nativeOk ? 'Подключён' : 'Preflight failed') : 'Недоступен'
    },
    xray: {
      status: xrayOk ? 'ok' : 'error',
      text: xrayOk ? 'Найден' : 'Проверьте xray.exe'
    },
    vless: {
      status: vlessOk ? 'ok' : 'error',
      text: vlessOk ? 'Формат OK' : 'Нужен VLESS URL'
    },
    repairCommand,
    primaryAction,
    secondaryAction,
    message: lines.join('\n\n') || 'Проверка завершена'
  };
}

function setSetupStatus(id, status, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.dataset.status = status;
  const value = el.querySelector('strong');
  if (value) value.textContent = text;
}

function showRepairCommand(command) {
  document.getElementById('repairCommand').textContent = command;
  document.getElementById('repairCommandBlock').hidden = false;
}

function hideRepairCommand() {
  document.getElementById('repairCommandBlock').hidden = true;
}

function renderSetupActions(summary) {
  const row = document.getElementById('setupActionRow');
  const primary = document.getElementById('setupActionPrimary');
  const secondary = document.getElementById('setupActionSecondary');

  setupActionState.primary = summary.primaryAction || null;
  setupActionState.secondary = summary.secondaryAction || null;

  if (!setupActionState.primary && !setupActionState.secondary) {
    row.hidden = true;
    return;
  }

  row.hidden = false;
  primary.hidden = !setupActionState.primary;
  primary.textContent = setupActionState.primary?.label || 'Действие';
  secondary.hidden = !setupActionState.secondary;
  secondary.textContent = setupActionState.secondary?.label || 'Дополнительно';
}

const setupActionState = {
  primary: null,
  secondary: null
};

function runSetupAction(slot) {
  const action = setupActionState[slot];
  if (!action) return;
  if (action.type === 'copy') {
    const btn = slot === 'primary'
      ? document.getElementById('setupActionPrimary')
      : document.getElementById('setupActionSecondary');
    copyText(document.getElementById(action.target)?.textContent || '', btn);
    return;
  }
  if (action.type === 'url') {
    openUrl(action.url);
    return;
  }
  if (action.type === 'step') {
    showStep(action.step);
    return;
  }
  if (action.type === 'settings') {
    if (hasExtensionRuntime()) {
      chrome.runtime.openOptionsPage();
    } else {
      showToast('Settings доступны после загрузки расширения в Chrome.', 'error');
    }
  }
}

function openUrl(url) {
  if (!url) return;
  const onOpenFailed = (message) => {
    copyText(url);
    showToast(`Не удалось открыть: ${message}. Адрес скопирован.`, 'error');
  };
  try {
    chrome.tabs.create({ url }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        onOpenFailed(err.message);
      }
    });
  } catch (error) {
    onOpenFailed(error.message);
  }
}

function showStepResult(elementId, message, type) {
  const el = document.getElementById(elementId);
  el.hidden = false;
  el.className = 'step-result ' + type;
  el.textContent = message;
}

async function finishOnboarding(skipped = false) {
  if (!hasExtensionRuntime()) {
    showToast('Завершение мастера доступно после загрузки расширения в Chrome.', 'error');
    return;
  }
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
