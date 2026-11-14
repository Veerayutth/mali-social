'use strict';
/* ความปลอดภัยที่ "ทำงานจริงในเบราว์เซอร์" ของต้นแบบ
   - TOTP (RFC 6238) ใช้กับแอปยืนยันตัวตนจริงได้
   - แฮชรหัสผ่านด้วย PBKDF2-SHA256 (ไม่เก็บรหัสผ่านตัวจริง)
   - แชตลับ: ECDH P-256 + AES-GCM ระหว่างสองฝั่งที่จำลองในเครื่อง
   - ตรวจลิงก์อันตรายด้วยรายการบล็อก + ฮิวริสติก
   - จำกัดอัตราการส่ง (rate limit) ฝั่งไคลเอนต์
   - ลบ EXIF/GPS โดยวาดรูปใหม่ลง canvas
   ของจริงต้องมีระบบฝั่งเซิร์ฟเวอร์ประกอบ ดูหน้า "ระบบหลังบ้านที่ต้องมี" ในแอป */
(function (M) {
  const S = M.sec = {};
  const subtle = window.crypto?.subtle;
  S.available = !!subtle;
  const enc = new TextEncoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  S.b64 = b64; S.unb64 = unb64;
  S.randBytes = n => crypto.getRandomValues(new Uint8Array(n));

  /* ---------- Base32 + TOTP ---------- */
  const A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  S.base32 = bytes => { let bits = 0, val = 0, out = ''; for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += A32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += A32[(val << (5 - bits)) & 31]; return out; };
  S.unbase32 = str => { const s = str.replace(/[\s=]/g, '').toUpperCase(); let bits = 0, val = 0; const out = []; for (const c of s) { const i = A32.indexOf(c); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); };
  S.newTotpSecret = () => S.base32(S.randBytes(20));
  S.totp = async (secret, t = Date.now(), step = 30) => {
    const counter = Math.floor(t / 1000 / step);
    const msg = new ArrayBuffer(8); const dv = new DataView(msg);
    dv.setUint32(0, Math.floor(counter / 2 ** 32)); dv.setUint32(4, counter >>> 0);
    const key = await subtle.importKey('raw', S.unbase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const h = new Uint8Array(await subtle.sign('HMAC', key, msg));
    const o = h[h.length - 1] & 15;
    const code = ((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1e6;
    return String(code).padStart(6, '0');
  };
  S.verifyTotp = async (secret, code) => {
    code = String(code).replace(/\D/g, '');
    for (const w of [-1, 0, 1]) if (await S.totp(secret, Date.now() + w * 30000) === code) return true;
    return false;
  };
  S.otpauth = (secret, account) => `otpauth://totp/${encodeURIComponent('Mali:' + account)}?secret=${secret}&issuer=Mali&digits=6&period=30`;
  S.backupCodes = () => Array.from({ length: 8 }, () => [...S.randBytes(4)].map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 8).toUpperCase());

  /* ---------- รหัสผ่าน ---------- */
  S.hashPassword = async (pw, saltB64) => {
    const salt = saltB64 ? unb64(saltB64) : S.randBytes(16);
    const key = await subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256);
    return { salt: b64(salt), hash: b64(bits), algo: 'PBKDF2-SHA256-210k' };
  };
  S.checkPassword = async (pw, rec) => rec && (await S.hashPassword(pw, rec.salt)).hash === rec.hash;
  S.strength = pw => {
    let s = 0;
    if (pw.length >= 8) s++; if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++; if (/[^\w]/.test(pw)) s++;
    if (/^(.)\1+$/.test(pw) || /12345|password|qwerty|11111/i.test(pw)) s = 0;
    return Math.min(4, s); // 0..4
  };
  S.STRENGTH_TH = ['อ่อนมาก', 'อ่อน', 'พอใช้', 'ดี', 'แข็งแรง'];

  /* ---------- จำกัดอัตรา ---------- */
  const buckets = {};
  // คืนค่า 0 ถ้าอนุญาต หรือจำนวนวินาทีที่ต้องรอ
  S.rateLimit = (key, max, windowMs) => {
    const now = Date.now();
    const b = buckets[key] = (buckets[key] || []).filter(t => now - t < windowMs);
    if (b.length >= max) return Math.ceil((windowMs - (now - b[0])) / 1000);
    b.push(now); return 0;
  };
  S.guard = (key, max, windowMs, what = 'ทำรายการ') => {
    const wait = S.rateLimit(key, max, windowMs);
    if (wait) { M.toast(`${what}เร็วเกินไป รออีก ${wait} วินาที (ระบบจำกัดอัตราเพื่อกันสแปม)`); return false; }
    return true;
  };

  /* ---------- ตรวจลิงก์ ---------- */
  const BLOCK = ['free-gift-mali.xyz', 'mali-login-verify.com', 'mali-support-help.top', 'claim-prize-now.click'];
  const BRAND = /m[a@4]l[i1l]/i;
  S.scanUrl = (raw, strict = M.st?.security?.advanced) => {
    const out = { url: raw, level: 'safe', reasons: [] };
    let u;
    try { u = new URL(raw); } catch { return { ...out, level: 'danger', reasons: ['รูปแบบลิงก์ไม่ถูกต้อง'] }; }
    const host = u.hostname.toLowerCase();
    if (BLOCK.some(b => host === b || host.endsWith('.' + b))) out.reasons.push('อยู่ในรายการเว็บหลอกลวงที่ทราบแล้ว');
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) out.reasons.push('ใช้หมายเลข IP แทนชื่อเว็บ');
    if (host.includes('xn--')) out.reasons.push('ใช้ตัวอักษรหน้าตาคล้ายกัน (punycode)');
    if (u.username || raw.includes('@')) out.reasons.push('มีเครื่องหมาย @ ซ่อนปลายทางจริง');
    if (BRAND.test(host) && !/(^|\.)mali\.example$/.test(host)) out.reasons.push('อ้างชื่อแอปแต่ไม่ใช่โดเมนทางการ (mali.example)');
    if (/\.(xyz|top|click|zip|mov)$/.test(host)) out.reasons.push('โดเมนระดับบนที่พบในการหลอกลวงบ่อย');
    const warn = [];
    if (u.protocol === 'http:') warn.push('ไม่เข้ารหัส (http)');
    if (out.reasons.length) out.level = 'danger';
    else if (warn.length || strict) { out.level = 'warn'; out.reasons = warn.length ? warn : ['โหมดปกป้องขั้นสูง: ยืนยันทุกลิงก์ภายนอก']; }
    out.host = host;
    return out;
  };

  /* ---------- คำที่ซ่อน ---------- */
  const DEFAULT_BAD = ['โง่', 'ควาย', 'สแปม', 'รวยทางลัด', 'แอดไลน์', 'คลิกลิงก์รับเงิน'];
  S.isHiddenWord = text => {
    const st = M.st.settings;
    const words = [...(st.hiddenWords || []), ...(st.hiddenDefault ? DEFAULT_BAD : [])];
    const t = String(text).toLowerCase();
    return words.some(w => w && t.includes(w.toLowerCase()));
  };

  /* ---------- EXIF + ย่อรูป ---------- */
  S.inspectExif = buf => {
    const b = new Uint8Array(buf.slice(0, 131072));
    let exif = false, gps = false;
    for (let i = 0; i < b.length - 6; i++) {
      if (b[i] === 0x45 && b[i + 1] === 0x78 && b[i + 2] === 0x69 && b[i + 3] === 0x66 && b[i + 4] === 0 && b[i + 5] === 0) exif = true;
      if (exif && ((b[i] === 0x88 && b[i + 1] === 0x25) || (b[i] === 0x25 && b[i + 1] === 0x88))) { gps = true; break; }
    }
    return { exif, gps };
  };
  S.processImage = async (file, max = 1080) => {
    const buf = await file.arrayBuffer();
    const meta = S.inspectExif(buf);
    const url = URL.createObjectURL(new Blob([buf], { type: file.type }));
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sc = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    // การวาดใหม่ลง canvas จะได้ไฟล์ใหม่ที่ไม่มี EXIF ติดมา
    return { dataUrl: c.toDataURL('image/jpeg', .82), ...meta, w: c.width, h: c.height };
  };

  /* ---------- แชตลับ (E2EE จำลองสองฝั่งในเครื่อง) ---------- */
  const keyCache = {};
  S.e2eeSetup = async () => {
    const gen = () => subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    const a = await gen(), b = await gen();
    const ex = async k => ({ pub: await subtle.exportKey('jwk', k.publicKey), priv: await subtle.exportKey('jwk', k.privateKey) });
    return { me: await ex(a), peer: await ex(b) };
  };
  const sharedKey = async (chat) => {
    if (keyCache[chat.id]) return keyCache[chat.id];
    const priv = await subtle.importKey('jwk', chat.keys.me.priv, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
    const pub = await subtle.importKey('jwk', chat.keys.peer.pub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    return keyCache[chat.id] = subtle.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  };
  S.encrypt = async (chat, text) => {
    const iv = S.randBytes(12);
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, await sharedKey(chat), enc.encode(text));
    return { iv: b64(iv), ct: b64(ct) };
  };
  S.decrypt = async (chat, c) => new TextDecoder().decode(await subtle.decrypt({ name: 'AES-GCM', iv: unb64(c.iv) }, await sharedKey(chat), unb64(c.ct)));
  S.safetyNumber = async chat => {
    const h = new Uint8Array(await subtle.digest('SHA-256', enc.encode(chat.keys.me.pub.x + chat.keys.me.pub.y + chat.keys.peer.pub.x + chat.keys.peer.pub.y)));
    const digits = [...h].map(b => String(b % 100).padStart(2, '0')).join('').slice(0, 40);
    return digits.match(/.{5}/g).join(' ');
  };

  /* ---------- สรุปแชตกลุ่ม (สรุปแบบดึงประโยคสำคัญ ทำงานในเครื่อง) ---------- */
  S.summarize = msgs => {
    const text = msgs.filter(m => m.type === 'text');
    const by = {};
    text.forEach(m => by[m.from] = (by[m.from] || 0) + 1);
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => M.user(id).name.split(' ')[0]);
    const KEY = /(\d|นัด|จอง|งบ|บาท|โมง|น\.|วัน|ไฟลต์|ที่พัก|อย่าลืม|ต้อง|สรุป|ตกลง|\?)/;
    const scored = text.map((m, i) => ({ m, i, s: (m.text.match(KEY) ? 2 : 0) + ((m.text.match(/\d/g) || []).length > 2 ? 2 : 0) + (m.text.length > 25 ? 1 : 0) + (/555|ฮ่า|จริง|ใช่/.test(m.text) ? -2 : 0) }))
      .filter(x => x.s >= 2).sort((a, b) => b.s - a.s || b.i - a.i).slice(0, 6).sort((a, b) => a.i - b.i);
    return { count: msgs.length, top, points: scored.map(x => ({ who: M.user(x.m.from).name.split(' ')[0], text: x.m.text })) };
  };
})(window.M);
