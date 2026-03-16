const _el = (id) => document.getElementById(id);

function vkCleanSecret(s) {
  return (s || '').trim();
}

function vkShortLabel(raw) {
  const s = vkCleanSecret(raw)
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/=+$/g, '');
  return (s || '-----').slice(0, 5);
}

function vkFormatCode(code) {
  const s = String(code || '');
  if (/^\d{6}$/.test(s)) return s.slice(0, 3) + ' ' + s.slice(3);
  if (/^\d{8}$/.test(s)) return s.slice(0, 4) + ' ' + s.slice(4);
  return s;
}

async function vkLoadItems() {
  const { vkItems } = await chrome.storage.local.get(['vkItems']);
  return Array.isArray(vkItems) ? vkItems : [];
}

async function vkSaveItems(items) {
  await chrome.storage.local.set({ vkItems: items });
}

async function vkInitHomePage() {
  const template = document.querySelector('.savecode');
  if (!template) return;

  const items = await vkLoadItems();
  if (!items.length) {
    location.href = 'add.html';
    return;
  }

  const parent = template.parentElement;
  parent.querySelectorAll('.savecode').forEach((n) => n.remove());
  const tpl = template.cloneNode(true);
  const cards = [];

  for (const item of items) {
    const node = tpl.cloneNode(true);
    const nameEl = node.querySelector('#codename') || node.querySelector('.namecodetext');
    const codeEl = node.querySelector('#savecode') || node.querySelector('.savecodetext');
    const ringEl = node.querySelector('.roundtime');

    const title = (item.label && item.label.trim())
      ? item.label.trim()
      : vkShortLabel(item.secret);

    if (nameEl) nameEl.textContent = title;
    if (codeEl) {
      codeEl.textContent = '------';
      codeEl.style.cursor = 'pointer';
      codeEl.addEventListener('click', async () => {
        const c = (codeEl.textContent || '').replace(/\s/g, '');
        if (!/^\d{6,8}$/.test(c)) return;
        try { await navigator.clipboard.writeText(c); } catch {}
      });
    }

    parent.appendChild(node);
    cards.push({
      item,
      codeEl,
      ringEl,
      period: item.period || 30,
      digits: item.digits || 6,
      algorithm: item.algorithm || 'SHA1'
    });
  }

  async function vkTickAll() {
    const now = Date.now();
    for (const c of cards) {
      try {
        const code = await VaultOTP.generate({
          secret: c.item.secret,
          digits: c.digits,
          period: c.period,
          algorithm: c.algorithm
        }, now);
        if (c.codeEl) c.codeEl.textContent = vkFormatCode(code);
        const remaining = VaultOTP.timeLeft(c.period, now);
        if (c.ringEl) {
          const fraction = remaining / c.period;
          const deg = Math.max(0, Math.min(360, 360 * fraction));
          const color = (remaining <= 7) ? '#d80000' : '#1c71d8';
          c.ringEl.style.background =
            `conic-gradient(${color} ${deg}deg, rgba(0,0,0,0) 0deg)`;
        }
      } catch {
        if (c.codeEl) c.codeEl.textContent = '------';
      }
    }
  }

  setInterval(vkTickAll, 300);
  vkTickAll();
}

(function vkInjectBlink() {
  const css = `
@keyframes vkBlinkRed {
  0%, 50% { color: #d80000; }
  51%, 100% { color: inherit; }
}
.__vk_blink { animation: vkBlinkRed 0.35s linear infinite; }
`;
  const st = document.createElement('style');
  st.textContent = css;
  document.documentElement.appendChild(st);
})();

async function vkInitAddPage() {
  const els = {
    label: _el('label'),
    secret: _el('secret'),
    save: _el('save'),
    clear: _el('clear'),
    code: _el('code'),
    left: _el('left'),
    copy: _el('copy'),
    hint: _el('hint'),
    lablekey: _el('lablekey'),
  };

  if (!els.secret || !els.save) return;

  let cfg = {
    label: '', secret: '', digits: 6, period: 30, algorithm: 'SHA1', issuer: ''
  };

  function vkSetHint(text) {
    if (!els.hint) return;
    els.hint.textContent = text || '';
  }

  function vkBlinkLabel() {
    if (!els.lablekey) return;
    els.lablekey.classList.add('__vk_blink');
    setTimeout(() => els.lablekey.classList.remove('__vk_blink'), 7000);
  }

  async function vkLoad() {
    const { vkCfg } = await chrome.storage.local.get(['vkCfg']);
    if (vkCfg) cfg = { ...cfg, ...vkCfg };
    if (els.label) els.label.value = cfg.label || '';
    els.secret.value = cfg.secret || '';
  }

  async function vkSave() {
    cfg.label = (els.label?.value || '').trim();
    const raw = vkCleanSecret(els.secret.value);
    if (!raw) { vkBlinkLabel(); return; }

    try {
      const parsed = VaultOTP.parseUri(raw);
      if (parsed) {
        cfg = {
          ...cfg,
          label: cfg.label || parsed.label || '',
          issuer: parsed.issuer || '',
          secret: parsed.secret,
          digits: parsed.digits,
          period: parsed.period,
          algorithm: parsed.algorithm
        };
        if (els.label) els.label.value = cfg.label;
        els.secret.value =
          `otpauth://totp/${encodeURIComponent(cfg.label || '')}` +
          `?secret=${encodeURIComponent(cfg.secret)}` +
          `&issuer=${encodeURIComponent(cfg.issuer || '')}` +
          `&digits=${cfg.digits}&period=${cfg.period}&algorithm=${cfg.algorithm}`;
      } else {
        cfg.secret = raw;
      }
    } catch (e) {
      vkSetHint(String(e?.message || e));
      return;
    }

    await chrome.storage.local.set({ vkCfg: cfg });
    const items = await vkLoadItems();
    items.push({
      id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + '_' + Math.random().toString(16).slice(2)),
      label: cfg.label || '',
      issuer: cfg.issuer || '',
      secret: cfg.secret,
      digits: cfg.digits,
      period: cfg.period,
      algorithm: cfg.algorithm,
      createdAt: Date.now()
    });
    await vkSaveItems(items);
  }

  async function vkClearAll() {
    await chrome.storage.local.remove(['vkCfg']);
    cfg = { label: '', secret: '', digits: 6, period: 30, algorithm: 'SHA1', issuer: '' };
    if (els.label) els.label.value = '';
    els.secret.value = '';
    if (els.code) els.code.textContent = '------';
    if (els.left) els.left.textContent = '--';
  }

  async function vkTick() {
    const raw = vkCleanSecret(els.secret.value);
    try {
      let localCfg = { ...cfg };
      const parsed = VaultOTP.parseUri(raw);
      if (parsed) localCfg = { ...localCfg, ...parsed };
      else localCfg.secret = raw;
      if (!localCfg.secret) {
        if (els.code) els.code.textContent = '------';
        if (els.left) els.left.textContent = '--';
        return;
      }
      const code = await VaultOTP.generate(localCfg);
      if (els.code) els.code.textContent = code;
      if (els.left) els.left.textContent = String(VaultOTP.timeLeft(localCfg.period));
    } catch (e) {
      if (els.code) els.code.textContent = '------';
      if (els.left) els.left.textContent = '--';
      vkSetHint(String(e?.message || e));
    }
  }

  async function vkCopyCode() {
    const code = (els.code?.textContent || '').trim();
    if (!/^\d{6,8}$/.test(code)) return;
    try { await navigator.clipboard.writeText(code); } catch {}
  }

  els.save.addEventListener('click', vkSave);
  if (els.clear) els.clear.addEventListener('click', vkClearAll);
  if (els.copy) els.copy.addEventListener('click', vkCopyCode);
  setInterval(vkTick, 300);
  vkLoad().then(vkTick);
}

vkInitAddPage();
vkInitHomePage();
