// Shared validation helpers (background via importScripts, options via script tag)

const BrowsValidators = {
  WINDOWS_EXCLUDED_RANGES: [[1068, 1167]],
  OPERATION_MODES: ['selective', 'global', 'global_exclude', 'disabled'],

  validateOperationMode(mode) {
    return this.OPERATION_MODES.includes(mode);
  },

  sanitizeSocksPort(port, fallback = 10808) {
    const r = this.validateSocksPort(port);
    if (r.ok) return r.port;
    const fb = this.validateSocksPort(fallback);
    return fb.ok ? fb.port : 10808;
  },

  redactVlessUrl(url) {
    if (!url || !String(url).trim()) return '(не задан)';
    try {
      const u = new URL(String(url).trim());
      const port = u.port || (u.protocol === 'vless:' ? '443' : '');
      return `vless://***@${u.hostname || '?'}${port ? ':' + port : ''}***`;
    } catch {
      return 'vless://***';
    }
  },

  redactUrl(url) {
    if (!url || typeof url !== 'string') return url;
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.hostname}${u.pathname || '/'}`;
    } catch {
      return '[url]';
    }
  },

  redactDiagnosticData(data) {
    if (data == null) return data;
    if (typeof data === 'string') {
      if (data.startsWith('vless://')) return this.redactVlessUrl(data);
      if (data.startsWith('http://') || data.startsWith('https://')) return this.redactUrl(data);
      return data;
    }
    if (Array.isArray(data)) return data.map((v) => this.redactDiagnosticData(v));
    if (typeof data === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(data)) {
        if (k === 'vless_url' || k === 'vlessConfig' || k === 'url') {
          out[k] = typeof v === 'string' && v.startsWith('vless://') ? this.redactVlessUrl(v) : this.redactUrl(v);
        } else if (k === 'pacPreview' || k === 'pacScript' || k === 'lastPacScript') {
          out[k] = '[redacted]';
        } else {
          out[k] = this.redactDiagnosticData(v);
        }
      }
      return out;
    }
    return data;
  },

  /**
   * Validates and merges a settings patch (used by background service worker).
   * Returns { ok, errors, warnings, state } where state is the merged vpn fields.
   */
  applySettingsUpdate(current, patch) {
    const errors = [];
    const warnings = [];
    const state = {
      vlessConfig: current.vlessConfig,
      profiles: Array.isArray(current.profiles) ? [...current.profiles] : [],
      activeProfileId: current.activeProfileId,
      mode: current.mode || 'selective',
      domains: Array.isArray(current.domains) ? [...current.domains] : [],
      excludeDomains: Array.isArray(current.excludeDomains) ? [...current.excludeDomains] : [],
      routingPresets:
        current.routingPresets && typeof current.routingPresets === 'object'
          ? { ...current.routingPresets }
          : {},
      routingRulesCustom: Array.isArray(current.routingRulesCustom)
        ? [...current.routingRulesCustom]
        : [],
      socksPort: this.sanitizeSocksPort(current.socksPort)
    };

    if (patch.vlessConfig !== undefined) {
      const url = String(patch.vlessConfig || '').trim();
      if (url) {
        const v = this.validateVlessUrl(url);
        if (!v.ok) errors.push(...v.errors);
        else {
          state.vlessConfig = url;
          warnings.push(...v.warnings);
        }
      } else {
        state.vlessConfig = '';
      }
    }

    if (patch.profiles !== undefined) {
      if (!Array.isArray(patch.profiles)) {
        errors.push('profiles должен быть массивом');
      } else {
        const list = patch.profiles.map((p) => this.normalizeProfile(p)).filter(Boolean);
        for (const p of list) {
          if (p.vless_url) {
            const v = this.validateVlessUrl(p.vless_url);
            if (!v.ok) errors.push(`Профиль «${p.name}»: ${v.errors.join('; ')}`);
            else warnings.push(...v.warnings);
          }
        }
        if (errors.length === 0) state.profiles = list;
      }
    }

    if (patch.activeProfileId !== undefined) {
      state.activeProfileId = patch.activeProfileId;
      const url = this.activeProfileVlessUrl(state.profiles, state.activeProfileId);
      if (url) state.vlessConfig = url;
    }

    if (patch.mode !== undefined) {
      if (!this.validateOperationMode(patch.mode)) {
        errors.push(`Неизвестный режим: ${patch.mode}`);
      } else {
        state.mode = patch.mode;
      }
    }

    if (patch.domains !== undefined) {
      if (Array.isArray(patch.domains)) {
        const domains = [];
        for (const d of patch.domains) {
          const r = this.normalizeDomain(String(d));
          if (r.ok) domains.push(r.domain);
          else errors.push(r.error);
        }
        state.domains = domains;
      } else {
        errors.push('domains должен быть массивом');
      }
    }

    if (patch.excludeDomains !== undefined) {
      if (Array.isArray(patch.excludeDomains)) {
        const domains = [];
        for (const d of patch.excludeDomains) {
          const r = this.normalizeDomain(String(d));
          if (r.ok) domains.push(r.domain);
          else errors.push(r.error);
        }
        state.excludeDomains = domains;
      } else {
        errors.push('excludeDomains должен быть массивом');
      }
    }

    if (patch.routingPresets !== undefined) {
      if (patch.routingPresets && typeof patch.routingPresets === 'object') {
        state.routingPresets = {
          tld_ru: !!patch.routingPresets.tld_ru,
          tld_local: !!patch.routingPresets.tld_local,
          localhost: !!patch.routingPresets.localhost
        };
      } else {
        errors.push('routingPresets должен быть объектом');
      }
    }

    if (patch.routingRulesCustom !== undefined) {
      if (Array.isArray(patch.routingRulesCustom)) {
        state.routingRulesCustom = patch.routingRulesCustom
          .map((r) => this.normalizeRoutingRule(r))
          .filter(Boolean);
      } else {
        errors.push('routingRulesCustom должен быть массивом');
      }
    }

    if (patch.socksPort !== undefined) {
      const portCheck = this.validateSocksPort(patch.socksPort);
      if (!portCheck.ok) errors.push(...portCheck.errors);
      else {
        state.socksPort = portCheck.port;
        warnings.push(...portCheck.warnings);
      }
    }

    state.routingRules = this.buildRoutingRules(state.routingPresets, state.routingRulesCustom);

    if (state.activeProfileId && state.profiles.length) {
      if (!state.profiles.some((p) => p.id === state.activeProfileId)) {
        errors.push('activeProfileId не найден среди профилей');
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings: [...new Set(warnings)],
      state
    };
  },

  validateVlessUrl(url) {
    const errors = [];
    const warnings = [];

    if (!url || !url.trim()) {
      errors.push('VLESS URL не задан');
      return { ok: false, errors, warnings };
    }
    url = url.trim();
    if (!url.startsWith('vless://')) {
      errors.push('URL должен начинаться с vless://');
      return { ok: false, errors, warnings };
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      errors.push('Некорректный формат URL');
      return { ok: false, errors, warnings };
    }

    if (!parsed.username) errors.push('Отсутствует UUID');
    if (!parsed.hostname) errors.push('Отсутствует адрес сервера');

    const type = parsed.searchParams.get('type');
    const security = parsed.searchParams.get('security');
    if (!type) errors.push('Отсутствует параметр type');
    if (!security) errors.push('Отсутствует параметр security');

    if (security === 'reality') {
      if (!parsed.searchParams.get('pbk')) errors.push('Reality требует pbk (публичный ключ)');
      if (!parsed.searchParams.get('sni')) errors.push('Reality требует sni');
    }
    if (type === 'grpc' && !parsed.searchParams.get('serviceName')) {
      errors.push('gRPC требует serviceName');
    }

    if (url.includes('://http') || url.includes('@http')) {
      warnings.push('В URL похоже есть http:// — укажите только хост');
    }

    return { ok: errors.length === 0, errors, warnings };
  },

  normalizeDomain(raw) {
    let d = raw.trim().toLowerCase();
    if (!d) return { ok: false, error: 'Пустая строка' };
    d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
    if (d.includes('/') || d.includes(' ')) {
      return { ok: false, error: `Некорректный домен: ${raw}` };
    }
    if (d === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(d)) {
      return { ok: true, domain: d };
    }
    if (!/^[a-z0-9.*-]+(\.[a-z0-9*-]+)+$/.test(d) && !/^\*\.[a-z0-9.-]+$/.test(d)) {
      return { ok: false, error: `Неверный формат домена: ${raw}` };
    }
    return { ok: true, domain: d };
  },

  validateDomainList(text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const domains = [];
    const errors = [];
    for (const line of lines) {
      const r = this.normalizeDomain(line);
      if (r.ok) domains.push(r.domain);
      else errors.push(r.error);
    }
    return { ok: errors.length === 0, domains, errors };
  },

  /** Hostname from http(s) tab URL, or null for system pages. */
  hostnameFromUrl(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.hostname.toLowerCase().replace(/\.$/, '');
    } catch {
      return null;
    }
  },

  /** Registrable-ish domain for whitelist: www.2ip.ru → 2ip.ru */
  toWhitelistDomain(hostname) {
    if (!hostname) return { ok: false, error: 'Пустой хост' };
    const host = hostname.toLowerCase().replace(/\.$/, '');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return { ok: true, domain: host };
    }
    let d = host.startsWith('www.') ? host.slice(4) : host;
    const parts = d.split('.').filter(Boolean);
    if (parts.length < 2) {
      return { ok: false, error: `Некорректный домен: ${hostname}` };
    }
    const multiPartTlds = ['co.uk', 'com.au', 'co.jp', 'org.uk', 'net.ru', 'com.br', 'co.nz'];
    const last2 = parts.slice(-2).join('.');
    if (multiPartTlds.includes(last2) && parts.length >= 3) {
      d = parts.slice(-3).join('.');
    } else if (parts.length > 2) {
      d = parts.slice(-2).join('.');
    }
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) {
      return { ok: false, error: `Некорректный домен: ${hostname}` };
    }
    return { ok: true, domain: d };
  },

  isHostInWhitelist(host, domains, socksPort = 10808, routingRules = []) {
    if (!host) return false;
    return this.pacRouteForHost(host, 'selective', domains, socksPort, [], routingRules).includes('SOCKS');
  },

  isHostProxied(host, mode, domains, socksPort, excludeDomains = [], routingRules = []) {
    if (!host) return false;
    return this.pacRouteForHost(host, mode, domains, socksPort, excludeDomains, routingRules).includes('SOCKS');
  },

  validateSocksPort(port) {
    const errors = [];
    const warnings = [];
    let n;

    if (typeof port === 'number') {
      if (!Number.isInteger(port)) {
        errors.push('Порт должен быть целым числом');
        return { ok: false, errors, warnings, port: 10808 };
      }
      n = port;
    } else if (typeof port === 'string') {
      const trimmed = port.trim();
      if (!/^\d+$/.test(trimmed)) {
        errors.push('Порт должен быть целым числом');
        return { ok: false, errors, warnings, port: 10808 };
      }
      n = parseInt(trimmed, 10);
    } else {
      errors.push('Порт должен быть целым числом');
      return { ok: false, errors, warnings, port: 10808 };
    }

    if (Number.isNaN(n) || n < 1024 || n > 65535) {
      errors.push('Порт должен быть от 1024 до 65535');
    }
    for (const [lo, hi] of this.WINDOWS_EXCLUDED_RANGES) {
      if (n >= lo && n <= hi) {
        warnings.push(`Port ${n} может быть заблокирован Windows (диапазон ${lo}–${hi}). Используйте 10808.`);
      }
    }
    return { ok: errors.length === 0, errors, warnings, port: n };
  },

  hostMatchesPattern(host, pattern) {
    const p = pattern.toLowerCase().trim();
    if (!p) return false;
    host = host.toLowerCase().replace(/\.$/, '');
    if (p.startsWith('*.')) {
      const base = p.slice(2);
      return host === base || host.endsWith('.' + base);
    }
    return host === p || host.endsWith('.' + p);
  },

  hostMatchesAnyPattern(host, patterns) {
    if (!host || !patterns?.length) return false;
    for (const pattern of patterns) {
      if (this.hostMatchesPattern(host, pattern)) return true;
    }
    return false;
  },

  ROUTING_PRESETS: [
    { id: 'tld_ru', label: 'Домены .ru → напрямую', pattern: '*.ru', action: 'direct' },
    { id: 'tld_local', label: 'Локальные (*.local) → напрямую', pattern: '*.local', action: 'direct' },
    { id: 'localhost', label: 'localhost → напрямую', pattern: 'localhost', action: 'direct' }
  ],

  normalizeRoutingRule(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const pattern = (raw.pattern || '').trim().toLowerCase();
    if (!pattern) return null;
    const norm = this.normalizeDomain(pattern);
    if (!norm.ok && !pattern.startsWith('*.')) {
      return null;
    }
    const action = raw.action === 'proxy' ? 'proxy' : 'direct';
    return {
      id: raw.id || 'rule_' + Date.now().toString(36),
      pattern: norm.ok ? norm.domain : pattern,
      action,
      preset: raw.preset || null
    };
  },

  parseRoutingRulesText(text) {
    const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const rules = [];
    const errors = [];
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        errors.push(`Неверный формат: «${line}» (ожидается: домен proxy|direct)`);
        continue;
      }
      const actionRaw = parts[parts.length - 1].toLowerCase();
      const pattern = parts.slice(0, -1).join(' ');
      let action = null;
      if (['proxy', 'vpn', 'socks'].includes(actionRaw)) action = 'proxy';
      if (['direct', 'directly', 'd', 'напрямую'].includes(actionRaw)) action = 'direct';
      if (!action) {
        errors.push(`Неизвестное действие в «${line}»: ${actionRaw}`);
        continue;
      }
      const rule = this.normalizeRoutingRule({ pattern, action });
      if (!rule) {
        errors.push(`Некорректный шаблон: ${pattern}`);
        continue;
      }
      rules.push(rule);
    }
    return { ok: errors.length === 0, rules, errors };
  },

  buildRoutingRules(presetFlags, customRules) {
    const rules = [];
    const flags = presetFlags || {};
    for (const preset of this.ROUTING_PRESETS) {
      if (flags[preset.id]) {
        rules.push({
          id: 'preset_' + preset.id,
          pattern: preset.pattern,
          action: preset.action,
          preset: preset.id
        });
      }
    }
    for (const raw of customRules || []) {
      const rule = this.normalizeRoutingRule(raw);
      if (rule && !rule.preset) rules.push(rule);
    }
    return rules;
  },

  routeFromRules(host, routingRules, proxy) {
    if (!routingRules?.length) return null;
    for (const rule of routingRules) {
      if (this.hostMatchesPattern(host, rule.pattern)) {
        return rule.action === 'proxy' ? proxy : 'DIRECT';
      }
    }
    return null;
  },

  pacRouteForHost(host, mode, domains, socksPort, excludeDomains = [], routingRules = []) {
    host = host.toLowerCase().replace(/\.$/, '');
    const port = this.sanitizeSocksPort(socksPort);
    const proxy = `SOCKS5 127.0.0.1:${port}`;

    const ruleRoute = this.routeFromRules(host, routingRules, proxy);
    if (ruleRoute !== null) return ruleRoute;

    if (mode === 'disabled') return 'DIRECT';
    if (mode === 'global') return proxy;
    if (mode === 'global_exclude') {
      if (this.hostMatchesAnyPattern(host, excludeDomains)) return 'DIRECT';
      return proxy;
    }
    if (mode === 'selective') {
      if (this.hostMatchesAnyPattern(host, domains)) return proxy;
      return 'DIRECT';
    }
    return 'DIRECT';
  },

  generatePACScript(mode, domains, socksPort, excludeDomains = [], routingRules = []) {
    const port = this.sanitizeSocksPort(socksPort);
    const proxyAddress = `SOCKS5 127.0.0.1:${port}`;
    const rulesJSON = JSON.stringify(
      (routingRules || []).map((r) => ({ pattern: r.pattern, action: r.action }))
    );

    const matchRuleBlock = `
        var routingRules = ${rulesJSON};
        host = host.toLowerCase();
        if (host.endsWith('.')) host = host.slice(0, -1);
        for (var ri = 0; ri < routingRules.length; ri++) {
          var rule = routingRules[ri];
          var pattern = rule.pattern.toLowerCase().trim();
          if (!pattern) continue;
          var matched = false;
          if (pattern.indexOf('*.') === 0) {
            var rbase = pattern.substring(2);
            matched = (host === rbase || host.endsWith('.' + rbase));
          } else {
            matched = (host === pattern || host.endsWith('.' + pattern));
          }
          if (matched) {
            return rule.action === 'proxy' ? "${proxyAddress}" : "DIRECT";
          }
        }`;

    if (mode === 'global') {
      return `function FindProxyForURL(url, host) {${matchRuleBlock}
        return "${proxyAddress}";
      }`;
    }

    if (mode === 'global_exclude') {
      const excludesJSON = JSON.stringify(excludeDomains);
      return `
      function FindProxyForURL(url, host) {${matchRuleBlock}
        var excludes = ${excludesJSON};
        for (var i = 0; i < excludes.length; i++) {
          var pattern = excludes[i].toLowerCase().trim();
          if (!pattern) continue;
          if (pattern.indexOf('*.') === 0) {
            var base = pattern.substring(2);
            if (host === base || host.endsWith('.' + base)) return "DIRECT";
          } else if (host === pattern || host.endsWith('.' + pattern)) {
            return "DIRECT";
          }
        }
        return "${proxyAddress}";
      }
    `;
    }

    if (mode === 'selective' && domains.length > 0) {
      const domainsJSON = JSON.stringify(domains);
      return `
      function FindProxyForURL(url, host) {${matchRuleBlock}
        var domains = ${domainsJSON};
        for (var i = 0; i < domains.length; i++) {
          var pattern = domains[i].toLowerCase().trim();
          if (!pattern) continue;
          if (pattern.indexOf('*.') === 0) {
            var base = pattern.substring(2);
            if (host === base || host.endsWith('.' + base)) return "${proxyAddress}";
          } else if (host === pattern || host.endsWith('.' + pattern)) {
            return "${proxyAddress}";
          }
        }
        return "DIRECT";
      }
    `;
    }

    if (mode === 'selective') {
      return `function FindProxyForURL(url, host) {${matchRuleBlock}
        return "DIRECT";
      }`;
    }

    return `function FindProxyForURL(url, host) { return "DIRECT"; }`;
  },

  /** Sample hostname used to verify a whitelist entry routes via SOCKS. */
  sampleHostForPattern(pattern) {
    const p = pattern.trim().toLowerCase();
    if (p.startsWith('*.')) return 'www.' + p.slice(2);
    return p;
  },

  verifyWhitelistRoutes(mode, domains, socksPort, excludeDomains = [], routingRules = []) {
    const failures = [];
    if (mode !== 'selective') {
      return { ok: true, failures };
    }
    for (const pattern of domains) {
      const host = this.sampleHostForPattern(pattern);
      const ruleRoute = this.routeFromRules(host, routingRules, `SOCKS5 127.0.0.1:${socksPort}`);
      if (ruleRoute === 'DIRECT') continue;
      const route = this.pacRouteForHost(host, mode, domains, socksPort, excludeDomains, routingRules);
      if (!route.includes('SOCKS')) {
        failures.push({ pattern, host, route });
      }
    }
    return { ok: failures.length === 0, failures };
  },

  verifyExcludeRoutes(mode, excludeDomains, socksPort) {
    const failures = [];
    if (mode !== 'global_exclude') {
      return { ok: true, failures };
    }
    for (const pattern of excludeDomains) {
      const host = this.sampleHostForPattern(pattern);
      const route = this.pacRouteForHost(host, mode, [], socksPort, excludeDomains);
      if (route.includes('SOCKS')) {
        failures.push({ pattern, host, route, expect: 'DIRECT' });
      }
    }
    const probe = this.pacRouteForHost('example-exclude-test.com', mode, [], socksPort, excludeDomains);
    if (!probe.includes('SOCKS')) {
      failures.push({ pattern: '(non-excluded)', host: 'example-exclude-test.com', route: probe, expect: 'SOCKS' });
    }
    return { ok: failures.length === 0, failures };
  },

  generateProfileId() {
    return 'prof_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  },

  normalizeProfile(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const url = (raw.vless_url || raw.vlessUrl || '').trim();
    const id = raw.id || this.generateProfileId();
    const name = (raw.name || '').trim() || 'Профиль';
    return {
      id,
      name,
      protocol: raw.protocol || 'vless',
      vless_url: url
    };
  },

  migrateProfilesFromLegacy(profiles, vlessConfig, activeProfileId) {
    const list = Array.isArray(profiles) ? profiles.map((p) => this.normalizeProfile(p)).filter(Boolean) : [];
    if (list.length) {
      const active = list.some((p) => p.id === activeProfileId) ? activeProfileId : list[0].id;
      return { profiles: list, activeProfileId: active };
    }
    const legacy = (vlessConfig || '').trim();
    if (!legacy) {
      return { profiles: [], activeProfileId: null };
    }
    const id = 'prof_default';
    return {
      profiles: [{ id, name: 'Основной', protocol: 'vless', vless_url: legacy }],
      activeProfileId: id
    };
  },

  activeProfileVlessUrl(profiles, activeProfileId) {
    const profile = (profiles || []).find((p) => p.id === activeProfileId);
    return profile?.vless_url || '';
  },

  SETTINGS_EXPORT_VERSION: 1,

  buildSettingsExport(stored, options = {}) {
    const includeSecrets = options.includeSecrets !== false;
    const migrated = this.migrateProfilesFromLegacy(
      stored?.profiles,
      stored?.vlessConfig,
      stored?.activeProfileId
    );
    const port = this.sanitizeSocksPort(stored?.socksPort);
    const profiles = includeSecrets
      ? migrated.profiles
      : migrated.profiles.map((p) => ({
          ...p,
          vless_url: p.vless_url ? '' : ''
        }));
    return {
      version: this.SETTINGS_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'Brows VPN',
      secretsIncluded: includeSecrets,
      settings: {
        operationMode: stored?.operationMode || 'selective',
        domainList: Array.isArray(stored?.domainList) ? stored.domainList : [],
        excludeList: Array.isArray(stored?.excludeList) ? stored.excludeList : [],
        routingPresets:
          stored?.routingPresets && typeof stored.routingPresets === 'object'
            ? stored.routingPresets
            : {},
        routingRulesCustom: Array.isArray(stored?.routingRulesCustom)
          ? stored.routingRulesCustom.map((r) => this.normalizeRoutingRule(r)).filter(Boolean)
          : [],
        socksPort: port,
        logLevel: stored?.logLevel || 'info',
        autoReconnect: stored?.autoReconnect !== false,
        theme: ['light', 'dark', 'system'].includes(stored?.theme) ? stored.theme : 'system',
        profiles,
        activeProfileId: migrated.activeProfileId,
        vlessConfig: includeSecrets ? this.activeProfileVlessUrl(migrated.profiles, migrated.activeProfileId) : ''
      }
    };
  },

  validateSettingsImport(raw) {
    const errors = [];
    const warnings = [
      'Файл содержит секреты (VLESS URL). Не публикуйте его и не отправляйте посторонним.'
    ];

    if (!raw || typeof raw !== 'object') {
      return { ok: false, errors: ['Ожидается JSON-объект'], warnings, preview: null, settings: null };
    }

    if (raw.app && raw.app !== 'Brows VPN') {
      warnings.push(`Файл от другого приложения: ${raw.app}`);
    }

    const version = raw.version;
    if (version !== this.SETTINGS_EXPORT_VERSION) {
      errors.push(`Неподдерживаемая версия формата: ${version ?? 'нет'}`);
    }

    const settings = raw.settings;
    if (!settings || typeof settings !== 'object') {
      errors.push('Отсутствует блок settings');
      return { ok: false, errors, warnings, preview: null, settings: null };
    }

    const allowedModes = ['selective', 'global', 'global_exclude', 'disabled'];
    const mode = settings.operationMode || 'selective';
    if (!allowedModes.includes(mode)) {
      errors.push(`Неизвестный режим: ${mode}`);
    }

    const domainList = Array.isArray(settings.domainList) ? settings.domainList : [];
    for (const d of domainList) {
      const r = this.normalizeDomain(String(d));
      if (!r.ok) errors.push(`Домен в domainList: ${r.error}`);
    }

    const excludeList = Array.isArray(settings.excludeList) ? settings.excludeList : [];
    for (const d of excludeList) {
      const r = this.normalizeDomain(String(d));
      if (!r.ok) errors.push(`Домен в excludeList: ${r.error}`);
    }

    const routingRulesCustom = Array.isArray(settings.routingRulesCustom)
      ? settings.routingRulesCustom
      : [];
    const normalizedRules = [];
    for (const rule of routingRulesCustom) {
      const n = this.normalizeRoutingRule(rule);
      if (!n) errors.push('Некорректное правило маршрутизации');
      else normalizedRules.push(n);
    }

    const profilesRaw = Array.isArray(settings.profiles) ? settings.profiles : [];
    const profiles = profilesRaw.map((p) => this.normalizeProfile(p)).filter(Boolean);
    if (profilesRaw.length && !profiles.length) {
      errors.push('Нет валидных профилей VLESS');
    }

    for (const profile of profiles) {
      if (!profile.vless_url) {
        warnings.push(`Профиль «${profile.name}» без VLESS URL`);
        continue;
      }
      const v = this.validateVlessUrl(profile.vless_url);
      if (!v.ok) errors.push(`Профиль «${profile.name}»: ${v.errors.join('; ')}`);
      else if (v.warnings.length) warnings.push(`Профиль «${profile.name}»: ${v.warnings.join('; ')}`);
    }

    let activeProfileId = settings.activeProfileId || null;
    if (profiles.length) {
      if (!activeProfileId || !profiles.some((p) => p.id === activeProfileId)) {
        activeProfileId = profiles[0].id;
        warnings.push('Активный профиль заменён на первый из файла');
      }
    } else {
      activeProfileId = null;
    }

    const portCheck = this.validateSocksPort(settings.socksPort ?? 10808);
    if (!portCheck.ok) errors.push(...portCheck.errors);

    const routingPresets =
      settings.routingPresets && typeof settings.routingPresets === 'object'
        ? settings.routingPresets
        : {};

    const normalizedSettings = {
      operationMode: mode,
      domainList: domainList.map((d) => this.normalizeDomain(String(d)).domain).filter(Boolean),
      excludeList: excludeList.map((d) => this.normalizeDomain(String(d)).domain).filter(Boolean),
      routingPresets,
      routingRulesCustom: normalizedRules,
      socksPort: portCheck.port,
      logLevel: ['debug', 'info', 'warning', 'error'].includes(settings.logLevel)
        ? settings.logLevel
        : 'info',
      autoReconnect: settings.autoReconnect !== false,
      theme: ['light', 'dark', 'system'].includes(settings.theme) ? settings.theme : 'system',
      profiles,
      activeProfileId,
      vlessConfig: this.activeProfileVlessUrl(profiles, activeProfileId)
    };

    const routingRuleCount = this.buildRoutingRules(routingPresets, normalizedRules).length;

    const preview = {
      exportedAt: raw.exportedAt || null,
      mode,
      domainCount: normalizedSettings.domainList.length,
      excludeCount: normalizedSettings.excludeList.length,
      routingRuleCount,
      profileCount: profiles.length,
      profileNames: profiles.map((p) => p.name),
      socksPort: normalizedSettings.socksPort,
      autoReconnect: normalizedSettings.autoReconnect
    };

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      preview,
      settings: errors.length === 0 ? normalizedSettings : null
    };
  },

  parseSettingsImportText(text) {
    if (!text || !String(text).trim()) {
      return { ok: false, errors: ['Пустой JSON'], warnings: [], preview: null, settings: null };
    }
    try {
      return this.validateSettingsImport(JSON.parse(text));
    } catch {
      return { ok: false, errors: ['Некорректный JSON'], warnings: [], preview: null, settings: null };
    }
  },

  evaluatePacRoute(pacScript, url, host) {
    // Used in Node tests only; mirrors Chrome PAC evaluation.
    // eslint-disable-next-line no-eval
    eval(pacScript);
    return FindProxyForURL(url, host);
  }
};

if (typeof module !== 'undefined') module.exports = BrowsValidators;
