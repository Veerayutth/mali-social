'use strict';
/* สำรวจ (ค้นหาโพสต์ บัญชี แท็ก) และการแจ้งเตือน */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;

  const allTags = () => {
    const set = new Map();
    M.st.posts.concat(M.st.reels).forEach(p => (p.caption.match(/#[฀-๿a-zA-Z0-9_]+/g) || []).forEach(t => set.set(t, (set.get(t) || 0) + (p.likes || 0))));
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  };
  const search = q => {
    const st = M.st, s = q.toLowerCase().replace(/^[#@]/, '');
    const users = [st.me, ...Object.values(st.users)].filter(u => !st.blocked.includes(u.id) && (u.handle.toLowerCase().includes(s) || u.name.includes(s)));
    const posts = st.posts.filter(p => M.visiblePost(p) && (p.caption.toLowerCase().includes(s) || (p.location || '').includes(s) || (p.tags || []).some(t => M.TOPICS[t].includes(s)) || p.slides.some(x => x.caption?.includes(s))));
    const reels = st.reels.filter(r => r.caption.toLowerCase().includes(s));
    const tags = allTags().filter(([t]) => t.toLowerCase().includes(s));
    const places = [...new Set(st.posts.map(p => p.location).filter(l => l && l.includes(s)))];
    return { users, posts, reels, tags, places };
  };

  M.Pages.explore = {
    render(p) {
      const st = M.st, q = p.q || '', tab = p.tab || 'top';
      let body;
      if (!q) {
        const pool = [...st.posts.filter(x => x.userId !== 'me' && M.visiblePost(x)), ...st.reels].sort((a, b) => M.hash(a.id) % 7 - M.hash(b.id) % 7);
        body = `${st.recent.length ? `<div class="sec-row pad"><h3 class="sec-t">ค้นหาล่าสุด</h3><button class="link" data-act="clearRecent">ล้าง</button></div><div class="chips pad">${st.recent.map(r => `<button class="chip" data-act="exploreQ" data-q="${esc(r)}">${I('clock', 14)} ${esc(r)}</button>`).join('')}</div>` : ''}
          <h3 class="sec-t pad">กำลังเป็นที่นิยม</h3>
          <div class="chips pad">${allTags().slice(0, 8).map(([t]) => `<button class="chip" data-act="exploreQ" data-q="${esc(t)}">${esc(t)}</button>`).join('')}</div>
          <div class="grid3 mosaic">${pool.map((x, i) => `<div class="${i % 10 === 2 || i % 10 === 6 ? 'tall' : ''}">${M.gridTile(x)}</div>`).join('')}</div>`;
      } else {
        const r = search(q);
        const tabs = [['top', 'ยอดนิยม'], ['users', `บัญชี ${r.users.length}`], ['tags', `แท็ก ${r.tags.length}`], ['places', `สถานที่ ${r.places.length}`]];
        const userRows = list => list.map(u => `<button class="row" data-act="openUser" data-id="${u.id}">${M.ringAv(u, 44, 'openUser')}<span class="row-tx"><span>${M.handle(u, false)}</span><small>${esc(u.name)} · ผู้ติดตาม ${M.num(u.followers)}</small></span></button>`).join('');
        body = `<div class="seg pad tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="exploreTab" data-tab="${k}">${l}</button>`).join('')}</div>`;
        if (tab === 'top') body += `${r.users.length ? `<div class="rows">${userRows(r.users.slice(0, 3))}</div>` : ''}<div class="grid3">${[...r.posts, ...r.reels].map(M.gridTile).join('')}</div>${!r.users.length && !r.posts.length && !r.reels.length ? `<div class="empty">${M.bud('sad', 64)}<p>ไม่พบผลลัพธ์สำหรับ "${esc(q)}"</p></div>` : ''}`;
        if (tab === 'users') body += `<div class="rows">${userRows(r.users) || '<p class="empty">ไม่พบบัญชี</p>'}</div>`;
        if (tab === 'tags') body += `<div class="rows">${r.tags.map(([t, n]) => `<button class="row" data-act="exploreQ" data-q="${esc(t)}"><span class="av tagav" style="--s:44px">#</span><span class="row-tx"><span>${esc(t)}</span><small>การมีส่วนร่วม ${M.num(n)}</small></span></button>`).join('') || '<p class="empty">ไม่พบแท็ก</p>'}</div>`;
        if (tab === 'places') body += `<div class="rows">${r.places.map(pl => `<button class="row" data-act="exploreQ" data-q="${esc(pl)}"><span class="row-ic">${I('pin', 22)}</span><span class="row-tx"><span>${esc(pl)}</span></span></button>`).join('') || '<p class="empty">ไม่พบสถานที่</p>'}</div>`;
      }
      return `<header class="bar glass"><button class="ibtn" data-act="back" aria-label="ย้อนกลับ">${I('back')}</button>
        <form class="searchf" data-exsearch>${I('search', 18)}<input class="field" name="q" value="${esc(q)}" placeholder="ค้นหา" autocomplete="off" aria-label="ค้นหา">${q ? `<button type="button" class="ibtn sm" data-act="exploreQ" data-q="" aria-label="ล้าง">${I('x', 16)}</button>` : ''}</form></header>
        <div class="scroll"><div class="col">${body}</div></div>`;
    },
    mount(el, p) {
      const f = el.querySelector('[data-exsearch]');
      const inp = f.q;
      if (!p.q) setTimeout(() => inp.focus(), 300);
      const run = M.debounce(() => { const v = inp.value.trim(); el._params = { ...el._params, q: v, tab: 'top' }; const pos = inp.selectionStart; M.renderPage(el); const i2 = el.querySelector('[data-exsearch] input'); i2.focus(); i2.setSelectionRange(pos, pos); }, 300);
      inp.oninput = run;
      f.onsubmit = e => { e.preventDefault(); const v = inp.value.trim(); if (v) { M.st.recent = [v, ...M.st.recent.filter(x => x !== v)].slice(0, 8); M.save(); } };
    }
  };
  A.exploreQ = el => {
    const top = M.topPage(), q = el.dataset.q;
    if (q) { M.st.recent = [q, ...M.st.recent.filter(x => x !== q)].slice(0, 8); M.save(); }
    if (top?.dataset.page === 'explore') { top._params = { q, tab: 'top' }; M.renderPage(top); }
    else M.push('explore', { q });
  };
  A.exploreTab = el => { const top = M.topPage(); top._params.tab = el.dataset.tab; M.renderPage(top); };
  A.clearRecent = () => { M.st.recent = []; M.refresh(); };

  /* ---------- การแจ้งเตือน ---------- */
  const TEXT = {
    like: 'ถูกใจโพสต์ของคุณ', comment: 'แสดงความคิดเห็น:', tag: 'แท็กคุณในโพสต์', mention: 'พูดถึงคุณ:', follow: 'เริ่มติดตามคุณ',
    follow_req: 'ขอติดตามคุณ', live: 'เริ่มถ่ายทอดสด'
  };
  M.Pages.notifications = {
    render() {
      const st = M.st, ns = st.notifications.filter(n => !st.blocked.includes(n.userId));
      const reqs = ns.filter(n => n.type === 'follow_req' && !n.resolved);
      const rest = ns.filter(n => n.type !== 'follow_req' || n.resolved);
      const today = rest.filter(n => Date.now() - n.ts < M.T.DAY), older = rest.filter(n => Date.now() - n.ts >= M.T.DAY);
      const row = n => {
        if (n.type === 'security') return `<button class="row notif sec-n" data-act="page" data-page="sessions" data-params="{}"><span class="row-ic warn">${I('shieldCheck', 22)}</span><span class="row-tx"><span>${esc(n.text)}</span><small>${M.ago(n.ts)}</small></span></button>`;
        const u = M.user(n.userId), p = n.postId && M.findPost(n.postId);
        const pending = n.type === 'tag' && st.settings.tagApproval && !n.approved && !n.resolved;
        return `<div class="row notif${n.read ? '' : ' unread'}">${M.ringAv(u, 44)}<span class="row-tx"><span>${M.handle(u)} <span>${TEXT[n.type] || ''}</span> ${n.text ? `<span translate="no">${esc(n.text)}</span>` : ''} <span class="muted">${M.ago(n.ts)}</span></span>
          ${pending ? `<span class="acts"><button class="btn sm pri" data-act="tagDecide" data-id="${n.id}" data-v="1">แสดงบนโปรไฟล์</button><button class="btn sm sec" data-act="tagDecide" data-id="${n.id}" data-v="0">ซ่อน</button></span>` : ''}</span>
          ${n.type === 'follow' ? (st.following.includes(u.id) ? `<button class="btn sm sec" data-act="follow" data-id="${u.id}">กำลังติดตาม</button>` : `<button class="btn sm pri" data-act="follow" data-id="${u.id}">ติดตามกลับ</button>`)
            : p ? `<button class="thumb" data-act="openPost" data-id="${p.id}" aria-label="เปิดโพสต์">${M.media(p.slides[0])}</button>` : ''}</div>`;
      };
      return M.bar('การแจ้งเตือน', `<button class="link" data-act="readAll">อ่านทั้งหมด</button>`) + `<div class="scroll"><div class="col">
        ${reqs.length ? `<h3 class="sec-t pad">คำขอติดตาม ${reqs.length}</h3><div class="rows">${reqs.map(n => { const u = M.user(n.userId); return `<div class="row">${M.avatar(u, 44)}<span class="row-tx"><span>${M.handle(u)}</span><small>${esc(u.name)}</small></span><button class="btn sm pri" data-act="followReq" data-id="${n.id}" data-v="1">ยืนยัน</button><button class="btn sm sec" data-act="followReq" data-id="${n.id}" data-v="0">ลบ</button></div>`; }).join('')}</div>` : ''}
        ${today.length ? `<h3 class="sec-t pad">วันนี้</h3><div class="rows">${today.map(row).join('')}</div>` : ''}
        ${older.length ? `<h3 class="sec-t pad">7 วันที่ผ่านมา</h3><div class="rows">${older.map(row).join('')}</div>` : ''}
        ${!ns.length ? `<div class="empty">${M.bud('sleepy', 64)}<p>ยังไม่มีการแจ้งเตือน</p></div>` : ''}
      </div></div>`;
    },
    mount() { setTimeout(() => { M.st.notifications.forEach(n => n.read = true); M.save(); M.renderNav(); }, 1500); }
  };
  A.readAll = () => { M.st.notifications.forEach(n => n.read = true); M.refresh(); };
  A.followReq = el => {
    const n = M.st.notifications.find(x => x.id === el.dataset.id);
    n.resolved = true;
    if (el.dataset.v === '1') { n.type = 'follow'; M.st.me.followers++; M.toast(`${M.user(n.userId).handle} ติดตามคุณแล้ว`); }
    else M.st.notifications = M.st.notifications.filter(x => x !== n);
    M.refresh();
  };
  A.tagDecide = el => {
    const n = M.st.notifications.find(x => x.id === el.dataset.id);
    n.resolved = true; n.approved = el.dataset.v === '1';
    const p = M.findPost(n.postId);
    if (p && !n.approved) p.tagged = (p.tagged || []).filter(x => x !== 'me');
    M.toast(n.approved ? 'แสดงโพสต์ที่ถูกแท็กบนโปรไฟล์แล้ว' : 'ซ่อนจากโปรไฟล์แล้ว'); M.refresh();
  };
})(window.M);
