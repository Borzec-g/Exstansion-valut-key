document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  if (!fileInput) return;

  const VK_QR_ENDPOINT = 'https://exstension-tot-auth.replit.app/api/qr/upload';

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(VK_QR_ENDPOINT, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('QR decode request failed');

      const payload = await response.json();
      if (!payload.otpauth) throw new Error('Invalid server response');

      const parsed = VaultOTP.parseUri(payload.otpauth);
      if (!parsed) throw new Error('Failed to parse otpauth URI');

      const items = await new Promise(resolve =>
        chrome.storage.local.get(['vkItems'], r =>
          resolve(Array.isArray(r.vkItems) ? r.vkItems : [])
        )
      );

      items.push({
        id: crypto.randomUUID(),
        label: parsed.label || '',
        issuer: parsed.issuer || '',
        secret: parsed.secret,
        digits: parsed.digits,
        period: parsed.period,
        algorithm: parsed.algorithm,
        createdAt: Date.now()
      });

      await chrome.storage.local.set({ vkItems: items });
      window.close();
    } catch (err) {
      console.error('[VaultKey] QR scan error:', err);
      alert('Failed to read QR code');
    }

    fileInput.value = '';
  });
});
