'use strict';
/* ตัวช่วยพื้นฐาน + ที่เก็บสถานะ (IndexedDB, ถ้าใช้ไม่ได้จะใช้ localStorage) */
window.M = window.M || {};
(function (M) {
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;
  M.T = { MIN, HOUR, DAY };

  M.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  M.uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  M.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  M.pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];

  // seeded RNG (mulberry32) — ใช้กับภาพประกอบและข้อมูลสถิติ ให้ผลเหมือนเดิมทุกครั้ง
  M.rng = seed => {
    let a = (seed >>> 0) || 1;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  M.hash = str => { let h = 2166136261; for (const c of String(str)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  M.ago = ts => {
    const d = Date.now() - ts;
    if (d < MIN) return 'เมื่อสักครู่';
    if (d < HOUR) return Math.floor(d / MIN) + ' นาที';
    if (d < DAY) return Math.floor(d / HOUR) + ' ชม.';
    if (d < 7 * DAY) return Math.floor(d / DAY) + ' วัน';
    return new Date(ts).toLocaleDateString(M.locale(), { day: 'numeric', month: 'short' });
  };
  M.clock = ts => new Date(ts).toLocaleTimeString(M.locale(), { hour: '2-digit', minute: '2-digit' });
  M.dayLabel = ts => {
    const d = new Date(ts), t = new Date();
    if (d.toDateString() === t.toDateString()) return 'วันนี้';
    const y = new Date(t - DAY);
    if (d.toDateString() === y.toDateString()) return 'เมื่อวาน';
    return d.toLocaleDateString(M.locale(), { weekday: 'short', day: 'numeric', month: 'short' });
  };
  M.left24 = ts => {
    const r = ts + DAY - Date.now();
    if (r <= 0) return 'หมดอายุแล้ว';
    const h = Math.floor(r / HOUR);
    return h >= 1 ? `เหลือ ${h} ชม.` : `เหลือ ${Math.max(1, Math.floor(r / MIN))} นาที`;
  };
  // ภาษาสำหรับรูปแบบวันที่และตัวเลข
  M.locale = () => { const l = M.store?.state?.settings?.lang; return !l || l === 'th' ? 'th-TH' : l; };
  M.num = n => {
    n = Number(n) || 0;
    if (n < 1000) return n.toLocaleString(M.locale());
    if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'K';
    return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  };
  M.fullNum = n => (Number(n) || 0).toLocaleString(M.locale());
  M.dur = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };

  M.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  M.sleep = ms => new Promise(r => setTimeout(r, ms));

  // ข้อความที่มี # และ @ และลิงก์
  M.richText = text => '<span translate="no">' + M.esc(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a class="lnk" data-act="openLink" data-url="$1">$1</a>')
    .replace(/(^|\s)#([฀-๿a-zA-Z0-9_]+)/g, '$1<a class="tagl" data-act="searchTag" data-q="#$2">#$2</a>')
    .replace(/(^|\s)@([a-zA-Z0-9_.]+)/g, '$1<a class="tagl" data-act="openHandle" data-q="$2">@$2</a>') + '</span>';

  /* ---------- IndexedDB สำหรับไฟล์ใหญ่ (เช่นแบนเนอร์ GIF) ---------- */
  const idbOpen = () => new Promise((res, rej) => {
    const r = indexedDB.open('mali-media', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const idbDo = async (mode, fn) => { const db = await idbOpen(); return new Promise((res, rej) => { const tx = db.transaction('files', mode); const q = fn(tx.objectStore('files')); tx.oncomplete = () => res(q?.result); tx.onerror = () => rej(tx.error); }); };
  M.idb = {
    put: (k, v) => idbDo('readwrite', s => s.put(v, k)),
    get: k => idbDo('readonly', s => s.get(k)),
    del: k => idbDo('readwrite', s => s.delete(k)),
    keys: () => idbDo('readonly', s => s.getAllKeys())
  };

  /* ---------- ที่เก็บสถานะ ----------
     เก็บใน IndexedDB (พื้นที่หลายร้อย MB ขึ้นกับเครื่อง) ถ้าเบราว์เซอร์ไม่ให้ใช้ (เช่นบางโหมดส่วนตัว)
     จะกลับไปใช้ localStorage (~5 MB) ข้อมูลเก่าใน localStorage จะถูกย้ายมาให้อัตโนมัติ */
  const KEY = 'mali.v1', IDB_KEY = 'state';
  M.mem = { videos: {}, plain: {} }; // ข้อมูลชั่วคราว (URL ของวิดีโอที่โหลดแล้ว, ข้อความถอดรหัสแล้ว)
  M.store = {
    state: null, backend: 'idb',
    async load() {
      try {
        const raw = await M.idb.get(IDB_KEY);
        if (raw) { this.state = JSON.parse(raw); return true; }
        const old = localStorage.getItem(KEY);
        if (old) { this.state = JSON.parse(old); await M.idb.put(IDB_KEY, old); try { localStorage.removeItem(KEY); } catch (e) {} return true; }
        return false;
      } catch (e) {
        console.warn('IndexedDB ใช้ไม่ได้ ใช้ localStorage แทน', e); this.backend = 'ls';
        try { const raw = localStorage.getItem(KEY); if (raw) { this.state = JSON.parse(raw); return true; } } catch (e2) { console.warn(e2); }
        return false;
      }
    },
    async saveNow() {
      const json = JSON.stringify(this.state);
      if (this.backend === 'idb') {
        try { await M.idb.put(IDB_KEY, json); return; }
        catch (e) { M.toast && M.toast('พื้นที่เก็บข้อมูลของเครื่องเต็ม ข้อมูลล่าสุดอาจไม่ถูกบันทึก'); return; }
      }
      try { localStorage.setItem(KEY, json); }
      catch (e) { M.toast && M.toast('พื้นที่เก็บข้อมูลของเบราว์เซอร์เต็ม รูปใหม่อาจไม่ถูกบันทึกหลังรีเฟรช'); }
    },
    async reset() {
      try { await M.idb.del(IDB_KEY); const ks = await M.idb.keys(); await Promise.all(ks.map(k => M.idb.del(k))); } catch (e) {}
      try { localStorage.removeItem(KEY); } catch (e) {}
      location.reload();
    }
  };
  // บันทึกทันทีเมื่อผู้ใช้สลับแอป/ปิดแท็บ
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && M.store.state) M.store.saveNow(); });

  /* วิดีโอที่อัปโหลด: เก็บไฟล์ใน IndexedDB เพื่อให้รีเฟรชแล้วยังอยู่ */
  M.saveVideo = file => {
    const key = M.uid('v');
    M.mem.videos[key] = URL.createObjectURL(file);
    M.idb.put('v_' + key, file).catch(() => M.toast && M.toast('บันทึกวิดีโอไม่ได้ วิดีโอจะหายเมื่อรีเฟรช'));
    return key;
  };
  M.loadVideos = async () => {
    const used = new Set();
    JSON.stringify(M.st, (k, v) => { if (k === 'vid' && typeof v === 'string') used.add(v); return v; });
    let keys = [];
    try { keys = await M.idb.keys(); } catch (e) { return; }
    await Promise.all(keys.filter(k => typeof k === 'string' && k.startsWith('v_')).map(async k => {
      const id = k.slice(2);
      if (!used.has(id)) return M.idb.del(k).catch(() => {}); // ลบวิดีโอที่ไม่มีโพสต์ใช้แล้ว
      const blob = await M.idb.get(k).catch(() => null);
      if (blob) M.mem.videos[id] = URL.createObjectURL(blob);
    }));
  };
  M.store.save = M.debounce(() => M.store.saveNow(), 250);
  Object.defineProperty(M, 'st', { get() { return M.store.state; } });
  M.save = () => M.store.save();

  M.user = id => id === 'me' ? M.st.me : (M.st.users[id] || { id, name: 'ผู้ใช้', handle: 'unknown', hue: 30 });
  M.userByHandle = h => [M.st.me, ...Object.values(M.st.users)].find(u => u.handle === h);
  M.isWide = () => window.matchMedia('(min-width: 960px)').matches;
})(window.M);
