'use strict';
/* โหมดออนไลน์: ใช้บัญชีจริงบนเซิร์ฟเวอร์ของมะลิ (server/server.js)
   - สมัคร/เข้าสู่ระบบ, ฟีดรวม, โพสต์รูป/วิดีโอ, ถูกใจ, ความคิดเห็น, ติดตาม, ค้นหาผู้ใช้, แชตตัวต่อตัวแบบเรียลไทม์
   - ทำงานเมื่อเปิดแอปผ่านเซิร์ฟเวอร์นี้เท่านั้น (เช่น http://localhost:8787) ข้อมูลตัวอย่างในเครื่องไม่ถูกส่งขึ้นเซิร์ฟเวอร์
   - เนื้อหาจากผู้ใช้แสดงผ่าน esc() และอยู่ใต้ translate="no" เสมอ */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;

  /* ---------------- ตัวเชื่อม API ---------------- */
  const C = M.cloud = { checked: false, available: false, me: null, unread: 0, es: null, feed: null, chats: null, users: null, tab: 'feed', composer: { text: '', media: [] }, busy: false };

  class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  C.api = async (method, path, body, opts = {}) => {
    const init = { method, credentials: 'same-origin', headers: { 'X-Mali': '1' } };
    if (body instanceof Blob) { init.body = body; init.headers['Content-Type'] = body.type; }
    else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
    let res;
    try { res = await fetch('/api' + path, init); } catch { throw new ApiError(0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      if (res.status === 401 && !opts.quiet401) { C.me = null; C.disconnect(); }
      throw new ApiError(res.status, data?.error || 'เกิดข้อผิดพลาด');
    }
    return data;
  };
  const fail = e => M.toast(e.message || 'เกิดข้อผิดพลาด');

  C.check = async () => {
    if (C.checked) return C.available;
    C.checked = true;
    if (!/^https?:$/.test(location.protocol)) return (C.available = false);
    try { const r = await fetch('/api/health', { cache: 'no-store' }); const d = await r.json(); C.available = d?.app === 'mali'; } catch { C.available = false; }
    if (C.available) {
      try { const d = await C.api('GET', '/me', undefined, { quiet401: true }); C.me = d.user; C.unread = d.unread || 0; } catch {}
      if (C.me) C.connect();
    }
    return C.available;
  };

  /* เรียลไทม์: ลอง SSE ก่อน ถ้า 4 วินาทีไม่ได้รับ hello (เช่นพร็อกซีบัฟเฟอร์ไว้) เปลี่ยนเป็น long-poll */
  const handlers = {
    message: d => onMessage(d),
    read: () => { const pg = topOf('onlineChat'); if (pg) markSeen(pg); },
    like: d => M.toast(`${d.user.name} ถูกใจโพสต์ของคุณ`),
    comment: d => M.toast(`${d.user.name} แสดงความคิดเห็น: ${d.text}`),
    follow: d => M.toast(`${d.user.name} เริ่มติดตามคุณ`),
    post: () => { C.feed = null; if (topOf('online') && C.tab === 'feed') loadFeed(); }
  };
  C.connect = () => {
    if (C.es || C.polling || !C.me) return;
    const es = C.es = new EventSource('/api/events');
    let ok = false;
    es.addEventListener('hello', () => { ok = true; });
    Object.keys(handlers).forEach(k => es.addEventListener(k, e => { try { handlers[k](JSON.parse(e.data)); } catch (err) { console.warn(err); } }));
    setTimeout(() => { if (!ok && C.es === es) { es.close(); C.es = null; startPolling(); } }, 4000);
  };
  async function startPolling() {
    if (C.polling) return;
    const run = C.polling = {};
    let seq = 0, delay = 1000;
    while (C.polling === run && C.me) {
      try {
        const d = await C.api('GET', '/poll?after=' + seq);
        if (C.polling !== run) break;
        if (seq) d.events.forEach(e => { try { handlers[e.type]?.(e.data); } catch (err) { console.warn(err); } });
        seq = d.seq; delay = 1000;
      } catch (e) { if (e.status === 401) break; await M.sleep(delay); delay = Math.min(delay * 2, 30000); }
    }
    if (C.polling === run) C.polling = null;
  }
  C.disconnect = () => { C.es?.close(); C.es = null; C.polling = null; };

  const topOf = name => { const t = M.topPage(); return t?.dataset.page === name ? t : null; };
  const redraw = () => { const t = M.topPage(); if (t && /^online/.test(t.dataset.page)) M.renderPage(t); };

  function onMessage({ message: m, user }) {
    const pg = topOf('onlineChat');
    const otherId = m.from === C.me.id ? m.to : m.from;
    if (pg && pg._params.user?.id === otherId) {
      const list = pg._params.messages || (pg._params.messages = []);
      if (!list.some(x => x.id === m.id)) { list.push(m); appendMsg(pg, m); }
      if (m.from !== C.me.id) C.api('POST', `/chats/${encodeURIComponent(pg._params.handle)}/read`).catch(() => {});
    } else if (m.from !== C.me.id) {
      C.unread++;
      M.toast(`ข้อความใหม่จาก ${user.name}`, { action: 'เปิด', onAction: () => M.push('onlineChat', { handle: user.handle }) });
    }
    C.chats = null;
    if (topOf('online') && C.tab === 'chats') loadChats();
  }

  /* ---------------- ตัวช่วยแสดงผล ---------------- */
  const av = (u, s = 40) => M.avatar({ name: u?.name || '?', hue: u?.hue ?? 30, photo: u?.avatar || null }, s);
  const media = (m, cls = '') => m.type === 'video' || /\.(mp4|mov|webm)$/.test(m.url || m)
    ? `<video class="${cls}" src="${esc(m.url || m)}" controls playsinline preload="metadata"></video>`
    : `<img class="${cls}" src="${esc(m.url || m)}" alt="" loading="lazy">`;
  const postCard = p => `<article class="on-post" data-pid="${p.id}">
      <header class="on-ph"><button class="on-u" data-act="onUser" data-h="${esc(p.user.handle)}">${av(p.user, 36)}<span translate="no"><b>${esc(p.user.name)}</b><small>@${esc(p.user.handle)} · ${M.ago(p.created)}</small></span></button>
        ${p.user.id === C.me.id ? `<button class="ibtn sm" data-act="onPostMenu" data-id="${p.id}" aria-label="ตัวเลือก">${I('more', 20)}</button>` : ''}</header>
      ${p.media.length ? `<div class="on-media${p.media.length > 1 ? ' multi' : ''}">${p.media.map(u => media(u)).join('')}</div>` : ''}
      ${p.caption ? `<p class="on-cap" translate="no">${esc(p.caption)}</p>` : ''}
      <footer class="on-acts"><button class="on-act${p.liked ? ' on' : ''}" data-act="onLike" data-id="${p.id}" aria-pressed="${p.liked}" aria-label="ถูกใจ">${I('heart', 22)}<span>${p.likes || ''}</span></button>
        <button class="on-act" data-act="onComments" data-id="${p.id}" aria-label="ความคิดเห็น">${I('comment', 22)}<span>${p.comments || ''}</span></button></footer></article>`;
  const loading = '<p class="muted center pad">กำลังโหลด…</p>';

  async function loadFeed() { try { C.feed = (await C.api('GET', '/feed')).posts; } catch (e) { C.feed = []; fail(e); } redraw(); }
  async function loadChats() { try { C.chats = (await C.api('GET', '/chats')).chats; C.unread = C.chats.reduce((n, c) => n + c.unread, 0); } catch (e) { C.chats = []; fail(e); } redraw(); }
  async function loadUsers(q = '') { try { C.users = (await C.api('GET', '/users?q=' + encodeURIComponent(q))).users; } catch (e) { C.users = []; fail(e); } redraw(); }

  /* ---------------- หน้าออนไลน์ ---------------- */
  M.Pages.online = {
    render() {
      if (!C.checked) return M.bar('ออนไลน์') + `<div class="scroll">${loading}</div>`;
      if (!C.available) return M.bar('ออนไลน์') + `<div class="scroll"><div class="col pad on-intro">
          ${M.bud('sleepy', 72)}<h2>ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์</h2>
          <p class="muted">บัญชีออนไลน์ต้องเปิดแอปผ่านเซิร์ฟเวอร์ของมะลิ รันคำสั่งนี้ในโฟลเดอร์แอป แล้วเปิด <b translate="no">http://localhost:8787</b></p>
          <pre class="on-cmd" translate="no">node server/server.js</pre>
          <p class="note">ใช้ Node.js 22.5 ขึ้นไป ไม่ต้องติดตั้งแพ็กเกจเพิ่ม มือถือที่อยู่ Wi-Fi เดียวกันเปิดผ่าน IP ของคอมได้</p></div></div>`;
      if (!C.me) return authView();
      const tabs = [['feed', 'ฟีด', 'home'], ['chats', 'แชต', 'chat'], ['find', 'ค้นหา', 'search'], ['me', 'ฉัน', 'user']];
      let body = '';
      if (C.tab === 'feed') {
        body = `<form class="on-compose" data-oncompose>
            <div class="on-cmp-top">${av(C.me, 36)}<textarea class="field" name="t" rows="2" maxlength="2200" placeholder="คุณกำลังคิดอะไรอยู่" aria-label="เขียนโพสต์">${esc(C.composer.text)}</textarea></div>
            ${C.composer.media.length ? `<div class="on-cmp-media">${C.composer.media.map((m, i) => `<span>${media(m)}<button type="button" class="ibtn sm" data-act="onDropMedia" data-i="${i}" aria-label="เอาออก">${I('x', 16)}</button></span>`).join('')}</div>` : ''}
            <div class="on-cmp-bar"><button type="button" class="btn sec sm" data-act="onAddMedia">${I('image', 18)} รูปหรือวิดีโอ</button><button class="btn pri sm" ${C.busy ? 'disabled' : ''}>${C.busy ? 'กำลังโพสต์…' : 'โพสต์'}</button></div></form>
          ${C.feed == null ? loading : C.feed.length ? C.feed.map(postCard).join('') : `<div class="empty">${M.bud('happy', 64)}<p>ยังไม่มีโพสต์ เป็นคนแรกเลย</p></div>`}`;
        if (C.feed == null) loadFeed();
      } else if (C.tab === 'chats') {
        body = C.chats == null ? loading : C.chats.length ? `<div class="rows">${C.chats.map(c => `<button class="row" data-act="onChat" data-h="${esc(c.user.handle)}">${av(c.user, 48)}<span class="row-tx" translate="no"><span>${esc(c.user.name)}</span><small class="${c.unread ? 'strong' : ''}">${c.last.from === C.me.id ? 'คุณ: ' : ''}${esc(c.last.text || (c.last.media ? 'ส่งไฟล์' : ''))} · ${M.ago(c.last.created)}</small></span>${c.unread ? `<span class="badge">${c.unread}</span>` : ''}</button>`).join('')}</div>`
          : `<div class="empty">${M.bud('happy', 64)}<p>ยังไม่มีแชต ไปที่ค้นหาเพื่อหาเพื่อนแล้วส่งข้อความ</p></div>`;
        if (C.chats == null) loadChats();
      } else if (C.tab === 'find') {
        body = `<form class="searchf pad on-find" data-onfind>${I('search', 18)}<input class="field" name="q" placeholder="ค้นหาชื่อหรือ @ชื่อผู้ใช้" autocomplete="off" aria-label="ค้นหาผู้ใช้"></form>
          ${C.users == null ? loading : C.users.length ? `<div class="rows">${C.users.filter(u => u.id !== C.me.id).map(u => `<button class="row" data-act="onUser" data-h="${esc(u.handle)}">${av(u, 44)}<span class="row-tx" translate="no"><span>${esc(u.name)}</span><small>@${esc(u.handle)}</small></span></button>`).join('')}</div>` : '<p class="empty">ไม่พบผู้ใช้</p>'}`;
        if (C.users == null) loadUsers();
      } else {
        body = `<div class="on-me pad">${av(C.me, 88)}<button class="btn sec sm" data-act="onAvatar">เปลี่ยนรูปโปรไฟล์</button>
            <h2 translate="no">${esc(C.me.name)}</h2><p class="muted" translate="no">@${esc(C.me.handle)}</p>${C.me.bio ? `<p translate="no">${esc(C.me.bio)}</p>` : ''}</div>
          <div class="rows">
            <button class="row" data-act="onUser" data-h="${esc(C.me.handle)}"><span class="row-ic">${I('grid', 22)}</span><span class="row-tx"><span>โปรไฟล์และโพสต์ของฉัน</span></span></button>
            <button class="row" data-act="onEdit" data-k="name"><span class="row-ic">${I('edit', 22)}</span><span class="row-tx"><span>แก้ไขชื่อ</span></span></button>
            <button class="row" data-act="onEdit" data-k="bio"><span class="row-ic">${I('type', 22)}</span><span class="row-tx"><span>แก้ไข Bio</span></span></button>
            <button class="row" data-act="onLogoutAll"><span class="row-ic">${I('device', 22)}</span><span class="row-tx"><span>ออกจากระบบทุกอุปกรณ์</span></span></button>
            <button class="row" data-act="onLogout"><span class="row-ic">${I('logout', 22)}</span><span class="row-tx"><span>ออกจากระบบ</span></span></button></div>
          <p class="note pad">บัญชีนี้อยู่บนเซิร์ฟเวอร์ที่คุณรันเอง แยกจากข้อมูลตัวอย่างในแอป</p>`;
      }
      return M.bar('ออนไลน์') + `<div class="seg pad tabs on-tabs">${tabs.map(([k, l]) => `<button class="${C.tab === k ? 'on' : ''}" data-act="onTab" data-k="${k}">${l}${k === 'chats' && C.unread ? ` <span class="badge">${C.unread}</span>` : ''}</button>`).join('')}</div>
        <div class="scroll"><div class="col">${body}</div></div>`;
    },
    mount(el) {
      if (!C.checked) { C.check().then(() => M.renderPage(el)); return; }
      const auth = el.querySelector('[data-onauth]');
      if (auth) auth.onsubmit = async e => {
        e.preventDefault();
        const mode = auth.dataset.onauth, f = auth.elements;
        const body = { handle: f.h.value.trim().replace(/^@/, ''), password: f.p.value };
        if (mode === 'signup') { body.name = f.n.value.trim(); if (f.p.value !== f.p2.value) return M.toast('รหัสผ่านสองช่องไม่ตรงกัน'); }
        const btn = auth.querySelector('.btn.pri'); btn.disabled = true;
        try {
          const d = await C.api('POST', `/auth/${mode}`, body, { quiet401: true });
          C.me = d.user; C.tab = 'feed'; C.feed = C.chats = C.users = null; C.connect();
          M.toast(mode === 'signup' ? 'สร้างบัญชีแล้ว ยินดีต้อนรับ' : 'เข้าสู่ระบบแล้ว');
          M.renderPage(el);
        } catch (err) { fail(err); btn.disabled = false; }
      };
      const cmp = el.querySelector('[data-oncompose]');
      if (cmp) {
        cmp.t.oninput = () => { C.composer.text = cmp.t.value; };
        cmp.onsubmit = async e => {
          e.preventDefault();
          if (C.busy) return;
          const caption = cmp.t.value.trim();
          if (!caption && !C.composer.media.length) return M.toast('เขียนอะไรสักหน่อยหรือเพิ่มรูปก่อนโพสต์');
          C.busy = true; M.renderPage(el);
          try {
            const d = await C.api('POST', '/posts', { caption, media: C.composer.media.map(m => m.url) });
            C.feed = [d.post, ...(C.feed || [])]; C.composer = { text: '', media: [] };
            M.toast('โพสต์แล้ว');
          } catch (err) { fail(err); }
          C.busy = false; redraw();
        };
      }
      const fd = el.querySelector('[data-onfind]');
      if (fd) { const run = M.debounce(() => loadUsers(fd.q.value.trim()), 300); fd.q.oninput = run; fd.onsubmit = e => { e.preventDefault(); run(); }; }
    },
    unmount() { M.refresh(); }
  };

  function authView() {
    const mode = C.authMode || 'login';
    return M.bar('ออนไลน์') + `<div class="scroll"><div class="col pad on-auth">
      <div class="on-intro">${M.logo(48)}<h2>${mode === 'login' ? 'เข้าสู่ระบบบัญชีออนไลน์' : 'สร้างบัญชีออนไลน์'}</h2>
        <p class="muted">โพสต์ แชต และติดตามเพื่อนที่ใช้เซิร์ฟเวอร์เดียวกันได้จริง</p></div>
      <div class="seg"><button class="${mode === 'login' ? 'on' : ''}" data-act="onAuthMode" data-k="login">เข้าสู่ระบบ</button><button class="${mode === 'signup' ? 'on' : ''}" data-act="onAuthMode" data-k="signup">สมัครใหม่</button></div>
      <form class="on-form" data-onauth="${mode}">
        ${mode === 'signup' ? `<label>ชื่อที่แสดง<input class="field" name="n" maxlength="40" autocomplete="name" required></label>` : ''}
        <label>ชื่อผู้ใช้<input class="field" name="h" maxlength="31" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="a-z 0-9 _ ." required translate="no"></label>
        <label>รหัสผ่าน<input class="field" name="p" type="password" minlength="8" maxlength="128" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required></label>
        ${mode === 'signup' ? `<label>ยืนยันรหัสผ่าน<input class="field" name="p2" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><p class="note">อย่างน้อย 8 ตัว และไม่ควรใช้ซ้ำกับบริการอื่น</p>` : ''}
        <button class="btn pri wide">${mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}</button></form></div></div>`;
  }

  A.onAuthMode = el => { C.authMode = el.dataset.k; redraw(); };
  A.onTab = el => { C.tab = el.dataset.k; if (C.tab === 'chats') C.chats = null; if (C.tab === 'feed') C.feed = null; redraw(); };
  A.openOnline = () => M.push('online', {});

  /* อัปโหลดไฟล์: รูปผ่านตัวกรอง 18+ และลบ EXIF ก่อน, วิดีโอส่งตามเดิม */
  async function pickAndUpload(accept, where) {
    const f = await new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); });
    if (!f) return null;
    try {
      let blob = f;
      if (f.type.startsWith('image/')) {
        const r = await M.adult.guard(f, where); if (!r) return null;
        if (f.type !== 'image/gif') { const p = await M.sec.processImage(f, 1600); blob = await (await fetch(p.dataUrl)).blob(); if (p.gps) M.toast('ลบพิกัด GPS ออกจากรูปแล้ว'); }
      } else if (!f.type.startsWith('video/')) { M.toast('รองรับเฉพาะรูปและวิดีโอ'); return null; }
      M.toast('กำลังอัปโหลด…', { ms: 1500 });
      return await C.api('POST', '/upload', blob);
    } catch (e) { fail(e); return null; }
  }
  A.onAddMedia = async () => {
    if (C.composer.media.length >= 10) return M.toast('แนบได้สูงสุด 10 ไฟล์');
    const r = await pickAndUpload('image/*,video/mp4,video/quicktime,video/webm', 'post');
    if (r) { C.composer.media.push(r); redraw(); }
  };
  A.onDropMedia = el => { C.composer.media.splice(+el.dataset.i, 1); redraw(); };
  A.onAvatar = async () => {
    const r = await pickAndUpload('image/jpeg,image/png,image/webp', 'avatar'); if (!r) return;
    try { C.me = (await C.api('PATCH', '/me', { avatar: r.url })).user; M.toast('เปลี่ยนรูปโปรไฟล์แล้ว'); redraw(); } catch (e) { fail(e); }
  };
  A.onEdit = async el => {
    const k = el.dataset.k;
    const v = await M.prompt(k === 'name' ? 'แก้ไขชื่อ' : 'แก้ไข Bio', C.me[k] || '', '', { multiline: k === 'bio', max: k === 'name' ? 40 : 150 });
    if (v == null) return;
    try { C.me = (await C.api('PATCH', '/me', { [k]: v })).user; redraw(); } catch (e) { fail(e); }
  };
  A.onLogout = async () => {
    try { await C.api('POST', '/auth/logout'); } catch {}
    C.disconnect(); C.me = null; C.feed = C.chats = C.users = null; C.unread = 0; redraw();
  };
  A.onLogoutAll = async () => {
    if (!(await M.confirm('ออกจากระบบทุกอุปกรณ์ไหม', 'ทุกอุปกรณ์ที่เข้าสู่ระบบบัญชีนี้ รวมถึงเครื่องนี้ จะต้องเข้าสู่ระบบใหม่', 'ออกจากระบบ', true))) return;
    try { await C.api('POST', '/auth/logout-all'); } catch {}
    C.disconnect(); C.me = null; redraw();
  };

  /* โพสต์ */
  const findPost = id => [...(C.feed || []), ...(topOf('onlineUser')?._params.data?.posts || [])].filter(p => p.id === id);
  A.onLike = async el => {
    const id = el.dataset.id;
    try {
      const d = await C.api('POST', `/posts/${id}/like`);
      findPost(id).forEach(p => { p.liked = d.liked; p.likes = d.likes; });
      el.classList.toggle('on', d.liked); el.setAttribute('aria-pressed', d.liked); el.querySelector('span').textContent = d.likes || '';
    } catch (e) { fail(e); }
  };
  A.onPostMenu = el => M.menu([{ label: 'ลบโพสต์', icon: 'trash', danger: true, act: async () => {
    if (!(await M.confirm('ลบโพสต์นี้ไหม', 'ลบแล้วกู้คืนไม่ได้', 'ลบ', true))) return;
    try { await C.api('DELETE', `/posts/${el.dataset.id}`); if (C.feed) C.feed = C.feed.filter(p => p.id !== el.dataset.id); const u = topOf('onlineUser'); if (u?._params.data) u._params.data.posts = u._params.data.posts.filter(p => p.id !== el.dataset.id); M.toast('ลบโพสต์แล้ว'); redraw(); } catch (e) { fail(e); }
  } }]);
  A.onComments = async el => {
    const id = el.dataset.id;
    const sh = M.sheet(`<div class="on-cm">${loading}</div><form class="composer" data-oncm><input class="field" name="t" maxlength="1000" placeholder="แสดงความคิดเห็น" aria-label="ความคิดเห็น" autocomplete="off"><button class="ibtn" aria-label="ส่ง">${I('send')}</button></form>`, { title: 'ความคิดเห็น' });
    const box = sh.querySelector('.on-cm');
    const row = c => `<div class="row on-cm-r">${av(c.user, 32)}<span class="row-tx" translate="no"><span><b>${esc(c.user.name)}</b> ${esc(c.text)}</span><small>${M.ago(c.created)}</small></span></div>`;
    try { const d = await C.api('GET', `/posts/${id}/comments`); box.innerHTML = d.comments.length ? d.comments.map(row).join('') : '<p class="muted center pad">ยังไม่มีความคิดเห็น</p>'; } catch (e) { box.innerHTML = ''; fail(e); }
    const f = sh.querySelector('[data-oncm]');
    f.onsubmit = async e => {
      e.preventDefault();
      const t = f.t.value.trim(); if (!t) return;
      try {
        const d = await C.api('POST', `/posts/${id}/comments`, { text: t });
        if (!box.querySelector('.on-cm-r')) box.innerHTML = '';
        box.insertAdjacentHTML('beforeend', row(d.comment)); f.t.value = '';
        findPost(id).forEach(p => p.comments++);
        const cnt = document.querySelector(`.on-post[data-pid="${id}"] [data-act="onComments"] span`); if (cnt) cnt.textContent = +(cnt.textContent || 0) + 1;
      } catch (err) { fail(err); }
    };
  };

  /* โปรไฟล์ผู้ใช้ */
  A.onUser = el => M.push('onlineUser', { handle: el.dataset.h });
  M.Pages.onlineUser = {
    render(p) {
      const d = p.data;
      if (!d) return M.bar('โปรไฟล์') + `<div class="scroll">${loading}</div>`;
      const mine = d.user.id === C.me?.id;
      return M.bar(`<span translate="no">@${esc(d.user.handle)}</span>`) + `<div class="scroll"><div class="col">
        <div class="on-me pad">${av(d.user, 88)}<h2 translate="no">${esc(d.user.name)}</h2>${d.user.bio ? `<p translate="no">${esc(d.user.bio)}</p>` : ''}
          <div class="on-stats"><span><b>${d.posts.length}</b> โพสต์</span><span><b>${d.followers}</b> ผู้ติดตาม</span><span><b>${d.following}</b> กำลังติดตาม</span></div>
          ${mine ? '' : `<div class="p2p-row"><button class="btn ${d.isFollowing ? 'sec' : 'pri'}" data-act="onFollow">${d.isFollowing ? 'กำลังติดตาม' : 'ติดตาม'}</button><button class="btn sec" data-act="onChat" data-h="${esc(d.user.handle)}">ส่งข้อความ</button></div>`}</div>
        ${d.posts.length ? d.posts.map(postCard).join('') : '<p class="empty">ยังไม่มีโพสต์</p>'}</div></div>`;
    },
    mount(el, p) {
      if (!p.data) C.api('GET', `/users/${encodeURIComponent(p.handle)}`).then(d => { p.data = d; M.renderPage(el); }).catch(e => { fail(e); M.back(); });
    }
  };
  A.onFollow = async () => {
    const pg = topOf('onlineUser'), d = pg?._params.data; if (!d) return;
    try { const r = await C.api('POST', `/users/${encodeURIComponent(d.user.handle)}/follow`); d.isFollowing = r.following; d.followers += r.following ? 1 : -1; C.feed = null; M.renderPage(pg); } catch (e) { fail(e); }
  };

  /* แชต */
  A.onChat = el => M.push('onlineChat', { handle: el.dataset.h });
  const bubble = (m, seen = true) => {
    const me = m.from === C.me.id && seen;
    return `<div class="msg ${m.from === C.me.id ? 'me' : ''}" data-mid="${m.id}"><div class="msg-c">${m.media ? `<div class="on-msg-media">${media(m.media)}</div>` : ''}${m.text ? `<div class="bub" translate="no">${esc(m.text)}</div>` : ''}${me ? `<small class="on-seen" data-seen="${m.read ? 1 : 0}">${m.read ? 'อ่านแล้ว' : 'ส่งแล้ว'}</small>` : ''}</div></div>`;
  };
  function appendMsg(pg, m) {
    const box = pg.querySelector('[data-onlog]'); if (!box) return;
    box.querySelector('.empty')?.remove();
    // แสดงสถานะเฉพาะข้อความล่าสุดของเรา
    if (m.from === C.me.id) box.querySelectorAll('.on-seen').forEach(s => s.remove());
    box.insertAdjacentHTML('beforeend', bubble(m)); box.scrollTop = box.scrollHeight;
  }
  function markSeen(pg) { pg._params.messages?.forEach(m => { if (m.from === C.me.id) m.read = true; }); pg.querySelectorAll('.on-seen').forEach(s => { s.textContent = 'อ่านแล้ว'; s.dataset.seen = 1; }); }
  M.Pages.onlineChat = {
    render(p) {
      const u = p.user;
      if (!u) return M.bar('แชต') + `<div class="scroll">${loading}</div>`;
      const msgs = p.messages || [];
      const lastMine = [...msgs].reverse().find(m => m.from === C.me.id)?.id;
      return M.bar(`<button class="on-u" data-act="onUser" data-h="${esc(u.handle)}">${av(u, 32)}<span translate="no">${esc(u.name)}</span></button>`) +
        `<div class="scroll p2p-log" data-onlog>${msgs.length ? msgs.map(m => bubble(m, m.id === lastMine)).join('') : `<div class="empty">${av(u, 64)}<p>เริ่มคุยกับ <span translate="no">${esc(u.name)}</span></p></div>`}</div>
        <form class="p2p-form" data-onmsg><button type="button" class="ibtn" data-act="onSendMedia" aria-label="ส่งรูปหรือวิดีโอ">${I('image')}</button><input class="field" name="t" maxlength="2000" autocomplete="off" placeholder="พิมพ์ข้อความ" aria-label="ข้อความ"><button class="ibtn" aria-label="ส่ง">${I('send')}</button></form>`;
    },
    mount(el, p) {
      if (!p.user) {
        C.api('GET', `/chats/${encodeURIComponent(p.handle)}`).then(d => {
          p.user = d.user; p.messages = d.messages; M.renderPage(el);
          const n = d.messages.filter(m => m.to === C.me.id && !m.read).length;
          if (n) C.api('POST', `/chats/${encodeURIComponent(p.handle)}/read`).then(() => { C.chats = null; C.unread = Math.max(0, C.unread - n); }).catch(() => {});
        }).catch(e => { fail(e); M.back(); });
        return;
      }
      const box = el.querySelector('[data-onlog]'); box.scrollTop = box.scrollHeight;
      const f = el.querySelector('[data-onmsg]');
      f.onsubmit = async e => {
        e.preventDefault();
        const t = f.t.value.trim(); if (!t) return;
        f.t.value = '';
        try { const d = await C.api('POST', `/chats/${encodeURIComponent(p.handle)}`, { text: t }); if (!p.messages.some(m => m.id === d.message.id)) { p.messages.push(d.message); appendMsg(el, d.message); } }
        catch (err) { fail(err); f.t.value = t; }
      };
      setTimeout(() => f.t.focus(), 50);
    },
    unmount() { C.chats = null; M.refresh(); }
  };
  A.onSendMedia = async () => {
    const pg = topOf('onlineChat'); if (!pg) return;
    const r = await pickAndUpload('image/*,video/mp4,video/quicktime,video/webm', 'chat'); if (!r) return;
    try { const d = await C.api('POST', `/chats/${encodeURIComponent(pg._params.handle)}`, { media: r.url }); if (!pg._params.messages.some(m => m.id === d.message.id)) { pg._params.messages.push(d.message); appendMsg(pg, d.message); } } catch (e) { fail(e); }
  };

  // ตรวจเซิร์ฟเวอร์ตอนเปิดแอป เพื่อให้รับข้อความใหม่ได้แม้ยังไม่ได้เปิดหน้าออนไลน์
  setTimeout(() => C.check(), 800);
})(window.M);
