/* Service worker: ทำให้ติดตั้งเป็นแอปและเปิดแบบออฟไลน์ได้
   - ไฟล์ของแอป: ลองโหลดจากเครือข่ายก่อน (ได้เวอร์ชันล่าสุดเสมอ) ถ้าออฟไลน์ใช้สำเนาในแคช
   - ฟอนต์ Google และโมเดลตัวกรอง 18+ จาก jsDelivr: ใช้แคชก่อน (ไฟล์ระบุเวอร์ชัน ไม่เปลี่ยน) */
const VERSION = 'mali-v5';
const SHELL = [
    './',
    './css/app.css',
    './icons/apple-touch-icon.png',
    './icons/favicon-32.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/maskable-512.png',
    './index.html',
    './js/app.js',
    './js/core/adult-filter.js',
    './js/core/appearance.js',
    './js/core/art.js',
    './js/core/i18n.js',
    './js/core/icons.js',
    './js/core/security.js',
    './js/core/ui.js',
    './js/core/util.js',
    './js/data/i18n-en.js',
    './js/data/seed.js',
    './js/screens/chat.js',
    './js/screens/create.js',
    './js/screens/explore.js',
    './js/screens/home.js',
    './js/screens/hub.js',
    './js/screens/online.js',
    './js/screens/p2p.js',
    './js/screens/profile.js',
    './js/screens/reels.js',
    './js/screens/security-center.js',
    './js/screens/settings.js',
    './js/screens/stories.js',
    './js/screens/studio.js',
    './manifest.webmanifest',
];
const CDN = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== 'mali-cdn').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && /^\/(api|media)\//.test(url.pathname)) return; // ข้อมูลสดจากเซิร์ฟเวอร์ ไม่แคช
  if (url.origin === location.origin) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
  } else if (CDN.includes(url.hostname)) {
    e.respondWith(caches.open('mali-cdn').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
  }
});
