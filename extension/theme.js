// Shared theme loader for Brows VPN UI pages

const BrowsTheme = {
  current: 'system',
  _mediaListener: null,

  apply(theme) {
    this.current = theme || 'system';
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
    this._bindSystemListener(theme || 'system');
  },

  _bindSystemListener(theme) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (this._mediaListener) {
      mq.removeEventListener('change', this._mediaListener);
      this._mediaListener = null;
    }
    if (theme !== 'system') return;
    this._mediaListener = () => this.apply('system');
    mq.addEventListener('change', this._mediaListener);
  },

  async loadAndApply() {
    const data = await chrome.storage.local.get(['theme']);
    this.apply(data.theme || 'system');
    return data.theme || 'system';
  },

  async save(theme) {
    await chrome.storage.local.set({ theme });
    this.apply(theme);
  }
};

if (typeof module !== 'undefined') module.exports = BrowsTheme;
