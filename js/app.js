'use strict';
/* จุดเริ่มต้นแอป */
(async function (M) {
  const fresh = !(await M.store.load());
  if (fresh) M.store.state = M.seed();
  M.normalizeTimes(M.st, fresh);
  // ย้ายข้อมูลจากเวอร์ชันก่อน: เอา OpenChat ออก + ค่าตั้งใหม่
  const st0 = M.st;
  delete st0.openchats; delete st0.ocCat; delete st0.ocQ;
  st0.chats = st0.chats.filter(c => c.type !== 'openchat');
  st0.settings = { lang: 'th', font: 'Anuphan', fontScale: 1, ringAll: false, adultFilter: 'standard', ...st0.settings };
  if (!st0.me.ringColor) st0.me.ringColor = '#c4411a';
  if (st0.me.banner === undefined) st0.me.banner = { art: { kind: 'sea', seed: 77 } };
  const BANNERS = { ploy: ['cafe', 12], ton: ['cafe', 40], mint: ['food', 3], nok: ['mountain', 21], bank: ['city', 8], fah: ['flower', 9], jirat: ['city', 61], may: ['forest', 5], kao: ['market', 14], pim: ['temple', 2], mali: ['flower', 30] };
  Object.entries(BANNERS).forEach(([id, [kind, seed]]) => { const u = st0.users[id]; if (u && u.banner === undefined) u.banner = { art: { kind, seed } }; });
  if (st0.users.ploy && !st0.users.ploy.ringColor) st0.users.ploy.ringColor = 'conic-gradient(from 200deg, #f59f00, #d6336c, #ae3ec9, #f59f00)';
  if (st0.users.mint && !st0.users.mint.ringColor) st0.users.mint.ringColor = '#d6336c';
  // ล้างสถานะชั่วคราวที่อาจค้างจากการปิดแท็บ
  M.st.chats.forEach(c => { delete c._typing; delete c._summary; });
  M.st.reorder = false;
  M.store.saveNow();
  await M.loadVideos();

  const applyTheme = () => {
    const t = M.st.settings.theme;
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#161513' : '#f7f4ee';
  };
  applyTheme();
  M.applyAppearance();
  M.i18n.start();
  if (M.st.settings.lang && M.st.settings.lang !== 'th') M.i18n.set(M.st.settings.lang);
  M.loadBanner();
  M.onChoice['settings.theme'] = () => setTimeout(applyTheme, 0);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  const startHash = location.hash;
  const start = startHash.slice(1).split('=')[0];
  M.go(M.Tabs[start] ? start : 'home');
  history.replaceState({ root: 1 }, '', location.hash || '#home');
  if (M.st.session.loggedOut) M.push('login');
  else M.p2pFromHash(startHash);
  addEventListener('hashchange', () => { if (!M.st.session.loggedOut) M.p2pFromHash(); });

  // ปรับเลย์เอาต์แชตเมื่อขนาดจอเปลี่ยน (สองคอลัมน์ ↔ หน้าเดียว)
  let wide = M.isWide();
  addEventListener('resize', M.debounce(() => { if (M.isWide() !== wide) { wide = M.isWide(); if (M.cur === 'chat') M.renderTab('chat'); } }, 200));

  // ติดตั้งเป็นแอป (PWA): service worker ทำงานได้เฉพาะเมื่อเปิดผ่าน http(s) ไม่ใช่ file://
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e)));
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); M.installPrompt = e; });
  addEventListener('appinstalled', () => { M.installPrompt = null; M.toast('ติดตั้งมะลิลงเครื่องแล้ว'); });
})(window.M);
