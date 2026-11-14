'use strict';
/* เครื่องมือผู้ดูแลระบบ (รันบนเซิร์ฟเวอร์เท่านั้น ไม่มีทางเรียกผ่านเว็บ)
   node server/admin.js grant <handle> <user|moderator|admin>   ตั้งสิทธิ์เจ้าหน้าที่
   node server/admin.js rotate-key                               สร้างกุญแจเข้ารหัสใหม่
   node server/admin.js encrypt-existing                         เข้ารหัสข้อความและไฟล์สื่อเดิมที่ยังไม่เข้ารหัส / ห่อใหม่ด้วยกุญแจล่าสุด
   node server/admin.js verify-audit                             ตรวจว่า audit log ไม่ถูกแก้ไข
   node server/admin.js events [จำนวน]                           ดูเหตุการณ์ความปลอดภัยล่าสุด
   node server/admin.js unrestrict <บัญชีหรือ IP>               ยกเลิกการจำกัดชั่วคราว */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const kms = require('./kms');

const DATA = path.resolve(process.env.MALI_DATA || path.join(__dirname, 'data'));
const db = new DatabaseSync(path.join(DATA, 'mali.db'));
const G = require('./guard')(db);
const q = s => db.prepare(s);
const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'grant': {
    const [handle, role] = args;
    if (!['user', 'moderator', 'admin'].includes(role)) throw new Error('สิทธิ์ต้องเป็น user, moderator หรือ admin');
    const u = q('SELECT * FROM users WHERE handle = ?').get(handle); if (!u) throw new Error('ไม่พบบัญชี ' + handle);
    q('UPDATE users SET role = ? WHERE id = ?').run(role, u.id);
    G.audit({ actorType: 'system', actorId: process.env.USER || 'cli', action: 'grant_role', target: u.id, detail: { role } });
    console.log(`ตั้ง @${handle} เป็น ${role} แล้ว`);
    break;
  }
  case 'rotate-key': {
    const kid = kms.rotate();
    G.audit({ actorType: 'system', actorId: process.env.USER || 'cli', action: 'rotate_key', detail: { kid } });
    console.log(`สร้างกุญแจใหม่ ${kid} แล้ว ข้อมูลใหม่จะใช้กุญแจนี้ ถ้าต้องการห่อข้อมูลเดิมด้วยกุญแจใหม่ ให้รัน encrypt-existing (ต้องรีสตาร์ตเซิร์ฟเวอร์ด้วย)`);
    break;
  }
  case 'encrypt-existing': {
    let n = 0;
    const active = kms.activeKid();
    for (const m of q('SELECT id, text, media FROM messages').all()) {
      const needs = v => v && (!String(v).startsWith('enc1:') || String(v).split(':')[1] !== active);
      if (needs(m.text) || needs(m.media)) {
        q('UPDATE messages SET text = ?, media = ? WHERE id = ?').run(m.text ? kms.seal(kms.open(m.text)) : m.text, m.media ? kms.seal(kms.open(m.media)) : m.media, m.id); n++;
      }
    }
    let f = 0;
    const MEDIA = path.join(DATA, 'media');
    for (const name of fs.existsSync(MEDIA) ? fs.readdirSync(MEDIA) : []) {
      const p = path.join(MEDIA, name), buf = fs.readFileSync(p);
      const kidNow = kms.isSealedFile(buf) ? buf.subarray(9, 9 + buf[8]).toString() : null;
      if (kidNow === active) continue;
      const tmp = p + '.tmp';
      fs.writeFileSync(tmp, kms.sealFile(kms.openFile(buf)), { mode: 0o600 }); fs.renameSync(tmp, p); f++;
    }
    G.audit({ actorType: 'system', actorId: process.env.USER || 'cli', action: 'encrypt_existing', detail: { messages: n, files: f } });
    console.log(`เข้ารหัส/ห่อใหม่ ข้อความ ${n} รายการ ไฟล์ ${f} ไฟล์ ด้วยกุญแจ ${active}`);
    break;
  }
  case 'verify-audit': {
    const bad = G.verifyAudit();
    console.log(bad == null ? `audit log ครบถ้วน (${q('SELECT COUNT(*) n FROM audit_log').get().n} รายการ)` : `พบการแก้ไขที่รายการ id ${bad}`);
    process.exitCode = bad == null ? 0 : 2;
    break;
  }
  case 'events': {
    for (const e of q('SELECT * FROM security_events ORDER BY id DESC LIMIT ?').all(+args[0] || 30))
      console.log(new Date(e.ts).toISOString(), e.severity.padEnd(4), e.type.padEnd(22), e.user_id || '-', e.ip || '-');
    break;
  }
  case 'unrestrict': {
    const s = args[0]; const u = q('SELECT id FROM users WHERE handle = ?').get(s);
    const r = q('DELETE FROM restrictions WHERE subject = ?').run(u ? u.id : s);
    console.log(`ยกเลิกการจำกัด ${r.changes} รายการ`);
    break;
  }
  default:
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 9).join('\n'));
}
