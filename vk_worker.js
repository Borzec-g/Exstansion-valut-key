const VK_SITELIST_ENDPOINT = 'https://exstension-tot-auth.replit.app/api/blocklist';
const VK_REFRESH_INTERVAL = 60 * 60 * 1000;

async function vkRefreshSiteList() {
  try {
    const response = await fetch(VK_SITELIST_ENDPOINT, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.sites)) throw new Error('Unexpected response structure');
    await chrome.storage.local.set({
      vkSiteList: payload.sites,
      vkSiteListTimestamp: Date.now()
    });
    console.log(`[VaultKey] Site list refreshed: ${payload.sites.length} entries`);
  } catch (err) {
    console.warn('[VaultKey] Site list refresh failed:', err.message);
  }
}

chrome.alarms.create('vkRefreshSiteList', {
  periodInMinutes: 60
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'vkRefreshSiteList') {
    vkRefreshSiteList();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  vkRefreshSiteList();
});

chrome.runtime.onStartup.addListener(async () => {
  const { vkSiteListTimestamp } = await chrome.storage.local.get(['vkSiteListTimestamp']);
  const needsRefresh = !vkSiteListTimestamp || (Date.now() - vkSiteListTimestamp > VK_REFRESH_INTERVAL);
  if (needsRefresh) vkRefreshSiteList();
});