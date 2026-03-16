document.addEventListener('click', async (e) => {
  const card = e.target.closest('.savecode');
  if (!card) return;
  const codeEl = card.querySelector('.savecodetext');
  if (!codeEl) return;
  const code = codeEl.textContent.replace(/\s/g, '').trim();
  if (!/^\d{6,8}$/.test(code)) return;
  try {
    await navigator.clipboard.writeText(code);
  } catch (err) {
    console.error('[VaultKey] Clipboard error:', err);
  }
});
