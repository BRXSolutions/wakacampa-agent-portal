/*
 * Session tokens, login codes and request signatures for the Agent API.
 * Pure JavaScript SHA-256 / HMAC so it runs inside an n8n Code node without
 * enabling built-in modules.
 *
 * Token format: base64url(JSON payload) + '.' + base64url(HMAC-SHA256(payload, secret))
 * Signature for direct API calls: hex(HMAC-SHA256(raw body, agency secret)), same as RCM.
 */

function sha256Bytes(bytes) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const len = bytes.length;
  const bitLen = len * 8;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  const W = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = W[i - 15], y = W[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  H.forEach((v, i) => ov.setUint32(i * 4, v));
  return out;
}

function utf8(str) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
  const s = unescape(encodeURIComponent(str));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

function hmacBytes(key, msg) {
  let k = typeof key === 'string' ? utf8(key) : key;
  if (k.length > 64) k = sha256Bytes(k);
  const ipad = new Uint8Array(64 + (typeof msg === 'string' ? utf8(msg).length : msg.length));
  const m = typeof msg === 'string' ? utf8(msg) : msg;
  const opad = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    const kb = k[i] || 0;
    ipad[i] = kb ^ 0x36;
    opad[i] = kb ^ 0x5c;
  }
  ipad.set(m, 64);
  opad.set(sha256Bytes(ipad), 64);
  return sha256Bytes(opad);
}

function hex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }

function b64url(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += chars[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += chars[n & 63];
  }
  return out;
}

function fromB64url(s) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes = [];
  let buf = 0, bits = 0;
  for (const c of s) {
    const v = chars.indexOf(c);
    if (v < 0) throw new Error('bad base64');
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buf >> bits) & 255); }
  }
  return new Uint8Array(bytes);
}

function bytesToUtf8(bytes) {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); });
  return decodeURIComponent(escape(s));
}

/* Constant-time string compare. */
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function hmacHex(secret, message) { return hex(hmacBytes(secret, message)); }

function signToken(payload, secret, ttlSeconds, now) {
  const t = Math.floor((now || Date.now()) / 1000);
  const body = Object.assign({}, payload, { iat: t, exp: t + (ttlSeconds || 43200) });
  const p = b64url(utf8(JSON.stringify(body)));
  return p + '.' + b64url(hmacBytes(secret, p));
}

function verifyToken(token, secret, now) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [p, sig] = token.split('.');
  if (!safeEqual(sig, b64url(hmacBytes(secret, p)))) return null;
  let body;
  try { body = JSON.parse(bytesToUtf8(fromB64url(p))); } catch (e) { return null; }
  if (!body.exp || Math.floor((now || Date.now()) / 1000) > body.exp) return null;
  return body;
}

/* Login codes: 6 digits; only a salted hash is stored. */
function newLoginCode(rand) {
  const r = typeof rand === 'number' ? rand : Math.random();
  return String(Math.floor(r * 1000000)).padStart(6, '0');
}

function hashLoginCode(code, email, secret) {
  return hmacHex(secret, `login:${String(email).trim().toLowerCase()}:${code}`);
}

function bearer(headers) {
  const h = headers || {};
  const v = h.authorization || h.Authorization || '';
  const m = String(v).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

const auth = { sha256Hex: s => hex(sha256Bytes(utf8(s))), hmacHex, signToken, verifyToken, newLoginCode, hashLoginCode, safeEqual, bearer };

if (typeof module !== 'undefined' && module.exports) module.exports = auth;
