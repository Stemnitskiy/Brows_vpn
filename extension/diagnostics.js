// Legacy entry: diagnostics moved to a modal on the options page.
chrome.tabs.create({ url: chrome.runtime.getURL('options.html#diagnostics') });
window.close();
