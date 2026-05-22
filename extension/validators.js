// Shared validation helpers (background via importScripts, options via script tag)

const BrowsValidators = {
  WINDOWS_EXCLUDED_RANGES: [[1068, 1167]],

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

  validateSocksPort(port) {
    const n = parseInt(port, 10);
    const errors = [];
    const warnings = [];
    if (Number.isNaN(n) || n < 1024 || n > 65535) {
      errors.push('Порт должен быть от 1024 до 65535');
    }
    for (const [lo, hi] of this.WINDOWS_EXCLUDED_RANGES) {
      if (n >= lo && n <= hi) {
        warnings.push(`Порт ${n} может быть заблокирован Windows (диапазон ${lo}–${hi}). Используйте 10808.`);
      }
    }
    return { ok: errors.length === 0, errors, warnings, port: n };
  },

  pacRouteForHost(host, mode, domains, socksPort) {
    host = host.toLowerCase().replace(/\.$/, '');
    const proxy = `SOCKS5 127.0.0.1:${socksPort}`;
    if (mode === 'global') return proxy;
    if (mode !== 'selective') return 'DIRECT';
    for (const pattern of domains) {
      const p = pattern.toLowerCase().trim();
      if (!p) continue;
      if (p.startsWith('*.')) {
        const base = p.slice(2);
        if (host === base || host.endsWith('.' + base)) return proxy;
      } else if (host === p || host.endsWith('.' + p)) {
        return proxy;
      }
    }
    return 'DIRECT';
  },

  generatePACScript(mode, domains, socksPort) {
    const proxyAddress = `SOCKS5 127.0.0.1:${socksPort}`;

    if (mode === 'global') {
      return `function FindProxyForURL(url, host) { return "${proxyAddress}"; }`;
    }

    if (mode === 'selective' && domains.length > 0) {
      const domainsJSON = JSON.stringify(domains);
      return `
      function FindProxyForURL(url, host) {
        var domains = ${domainsJSON};
        host = host.toLowerCase();
        if (host.endsWith('.')) host = host.slice(0, -1);
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

    return `function FindProxyForURL(url, host) { return "DIRECT"; }`;
  },

  /** Sample hostname used to verify a whitelist entry routes via SOCKS. */
  sampleHostForPattern(pattern) {
    const p = pattern.trim().toLowerCase();
    if (p.startsWith('*.')) return 'www.' + p.slice(2);
    return p;
  },

  verifyWhitelistRoutes(mode, domains, socksPort) {
    const failures = [];
    if (mode !== 'selective') {
      return { ok: true, failures };
    }
    for (const pattern of domains) {
      const host = this.sampleHostForPattern(pattern);
      const route = this.pacRouteForHost(host, mode, domains, socksPort);
      if (!route.includes('SOCKS')) {
        failures.push({ pattern, host, route });
      }
    }
    return { ok: failures.length === 0, failures };
  },

  evaluatePacRoute(pacScript, url, host) {
    // Used in Node tests only; mirrors Chrome PAC evaluation.
    // eslint-disable-next-line no-eval
    eval(pacScript);
    return FindProxyForURL(url, host);
  }
};

if (typeof module !== 'undefined') module.exports = BrowsValidators;
