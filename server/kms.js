'use strict';
/* การเข้ารหัสข้อมูลที่จัดเก็บ (encryption at rest) + การจัดการกุญแจ
   - กุญแจหลัก (KEK) อยู่ในไฟล์ keyring.json ในโฟลเดอร์กุญแจที่แยกจากโฟลเดอร์ข้อมูล
     (ค่าเริ่มต้น server/keys, บนเซิร์ฟเวอร์จริงใช้ /etc/mali/keys สิทธิ์ 0700/0600 เฉพาะผู้ใช้ mali)
     คนที่ได้ไฟล์ฐานข้อมูลหรือไฟล์สำรองไปอย่างเดียวจะอ่านข้อความและไฟล์สื่อไม่ได้
   - หมุนกุญแจได้ (rotate): กุญแจใหม่ใช้เข้ารหัสข้อมูลใหม่ กุญแจเก่าเก็บไว้ถอดรหัสข้อมูลเดิม
   - ฟิลด์ข้อความ: AES-256-GCM รูปแบบ "enc1:<kid>:<iv>:<tag>:<ciphertext>" (base64url)
   - ไฟล์สื่อ: envelope encryption — สุ่มกุญแจข้อมูล (DEK) ต่อไฟล์ แล้วห่อ DEK ด้วย KEK */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const KEYS_DIR = path.resolve(process.env.MALI_KEYS || path.join(__dirname, 'keys'));
const RING = path.join(KEYS_DIR, 'keyring.json');
const b64 = b => Buffer.from(b).toString('base64url');
const unb64 = s => Buffer.from(s, 'base64url');

function loadRing() {
  fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(RING)) {
    const kid = 'k' + Date.now().toString(36);
    const ring = { active: kid, keys: { [kid]: { key: b64(crypto.randomBytes(32)), created: Date.now() } } };
    fs.writeFileSync(RING, JSON.stringify(ring, null, 2), { mode: 0o600, flag: 'wx' });
  }
  try { fs.chmodSync(RING, 0o600); } catch {}
  const ring = JSON.parse(fs.readFileSync(RING, 'utf8'));
  const keys = new Map(Object.entries(ring.keys).map(([k, v]) => [k, unb64(v.key)]));
  if (!keys.has(ring.active) || [...keys.values()].some(k => k.length !== 32)) throw new Error('keyring.json ไม่ถูกต้อง');
  return { active: ring.active, keys };
}
let ring = loadRing();

const kms = {
  dir: KEYS_DIR,
  activeKid: () => ring.active,
  /** สร้างกุญแจใหม่และตั้งเป็นกุญแจที่ใช้งาน (กุญแจเดิมยังถอดรหัสข้อมูลเก่าได้) */
  rotate() {
    const raw = JSON.parse(fs.readFileSync(RING, 'utf8'));
    const kid = 'k' + Date.now().toString(36);
    raw.keys[kid] = { key: b64(crypto.randomBytes(32)), created: Date.now() };
    raw.active = kid;
    const tmp = RING + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(raw, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, RING);
    ring = loadRing();
    return kid;
  },
  /** เข้ารหัสข้อความสั้น (คืนค่าเดิมถ้าว่าง) */
  seal(text) {
    if (text == null || text === '') return text;
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', ring.keys.get(ring.active), iv);
    c.setAAD(Buffer.from(ring.active));
    const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
    return `enc1:${ring.active}:${b64(iv)}:${b64(c.getAuthTag())}:${b64(ct)}`;
  },
  /** ถอดรหัสข้อความ (ข้อมูลเก่าที่ยังไม่เข้ารหัสจะคืนค่าเดิม) */
  open(v) {
    if (typeof v !== 'string' || !v.startsWith('enc1:')) return v;
    const [, kid, iv, tag, ct] = v.split(':');
    const key = ring.keys.get(kid); if (!key) throw new Error('ไม่พบกุญแจ ' + kid);
    const d = crypto.createDecipheriv('aes-256-gcm', key, unb64(iv));
    d.setAAD(Buffer.from(kid)); d.setAuthTag(unb64(tag));
    return Buffer.concat([d.update(unb64(ct)), d.final()]).toString('utf8');
  },
  /** เข้ารหัสไฟล์: MAGIC | kidLen | kid | wrapIv | wrapTag | wrappedDEK(32) | iv | tag | ciphertext */
  sealFile(buf) {
    const dek = crypto.randomBytes(32), kid = Buffer.from(ring.active);
    const wiv = crypto.randomBytes(12), w = crypto.createCipheriv('aes-256-gcm', ring.keys.get(ring.active), wiv);
    w.setAAD(kid);
    const wrapped = Buffer.concat([w.update(dek), w.final()]), wtag = w.getAuthTag();
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', dek, iv);
    const ct = Buffer.concat([c.update(buf), c.final()]);
    return Buffer.concat([kms.MAGIC, Buffer.from([kid.length]), kid, wiv, wtag, wrapped, iv, c.getAuthTag(), ct]);
  },
  isSealedFile: buf => buf.length > 8 && buf.subarray(0, 8).equals(kms.MAGIC),
  openFile(buf) {
    if (!kms.isSealedFile(buf)) return buf; // ไฟล์เก่าก่อนเปิดการเข้ารหัส
    let o = 8; const kl = buf[o++]; const kid = buf.subarray(o, o += kl).toString();
    const key = ring.keys.get(kid); if (!key) throw new Error('ไม่พบกุญแจ ' + kid);
    const wiv = buf.subarray(o, o += 12), wtag = buf.subarray(o, o += 16), wrapped = buf.subarray(o, o += 32);
    const w = crypto.createDecipheriv('aes-256-gcm', key, wiv); w.setAAD(Buffer.from(kid)); w.setAuthTag(wtag);
    const dek = Buffer.concat([w.update(wrapped), w.final()]);
    const iv = buf.subarray(o, o += 12), tag = buf.subarray(o, o += 16);
    const d = crypto.createDecipheriv('aes-256-gcm', dek, iv); d.setAuthTag(tag);
    return Buffer.concat([d.update(buf.subarray(o)), d.final()]);
  },
  MAGIC: Buffer.from('MALIENC1')
};
module.exports = kms;
