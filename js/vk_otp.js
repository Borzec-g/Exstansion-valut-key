const VaultOTP = (() => {
  function _normalizeSecret(s) {
    return (s || '')
      .toUpperCase()
      .replace(/[\s-]/g, '')
      .replace(/=+$/g, '');
  }

  function _secretToBytes(input) {
    const s = (input || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]/g, '')
      .replace(/=+$/g, '');

    if (!s) throw new Error('Secret is empty');
    const RFC_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const isRfc = /^[A-Z2-7]+$/.test(s);

    const _decode = (getVal) => {
      let bits = 0, value = 0;
      const out = [];
      for (const ch of s) {
        const v = getVal(ch);
        if (v == null) throw new Error('Secret contains invalid Base32 characters');
        value = (value << 5) | v;
        bits += 5;
        if (bits >= 8) {
          out.push((value >>> (bits - 8)) & 0xff);
          bits -= 8;
        }
      }
      return new Uint8Array(out);
    };

    if (isRfc) {
      return _decode((ch) => {
        const idx = RFC_ALPHABET.indexOf(ch);
        return idx === -1 ? null : idx;
      });
    }

    const EXT_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const charMap = new Map();
    for (let i = 0; i < EXT_ALPHABET.length; i++) charMap.set(EXT_ALPHABET[i], i);
    charMap.set('O', 0);
    charMap.set('I', 1);
    charMap.set('L', 1);

    if (!/^[0-9A-Z]+$/.test(s)) {
      throw new Error('Secret contains unsupported characters');
    }
    return _decode((ch) => (charMap.has(ch) ? charMap.get(ch) : null));
  }

  function parseUri(input) {
    const text = (input || '').trim();
    if (!text.toLowerCase().startsWith('otpauth://')) return null;
    const url = new URL(text);
    const type = url.host;
    if (type !== 'totp') throw new Error('Only TOTP is supported (not HOTP)');
    const label = decodeURIComponent(url.pathname.replace(/^\//, '')) || '';
    const secret = url.searchParams.get('secret') || '';
    const issuer = url.searchParams.get('issuer') || '';
    const digits = parseInt(url.searchParams.get('digits') || '6', 10);
    const period = parseInt(url.searchParams.get('period') || '30', 10);
    const algorithm = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase();
    if (!secret) throw new Error('otpauth URI missing secret');
    if (![6, 7, 8].includes(digits)) throw new Error('digits must be 6, 7 or 8');
    if (!(period > 0)) throw new Error('period is invalid');
    if (!['SHA1', 'SHA256', 'SHA512'].includes(algorithm)) throw new Error('algorithm must be SHA1/SHA256/SHA512');
    return { label, issuer, secret, digits, period, algorithm };
  }

  function _counterToBytes(counter) {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    const hi = Math.floor(counter / 2 ** 32);
    const lo = counter >>> 0;
    view.setUint32(0, hi);
    view.setUint32(4, lo);
    return new Uint8Array(buf);
  }

  function _resolveAlgo(algo) {
    const table = {
      'SHA1': 'SHA-1', 'SHA256': 'SHA-256', 'SHA512': 'SHA-512',
      'SHA-1': 'SHA-1', 'SHA-256': 'SHA-256', 'SHA-512': 'SHA-512'
    };
    return table[algo.toUpperCase()] || 'SHA-1';
  }

  async function _computeHmac(algorithm, keyBytes, msgBytes) {
    const algoName = _resolveAlgo(algorithm);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyBytes,
      { name: 'HMAC', hash: { name: algoName } },
      false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgBytes);
    return new Uint8Array(sig);
  }

  function _extractCode(hmacBytes, digits) {
    const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
    const chunk = hmacBytes.slice(offset, offset + 4);
    const bin = ((chunk[0] & 0x7f) << 24) | (chunk[1] << 16) | (chunk[2] << 8) | chunk[3];
    return (bin % (10 ** digits)).toString().padStart(digits, '0');
  }

  async function generate({ secret, digits = 6, period = 30, algorithm = 'SHA1' }, nowMs = Date.now()) {
    const keyBytes = _secretToBytes(secret);
    const counter = Math.floor((nowMs / 1000) / period);
    const msgBytes = _counterToBytes(counter);
    const hmacBytes = await _computeHmac(algorithm, keyBytes, msgBytes);
    return _extractCode(hmacBytes, digits);
  }

  function timeLeft(period = 30, nowMs = Date.now()) {
    const s = Math.floor(nowMs / 1000);
    return period - (s % period);
  }

  return { parseUri, generate, timeLeft };
})();
