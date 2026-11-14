'use strict';
/* เซิร์ฟเวอร์ของมะลิ — ไม่ต้องติดตั้งแพ็กเกจเพิ่ม ใช้แค่ Node.js 22.5 ขึ้นไป
   รัน:  node server/server.js   แล้วเปิด http://localhost:8787
   ทำอะไรบ้าง
   - เสิร์ฟไฟล์ของแอป (เฉพาะ index.html, manifest, sw.js, css/, js/, icons/)
   - บัญชีผู้ใช้: สมัคร เข้าสู่ระบบ ออกจากระบบ (รหัสผ่านแฮชด้วย scrypt, session เป็นคุกกี้ HttpOnly)
   - โพสต์ ถูกใจ ความคิดเห็น ติดตาม แชตตัวต่อตัว อัปโหลดรูป/วิดีโอ
   - แจ้งเหตุการณ์แบบเรียลไทม์ด้วย Server-Sent Events (/api/events)
   - จำกัดอัตราการเรียกต่อ IP และต่อบัญชี, ตรวจชนิดไฟล์จากไบต์จริง, กัน CSRF ด้วยเฮดเดอร์ X-Mali
   ข้อมูลเก็บใน server/data/ (SQLite + โฟลเดอร์ media) */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = +process.env.PORT || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(__dirname, '..');
const DATA = path.resolve(process.env.MALI_DATA || path.join(__dirname, 'data'));
const MEDIA = path.join(DATA, 'media');
const FORCE_SECURE = process.env.HTTPS === '1'; // บังคับคุกกี้ Secure เสมอ
fs.mkdirSync(MEDIA, { recursive: true });

/* ---------------- ฐานข้อมูล ---------------- */
const db = new DatabaseSync(path.join(DATA, 'mali.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, handle TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '', avatar TEXT, hue INTEGER NOT NULL DEFAULT 30,
    pw TEXT NOT NULL, created INTEGER NOT NULL, failed INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created INTEGER NOT NULL, expires INTEGER NOT NULL, ua TEXT);
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    caption TEXT NOT NULL DEFAULT '', media TEXT NOT NULL DEFAULT '[]', created INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS posts_created ON posts(created DESC);
  CREATE TABLE IF NOT EXISTS likes (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, user_id));
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS follows (
    follower TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, followee TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created INTEGER NOT NULL, PRIMARY KEY (follower, followee));
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, pair TEXT NOT NULL, from_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL DEFAULT '', media TEXT,
    created INTEGER NOT NULL, read_at INTEGER);
  CREATE INDEX IF NOT EXISTS messages_pair ON messages(pair, created);
  CREATE INDEX IF NOT EXISTS messages_to ON messages(to_id, read_at);
  CREATE TABLE IF NOT EXISTS handle_changes (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, old TEXT NOT NULL COLLATE NOCASE, new TEXT NOT NULL COLLATE NOCASE, ts INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS handle_changes_old ON handle_changes(old, ts);
`);
const q = sql => db.prepare(sql);
const now = () => Date.now();
const newId = (p = '') => p + crypto.randomBytes(9).toString('base64url');
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

/* ---------------- รหัสผ่าน (scrypt) ---------------- */
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const hashPw = pw => new Promise((res, rej) => {
  const salt = crypto.randomBytes(16);
  crypto.scrypt(pw.normalize('NFKC'), salt, 32, SCRYPT, (e, k) => e ? rej(e) : res(`scrypt$${salt.toString('base64')}$${k.toString('base64')}`));
});
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(32).toString('base64')}`;
const checkPw = (pw, stored) => new Promise(res => {
  const [, s, k] = String(stored).split('$');
  const expect = Buffer.from(k || '', 'base64');
  crypto.scrypt(pw.normalize('NFKC'), Buffer.from(s || '', 'base64'), 32, SCRYPT, (e, got) => res(!e && expect.length === 32 && crypto.timingSafeEqual(got, expect)));
});

/* ---------------- จำกัดอัตรา ---------------- */
const buckets = new Map();
function limited(key, max, windowMs) {
  const t = now(), b = (buckets.get(key) || []).filter(x => t - x < windowMs);
  if (b.length >= max) { buckets.set(key, b); return Math.ceil((windowMs - (t - b[0])) / 1000); }
  b.push(t); buckets.set(key, b); return 0;
}
setInterval(() => { const t = now(); for (const [k, b] of buckets) if (!b.length || t - b[b.length - 1] > 3600e3) buckets.delete(k); }, 600e3).unref();

/* ---------------- ตัวช่วย HTTP ---------------- */
class HttpError extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra; } }
const fail = (status, msg, extra) => { throw new HttpError(status, msg, extra); };

const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self)'
};
function send(res, status, body, headers = {}) {
  if (res.req && viaHttps(res.req)) headers = { 'Strict-Transport-Security': 'max-age=15552000', ...headers };
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, { ...SEC_HEADERS, 'Content-Type': isBuf ? 'application/octet-stream' : typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Content-Length': data.length, 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const len = +req.headers['content-length'] || 0;
    if (len > limit) return reject(new HttpError(413, 'ไฟล์หรือข้อมูลใหญ่เกินไป'));
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new HttpError(413, 'ไฟล์หรือข้อมูลใหญ่เกินไป')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  if (!/^application\/json\b/.test(req.headers['content-type'] || '')) fail(415, 'ต้องส่งเป็น JSON');
  try { return JSON.parse((await readBody(req, 64 * 1024)).toString('utf8') || '{}'); } catch (e) { if (e instanceof HttpError) throw e; fail(400, 'JSON ไม่ถูกต้อง'); }
}
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
// IP จริงของผู้ใช้: ถ้าคำขอมาจากเครื่องนี้ (เช่น ผ่าน Cloudflare Tunnel) ใช้เฮดเดอร์ที่ Cloudflare ใส่มา
// เชื่อเฮดเดอร์เฉพาะเมื่อมาจาก loopback เพราะคนภายนอกปลอมเฮดเดอร์นี้ได้ถ้าต่อตรง
const isLoopback = a => a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
const clientIp = req => {
  const a = req.socket.remoteAddress || '?';
  const cf = req.headers['cf-connecting-ip'];
  return isLoopback(a) && typeof cf === 'string' && /^[0-9a-fA-F:.]{3,45}$/.test(cf) ? cf : a;
};
const viaHttps = req => FORCE_SECURE || (isLoopback(req.socket.remoteAddress) && req.headers['x-forwarded-proto'] === 'https');
const str = (v, max, field) => {
  if (typeof v !== 'string') fail(400, `${field} ไม่ถูกต้อง`);
  v = v.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (v.length > max) fail(400, `${field} ยาวเกิน ${max} ตัวอักษร`);
  return v;
};

/* ---------------- session ---------------- */
const SESSION_DAYS = 30;
/* หลายบัญชีในเครื่องเดียว: แต่ละบัญชีมีคุกกี้ของตัวเอง mali_s_<userId> และ mali_a บอกว่าใช้บัญชีไหนอยู่
   โทเค็นทุกตัวเป็น HttpOnly สคริปต์ในหน้าเว็บอ่านไม่ได้ เซิร์ฟเวอร์เก็บเฉพาะแฮช */
const MAX_ACCOUNTS = 5;
const cookieOpts = (req, maxAge) => `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${viaHttps(req) ? '; Secure' : ''}`;
const addCookie = (res, c) => { const prev = res.getHeader('Set-Cookie') || []; res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : [prev]), c]); };
const sessionUser = token => token ? q('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires > ?').get(sha256(token), now()) || null : null;
// บัญชีที่เข้าสู่ระบบไว้ในเครื่องนี้ (ตรวจโทเค็นทุกตัว)
function deviceAccounts(req) {
  const c = cookies(req), out = [];
  for (const [k, v] of Object.entries(c)) {
    if (!k.startsWith('mali_s_')) continue;
    const u = sessionUser(v);
    if (u && u.id === k.slice(7)) out.push({ user: u, token: v });
  }
  return out;
}
function createSession(res, userId, req) {
  const others = deviceAccounts(req).filter(a => a.user.id !== userId);
  if (others.length >= MAX_ACCOUNTS) fail(400, `เพิ่มบัญชีในเครื่องนี้ได้สูงสุด ${MAX_ACCOUNTS} บัญชี`);
  const token = crypto.randomBytes(32).toString('base64url');
  q('INSERT INTO sessions (token, user_id, created, expires, ua) VALUES (?,?,?,?,?)').run(sha256(token), userId, now(), now() + SESSION_DAYS * 864e5, String(req.headers['user-agent'] || '').slice(0, 200));
  addCookie(res, `mali_s_${userId}=${token}; ${cookieOpts(req, SESSION_DAYS * 86400)}`);
  addCookie(res, `mali_a=${userId}; ${cookieOpts(req, SESSION_DAYS * 86400)}`);
  if (cookies(req).mali_sid) addCookie(res, `mali_sid=; ${cookieOpts(req, 0)}`); // คุกกี้แบบเก่า
}
function currentUser(req) {
  const c = cookies(req);
  if (c.mali_a && /^[\w-]+$/.test(c.mali_a)) { const u = sessionUser(c['mali_s_' + c.mali_a]); if (u && u.id === c.mali_a) return u; }
  return sessionUser(c.mali_sid);
}
const needUser = req => currentUser(req) || fail(401, 'กรุณาเข้าสู่ระบบ');

/* ---------------- รูปแบบข้อมูลที่ส่งกลับ ---------------- */
/* ชื่อผู้ใช้: ใช้ได้เฉพาะ a-z 0-9 _ . / ชื่อเดิมถูกกันไว้ให้เจ้าของ 14 วันหลังเปลี่ยน / เปลี่ยนได้ 5 ครั้งใน 30 นาที */
const HANDLE_RESERVE_MS = 14 * 864e5, HANDLE_MAX = 5, HANDLE_WINDOW_MS = 30 * 60e3;
const handleOk = h => /^[a-z0-9_.]{3,30}$/.test(h) && !/^\.|\.$|\.\./.test(h);
const handleReservedFor = h => q('SELECT user_id FROM handle_changes WHERE old = ? AND ts > ? ORDER BY ts DESC LIMIT 1').get(h, now() - HANDLE_RESERVE_MS)?.user_id || null;
const pubUser = u => u && ({ id: u.id, handle: u.handle, name: u.name, bio: u.bio, avatar: u.avatar, hue: u.hue });
function postOut(p, meId) {
  const u = q('SELECT * FROM users WHERE id = ?').get(p.user_id);
  return {
    id: p.id, caption: p.caption, media: JSON.parse(p.media), created: p.created, user: pubUser(u),
    likes: q('SELECT COUNT(*) n FROM likes WHERE post_id = ?').get(p.id).n,
    liked: !!(meId && q('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(p.id, meId)),
    comments: q('SELECT COUNT(*) n FROM comments WHERE post_id = ?').get(p.id).n
  };
}
const msgOut = m => ({ id: m.id, from: m.from_id, to: m.to_id, text: m.text, media: m.media ? JSON.parse(m.media) : null, created: m.created, read: !!m.read_at });
const pairOf = (a, b) => [a, b].sort().join('|');

/* ---------------- เรียลไทม์ (SSE) ---------------- */
const streams = new Map(); // userId → Set<res>  (SSE)
const queues = new Map();  // userId → { seq, events: [{seq,type,data,ts}], waiters: Set<fn> }  (long-poll สำรอง)
let SEQ = Date.now();
function emit(userId, type, data) {
  const set = streams.get(userId);
  if (set) { const line = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`; for (const r of set) r.write(line); }
  // เก็บเหตุการณ์ล่าสุดไว้ให้ผู้ใช้ที่ใช้ long-poll (เช่นผ่านพร็อกซีที่บัฟเฟอร์ SSE)
  const qu = queues.get(userId) || { events: [], waiters: new Set() };
  qu.events.push({ seq: ++SEQ, type, data, ts: now() });
  if (qu.events.length > 200) qu.events.splice(0, qu.events.length - 200);
  queues.set(userId, qu);
  for (const w of qu.waiters) w();
}
// ล้างคิวเก่ากว่า 10 นาที
setInterval(() => { const t = now(); for (const [k, qu] of queues) { qu.events = qu.events.filter(e => t - e.ts < 600e3); if (!qu.events.length && !qu.waiters.size) queues.delete(k); } }, 60e3).unref();
setInterval(() => { for (const set of streams.values()) for (const r of set) r.write(': ping\n\n'); }, 25e3).unref();

/* ---------------- ไฟล์อัปโหลด ---------------- */
const MEDIA_TYPES = {
  'image/jpeg': { ext: 'jpg', max: 10 << 20, magic: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', max: 10 << 20, magic: b => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { ext: 'webp', max: 10 << 20, magic: b => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' },
  'image/gif': { ext: 'gif', max: 10 << 20, magic: b => /^GIF8[79]a$/.test(b.slice(0, 6).toString('latin1')) },
  'video/mp4': { ext: 'mp4', max: 60 << 20, magic: b => b.slice(4, 8).toString('latin1') === 'ftyp' },
  'video/quicktime': { ext: 'mov', max: 60 << 20, magic: b => b.slice(4, 8).toString('latin1') === 'ftyp' },
  'video/webm': { ext: 'webm', max: 60 << 20, magic: b => b.slice(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) }
};
const MIME_BY_EXT = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', webmanifest: 'application/manifest+json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', md: 'text/plain; charset=utf-8' };
const mediaUrlOk = u => typeof u === 'string' && /^\/media\/[A-Za-z0-9_-]{12,40}\.(jpg|png|webp|gif|mp4|mov|webm)$/.test(u) && fs.existsSync(path.join(MEDIA, path.basename(u)));

/* ---------------- เส้นทาง API ---------------- */
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('GET', '/api/health', () => ({ ok: true, app: 'mali', version: 1 }));

route('POST', '/api/auth/signup', async (req, res) => {
  const ip = clientIp(req), w = limited('signup:' + ip, 20, 3600e3);
  if (w) fail(429, `สมัครบ่อยเกินไป รออีก ${w} วินาที`);
  const b = await readJson(req);
  const handle = str(b.handle, 30, 'ชื่อผู้ใช้').toLowerCase();
  const name = str(b.name, 40, 'ชื่อ') || handle;
  const pw = typeof b.password === 'string' ? b.password : '';
  if (!/^[a-z0-9_.]{3,30}$/.test(handle) || /^\.|\.$|\.\./.test(handle)) fail(400, 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 _ . ยาว 3–30 ตัว');
  if (pw.length < 8 || pw.length > 128) fail(400, 'รหัสผ่านต้องยาว 8–128 ตัวอักษร');
  if (pw.toLowerCase().includes(handle)) fail(400, 'รหัสผ่านต้องไม่มีชื่อผู้ใช้อยู่ด้วย');
  if (q('SELECT 1 FROM users WHERE handle = ?').get(handle) || handleReservedFor(handle)) fail(409, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
  const id = newId('u_');
  q('INSERT INTO users (id, handle, name, pw, created, hue) VALUES (?,?,?,?,?,?)').run(id, handle, name, await hashPw(pw), now(), crypto.randomInt(0, 360));
  createSession(res, id, req);
  return { user: pubUser(q('SELECT * FROM users WHERE id = ?').get(id)) };
});

route('POST', '/api/auth/login', async (req, res) => {
  const ip = clientIp(req);
  const w = limited('login:' + ip, 10, 900e3);
  if (w) fail(429, `ลองเข้าสู่ระบบบ่อยเกินไป รออีก ${w} วินาที`);
  const b = await readJson(req);
  const handle = str(b.handle || '', 30, 'ชื่อผู้ใช้').toLowerCase();
  const pw = typeof b.password === 'string' ? b.password.slice(0, 128) : '';
  const u = q('SELECT * FROM users WHERE handle = ?').get(handle);
  if (u && u.locked_until > now()) fail(429, `บัญชีถูกล็อกชั่วคราว ลองใหม่ใน ${Math.ceil((u.locked_until - now()) / 60000)} นาที`);
  const ok = await checkPw(pw, u ? u.pw : DUMMY_HASH); // ตรวจเสมอเพื่อไม่ให้เดาได้จากเวลาตอบว่ามีบัญชีไหม
  if (!u || !ok) {
    if (u) { const f = u.failed + 1; q('UPDATE users SET failed = ?, locked_until = ? WHERE id = ?').run(f >= 5 ? 0 : f, f >= 5 ? now() + 15 * 60e3 : 0, u.id); }
    fail(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  q('UPDATE users SET failed = 0, locked_until = 0 WHERE id = ?').run(u.id);
  createSession(res, u.id, req);
  return { user: pubUser(u) };
});

// ออกจากระบบเฉพาะบัญชีที่ใช้อยู่ แล้วสลับไปบัญชีอื่นในเครื่อง (ถ้ามี)
function signOut(req, res, userId, everywhere) {
  const c = cookies(req);
  if (everywhere) q('DELETE FROM sessions WHERE user_id = ?').run(userId);
  else { const tk = c['mali_s_' + userId] || c.mali_sid; if (tk) q('DELETE FROM sessions WHERE token = ?').run(sha256(tk)); }
  addCookie(res, `mali_s_${userId}=; ${cookieOpts(req, 0)}`);
  if (c.mali_sid) addCookie(res, `mali_sid=; ${cookieOpts(req, 0)}`);
  const next = deviceAccounts(req).find(a => a.user.id !== userId);
  addCookie(res, next ? `mali_a=${next.user.id}; ${cookieOpts(req, SESSION_DAYS * 86400)}` : `mali_a=; ${cookieOpts(req, 0)}`);
  return { ok: true, next: next ? pubUser(next.user) : null };
}
route('POST', '/api/auth/logout', (req, res) => { const u = currentUser(req); if (!u) return { ok: true, next: null }; return signOut(req, res, u.id, false); });
route('POST', '/api/auth/logout-all', (req, res) => { const u = needUser(req); return signOut(req, res, u.id, true); });
route('GET', '/api/auth/accounts', req => {
  const cur = currentUser(req);
  return { accounts: deviceAccounts(req).map(a => ({ user: pubUser(a.user), active: a.user.id === cur?.id,
    unread: q('SELECT COUNT(*) n FROM messages WHERE to_id = ? AND read_at IS NULL').get(a.user.id).n })) };
});
route('POST', '/api/auth/switch', async (req, res) => {
  const id = String((await readJson(req)).id || '');
  const a = deviceAccounts(req).find(x => x.user.id === id) || fail(401, 'บัญชีนี้ออกจากระบบไปแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');
  addCookie(res, `mali_a=${a.user.id}; ${cookieOpts(req, SESSION_DAYS * 86400)}`);
  return { user: pubUser(a.user) };
});

route('GET', '/api/me', req => {
  const u = currentUser(req);
  if (!u) return { user: null };
  return { user: pubUser(u), unread: q('SELECT COUNT(*) n FROM messages WHERE to_id = ? AND read_at IS NULL').get(u.id).n };
});
route('PATCH', '/api/me', async req => {
  const u = needUser(req), b = await readJson(req);
  const name = b.name != null ? str(b.name, 40, 'ชื่อ') || u.name : u.name;
  const bio = b.bio != null ? str(b.bio, 150, 'Bio') : u.bio;
  let avatar = u.avatar;
  if (b.avatar !== undefined) { if (b.avatar === null) avatar = null; else if (mediaUrlOk(b.avatar) && /\.(jpg|png|webp|gif)$/.test(b.avatar)) avatar = b.avatar; else fail(400, 'รูปโปรไฟล์ไม่ถูกต้อง'); }
  q('UPDATE users SET name = ?, bio = ?, avatar = ? WHERE id = ?').run(name, bio, avatar, u.id);
  return { user: pubUser(q('SELECT * FROM users WHERE id = ?').get(u.id)) };
});

route('GET', '/api/me/handle', req => {
  const me = needUser(req);
  const prev = q('SELECT old, ts FROM handle_changes WHERE user_id = ? AND ts > ? ORDER BY ts DESC LIMIT 1').get(me.id, now() - HANDLE_RESERVE_MS);
  const recent = q('SELECT COUNT(*) n FROM handle_changes WHERE user_id = ? AND ts > ?').get(me.id, now() - HANDLE_WINDOW_MS).n;
  return { handle: me.handle, previous: prev && !q('SELECT 1 FROM users WHERE handle = ? AND id != ?').get(prev.old, me.id) ? { handle: prev.old, until: prev.ts + HANDLE_RESERVE_MS } : null, left: Math.max(0, HANDLE_MAX - recent) };
});
route('GET', '/api/handle-available', (req, res, p, url) => {
  const me = needUser(req), h = String(url.searchParams.get('h') || '').toLowerCase();
  if (!handleOk(h)) return { ok: false, reason: 'format' };
  const owner = q('SELECT id FROM users WHERE handle = ?').get(h), rsv = handleReservedFor(h);
  return { ok: (!owner || owner.id === me.id) && (!rsv || rsv === me.id) };
});
route('POST', '/api/me/handle', async req => {
  const me = needUser(req);
  const h = str((await readJson(req)).handle || '', 30, 'ชื่อผู้ใช้').toLowerCase();
  if (!handleOk(h)) fail(400, 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 _ . ยาว 3–30 ตัว');
  if (h === me.handle.toLowerCase()) return { user: pubUser(me) };
  if (q('SELECT COUNT(*) n FROM handle_changes WHERE user_id = ? AND ts > ?').get(me.id, now() - HANDLE_WINDOW_MS).n >= HANDLE_MAX) fail(429, 'เปลี่ยนชื่อผู้ใช้ได้สูงสุด 5 ครั้งใน 30 นาที ลองใหม่ภายหลัง');
  const owner = q('SELECT id FROM users WHERE handle = ?').get(h), rsv = handleReservedFor(h);
  if ((owner && owner.id !== me.id) || (rsv && rsv !== me.id)) fail(409, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
  q('UPDATE users SET handle = ? WHERE id = ?').run(h, me.id);
  q('INSERT INTO handle_changes VALUES (?,?,?,?)').run(me.id, me.handle, h, now());
  return { user: pubUser(q('SELECT * FROM users WHERE id = ?').get(me.id)) };
});

route('GET', '/api/users', (req, res, p, url) => {
  needUser(req);
  const s = String(url.searchParams.get('q') || '').trim().slice(0, 30).replace(/[%_\\]/g, m => '\\' + m);
  const rows = s ? q("SELECT * FROM users WHERE handle LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' ORDER BY created DESC LIMIT 30").all(`%${s}%`, `%${s}%`)
    : q('SELECT * FROM users ORDER BY created DESC LIMIT 30').all();
  return { users: rows.map(pubUser) };
});
route('GET', '/api/users/:handle', (req, res, p) => {
  const me = needUser(req);
  const u = q('SELECT * FROM users WHERE handle = ?').get(p.handle) || fail(404, 'ไม่พบบัญชีนี้');
  return {
    user: pubUser(u),
    followers: q('SELECT COUNT(*) n FROM follows WHERE followee = ?').get(u.id).n,
    following: q('SELECT COUNT(*) n FROM follows WHERE follower = ?').get(u.id).n,
    isFollowing: !!q('SELECT 1 FROM follows WHERE follower = ? AND followee = ?').get(me.id, u.id),
    followsMe: !!q('SELECT 1 FROM follows WHERE follower = ? AND followee = ?').get(u.id, me.id),
    posts: q('SELECT * FROM posts WHERE user_id = ? ORDER BY created DESC LIMIT 60').all(u.id).map(x => postOut(x, me.id))
  };
});
route('POST', '/api/users/:handle/follow', (req, res, p) => {
  const me = needUser(req);
  if (limited('follow:' + me.id, 60, 3600e3)) fail(429, 'ติดตามบ่อยเกินไป');
  const u = q('SELECT * FROM users WHERE handle = ?').get(p.handle) || fail(404, 'ไม่พบบัญชีนี้');
  if (u.id === me.id) fail(400, 'ติดตามตัวเองไม่ได้');
  const has = q('SELECT 1 FROM follows WHERE follower = ? AND followee = ?').get(me.id, u.id);
  if (has) q('DELETE FROM follows WHERE follower = ? AND followee = ?').run(me.id, u.id);
  else { q('INSERT INTO follows VALUES (?,?,?)').run(me.id, u.id, now()); emit(u.id, 'follow', { user: pubUser(me) }); }
  return { following: !has };
});

/* ผู้ติดตาม / กำลังติดตาม / แนะนำ */
const mutualCount = (meId, uid) => q('SELECT COUNT(*) n FROM follows a JOIN follows b ON b.follower = a.followee WHERE a.follower = ? AND b.followee = ?').get(meId, uid).n;
const relRow = (me, u, since) => ({ user: pubUser(u), since,
  iFollow: !!q('SELECT 1 FROM follows WHERE follower = ? AND followee = ?').get(me.id, u.id),
  followsMe: !!q('SELECT 1 FROM follows WHERE follower = ? AND followee = ?').get(u.id, me.id),
  mutual: mutualCount(me.id, u.id) });
for (const kind of ['followers', 'following']) {
  route('GET', `/api/users/:handle/${kind}`, (req, res, p, url) => {
    const me = needUser(req);
    const u = q('SELECT * FROM users WHERE handle = ?').get(p.handle) || fail(404, 'ไม่พบบัญชีนี้');
    const order = { new: 'f.created DESC', old: 'f.created ASC' }[url.searchParams.get('sort')] || 'f.created DESC';
    const s = String(url.searchParams.get('q') || '').trim().slice(0, 30).replace(/[%_\\]/g, m => '\\' + m);
    const join = kind === 'followers' ? 'f.follower = x.id WHERE f.followee = ?' : 'f.followee = x.id WHERE f.follower = ?';
    const rows = q(`SELECT x.*, f.created since FROM follows f JOIN users x ON ${join} ${s ? "AND (x.handle LIKE ? ESCAPE '\\' OR x.name LIKE ? ESCAPE '\\')" : ''} ORDER BY ${order} LIMIT 500`)
      .all(...(s ? [u.id, `%${s}%`, `%${s}%`] : [u.id]));
    return { user: pubUser(u),
      counts: { followers: q('SELECT COUNT(*) n FROM follows WHERE followee = ?').get(u.id).n, following: q('SELECT COUNT(*) n FROM follows WHERE follower = ?').get(u.id).n },
      rows: rows.map(x => relRow(me, x, x.since)) };
  });
}
route('GET', '/api/suggestions', req => {
  const me = needUser(req);
  // คนที่ติดตามเราแต่เรายังไม่ติดตามกลับ + เพื่อนของเพื่อน เรียงตามจำนวนเพื่อนร่วมกัน
  const rows = q(`SELECT x.*, (SELECT COUNT(*) FROM follows a JOIN follows b ON b.follower = a.followee WHERE a.follower = ? AND b.followee = x.id) mutual,
      EXISTS (SELECT 1 FROM follows WHERE follower = x.id AND followee = ?) fm
    FROM users x WHERE x.id != ? AND x.id NOT IN (SELECT followee FROM follows WHERE follower = ?)
    ORDER BY fm DESC, mutual DESC, x.created DESC LIMIT 20`).all(me.id, me.id, me.id, me.id);
  return { users: rows.map(x => ({ user: pubUser(x), mutual: x.mutual, followsMe: !!x.fm })) };
});
route('POST', '/api/users/:handle/remove-follower', (req, res, p) => {
  const me = needUser(req);
  const u = q('SELECT * FROM users WHERE handle = ?').get(p.handle) || fail(404, 'ไม่พบบัญชีนี้');
  q('DELETE FROM follows WHERE follower = ? AND followee = ?').run(u.id, me.id);
  return { ok: true };
});

route('GET', '/api/feed', (req, res, p, url) => {
  const me = needUser(req);
  const before = +url.searchParams.get('before') || 9e15;
  const rows = q(`SELECT * FROM posts WHERE created < ? ORDER BY
      (user_id = ? OR user_id IN (SELECT followee FROM follows WHERE follower = ?)) DESC, created DESC LIMIT 30`).all(before, me.id, me.id);
  return { posts: rows.map(x => postOut(x, me.id)) };
});
route('POST', '/api/posts', async req => {
  const me = needUser(req);
  const w = limited('post:' + me.id, 20, 3600e3); if (w) fail(429, `โพสต์บ่อยเกินไป รออีก ${w} วินาที`);
  const b = await readJson(req);
  const caption = str(b.caption || '', 2200, 'คำบรรยาย');
  const media = Array.isArray(b.media) ? b.media.slice(0, 10) : [];
  if (!media.every(mediaUrlOk)) fail(400, 'ไฟล์แนบไม่ถูกต้อง');
  if (!caption && !media.length) fail(400, 'โพสต์ว่างไม่ได้');
  const id = newId('p_');
  q('INSERT INTO posts (id, user_id, caption, media, created) VALUES (?,?,?,?,?)').run(id, me.id, caption, JSON.stringify(media), now());
  const out = postOut(q('SELECT * FROM posts WHERE id = ?').get(id), me.id);
  for (const f of q('SELECT follower FROM follows WHERE followee = ?').all(me.id)) emit(f.follower, 'post', { id });
  return { post: out };
});
route('DELETE', '/api/posts/:id', (req, res, p) => {
  const me = needUser(req);
  const post = q('SELECT * FROM posts WHERE id = ?').get(p.id) || fail(404, 'ไม่พบโพสต์');
  if (post.user_id !== me.id) fail(403, 'ลบได้เฉพาะโพสต์ของคุณ');
  q('DELETE FROM posts WHERE id = ?').run(p.id);
  return { ok: true };
});
route('POST', '/api/posts/:id/like', (req, res, p) => {
  const me = needUser(req);
  if (limited('like:' + me.id, 200, 3600e3)) fail(429, 'กดถูกใจบ่อยเกินไป');
  const post = q('SELECT * FROM posts WHERE id = ?').get(p.id) || fail(404, 'ไม่พบโพสต์');
  const has = q('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(p.id, me.id);
  if (has) q('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(p.id, me.id);
  else { q('INSERT INTO likes VALUES (?,?)').run(p.id, me.id); if (post.user_id !== me.id) emit(post.user_id, 'like', { post: p.id, user: pubUser(me) }); }
  return { liked: !has, likes: q('SELECT COUNT(*) n FROM likes WHERE post_id = ?').get(p.id).n };
});
route('GET', '/api/posts/:id/comments', (req, res, p) => {
  needUser(req);
  return { comments: q('SELECT c.*, u.handle, u.name, u.avatar, u.hue FROM comments c JOIN users u ON u.id = c.user_id WHERE post_id = ? ORDER BY created LIMIT 300').all(p.id)
    .map(c => ({ id: c.id, text: c.text, created: c.created, user: { id: c.user_id, handle: c.handle, name: c.name, avatar: c.avatar, hue: c.hue } })) };
});
route('POST', '/api/posts/:id/comments', async (req, res, p) => {
  const me = needUser(req);
  const w = limited('comment:' + me.id, 30, 600e3); if (w) fail(429, `แสดงความคิดเห็นบ่อยเกินไป รออีก ${w} วินาที`);
  const post = q('SELECT * FROM posts WHERE id = ?').get(p.id) || fail(404, 'ไม่พบโพสต์');
  const text = str((await readJson(req)).text || '', 1000, 'ความคิดเห็น');
  if (!text) fail(400, 'ความคิดเห็นว่างไม่ได้');
  const id = newId('c_');
  q('INSERT INTO comments VALUES (?,?,?,?,?)').run(id, p.id, me.id, text, now());
  if (post.user_id !== me.id) emit(post.user_id, 'comment', { post: p.id, user: pubUser(me), text: text.slice(0, 80) });
  return { comment: { id, text, created: now(), user: pubUser(me) } };
});

route('GET', '/api/chats', req => {
  const me = needUser(req);
  const rows = q(`SELECT m.* FROM messages m JOIN (SELECT pair, MAX(created) mc FROM messages WHERE from_id = ? OR to_id = ? GROUP BY pair) x
      ON x.pair = m.pair AND x.mc = m.created ORDER BY m.created DESC LIMIT 100`).all(me.id, me.id);
  return { chats: rows.map(m => {
    const other = m.from_id === me.id ? m.to_id : m.from_id;
    return { user: pubUser(q('SELECT * FROM users WHERE id = ?').get(other)), last: msgOut(m),
      unread: q('SELECT COUNT(*) n FROM messages WHERE pair = ? AND to_id = ? AND read_at IS NULL').get(m.pair, me.id).n };
  }) };
});
route('GET', '/api/chats/:handle', (req, res, p, url) => {
  const me = needUser(req);
  const u = q('SELECT * FROM users WHERE handle = ?').get(p.handle) || fail(404, 'ไม่พบบัญชีนี้');
  const after = +url.searchParams.get('after') || 0;
  const msgs = q('SELECT * FROM (SELECT * FROM messages WHERE pair = ? AND created > ? ORDER BY created DESC LIMIT 200) ORDER BY created').all(pairOf(me.id, u.id), after);
  return { user: pubUser(u), messages: msgs.map(msgOut) };
});
route('POST', '/api/chats/:handle', async (req, res, p) => {
  const me = needUser(req);
  const w = limited('msg:' + me.id, 30, 60e3); if (w) fail(429, `ส่งข้อความเร็วเกินไป รออีก ${w} วินาที`);
  const u = q('SELECT * FROM users WHERE handle = ?').get(p.handle) || fail(404, 'ไม่พบบัญชีนี้');
  if (u.id === me.id) fail(400, 'ส่งข้อความหาตัวเองไม่ได้');
  const b = await readJson(req);
  const text = str(b.text || '', 2000, 'ข้อความ');
  const media = b.media == null ? null : mediaUrlOk(b.media) ? b.media : fail(400, 'ไฟล์แนบไม่ถูกต้อง');
  if (!text && !media) fail(400, 'ข้อความว่างไม่ได้');
  const m = { id: newId('m_'), pair: pairOf(me.id, u.id), from_id: me.id, to_id: u.id, text, media: media ? JSON.stringify(media) : null, created: now(), read_at: null };
  q('INSERT INTO messages VALUES (?,?,?,?,?,?,?,?)').run(m.id, m.pair, m.from_id, m.to_id, m.text, m.media, m.created, null);
  const out = msgOut(m);
  emit(u.id, 'message', { message: out, user: pubUser(me) });
  emit(me.id, 'message', { message: out, user: pubUser(u) }); // แท็บอื่นของเราเอง
  return { message: out };
});
route('POST', '/api/chats/:handle/read', (req, res, p) => {
  const me = needUser(req);
  const u = q('SELECT * FROM users WHERE handle = ?').get(p.handle) || fail(404, 'ไม่พบบัญชีนี้');
  const r = q('UPDATE messages SET read_at = ? WHERE pair = ? AND to_id = ? AND read_at IS NULL').run(now(), pairOf(me.id, u.id), me.id);
  if (r.changes) emit(u.id, 'read', { by: me.id });
  return { ok: true };
});

route('POST', '/api/upload', async req => {
  const me = needUser(req);
  const w = limited('upload:' + me.id, 60, 3600e3); if (w) fail(429, `อัปโหลดบ่อยเกินไป รออีก ${w} วินาที`);
  const type = String(req.headers['content-type'] || '').split(';')[0].trim();
  const t = MEDIA_TYPES[type] || fail(415, 'รองรับเฉพาะ JPG PNG WebP GIF MP4 MOV WebM');
  const buf = await readBody(req, t.max);
  if (buf.length < 16 || !t.magic(buf)) fail(415, 'เนื้อไฟล์ไม่ตรงกับชนิดไฟล์');
  const name = crypto.randomBytes(16).toString('base64url') + '.' + t.ext;
  fs.writeFileSync(path.join(MEDIA, name), buf, { flag: 'wx' });
  return { url: '/media/' + name, type: type.split('/')[0] };
});

route('GET', '/api/events', (req, res) => {
  const me = needUser(req);
  const set = streams.get(me.id) || new Set();
  if (set.size >= 10) fail(429, 'เปิดการเชื่อมต่อมากเกินไป');
  res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(`retry: 3000\nevent: hello\ndata: {"seq":${SEQ}}\n\n`);
  set.add(res); streams.set(me.id, set);
  res.on('close', () => { set.delete(res); if (!set.size) streams.delete(me.id); });
  return undefined; // ไม่ปิดการตอบกลับ
});

// long-poll: คืนเหตุการณ์ที่ seq > after ทันที หรือรอสูงสุด 25 วินาที
route('GET', '/api/poll', (req, res, p, url) => {
  const me = needUser(req);
  const after = +url.searchParams.get('after') || 0;
  const qu = queues.get(me.id) || { events: [], waiters: new Set() };
  queues.set(me.id, qu);
  const pending = () => qu.events.filter(e => e.seq > after);
  if (after === 0 || pending().length) return { seq: after === 0 ? SEQ : qu.events[qu.events.length - 1].seq, events: after === 0 ? [] : pending().map(({ seq, type, data }) => ({ seq, type, data })) };
  if (qu.waiters.size >= 10) fail(429, 'เปิดการเชื่อมต่อมากเกินไป');
  return new Promise(resolve => {
    const done = () => { clearTimeout(tm); qu.waiters.delete(done); const ev = pending(); resolve({ seq: ev.length ? ev[ev.length - 1].seq : after, events: ev.map(({ seq, type, data }) => ({ seq, type, data })) }); };
    const tm = setTimeout(done, 25e3);
    qu.waiters.add(done);
    res.on('close', () => { clearTimeout(tm); qu.waiters.delete(done); });
  });
});

/* ---------------- ไฟล์ของแอป ---------------- */
function serveStatic(req, res, pathname) {
  let rel;
  if (pathname === '/' || pathname === '/index.html') rel = 'index.html';
  else if (pathname === '/sw.js' || pathname === '/manifest.webmanifest') rel = pathname.slice(1);
  else if (/^\/(css|js|icons)\/[\w\-./]+$/.test(pathname) && !pathname.includes('..')) rel = pathname.slice(1);
  else if (/^\/media\/[A-Za-z0-9_-]+\.\w+$/.test(pathname)) return serveFile(req, res, path.join(MEDIA, path.basename(pathname)), true);
  else return false;
  return serveFile(req, res, path.join(ROOT, rel), false);
}
function serveFile(req, res, file, immutable) {
  let st;
  try { st = fs.statSync(file); if (!st.isFile()) throw 0; } catch { send(res, 404, 'Not found'); return true; }
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = MIME_BY_EXT[ext] || 'application/octet-stream';
  const etag = `"${st.size.toString(36)}-${st.mtimeMs.toString(36)}"`;
  const headers = { ...SEC_HEADERS, 'Content-Type': type, ETag: etag, 'Accept-Ranges': 'bytes', 'Cache-Control': immutable ? 'private, max-age=31536000, immutable' : 'no-cache' };
  if (immutable) headers['Content-Disposition'] = 'inline';
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return true; }
  // รองรับ Range สำหรับวิดีโอ
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    let start = m[1] ? +m[1] : st.size - +m[2], end = m[1] && m[2] ? +m[2] : st.size - 1;
    if (start >= st.size || start < 0 || end < start) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${st.size}` }); res.end(); return true; }
    end = Math.min(end, st.size - 1);
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end(), true;
    fs.createReadStream(file, { start, end }).pipe(res); return true;
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end(), true;
  fs.createReadStream(file).pipe(res);
  return true;
}

/* ---------------- ตัวรับคำขอ ---------------- */
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return send(res, 400, 'Bad request'); }
  const { pathname } = url;
  try {
    if (pathname.startsWith('/api/')) {
      // กัน CSRF: คำขอที่เปลี่ยนข้อมูลต้องมีเฮดเดอร์นี้ ซึ่งเว็บอื่นส่งข้ามโดเมนไม่ได้โดยไม่ผ่าน CORS preflight (เราไม่อนุญาต)
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-mali'] !== '1') fail(403, 'คำขอไม่ถูกต้อง');
      if (limited('ip:' + clientIp(req), 600, 60e3)) fail(429, 'เรียกใช้บ่อยเกินไป');
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(pathname); if (!m) continue;
        const params = Object.fromEntries(Object.entries(m.groups || {}).map(([k, v]) => [k, decodeURIComponent(v)]));
        const out = await r.fn(req, res, params, url);
        if (out !== undefined && !res.headersSent) send(res, 200, out);
        return;
      }
      fail(404, 'ไม่พบ API นี้');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    if (!serveStatic(req, res, pathname)) send(res, 404, 'Not found');
  } catch (e) {
    if (res.headersSent) return res.end();
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...(e.extra || {}) });
    console.error(e);
    send(res, 500, { error: 'เซิร์ฟเวอร์ขัดข้อง' });
  }
});
server.headersTimeout = 20e3;
server.requestTimeout = 120e3;
// ล้าง session ที่หมดอายุ
setInterval(() => q('DELETE FROM sessions WHERE expires < ?').run(now()), 3600e3).unref();

server.listen(PORT, HOST, () => {
  const nets = Object.values(require('node:os').networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
  console.log(`มะลิ เซิร์ฟเวอร์พร้อมแล้ว\n  เครื่องนี้:  http://localhost:${PORT}\n${nets.map(a => `  ในวง Wi-Fi: http://${a}:${PORT}`).join('\n')}\n  ข้อมูล: ${DATA}`);
});
module.exports = server;
