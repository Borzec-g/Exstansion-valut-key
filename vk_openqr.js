document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('openqr');
  if (!btn) return;

  btn.addEventListener('click', () => {
    chrome.windows.create({
      url: chrome.runtime.getURL('qrcode.html'),
      type: 'popup',
      width: 320,
      height: 550
    });
  });
});