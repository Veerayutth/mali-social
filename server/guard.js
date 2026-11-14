'use strict';
/* ความปลอดภัยฝั่งเซิร์ฟเวอร์
   - audit log แบบต่อท้ายอย่างเดียว เชื่อมกันด้วยแฮช (แก้หรือลบแถวย้อนหลังแล้วตรวจเจอ)
   - เหตุการณ์ความปลอดภัย + การแจ้งเตือนไปยัง webhook (ถ้าตั้ง ALERT_WEBHOOK)
   - ตรวจจับพฤติกรรมผิดปกติด้วยกฎ (rule-based risk engine) ไม่ใช่ ML:
       ลองรหัสหลายบัญชีจาก IP เดียว, ติดตามจำนวนมาก, บัญชีใหม่ส่งข้อความหาคนแปลกหน้าจำนวนมาก,
       เข้าสู่ระบบจากอุปกรณ์/ประเทศใหม่, ใช้โทเค็นจากอุปกรณ์อื่น (สงสัยโทเค็นถูกขโมย)
   - การจำกัดชั่วคราว (restrictions) ต่อบัญชีหรือ IP ที่เก็บในฐานข้อมูล รีสตาร์ตแล้วยังอยู่ */
const crypto = require('node:crypto');

module.exports = function guard(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, actor_type TEXT NOT NULL, actor_id TEXT,
      action TEXT NOT NULL, target_user TEXT, detail TEXT, ip TEXT, prev TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS audit_target ON audit_log(target_user, ts);
    CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
    CREATE TABLE IF NOT EXISTS security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, user_id TEXT, ip TEXT, type TEXT NOT NULL,
      severity TEXT NOT NULL, detail TEXT);
    CREATE INDEX IF NOT EXISTS secev_user ON security_events(user_id, ts);
    CREATE INDEX IF NOT EXISTS secev_type ON security_events(type, ip, ts);
    CREATE TABLE IF NOT EXISTS restrictions (
      subject TEXT NOT NULL, kind TEXT NOT NULL, until INTEGER NOT NULL, reason TEXT, PRIMARY KEY (subject, kind));
  `);
  const q = sql => db.prepare(sql);
  const now = () => Date.now();
  const sha = s => crypto.createHash('sha256').update(s).digest('hex');

  /* ---------- audit log ---------- */
  function audit({ actorType, actorId = null, action, target = null, detail = null, ip = null }) {
    const last = q('SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1').get();
    const prev = last?.hash || 'genesis', ts = now(), d = detail == null ? null : JSON.stringify(detail).slice(0, 2000);
    const hash = sha([prev, ts, actorType, actorId, action, target, d, ip].join('|'));
    q('INSERT INTO audit_log (ts, actor_type, actor_id, action, target_user, detail, ip, prev, hash) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(ts, actorType, actorId, action, target, d, ip, prev, hash);
  }
  /** ตรวจว่า audit log ไม่ถูกแก้ไข คืนค่า id แรกที่ไม่ตรง หรือ null */
  function verifyAudit() {
    let prev = 'genesis';
    for (const r of q('SELECT * FROM audit_log ORDER BY id').iterate()) {
      const h = sha([prev, r.ts, r.actor_type, r.actor_id, r.action, r.target_user, r.detail, r.ip].join('|'));
      if (r.prev !== prev || r.hash !== h) return r.id;
      prev = r.hash;
    }
    return null;
  }

  /* ---------- เหตุการณ์ + แจ้งเตือน ---------- */
  const WEBHOOK = process.env.ALERT_WEBHOOK || '';
  let alertsSent = [];
  function event(type, { userId = null, ip = null, severity = 'info', detail = null } = {}) {
    q('INSERT INTO security_events (ts, user_id, ip, type, severity, detail) VALUES (?,?,?,?,?,?)')
      .run(now(), userId, ip, type, severity, detail == null ? null : JSON.stringify(detail).slice(0, 1000));
    if (severity === 'high') {
      console.warn(`[ความปลอดภัย] ${type} user=${userId || '-'} ip=${ip || '-'}`);
      // ส่งไป webhook (เช่น Discord) ไม่เกิน 20 ครั้งต่อชั่วโมง ไม่ส่งข้อมูลส่วนตัวนอกจากประเภทเหตุการณ์
      alertsSent = alertsSent.filter(t => now() - t < 3600e3);
      if (WEBHOOK && /^https:\/\//.test(WEBHOOK) && alertsSent.length < 20) {
        alertsSent.push(now());
        fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `มะลิ: เหตุการณ์ความปลอดภัย ${type} (${new Date().toISOString()})` }) }).catch(() => {});
      }
    }
  }
  const countEvents = (type, field, value, sinceMs) =>
    q(`SELECT COUNT(*) n FROM security_events WHERE type = ? AND ${field === 'ip' ? 'ip' : 'user_id'} = ? AND ts > ?`).get(type, value, now() - sinceMs).n;

  /* ---------- การจำกัดชั่วคราว ---------- */
  function restrict(subject, kind, ms, reason) {
    q('INSERT INTO restrictions (subject, kind, until, reason) VALUES (?,?,?,?) ON CONFLICT(subject, kind) DO UPDATE SET until = MAX(until, excluded.until), reason = excluded.reason')
      .run(subject, kind, now() + ms, reason);
  }
  const restricted = (subject, kind) => {
    const r = q('SELECT until, reason FROM restrictions WHERE subject = ? AND kind = ? AND until > ?').get(subject, kind, now());
    return r || null;
  };
  setInterval(() => q('DELETE FROM restrictions WHERE until < ?').run(now()), 3600e3).unref();

  /* ---------- อุปกรณ์ ---------- */
  // ลายนิ้วมืออุปกรณ์แบบหยาบ: ตระกูลเบราว์เซอร์ + ระบบปฏิบัติการ (ตัดเลขเวอร์ชัน เพื่อไม่ให้หลุดเมื่ออัปเดตเบราว์เซอร์)
  function deviceOf(req) {
    const ua = String(req.headers['user-agent'] || '');
    const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'อื่นๆ';
    const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /curl|python|node|axios|Go-http/i.test(ua) ? 'สคริปต์' : 'เบราว์เซอร์อื่น';
    return { label: `${br} บน ${os}`, fp: sha(`${br}|${os}`).slice(0, 32) };
  }
  // ประเทศจากเฮดเดอร์ของ Cloudflare (มีเมื่ออยู่หลัง Cloudflare เท่านั้น)
  const countryOf = req => { const c = req.headers['cf-ipcountry']; return typeof c === 'string' && /^[A-Z]{2}$/.test(c) && c !== 'XX' ? c : null; };

  /* ---------- กฎตรวจจับ ---------- */
  const rules = {
    // ลองรหัสผิดหลายบัญชีจาก IP เดียว (credential stuffing) → บล็อก IP 1 ชม.
    loginFailed(ip, handle) {
      event('login_failed', { ip, detail: { handle: String(handle).slice(0, 30) } });
      const distinct = q("SELECT COUNT(DISTINCT detail) n FROM security_events WHERE type = 'login_failed' AND ip = ? AND ts > ?").get(ip, now() - 900e3).n;
      if (distinct >= 8 && !restricted(ip, 'login')) { restrict(ip, 'login', 3600e3, 'ลองเข้าสู่ระบบหลายบัญชีจาก IP เดียว'); event('credential_stuffing', { ip, severity: 'high', detail: { accounts: distinct } }); }
    },
    // ติดตามจำนวนมากผิดปกติ → งดติดตาม 24 ชม.
    followed(userId, ip) {
      event('follow', { userId, ip });
      if (countEvents('follow', 'user', userId, 86400e3) > 150 && !restricted(userId, 'follow')) {
        restrict(userId, 'follow', 86400e3, 'ติดตามจำนวนมากผิดปกติ'); event('mass_follow', { userId, ip, severity: 'high' });
      }
    },
    // บัญชีอายุไม่ถึง 1 วันส่งข้อความหาคนที่ไม่ได้ติดตามกันเกิน 15 คนใน 1 ชม. → ส่งได้เฉพาะคนที่ติดตามกันเป็นเวลา 24 ชม.
    messagedStranger(user, toId, ip) {
      event('dm_stranger', { userId: user.id, ip, detail: { to: toId } });
      const distinct = q("SELECT COUNT(DISTINCT detail) n FROM security_events WHERE type = 'dm_stranger' AND user_id = ? AND ts > ?").get(user.id, now() - 3600e3).n;
      const young = now() - user.created < 86400e3;
      if (distinct > (young ? 15 : 40) && !restricted(user.id, 'dm_strangers')) {
        restrict(user.id, 'dm_strangers', 86400e3, 'ส่งข้อความหาคนแปลกหน้าจำนวนมาก'); event('spam_suspected', { userId: user.id, ip, severity: 'high' });
      }
    }
  };

  return { audit, verifyAudit, event, restrict, restricted, deviceOf, countryOf, rules };
};
