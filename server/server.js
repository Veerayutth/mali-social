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
const kms = require('./kms');
const PROD = process.env.NODE_ENV === 'production';

const PORT = process.env.PORT != null && process.env.PORT !== '' ? +process.env.PORT : 8787;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(__dirname, '..');
const DATA = path.resolve(process.env.MALI_DATA || path.join(__dirname, 'data'));
const MEDIA = path.join(DATA, 'media');
const FORCE_SECURE = process.env.HTTPS === '1'; // บังคับคุกกี้ Secure เสมอ
fs.mkdirSync(MEDIA, { recursive: true });

/* ---------------- ฐานข้อมูล ----------------
   โหมด netlify: ไฟล์ฐานข้อมูลถูกดึง/ส่งกลับ Netlify Blobs ระหว่างคำขอ จึงห่อด้วยตัวแทนที่เปิดไฟล์ใหม่ได้ */
const SERVERLESS = process.env.MALI_MODE === 'netlify';
const DB_FILE = path.join(DATA, 'mali.db');
let realDb = new DatabaseSync(DB_FILE);
const db = { prepare: s => realDb.prepare(s), exec: s => realDb.exec(s) };
globalThis.__maliDb = {
  reopen() { try { realDb.close(); } catch {} realDb = new DatabaseSync(DB_FILE); realDb.exec('PRAGMA foreign_keys = ON;'); },
  changes: () => realDb.prepare('SELECT total_changes() n').get().n,
  file: DB_FILE
};
db.exec(`
  PRAGMA journal_mode = ${SERVERLESS ? 'DELETE' : 'WAL'};
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
// เพิ่มคอลัมน์ใหม่ให้ฐานข้อมูลเดิม (ย้ายข้อมูลแบบไม่ทำลาย)
for (const sql of [
  "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
  'ALTER TABLE users ADD COLUMN suspended_until INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE sessions ADD COLUMN sid TEXT', 'ALTER TABLE sessions ADD COLUMN device_fp TEXT', 'ALTER TABLE sessions ADD COLUMN device_label TEXT',
  'ALTER TABLE sessions ADD COLUMN ip TEXT', 'ALTER TABLE sessions ADD COLUMN country TEXT', 'ALTER TABLE sessions ADD COLUMN last_seen INTEGER',
  'ALTER TABLE sessions ADD COLUMN rotated_at INTEGER', 'ALTER TABLE sessions ADD COLUMN replaced INTEGER NOT NULL DEFAULT 0'
]) { try { db.exec(sql); } catch {} }
db.exec(`CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, reporter TEXT NOT NULL, kind TEXT NOT NULL, target TEXT NOT NULL, target_user TEXT, reason TEXT NOT NULL,
  note TEXT, created INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', handled_by TEXT, handled_at INTEGER);`);
const G = require('./guard')(db);
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

// นโยบายความปลอดภัยของเนื้อหา: อนุญาตเฉพาะแหล่งที่แอปใช้จริง
const CSP = ["default-src 'self'", "script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: blob:", "media-src 'self' blob: data:", "worker-src 'self' blob:",
  "connect-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com https://0.peerjs.com wss://0.peerjs.com",
  "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join('; ');
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
// PROXY บอกว่าอยู่หลังอะไร เพื่อเลือกเฮดเดอร์ที่เชื่อถือได้ (เชื่อเฉพาะเมื่อคำขอมาจากเครื่องนี้):
//   caddy      → X-Forwarded-For ตัวสุดท้าย (Caddy ใส่ IP จริงเอง)
//   cloudflare → CF-Connecting-IP (Cloudflare Tunnel หรือ Cloudflare proxy)
const PROXY = process.env.PROXY || 'cloudflare';
const ipOk = s => typeof s === 'string' && /^[0-9a-fA-F:.]{3,45}$/.test(s);
const clientIp = req => {
  const a = req.socket.remoteAddress || '?';
  if (!isLoopback(a)) return a;
  if (PROXY === 'caddy') { const x = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim(); return ipOk(x) ? x : a; }
  const cf = req.headers['cf-connecting-ip'];
  return ipOk(cf) ? cf : a;
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
const sessionUser = token => token ? q('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires > ? AND u.suspended_until <= ?').get(sha256(token), now(), now()) || null : null;
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
const SESSION_IDLE_MS = 14 * 864e5, ROTATE_MS = 864e5, ROTATE_GRACE_MS = 60e3;
function createSession(res, userId, req) {
  const others = deviceAccounts(req).filter(a => a.user.id !== userId);
  if (others.length >= MAX_ACCOUNTS) fail(400, `เพิ่มบัญชีในเครื่องนี้ได้สูงสุด ${MAX_ACCOUNTS} บัญชี`);
  const token = crypto.randomBytes(32).toString('base64url'), dev = G.deviceOf(req), ip = clientIp(req), country = G.countryOf(req);
  // อุปกรณ์หรือประเทศใหม่ → บันทึกเหตุการณ์และแจ้งเจ้าของบัญชี
  const seenDev = q('SELECT 1 FROM sessions WHERE user_id = ? AND device_fp = ?').get(userId, dev.fp) || q("SELECT 1 FROM security_events WHERE user_id = ? AND type = 'login' AND detail LIKE ?").get(userId, `%${dev.fp}%`);
  const lastCountry = q("SELECT country FROM sessions WHERE user_id = ? AND country IS NOT NULL ORDER BY created DESC LIMIT 1").get(userId)?.country;
  q('INSERT INTO sessions (token, user_id, created, expires, ua, sid, device_fp, device_label, ip, country, last_seen, rotated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(sha256(token), userId, now(), now() + SESSION_DAYS * 864e5, String(req.headers['user-agent'] || '').slice(0, 200), newId('s_'), dev.fp, dev.label, ip, country, now(), now());
  G.event('login', { userId, ip, detail: { device: dev.label, fp: dev.fp, country } });
  G.audit({ actorType: 'user', actorId: userId, action: 'login', target: userId, ip, detail: { device: dev.label } });
  const unusual = (!seenDev && q('SELECT COUNT(*) n FROM sessions WHERE user_id = ?').get(userId).n > 1) || (country && lastCountry && country !== lastCountry);
  if (unusual) {
    G.event('new_device_login', { userId, ip, severity: country && lastCountry && country !== lastCountry ? 'high' : 'info', detail: { device: dev.label, country } });
    emit(userId, 'security', { text: `เข้าสู่ระบบจากอุปกรณ์ใหม่: ${dev.label}${country ? ' (' + country + ')' : ''}` });
  }
  addCookie(res, `mali_s_${userId}=${token}; ${cookieOpts(req, SESSION_DAYS * 86400)}`);
  addCookie(res, `mali_a=${userId}; ${cookieOpts(req, SESSION_DAYS * 86400)}`);
  if (cookies(req).mali_sid) addCookie(res, `mali_sid=; ${cookieOpts(req, 0)}`); // คุกกี้แบบเก่า
}
// ตรวจ session: หมดอายุ / ไม่ได้ใช้นานเกิน / ใช้จากอุปกรณ์อื่น (สงสัยโทเค็นถูกขโมย) / บัญชีถูกระงับ
function checkSession(req, token, cookieName) {
  if (!token) return null;
  const s = q('SELECT * FROM sessions WHERE token = ? AND expires > ?').get(sha256(token), now());
  if (!s) return null;
  if (s.last_seen && now() - s.last_seen > SESSION_IDLE_MS) { q('DELETE FROM sessions WHERE token = ?').run(s.token); return null; }
  const dev = G.deviceOf(req);
  if (s.device_fp && s.device_fp !== dev.fp) {
    q('DELETE FROM sessions WHERE token = ?').run(s.token);
    G.event('token_device_mismatch', { userId: s.user_id, ip: clientIp(req), severity: 'high', detail: { expected: s.device_label, got: dev.label } });
    G.audit({ actorType: 'system', action: 'revoke_session_device_mismatch', target: s.user_id, ip: clientIp(req) });
    return null;
  }
  const u = q('SELECT * FROM users WHERE id = ?').get(s.user_id);
  if (!u || u.suspended_until > now()) return null;
  if (!s.last_seen || now() - s.last_seen > 60e3) q('UPDATE sessions SET last_seen = ?, ip = ? WHERE token = ?').run(now(), clientIp(req), s.token);
  // หมุนโทเค็นทุก 24 ชม.: ออกโทเค็นใหม่ โทเค็นเดิมใช้ได้อีก 60 วินาทีสำหรับคำขอที่กำลังวิ่งอยู่
  const res = req._res;
  if (res && cookieName && !s.replaced && now() - (s.rotated_at || s.created) > ROTATE_MS) {
    const nt = crypto.randomBytes(32).toString('base64url');
    q('INSERT INTO sessions (token, user_id, created, expires, ua, sid, device_fp, device_label, ip, country, last_seen, rotated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(sha256(nt), s.user_id, s.created, s.expires, s.ua, s.sid, s.device_fp, s.device_label, clientIp(req), s.country, now(), now());
    q('UPDATE sessions SET expires = ?, replaced = 1 WHERE token = ?').run(now() + ROTATE_GRACE_MS, s.token);
    addCookie(res, `${cookieName}=${nt}; ${cookieOpts(req, Math.max(1, Math.floor((s.expires - now()) / 1000)))}`);
  }
  return u;
}
function currentUser(req) {
  if (req._user !== undefined) return req._user;
  const c = cookies(req);
  let u = null;
  if (c.mali_a && /^[\w-]+$/.test(c.mali_a)) { const x = checkSession(req, c['mali_s_' + c.mali_a], 'mali_s_' + c.mali_a); if (x && x.id === c.mali_a) u = x; }
  if (!u) u = checkSession(req, c.mali_sid, 'mali_sid');
  return (req._user = u);
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
// ข้อความแชตเก็บแบบเข้ารหัส (kms.seal) และถอดรหัสตอนส่งให้ผู้ใช้ที่มีสิทธิ์
const msgOut = m => { const media = kms.open(m.media); return { id: m.id, from: m.from_id, to: m.to_id, text: kms.open(m.text) || '', media: media ? JSON.parse(media) : null, created: m.created, read: !!m.read_at }; };
const pairOf = (a, b) => [a, b].sort().join('|');

/* ---------------- เรียลไทม์ (SSE) ---------------- */
const streams = new Map(); // userId → Set<res>  (SSE)
const queues = new Map();  // userId → { seq, events: [{seq,type,data,ts}], waiters: Set<fn> }  (long-poll สำรอง)
let SEQ = Date.now();
db.exec('CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, ts INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS events_user ON events(user_id, id);');
function emit(userId, type, data) {
  if (SERVERLESS) { // หลายอินสแตนซ์: เก็บเหตุการณ์ไว้ในฐานข้อมูลให้ /api/poll อ่าน
    q('INSERT INTO events (user_id, type, data, ts) VALUES (?,?,?,?)').run(userId, type, JSON.stringify(data), now());
    if (Math.random() < .05) q('DELETE FROM events WHERE ts < ?').run(now() - 3600e3);
    return;
  }
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
// ไฟล์สื่อ: เก็บในโฟลเดอร์ (เซิร์ฟเวอร์ปกติ) หรือ Netlify Blobs (MEDIA_STORE=blobs)
const MEDIA_BLOBS = process.env.MEDIA_STORE === 'blobs';
let mediaStoreP = null;
const mediaStore = () => mediaStoreP || (mediaStoreP = import('@netlify/blobs').then(m => m.getStore({ name: 'mali-media', consistency: 'strong' })));
async function mediaPut(name, buf) {
  if (MEDIA_BLOBS) { const r = await (await mediaStore()).set(name, buf, { onlyIfNew: true }); if (!r.modified) fail(500, 'บันทึกไฟล์ไม่สำเร็จ'); return; }
  fs.writeFileSync(path.join(MEDIA, name), buf, { flag: 'wx', mode: 0o600 });
}
async function mediaGet(name) {
  if (MEDIA_BLOBS) { const ab = await (await mediaStore()).get(name, { type: 'arrayBuffer' }); return ab ? Buffer.from(ab) : null; }
  try { return fs.readFileSync(path.join(MEDIA, name)); } catch { return null; }
}
const mediaNameOk = u => typeof u === 'string' && /^\/media\/[A-Za-z0-9_-]{12,40}\.(jpg|png|webp|gif|mp4|mov|webm)$/.test(u);
async function mediaUrlOk(u) {
  if (!mediaNameOk(u)) return false;
  if (MEDIA_BLOBS) return !!(await (await mediaStore()).getMetadata(path.basename(u)));
  return fs.existsSync(path.join(MEDIA, path.basename(u)));
}
const SECURITY_TXT = `Contact: ${process.env.SECURITY_CONTACT || 'mailto:security@mali.example'}
Expires: ${new Date(Date.now() + 300 * 864e5).toISOString()}
Preferred-Languages: th, en
Policy: ${process.env.PUBLIC_URL || ''}/security-policy
`;

/* ---------------- เส้นทาง API ---------------- */
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, pattern, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('GET', '/api/health', () => { q('SELECT 1').get(); return { ok: true, app: 'mali', version: 2, realtime: SERVERLESS ? 'poll' : 'sse' }; });

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
  G.audit({ actorType: 'user', actorId: id, action: 'signup', target: id, ip });
  createSession(res, id, req);
  return { user: pubUser(q('SELECT * FROM users WHERE id = ?').get(id)) };
});

route('POST', '/api/auth/login', async (req, res) => {
  const ip = clientIp(req);
  const w = limited('login:' + ip, 10, 900e3);
  if (w) fail(429, `ลองเข้าสู่ระบบบ่อยเกินไป รออีก ${w} วินาที`);
  const blk = G.restricted(ip, 'login');
  if (blk) fail(429, `เครือข่ายนี้ถูกระงับการเข้าสู่ระบบชั่วคราว ลองใหม่ใน ${Math.ceil((blk.until - now()) / 60000)} นาที`);
  const b = await readJson(req);
  const handle = str(b.handle || '', 30, 'ชื่อผู้ใช้').toLowerCase();
  const pw = typeof b.password === 'string' ? b.password.slice(0, 128) : '';
  const u = q('SELECT * FROM users WHERE handle = ?').get(handle);
  if (u && u.locked_until > now()) fail(429, `บัญชีถูกล็อกชั่วคราว ลองใหม่ใน ${Math.ceil((u.locked_until - now()) / 60000)} นาที`);
  const ok = await checkPw(pw, u ? u.pw : DUMMY_HASH); // ตรวจเสมอเพื่อไม่ให้เดาได้จากเวลาตอบว่ามีบัญชีไหม
  if (!u || !ok) {
    G.rules.loginFailed(ip, handle);
    if (u) { const f = u.failed + 1; q('UPDATE users SET failed = ?, locked_until = ? WHERE id = ?').run(f >= 5 ? 0 : f, f >= 5 ? now() + 15 * 60e3 : 0, u.id); if (f >= 5) G.event('account_locked', { userId: u.id, ip, severity: 'high' }); }
    fail(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  if (u.suspended_until > now()) fail(403, 'บัญชีนี้ถูกระงับชั่วคราวจากการละเมิดข้อกำหนด');
  q('UPDATE users SET failed = 0, locked_until = 0 WHERE id = ?').run(u.id);
  createSession(res, u.id, req);
  return { user: pubUser(u) };
});

// ออกจากระบบเฉพาะบัญชีที่ใช้อยู่ แล้วสลับไปบัญชีอื่นในเครื่อง (ถ้ามี)
function signOut(req, res, userId, everywhere) {
  const c = cookies(req);
  G.audit({ actorType: 'user', actorId: userId, action: everywhere ? 'logout_all' : 'logout', target: userId, ip: clientIp(req) });
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
  if (b.avatar !== undefined) { if (b.avatar === null) avatar = null; else if (await mediaUrlOk(b.avatar) && /\.(jpg|png|webp|gif)$/.test(b.avatar)) avatar = b.avatar; else fail(400, 'รูปโปรไฟล์ไม่ถูกต้อง'); }
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
  if (G.restricted(me.id, 'follow')) fail(429, 'บัญชีของคุณถูกจำกัดการติดตามชั่วคราว 24 ชั่วโมง เพราะติดตามจำนวนมากผิดปกติ');
  const u = q('SELECT * FROM users WHERE handle = ?').get(p.handle) || fail(404, 'ไม่พบบัญชีนี้');
  if (u.id === me.id) fail(400, 'ติดตามตัวเองไม่ได้');
  const has = q('SELECT 1 FROM follows WHERE follower = ? AND followee = ?').get(me.id, u.id);
  if (has) q('DELETE FROM follows WHERE follower = ? AND followee = ?').run(me.id, u.id);
  else { q('INSERT INTO follows VALUES (?,?,?)').run(me.id, u.id, now()); G.rules.followed(me.id, clientIp(req)); emit(u.id, 'follow', { user: pubUser(me) }); }
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
  for (const u of media) if (!(await mediaUrlOk(u))) fail(400, 'ไฟล์แนบไม่ถูกต้อง');
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
  const media = b.media == null ? null : (await mediaUrlOk(b.media)) ? b.media : fail(400, 'ไฟล์แนบไม่ถูกต้อง');
  if (!text && !media) fail(400, 'ข้อความว่างไม่ได้');
  const follows = (a, b) => !!q('SELECT 1 FROM follows WHERE follower = ? AND followee = ?').get(a, b);
  const known = follows(u.id, me.id) || q('SELECT 1 FROM messages WHERE pair = ? AND from_id = ?').get(pairOf(me.id, u.id), u.id);
  if (!known) {
    if (G.restricted(me.id, 'dm_strangers')) fail(429, 'บัญชีของคุณส่งข้อความหาคนที่ไม่ได้ติดตามคุณได้ไม่ชั่วคราว 24 ชั่วโมง เพราะระบบพบการส่งจำนวนมากผิดปกติ');
    G.rules.messagedStranger(me, u.id, clientIp(req));
  }
  const m = { id: newId('m_'), pair: pairOf(me.id, u.id), from_id: me.id, to_id: u.id, text: kms.seal(text), media: media ? kms.seal(JSON.stringify(media)) : null, created: now(), read_at: null };
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
  await mediaPut(name, kms.sealFile(buf));
  return { url: '/media/' + name, type: type.split('/')[0] };
});

route('GET', '/api/events', (req, res) => {
  if (SERVERLESS) fail(404, 'ใช้ /api/poll');
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
  if (SERVERLESS) { // ตอบทันที ไคลเอนต์จะถามใหม่เป็นระยะ (ฟังก์ชันรอนานไม่ได้)
    if (url.searchParams.has('init')) return { seq: q('SELECT COALESCE(MAX(id), 0) n FROM events').get().n, events: [], interval: 5000 };
    const rows = q('SELECT * FROM events WHERE user_id = ? AND id > ? ORDER BY id LIMIT 100').all(me.id, after);
    const seq = rows.length ? rows[rows.length - 1].id : Math.max(after, q('SELECT COALESCE(MAX(id), 0) n FROM events').get().n);
    return { seq, events: rows.map(r => ({ seq: r.id, type: r.type, data: JSON.parse(r.data) })), interval: 5000 };
  }
  const qu = queues.get(me.id) || { events: [], waiters: new Set() };
  queues.set(me.id, qu);
  const pending = () => qu.events.filter(e => e.seq > after);
  const init = url.searchParams.has('init') || after === 0;
  if (init || pending().length) return { seq: init ? SEQ : qu.events[qu.events.length - 1].seq, events: init ? [] : pending().map(({ seq, type, data }) => ({ seq, type, data })) };
  if (qu.waiters.size >= 10) fail(429, 'เปิดการเชื่อมต่อมากเกินไป');
  return new Promise(resolve => {
    const done = () => { clearTimeout(tm); qu.waiters.delete(done); const ev = pending(); resolve({ seq: ev.length ? ev[ev.length - 1].seq : after, events: ev.map(({ seq, type, data }) => ({ seq, type, data })) }); };
    const tm = setTimeout(done, 25e3);
    qu.waiters.add(done);
    res.on('close', () => { clearTimeout(tm); qu.waiters.delete(done); });
  });
});


/* ---------------- ความปลอดภัยของบัญชี (ผู้ใช้ดูและจัดการเองได้) ---------------- */
route('GET', '/api/security/sessions', req => {
  const me = needUser(req), c = cookies(req), mine = sha256(c['mali_s_' + me.id] || c.mali_sid || '');
  const rows = q('SELECT * FROM sessions WHERE user_id = ? AND expires > ? AND replaced = 0 ORDER BY last_seen DESC').all(me.id, now());
  const maskIp = ip => !ip ? '' : ip.includes(':') ? ip.split(':').slice(0, 3).join(':') + ':…' : ip.split('.').slice(0, 2).join('.') + '.x.x';
  return { sessions: rows.map(s => ({ id: s.sid || s.token.slice(0, 12), device: s.device_label || 'อุปกรณ์ไม่ทราบชื่อ', ip: maskIp(s.ip), country: s.country, created: s.created, lastSeen: s.last_seen || s.created, current: s.token === mine })) };
});
route('DELETE', '/api/security/sessions/:id', (req, res, p) => {
  const me = needUser(req);
  const r = q('DELETE FROM sessions WHERE user_id = ? AND (sid = ? OR substr(token, 1, 12) = ?)').run(me.id, p.id, p.id);
  if (!r.changes) fail(404, 'ไม่พบอุปกรณ์นี้');
  G.audit({ actorType: 'user', actorId: me.id, action: 'revoke_session', target: me.id, ip: clientIp(req) });
  return { ok: true };
});
route('GET', '/api/security/events', req => {
  const me = needUser(req);
  const rows = q("SELECT ts, type, severity, detail FROM security_events WHERE user_id = ? AND type IN ('login','new_device_login','token_device_mismatch','account_locked','mass_follow','spam_suspected') ORDER BY ts DESC LIMIT 50").all(me.id);
  return { events: rows.map(r => { const d = r.detail ? JSON.parse(r.detail) : {}; delete d.fp; return { ts: r.ts, type: r.type, severity: r.severity, detail: d }; }),
    restrictions: q('SELECT kind, until, reason FROM restrictions WHERE subject = ? AND until > ?').all(me.id, now()) };
});
// ใครเข้าถึงข้อมูลของฉัน (เจ้าหน้าที่หรือแอปที่เชื่อมต่อ) จาก audit log
route('GET', '/api/security/access', req => {
  const me = needUser(req);
  return { access: q("SELECT ts, actor_type, actor_id, action FROM audit_log WHERE target_user = ? AND actor_type IN ('staff','app') ORDER BY id DESC LIMIT 100").all(me.id)
    .map(r => ({ ts: r.ts, by: r.actor_type === 'app' ? (q('SELECT name FROM oauth_apps WHERE client_id = ?').get(r.actor_id)?.name || 'แอป') : 'เจ้าหน้าที่มะลิ', type: r.actor_type, action: r.action })) };
});

/* ---------------- รายงานเนื้อหา ---------------- */
const REPORT_REASONS = ['spam', 'harassment', 'nudity', 'violence', 'scam', 'impersonation', 'self_harm', 'other'];
route('POST', '/api/report', async req => {
  const me = needUser(req);
  if (limited('report:' + me.id, 20, 3600e3)) fail(429, 'ส่งรายงานบ่อยเกินไป');
  const b = await readJson(req);
  const kind = ['user', 'post', 'comment', 'message'].includes(b.kind) ? b.kind : fail(400, 'ประเภทไม่ถูกต้อง');
  const reason = REPORT_REASONS.includes(b.reason) ? b.reason : fail(400, 'เหตุผลไม่ถูกต้อง');
  const target = str(b.target || '', 60, 'เป้าหมาย');
  let targetUser = null;
  if (kind === 'user') targetUser = q('SELECT id FROM users WHERE handle = ? OR id = ?').get(target, target)?.id;
  if (kind === 'post') targetUser = q('SELECT user_id FROM posts WHERE id = ?').get(target)?.user_id;
  if (kind === 'comment') targetUser = q('SELECT user_id FROM comments WHERE id = ?').get(target)?.user_id;
  if (kind === 'message') { const m = q('SELECT * FROM messages WHERE id = ?').get(target); if (!m || (m.to_id !== me.id && m.from_id !== me.id)) fail(404, 'ไม่พบข้อความ'); targetUser = m.from_id; }
  if (!targetUser) fail(404, 'ไม่พบสิ่งที่รายงาน');
  if (targetUser === me.id) fail(400, 'รายงานตัวเองไม่ได้');
  q('INSERT INTO reports (id, reporter, kind, target, target_user, reason, note, created) VALUES (?,?,?,?,?,?,?,?)').run(newId('r_'), me.id, kind, target, targetUser, reason, str(b.note || '', 500, 'รายละเอียด'), now());
  const open = q("SELECT COUNT(DISTINCT reporter) n FROM reports WHERE target_user = ? AND status = 'open' AND created > ?").get(targetUser, now() - 86400e3).n;
  if (open >= 5) G.event('many_reports', { userId: targetUser, severity: 'high', detail: { reporters: open } });
  return { ok: true };
});

/* ---------------- เจ้าหน้าที่ (least privilege + บันทึกทุกการเข้าถึง) ----------------
   สิทธิ์: user < moderator (ดูรายงาน ดูโปรไฟล์ ระงับบัญชี) < admin (ดู audit log ตั้งสิทธิ์)
   ให้สิทธิ์ผ่านคำสั่งบนเซิร์ฟเวอร์เท่านั้น: node server/admin.js grant <handle> moderator */
const ROLE_RANK = { user: 0, moderator: 1, admin: 2 };
const needRole = (req, role) => { const u = needUser(req); if ((ROLE_RANK[u.role] || 0) < ROLE_RANK[role]) fail(403, 'ไม่มีสิทธิ์'); return u; };
route('GET', '/api/admin/reports', (req, res, p, url) => {
  const st = needRole(req, 'moderator');
  G.audit({ actorType: 'staff', actorId: st.id, action: 'list_reports', ip: clientIp(req) });
  const status = url.searchParams.get('status') === 'closed' ? 'closed' : 'open';
  return { reports: q('SELECT r.*, u.handle target_handle FROM reports r LEFT JOIN users u ON u.id = r.target_user WHERE status = ? ORDER BY created DESC LIMIT 200').all(status)
    .map(r => ({ id: r.id, kind: r.kind, target: r.target, targetHandle: r.target_handle, reason: r.reason, note: r.note, created: r.created })) };
});
route('GET', '/api/admin/users/:handle', (req, res, p) => {
  const st = needRole(req, 'moderator');
  const u = q('SELECT * FROM users WHERE handle = ?').get(p.handle) || fail(404, 'ไม่พบบัญชีนี้');
  G.audit({ actorType: 'staff', actorId: st.id, action: 'view_user', target: u.id, ip: clientIp(req) });
  return { user: { ...pubUser(u), role: u.role, created: u.created, suspendedUntil: u.suspended_until },
    reports: q('SELECT reason, COUNT(*) n FROM reports WHERE target_user = ? GROUP BY reason').all(u.id),
    events: q('SELECT ts, type, severity FROM security_events WHERE user_id = ? ORDER BY ts DESC LIMIT 30').all(u.id),
    posts: q('SELECT * FROM posts WHERE user_id = ? ORDER BY created DESC LIMIT 20').all(u.id).map(x => postOut(x, st.id)) };
});
route('POST', '/api/admin/users/:handle/suspend', async (req, res, p) => {
  const st = needRole(req, 'moderator');
  const u = q('SELECT * FROM users WHERE handle = ?').get(p.handle) || fail(404, 'ไม่พบบัญชีนี้');
  if ((ROLE_RANK[u.role] || 0) >= ROLE_RANK[st.role]) fail(403, 'ระงับบัญชีที่มีสิทธิ์เท่ากันหรือสูงกว่าไม่ได้');
  const b = await readJson(req), days = Math.max(0, Math.min(365, +b.days || 0));
  q('UPDATE users SET suspended_until = ? WHERE id = ?').run(days ? now() + days * 864e5 : 0, u.id);
  if (days) q('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  G.audit({ actorType: 'staff', actorId: st.id, action: days ? 'suspend' : 'unsuspend', target: u.id, ip: clientIp(req), detail: { days, reason: str(b.reason || '', 200, 'เหตุผล') } });
  return { ok: true };
});
route('POST', '/api/admin/reports/:id/close', async (req, res, p) => {
  const st = needRole(req, 'moderator');
  const r = q("UPDATE reports SET status = 'closed', handled_by = ?, handled_at = ? WHERE id = ?").run(st.id, now(), p.id);
  if (!r.changes) fail(404, 'ไม่พบรายงาน');
  G.audit({ actorType: 'staff', actorId: st.id, action: 'close_report', ip: clientIp(req), detail: { report: p.id } });
  return { ok: true };
});
route('GET', '/api/admin/audit', (req, res, p, url) => {
  const st = needRole(req, 'admin');
  G.audit({ actorType: 'staff', actorId: st.id, action: 'view_audit', ip: clientIp(req) });
  return { tampered: G.verifyAudit(), rows: q('SELECT id, ts, actor_type, actor_id, action, target_user, ip FROM audit_log ORDER BY id DESC LIMIT 300').all() };
});

/* ---------------- OAuth 2.0 + PKCE (ให้แอปอื่นเชื่อมต่อแบบจำกัดสิทธิ์) ----------------
   - ไคลเอนต์แบบ public เท่านั้น บังคับ PKCE S256 และ redirect_uri ต้องตรงกับที่ลงทะเบียนทุกตัวอักษร
   - access token อายุ 1 ชม. refresh token 30 วัน และหมุนใหม่ทุกครั้งที่ใช้ (ถ้าเอาโทเค็นเก่ามาใช้ซ้ำ จะยกเลิกทั้งชุด)
   - scope: profile, posts:read, posts:write — ทุกการใช้งานบันทึกใน audit log และผู้ใช้ยกเลิกได้ */
db.exec(`
  CREATE TABLE IF NOT EXISTS oauth_apps (client_id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, redirect_uri TEXT NOT NULL, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS oauth_codes (code TEXT PRIMARY KEY, client_id TEXT NOT NULL, user_id TEXT NOT NULL, scope TEXT NOT NULL, challenge TEXT NOT NULL, redirect_uri TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS oauth_tokens (token TEXT PRIMARY KEY, family TEXT NOT NULL, kind TEXT NOT NULL, client_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, scope TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX IF NOT EXISTS oauth_tokens_family ON oauth_tokens(family);`);
const SCOPES = { profile: 'ดูชื่อ ชื่อผู้ใช้ และรูปโปรไฟล์', 'posts:read': 'ดูโพสต์ของคุณ', 'posts:write': 'โพสต์แทนคุณ' };
const htmlEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const redirectOk = u => { try { const x = new URL(u); return (x.protocol === 'https:' || (x.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(x.hostname))) && !x.hash; } catch { return false; } };
route('POST', '/api/oauth/apps', async req => {
  const me = needUser(req), b = await readJson(req);
  if (q('SELECT COUNT(*) n FROM oauth_apps WHERE owner = ?').get(me.id).n >= 10) fail(400, 'ลงทะเบียนแอปได้สูงสุด 10 แอป');
  const name = str(b.name || '', 40, 'ชื่อแอป') || fail(400, 'ใส่ชื่อแอป');
  const ru = str(b.redirect_uri || '', 300, 'redirect_uri');
  if (!redirectOk(ru)) fail(400, 'redirect_uri ต้องเป็น https (หรือ http://localhost สำหรับทดสอบ)');
  const id = 'app_' + crypto.randomBytes(12).toString('base64url');
  q('INSERT INTO oauth_apps VALUES (?,?,?,?,?)').run(id, me.id, name, ru, now());
  G.audit({ actorType: 'user', actorId: me.id, action: 'oauth_app_create', target: me.id, detail: { client_id: id } });
  return { client_id: id, name, redirect_uri: ru };
});
route('GET', '/api/oauth/grants', req => {
  const me = needUser(req);
  return { grants: q("SELECT a.client_id, a.name, MIN(t.scope) scope, MAX(t.expires) until FROM oauth_tokens t JOIN oauth_apps a ON a.client_id = t.client_id WHERE t.user_id = ? AND t.kind = 'refresh' AND t.used = 0 AND t.expires > ? GROUP BY a.client_id").all(me.id, now()) };
});
route('DELETE', '/api/oauth/grants/:client', (req, res, p) => {
  const me = needUser(req);
  q('DELETE FROM oauth_tokens WHERE user_id = ? AND client_id = ?').run(me.id, p.client);
  G.audit({ actorType: 'user', actorId: me.id, action: 'oauth_revoke', target: me.id, detail: { client_id: p.client } });
  return { ok: true };
});
const issueTokens = (clientId, userId, scope, family = crypto.randomBytes(9).toString('base64url')) => {
  const at = 'mat_' + crypto.randomBytes(32).toString('base64url'), rt = 'mrt_' + crypto.randomBytes(32).toString('base64url');
  q('INSERT INTO oauth_tokens VALUES (?,?,?,?,?,?,?,0)').run(sha256(at), family, 'access', clientId, userId, scope, now() + 3600e3);
  q('INSERT INTO oauth_tokens VALUES (?,?,?,?,?,?,?,0)').run(sha256(rt), family, 'refresh', clientId, userId, scope, now() + 30 * 864e5);
  return { access_token: at, token_type: 'Bearer', expires_in: 3600, refresh_token: rt, scope };
};
// ตรวจ Bearer token สำหรับ API ของแอปภายนอก
function appUser(req, scope) {
  const m = /^Bearer\s+(mat_[\w-]{20,})$/.exec(req.headers.authorization || '') || fail(401, 'ต้องใช้ access token');
  const t = q("SELECT * FROM oauth_tokens WHERE token = ? AND kind = 'access' AND expires > ?").get(sha256(m[1]), now()) || fail(401, 'โทเค็นไม่ถูกต้องหรือหมดอายุ');
  if (!t.scope.split(' ').includes(scope)) fail(403, `โทเค็นนี้ไม่มีสิทธิ์ ${scope}`);
  const u = q('SELECT * FROM users WHERE id = ?').get(t.user_id);
  if (!u || u.suspended_until > now()) fail(401, 'บัญชีไม่พร้อมใช้งาน');
  if (limited('app:' + t.client_id + ':' + u.id, 120, 60e3)) fail(429, 'แอปนี้เรียกใช้บ่อยเกินไป');
  G.audit({ actorType: 'app', actorId: t.client_id, action: 'api:' + scope, target: u.id, ip: clientIp(req) });
  return u;
}
route('GET', '/api/v1/me', req => ({ user: pubUser(appUser(req, 'profile')) }));
route('GET', '/api/v1/posts', req => { const u = appUser(req, 'posts:read'); return { posts: q('SELECT * FROM posts WHERE user_id = ? ORDER BY created DESC LIMIT 50').all(u.id).map(x => postOut(x, u.id)) }; });
route('POST', '/api/v1/posts', async req => {
  const u = appUser(req, 'posts:write'), b = await readJson(req);
  const caption = str(b.caption || '', 2200, 'คำบรรยาย') || fail(400, 'ใส่คำบรรยาย');
  const id = newId('p_');
  q('INSERT INTO posts (id, user_id, caption, media, created) VALUES (?,?,?,?,?)').run(id, u.id, caption, '[]', now());
  return { post: postOut(q('SELECT * FROM posts WHERE id = ?').get(id), u.id) };
});

// หน้าอนุญาต (consent) และ endpoint token อยู่นอก /api/
const oauthPage = (title, body) => `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEsc(title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#f7f4ee;color:#1f1b16;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}main{background:#fdfbf7;border:1px solid rgba(31,27,22,.12);border-radius:20px;padding:28px;max-width:420px;width:100%}h1{font-size:20px}li{margin:6px 0}.a{display:flex;gap:10px;margin-top:20px}button{flex:1;height:44px;border-radius:12px;border:0;font:inherit;font-weight:600;cursor:pointer}.ok{background:#c4411a;color:#fff}.no{background:#efe9df}small{color:#776e62}</style></head><body><main>${body}</main></body></html>`;
const pageHeaders = { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'", 'Cache-Control': 'no-store' };
async function oauthAuthorize(req, res, url) {
  const isPost = req.method === 'POST';
  const form = isPost ? new URLSearchParams((await readBody(req, 8192)).toString()) : url.searchParams;
  const g = k => String(form.get(k) || '');
  const app = q('SELECT * FROM oauth_apps WHERE client_id = ?').get(g('client_id'));
  if (!app || g('redirect_uri') !== app.redirect_uri) return send(res, 400, oauthPage('ผิดพลาด', '<h1>คำขอไม่ถูกต้อง</h1><p>ไม่พบแอปนี้ หรือ redirect_uri ไม่ตรงกับที่ลงทะเบียน</p>'), pageHeaders);
  const back = params => { const u = new URL(app.redirect_uri); Object.entries(params).forEach(([k, v]) => v != null && u.searchParams.set(k, v)); if (g('state')) u.searchParams.set('state', g('state')); res.writeHead(302, { Location: u.toString(), 'Cache-Control': 'no-store' }); res.end(); };
  if (g('response_type') !== 'code') return back({ error: 'unsupported_response_type' });
  if (g('code_challenge_method') !== 'S256' || !/^[\w-]{43,128}$/.test(g('code_challenge'))) return back({ error: 'invalid_request', error_description: 'PKCE S256 required' });
  const scopes = [...new Set(g('scope').split(/\s+/).filter(Boolean))];
  if (!scopes.length || scopes.some(s => !SCOPES[s])) return back({ error: 'invalid_scope' });
  const me = currentUser(req);
  if (!me) return send(res, 401, oauthPage('เข้าสู่ระบบก่อน', `<h1>เข้าสู่ระบบมะลิก่อน</h1><p>เปิด <a href="/">มะลิ</a> แล้วเข้าสู่ระบบในเมนูออนไลน์ จากนั้นกลับมาที่หน้านี้อีกครั้ง</p>`), pageHeaders);
  // กัน CSRF ของฟอร์มอนุญาต: โทเค็นผูกกับ session
  const sessTok = cookies(req)['mali_s_' + me.id] || cookies(req).mali_sid || '';
  const csrf = crypto.createHmac('sha256', sessTok).update(app.client_id + g('code_challenge')).digest('base64url');
  if (isPost) {
    const a = Buffer.from(g('csrf')), b2 = Buffer.from(csrf);
    if (a.length !== b2.length || !crypto.timingSafeEqual(a, b2)) return send(res, 403, oauthPage('ผิดพลาด', '<h1>คำขอไม่ถูกต้อง</h1>'), pageHeaders);
    if (g('decision') !== 'allow') return back({ error: 'access_denied' });
    const code = crypto.randomBytes(24).toString('base64url');
    q('INSERT INTO oauth_codes VALUES (?,?,?,?,?,?,?)').run(sha256(code), app.client_id, me.id, scopes.join(' '), g('code_challenge'), app.redirect_uri, now() + 60e3);
    G.audit({ actorType: 'user', actorId: me.id, action: 'oauth_consent', target: me.id, ip: clientIp(req), detail: { client_id: app.client_id, scope: scopes.join(' ') } });
    return back({ code });
  }
  const hidden = ['client_id', 'redirect_uri', 'response_type', 'scope', 'state', 'code_challenge', 'code_challenge_method'].map(k => `<input type="hidden" name="${k}" value="${htmlEsc(g(k))}">`).join('');
  return send(res, 200, oauthPage('อนุญาตแอป', `<h1>${htmlEsc(app.name)} ขอเชื่อมต่อกับบัญชี @${htmlEsc(me.handle)}</h1><p>แอปนี้จะได้สิทธิ์:</p><ul>${scopes.map(s => `<li>${htmlEsc(SCOPES[s])}</li>`).join('')}</ul>
    <small>แอปนี้จะไม่เห็นรหัสผ่านหรือข้อความแชตของคุณ ยกเลิกได้ทุกเมื่อที่ ออนไลน์ &gt; ฉัน &gt; ความปลอดภัย</small>
    <form method="post" action="/oauth/authorize">${hidden}<input type="hidden" name="csrf" value="${csrf}"><div class="a"><button class="no" name="decision" value="deny">ไม่อนุญาต</button><button class="ok" name="decision" value="allow">อนุญาต</button></div></form>`), pageHeaders);
}
async function oauthToken(req, res) {
  const f = new URLSearchParams((await readBody(req, 8192)).toString()), g = k => String(f.get(k) || '');
  const err = (code, d) => send(res, 400, { error: code, error_description: d }, { 'Cache-Control': 'no-store' });
  if (limited('oauth_token:' + clientIp(req), 60, 60e3)) return send(res, 429, { error: 'slow_down' });
  if (g('grant_type') === 'authorization_code') {
    const c = q('SELECT * FROM oauth_codes WHERE code = ?').get(sha256(g('code')));
    q('DELETE FROM oauth_codes WHERE code = ?').run(sha256(g('code'))); // ใช้ได้ครั้งเดียว
    if (!c || c.expires < now() || c.client_id !== g('client_id') || c.redirect_uri !== g('redirect_uri')) return err('invalid_grant', 'code ไม่ถูกต้องหรือหมดอายุ');
    const chal = crypto.createHash('sha256').update(g('code_verifier')).digest('base64url');
    if (!/^[\w.~-]{43,128}$/.test(g('code_verifier')) || chal !== c.challenge) return err('invalid_grant', 'PKCE verifier ไม่ตรง');
    return send(res, 200, issueTokens(c.client_id, c.user_id, c.scope), { 'Cache-Control': 'no-store' });
  }
  if (g('grant_type') === 'refresh_token') {
    const t = q("SELECT * FROM oauth_tokens WHERE token = ? AND kind = 'refresh'").get(sha256(g('refresh_token')));
    if (!t || t.client_id !== g('client_id') || t.expires < now()) return err('invalid_grant', 'refresh token ไม่ถูกต้อง');
    if (t.used) { // ใช้โทเค็นซ้ำ = อาจถูกขโมย → ยกเลิกทั้งชุด
      q('DELETE FROM oauth_tokens WHERE family = ?').run(t.family);
      G.event('oauth_refresh_reuse', { userId: t.user_id, ip: clientIp(req), severity: 'high', detail: { client_id: t.client_id } });
      return err('invalid_grant', 'refresh token ถูกใช้ไปแล้ว ยกเลิกการเชื่อมต่อทั้งหมดของแอปนี้แล้ว');
    }
    q('UPDATE oauth_tokens SET used = 1 WHERE token = ?').run(t.token);
    q("DELETE FROM oauth_tokens WHERE family = ? AND kind = 'access'").run(t.family);
    return send(res, 200, issueTokens(t.client_id, t.user_id, t.scope, t.family), { 'Cache-Control': 'no-store' });
  }
  return err('unsupported_grant_type');
}
async function oauthRevoke(req, res) {
  const f = new URLSearchParams((await readBody(req, 8192)).toString());
  const t = q('SELECT * FROM oauth_tokens WHERE token = ?').get(sha256(String(f.get('token') || '')));
  if (t) q('DELETE FROM oauth_tokens WHERE family = ?').run(t.family);
  send(res, 200, {}); // ตาม RFC 7009 ตอบ 200 เสมอ
}
setInterval(() => { q('DELETE FROM oauth_codes WHERE expires < ?').run(now()); q('DELETE FROM oauth_tokens WHERE expires < ?').run(now()); }, 3600e3).unref();

/* ---------------- ไฟล์ของแอป ---------------- */
function serveStatic(req, res, pathname) {
  let rel;
  if (pathname === '/' || pathname === '/index.html') rel = 'index.html';
  else if (pathname === '/sw.js' || pathname === '/manifest.webmanifest') rel = pathname.slice(1);
  else if (/^\/(css|js|icons)\/[\w\-./]+$/.test(pathname) && !pathname.includes('..')) rel = pathname.slice(1);
  else if (/^\/media\/[A-Za-z0-9_-]+\.\w+$/.test(pathname)) { serveMedia(req, res, path.join(MEDIA, path.basename(pathname))).catch(() => { if (!res.headersSent) send(res, 404, 'Not found'); }); return true; }
  else if (pathname === '/.well-known/security.txt' || pathname === '/security.txt') { send(res, 200, SECURITY_TXT); return true; }
  else return false;
  return serveFile(req, res, path.join(ROOT, rel), false);
}
// ไฟล์สื่อถูกเข้ารหัสบนดิสก์ ถอดรหัสในหน่วยความจำก่อนส่ง (รองรับ Range สำหรับวิดีโอ)
const mediaCache = new Map(); let mediaCacheBytes = 0;
async function serveMedia(req, res, file) {
  let buf = mediaCache.get(file);
  if (!buf) {
    const raw = await mediaGet(path.basename(file));
    try { if (!raw) throw 0; buf = kms.openFile(raw); } catch (e) { send(res, 404, 'Not found'); return true; }
    if (buf.length < 8 << 20) { mediaCache.set(file, buf); mediaCacheBytes += buf.length; while (mediaCacheBytes > 64 << 20) { const [k, v] = mediaCache.entries().next().value; mediaCache.delete(k); mediaCacheBytes -= v.length; } }
  }
  const ext = path.extname(file).slice(1).toLowerCase();
  const headers = { ...SEC_HEADERS, 'Content-Type': MIME_BY_EXT[ext] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=31536000, immutable', 'Content-Disposition': 'inline', ETag: '"' + path.basename(file) + '"' };
  if (viaHttps(req)) headers['Strict-Transport-Security'] = 'max-age=15552000';
  if (req.headers['if-none-match'] === headers.ETag) { res.writeHead(304, headers); return res.end(), true; }
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    let start = m[1] ? +m[1] : buf.length - +m[2], end = m[1] && m[2] ? +m[2] : buf.length - 1;
    if (start >= buf.length || start < 0 || end < start) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${buf.length}` }); return res.end(), true; }
    end = Math.min(end, buf.length - 1);
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${buf.length}`, 'Content-Length': end - start + 1 });
    return res.end(req.method === 'HEAD' ? undefined : buf.subarray(start, end + 1)), true;
  }
  res.writeHead(200, { ...headers, 'Content-Length': buf.length });
  return res.end(req.method === 'HEAD' ? undefined : buf), true;
}
function serveFile(req, res, file, immutable) {
  let st;
  try { st = fs.statSync(file); if (!st.isFile()) throw 0; } catch { send(res, 404, 'Not found'); return true; }
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = MIME_BY_EXT[ext] || 'application/octet-stream';
  const etag = `"${st.size.toString(36)}-${st.mtimeMs.toString(36)}"`;
  const headers = { ...SEC_HEADERS, 'Content-Type': type, ETag: etag, 'Accept-Ranges': 'bytes', 'Cache-Control': immutable ? 'private, max-age=31536000, immutable' : 'no-cache' };
  if (ext === 'html') headers['Content-Security-Policy'] = CSP;
  if (viaHttps(req)) headers['Strict-Transport-Security'] = 'max-age=15552000';
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
      req._res = res;
      const bearer = /^Bearer\s+/i.test(req.headers.authorization || '');
      // คำขอแบบ Bearer (แอปที่เชื่อมต่อผ่าน OAuth) ไม่ใช้คุกกี้ จึงไม่ต้องกัน CSRF ด้วยเฮดเดอร์
      if (!bearer && req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-mali'] !== '1') fail(403, 'คำขอไม่ถูกต้อง');
      const ip = clientIp(req);
      if (G.restricted(ip, 'all')) fail(429, 'เครือข่ายนี้ถูกระงับชั่วคราว');
      if (limited('ip:' + ip, 600, 60e3)) { G.event('rate_limit_ip', { ip, severity: 'info' }); fail(429, 'เรียกใช้บ่อยเกินไป'); }
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(pathname); if (!m) continue;
        // จำกัดต่อ endpoint: ต่อ IP และต่อบัญชี (ดูข้อมูลผู้ใช้จำกัดเข้มกว่าเพื่อกันบอทดูดข้อมูล)
        const scrape = /^\/api\/(users|suggestions|v1\/users)/.test(pathname);
        const per = scrape ? 60 : 240;
        if (limited(`ep:${ip}:${r.method}${r.pattern}`, per, 60e3)) fail(429, 'เรียกใช้ส่วนนี้บ่อยเกินไป รอสักครู่');
        const uid = !bearer && currentUser(req)?.id;
        if (uid && limited(`epu:${uid}:${r.method}${r.pattern}`, per, 60e3)) fail(429, 'เรียกใช้ส่วนนี้บ่อยเกินไป รอสักครู่');
        const params = Object.fromEntries(Object.entries(m.groups || {}).map(([k, v]) => [k, decodeURIComponent(v)]));
        const out = await r.fn(req, res, params, url);
        if (out !== undefined && !res.headersSent) send(res, 200, out);
        return;
      }
      fail(404, 'ไม่พบ API นี้');
    }
    if (pathname === '/oauth/authorize' && (req.method === 'GET' || req.method === 'POST')) { req._res = res; return await oauthAuthorize(req, res, url); }
    if (pathname === '/oauth/token' && req.method === 'POST') return await oauthToken(req, res);
    if (pathname === '/oauth/revoke' && req.method === 'POST') return await oauthRevoke(req, res);
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
server.keepAliveTimeout = 30e3;
server.maxHeadersCount = 60;
server.maxRequestsPerSocket = 1000;
// จำกัดจำนวนการเชื่อมต่อพร้อมกันต่อ IP (กันการเปิดค้างไว้จำนวนมาก)
const conns = new Map();
server.on('connection', sock => {
  const ip = sock.remoteAddress || '?';
  if (isLoopback(ip)) return; // หลังพร็อกซี (Caddy/Cloudflare) นับต่อ IP จริงที่ชั้นแอปแทน
  const n = (conns.get(ip) || 0) + 1; conns.set(ip, n);
  sock.on('close', () => { const k = (conns.get(ip) || 1) - 1; k ? conns.set(ip, k) : conns.delete(ip); });
  if (n > 64) sock.destroy();
});
// ล้าง session ที่หมดอายุ
setInterval(() => q('DELETE FROM sessions WHERE expires < ?').run(now()), 3600e3).unref();

server.listen(PORT, HOST, () => {
  const nets = Object.values(require('node:os').networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
  console.log(`มะลิ เซิร์ฟเวอร์พร้อมแล้ว\n  เครื่องนี้:  http://localhost:${PORT}\n${nets.map(a => `  ในวง Wi-Fi: http://${a}:${PORT}`).join('\n')}\n  ข้อมูล: ${DATA}`);
});
module.exports = server;
