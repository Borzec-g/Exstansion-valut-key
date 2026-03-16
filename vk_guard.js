(async function () {
  const { vkSiteList } = await chrome.storage.local.get(['vkSiteList']);
  if (!Array.isArray(vkSiteList) || vkSiteList.length === 0) return;

  const currentHost = location.hostname.replace(/^www\./, '');
  const hostMatches = vkSiteList.some(entry =>
    currentHost === entry || currentHost.endsWith('.' + entry)
  );

  if (!hostMatches) return;
  if (sessionStorage.getItem('vaultkey_guard_shown')) return;
  sessionStorage.setItem('vaultkey_guard_shown', 'true');

  const frame = document.createElement('iframe');
  frame.src = chrome.runtime.getURL('overlay.html');
  frame.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    border: none;
    z-index: 2147483647;
    background: white;
  `;
  document.documentElement.appendChild(frame);

  frame.onload = () => {
    frame.contentWindow.postMessage(
      { type: 'PAGE_URL', url: location.href },
      chrome.runtime.getURL('').slice(0, -1)
    );
  };

  window.addEventListener('message', (event) => {
    if (event.origin !== new URL(chrome.runtime.getURL('')).origin) return;
    if (event.data === 'CLOSE_IFRAME') {
      frame.remove();
    }
  });
})();