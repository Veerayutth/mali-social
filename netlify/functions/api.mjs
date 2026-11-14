/* มะลิบน Netlify: รันเซิร์ฟเวอร์เดิม (server/server.js) ทั้งชุดในฟังก์ชันนี้
   - ไฟล์ฐานข้อมูล SQLite เก็บใน Netlify Blobs (store "mali-db") ดึงมาไว้ที่ /tmp เมื่อมีเวอร์ชันใหม่
   - คำขอที่เขียนข้อมูล: ส่งไฟล์กลับแบบมีเงื่อนไข (onlyIfMatch ETag) ถ้ามีอินสแตนซ์อื่นเขียนก่อน จะดึงใหม่แล้วทำคำขอซ้ำ
   - ไฟล์สื่อเก็บใน store "mali-media" แบบเข้ารหัส, กุญแจมาจากตัวแปรลับ MALI_KEYRING
   เหมาะกับชุมชนขนาดเล็ก (การเขียนทำทีละคำขอ) */
import fs from 'node:fs';
import path from 'node:path';
import { getStore } from '@netlify/blobs';

const ROOT = '/tmp/mali';
Object.assign(process.env, {
  MALI_MODE: 'netlify', MEDIA_STORE: 'blobs', NODE_ENV: 'production', HTTPS: '1', PROXY: 'cloudflare',
  HOST: '127.0.0.1', PORT: '0', MALI_DATA: `${ROOT}/data`, MALI_KEYS: `${ROOT}/keys`
});
const dbStore = () => getStore({ name: 'mali-db', consistency: 'strong' });
let etag = null, port = 0, booting = null, noCas = false, booted = false;

async function pull() {
  const r = await dbStore().getWithMetadata('db', { type: 'arrayBuffer', etag: etag || undefined });
  if (!r) return 'missing';
  if (r.data === null || (noCas && booted)) return 'same';
  fs.writeFileSync(`${ROOT}/data/mali.db`, Buffer.from(r.data));
  etag = r.etag;
  if (!etag) noCas = true; // ตัวจำลอง Blobs ในเครื่อง (netlify dev) ไม่ส่ง ETag มา
  return 'new';
}
async function push() {
  const bytes = fs.readFileSync(`${ROOT}/data/mali.db`);
  if (noCas) { await dbStore().set('db', bytes); return true; }
  const r = await dbStore().set('db', bytes, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
  if (r.modified) etag = r.etag;
  return r.modified;
}
function boot() {
  return booting || (booting = (async () => {
    fs.mkdirSync(`${ROOT}/data`, { recursive: true });
    fs.mkdirSync(`${ROOT}/keys`, { recursive: true, mode: 0o700 });
    const ring = process.env.MALI_KEYRING;
    if (!ring) throw new Error('ยังไม่ได้ตั้งตัวแปรลับ MALI_KEYRING');
    fs.writeFileSync(`${ROOT}/keys/keyring.json`, ring, { mode: 0o600 });
    await pull();
    const mod = await import('../../server/server.js');
    const server = mod.default || mod;
    if (!server.listening) await new Promise(r => server.once('listening', r));
    port = server.address().port;
    if (!etag && !noCas) await push(); // ฐานข้อมูลใหม่ครั้งแรก
    booted = true;
  })());
}

export default async (req, context) => {
  try { await boot(); } catch (e) { console.error(e); return Response.json({ error: 'เซิร์ฟเวอร์ยังไม่พร้อม' }, { status: 503 }); }
  const url = new URL(req.url);
  let body = req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.from(await req.arrayBuffer());
  if (body && !body.length) body = undefined;
  const headers = new Headers(req.headers);
  // ระบุ IP/ประเทศจริงจาก Netlify (ลบค่าที่ผู้ใช้อาจปลอมมาก่อน)
  headers.delete('cf-connecting-ip'); headers.delete('cf-ipcountry'); headers.delete('x-forwarded-for');
  if (context.ip) headers.set('cf-connecting-ip', context.ip);
  if (context.geo?.country?.code) headers.set('cf-ipcountry', context.geo.country.code);
  headers.set('x-forwarded-proto', 'https');
  for (const k of ['host', 'connection', 'content-length', 'transfer-encoding', 'expect', 'keep-alive', 'upgrade', 'te', 'trailer']) headers.delete(k);

  for (let attempt = 0; attempt < 4; attempt++) {
    if ((await pull()) === 'new' || attempt > 0) globalThis.__maliDb.reopen();
    const before = globalThis.__maliDb.changes();
    const res = await fetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, { method: req.method, headers, body, redirect: 'manual' });
    const out = await res.arrayBuffer();
    if (globalThis.__maliDb.changes() > before && !(await push())) continue; // มีคนเขียนก่อน → ดึงใหม่แล้วทำซ้ำ
    const h = new Headers();
    res.headers.forEach((v, k) => { if (k !== 'set-cookie' && k !== 'content-length' && k !== 'transfer-encoding' && k !== 'connection' && k !== 'keep-alive') h.set(k, v); });
    for (const c of res.headers.getSetCookie()) h.append('set-cookie', c);
    return new Response(req.method === 'HEAD' ? null : out, { status: res.status, headers: h });
  }
  return Response.json({ error: 'มีคนใช้งานพร้อมกันมาก ลองอีกครั้ง' }, { status: 503 });
};

export const config = { path: ['/api/*', '/oauth/*', '/media/*', '/.well-known/security.txt'] };
