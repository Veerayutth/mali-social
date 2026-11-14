'use strict';
/* โปรไฟล์ของฉัน + โปรไฟล์คนอื่น + จัดเรียงตาราง + แก้ไขโปรไฟล์ + โน้ต */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;

  const myGrid = () => {
    const st = M.st;
    const ids = st.me.gridOrder.filter(id => M.findPost(id));
    // โพสต์ที่ถูกแท็กและเลือก "เพิ่มลงตารางหลัก"
    st.posts.filter(p => p.onMainGrid && !ids.includes(p.id)).forEach(p => ids.push(p.id));
    return ids.map(M.findPost);
  };
  const stat = (n, l, act) => `<button class="stat" ${act ? `data-act="${act}"` : ''}><b>${M.num(n)}</b><span>${l}</span></button>`;

  const header = (u, mine) => {
    const st = M.st;
    const posts = mine ? myGrid().length : st.posts.filter(p => p.userId === u.id).length;
    const note = mine ? st.me.note : st.notes[u.id];
    const noteHTML = note && Date.now() - note.ts < M.T.DAY
      ? `<button class="note-bub"${M.noteStyle(note)} ${mine ? 'data-act="editNote"' : ''}>${note.music ? `${I('music', 12)} ` : ''}${esc(note.text || (note.music ? M.TRACKS.find(t => t.id === note.music)?.name : ''))}</button>`
      : mine ? `<button class="note-bub add" data-act="editNote">แตะเพื่อเพิ่มโน้ต</button>` : '';
    const following = u.id === 'me' ? st.following.length : u.followingCount;
    return `${M.bannerHTML(u, mine)}<div class="pf${u.banner || mine ? ' has-banner' : ''}">
      <div class="pf-top"><div class="pf-av">${noteHTML}${M.ringAv(u, 86, mine ? 'newStory' : 'openUser')}</div>
        <div class="pf-stats">${stat(posts, 'โพสต์')}${stat(u.followers, 'ผู้ติดตาม', mine ? 'myFollowers' : '')}${stat(following, 'กำลังติดตาม', mine ? 'myFollowing' : '')}</div></div>
      <div class="pf-info"><b translate="no">${esc(u.name)}</b>${u.verified ? `<span class="vf">${I('verified', 15)}</span>` : ''}
        ${u.type !== 'personal' && u.category ? `<span class="muted small">${esc(u.category)}</span>` : ''}
        <p translate="no">${esc(u.bio).replace(/\n/g, '<br>')}</p>
        ${u.link ? `<a class="lnk" data-act="openLink" data-url="${esc(u.link)}">${I('link', 14)} ${esc(u.link.replace(/^https?:\/\//, ''))}</a>` : ''}
        ${!mine && st.following.some(f => f !== u.id && M.user(f).friend) ? `<p class="muted small">ติดตามโดย ${esc(M.user(st.following.find(f => f !== u.id && !M.user(f).official)).handle)} และคนอื่นๆ</p>` : ''}
      </div></div>`;
  };

  /* แบนเนอร์โปรไฟล์: รูปนิ่งหรือ GIF เคลื่อนไหว เก็บใน IndexedDB */
  M.mem.banners = M.mem.banners || {};
  M.bannerHTML = (u, mine) => {
    const b = u.banner;
    if (!b && !mine) return '';
    let inner = '';
    if (b?.idb) inner = M.mem.banners[u.id] ? `<img src="${M.mem.banners[u.id]}" alt="">` : '<div class="art"></div>';
    else if (b?.art) inner = `<div class="art">${M.scene(b.art.kind, b.art.seed)}</div>`;
    const tag = b?.gif ? '<span class="gif-tag">GIF</span>' : '';
    return mine
      ? `<button class="pf-banner${b ? '' : ' empty'}" data-act="bannerMenu" aria-label="แบนเนอร์โปรไฟล์">${inner}${tag}${b ? '' : `<span class="add">${I('image', 20)} เพิ่มแบนเนอร์ รองรับรูปและ GIF</span>`}</button>`
      : `<div class="pf-banner" role="img" aria-label="แบนเนอร์โปรไฟล์">${inner}${tag}</div>`;
  };
  M.loadBanner = async () => {
    const b = M.st.me.banner;
    if (!b?.idb) return;
    try { const blob = await M.idb.get(b.idb); if (blob) { M.mem.banners.me = URL.createObjectURL(blob); M.refresh(); } } catch {}
  };
  A.bannerMenu = () => M.menu([
    { label: 'อัปโหลดแบนเนอร์', sub: 'JPG, PNG, WebP หรือ GIF เคลื่อนไหว ไม่เกิน 8 MB', icon: 'upload', act: () => A.changeBanner() },
    { label: 'ใช้ภาพตัวอย่าง', icon: 'image', act: () => { M.st.me.banner = { art: { kind: M.pick(M.SCENES), seed: Math.floor(Math.random() * 999) } }; M.refresh(); } },
    M.st.me.banner && { label: 'ลบแบนเนอร์', icon: 'trash', danger: true, act: async () => { if (M.st.me.banner.idb) await M.idb.del(M.st.me.banner.idb).catch(() => {}); M.st.me.banner = null; delete M.mem.banners.me; M.refresh(); } }
  ], 'แบนเนอร์โปรไฟล์');
  A.changeBanner = async () => {
    const [f] = await M.pickFiles('image/gif,image/png,image/jpeg,image/webp');
    if (!f) return;
    if (!/^image\/(gif|png|jpeg|webp)$/.test(f.type)) return M.toast('รองรับเฉพาะ JPG, PNG, WebP และ GIF');
    if (f.size > 8 * 1024 * 1024) return M.toast('ไฟล์ใหญ่เกิน 8 MB');
    const verdict = await M.adult.guard(f, 'banner');
    if (!verdict) return;
    let blob = f;
    const animated = f.type === 'image/gif' || f.type === 'image/webp';
    // GIF/WebP เก็บไฟล์เดิมไว้เพื่อให้ยังเคลื่อนไหวได้ รูปอื่นวาดใหม่เพื่อลบ EXIF/GPS
    if (!animated) { const r = await M.sec.processImage(f, 1600); blob = await (await fetch(r.dataUrl)).blob(); if (r.gps) M.toast('ลบพิกัด GPS ออกจากรูปแล้ว'); }
    try { await M.idb.put('banner_me', blob); } catch { return M.toast('บันทึกแบนเนอร์ไม่สำเร็จ'); }
    if (M.mem.banners.me) URL.revokeObjectURL(M.mem.banners.me);
    M.mem.banners.me = URL.createObjectURL(blob);
    M.st.me.banner = { idb: 'banner_me', gif: f.type === 'image/gif', ts: Date.now() };
    M.toast(f.type === 'image/gif' ? 'ตั้งแบนเนอร์ GIF แล้ว' : 'ตั้งแบนเนอร์แล้ว'); M.refresh();
  };

  const highlights = (mine) => `<div class="hl hscroll">${mine ? `<button class="hl-it" data-act="newHighlight"><span class="hl-c add">${I('plus')}</span><span>ใหม่</span></button>` : ''}
    ${(mine ? M.st.highlights.filter(h => !h.archived) : []).map(h => `<button class="hl-it" data-act="openHighlight" data-id="${h.id}"><span class="hl-c">${M.media(h.items[0])}</span><span>${esc(h.title)}</span></button>`).join('')}</div>`;

  const tabsBar = (cur, mine) => `<div class="pf-tabs" role="tablist">${[['grid', 'grid', 'โพสต์'], ['reels', 'reels', 'Reels'], ['reposts', 'repost', 'รีโพสต์'], ['tagged', 'tag', 'ที่ถูกแท็ก']].map(([k, ic, l]) =>
    `<button role="tab" class="${cur === k ? 'on' : ''}" data-act="pfTab" data-k="${k}" aria-label="${l}" aria-selected="${cur === k}">${I(ic, 22)}</button>`).join('')}</div>`;

  const tabContent = (u, tab, mine) => {
    const st = M.st;
    if (tab === 'grid') {
      const list = mine ? myGrid() : st.posts.filter(p => p.userId === u.id || p.collab.includes(u.id));
      if (!list.length) return `<div class="empty">${M.bud('happy', 64)}<p>${mine ? 'แชร์รูปหรือวิดีโอแรกของคุณ' : 'ยังไม่มีโพสต์'}</p>${mine ? '<button class="btn pri" data-act="openCreate">สร้างโพสต์</button>' : ''}</div>`;
      return `${mine ? `<div class="grid-tools"><span class="muted small">${M.st.reorder ? 'ลากรูปเพื่อสลับตำแหน่ง แล้วกดเสร็จ' : 'กดค้างที่รูปเพื่อจัดเรียงตาราง'}</span><button class="link acc" data-act="toggleReorder">${M.st.reorder ? 'เสร็จ' : 'จัดเรียง'}</button></div>` : ''}
        <div class="grid3${mine && M.st.reorder ? ' reorder' : ''}" data-grid>${list.map(p => `<div class="cell" data-id="${p.id}">${M.gridTile(p)}</div>`).join('')}</div>`;
    }
    if (tab === 'reels') {
      const list = st.reels.filter(r => r.userId === u.id && (mine || !r.trial));
      return list.length ? `<div class="grid3 tall">${list.map(r => `<div class="cell">${M.gridTile(r)}<span class="tile-n">${I('play', 12)} ${M.num(r.likes * 4)}${r.trial ? ' · ทดลอง' : ''}</span></div>`).join('')}</div>` : '<p class="empty">ยังไม่มี Reels</p>';
    }
    if (tab === 'reposts') {
      const list = mine ? [...st.posts.filter(p => p.reposted), ...st.reels.filter(r => r.reposted)] : [];
      return list.length ? `<div class="grid3">${list.map(M.gridTile).join('')}</div>` : `<p class="empty">${mine ? 'โพสต์และ Reels ที่คุณรีโพสต์จะแสดงที่นี่' : 'ยังไม่มีรีโพสต์'}</p>`;
    }
    const tagged = st.posts.filter(p => (p.tagged || []).includes(u.id));
    return tagged.length ? `<div class="rows">${tagged.map(p => `<div class="row">${`<span class="thumb">${M.media(p.slides[0])}</span>`}<span class="row-tx"><span>โดย ${esc(M.user(p.userId).handle)}</span><small>${esc(p.caption.slice(0, 50))}</small></span>
      ${mine ? `<label class="mini-sw"><small>ตารางหลัก</small><input type="checkbox" class="switch" data-maingrid="${p.id}" ${p.onMainGrid ? 'checked' : ''}></label>` : `<button class="btn sm sec" data-act="openPost" data-id="${p.id}">ดู</button>`}</div>`).join('')}</div>
      ${mine ? '<p class="note">เปิด "ตารางหลัก" เพื่อแสดงโพสต์ที่ถูกแท็กรวมกับโพสต์ของคุณ</p>' : ''}` : '<p class="empty">ยังไม่มีโพสต์ที่ถูกแท็ก</p>';
  };
  document.addEventListener('change', e => {
    const id = e.target.dataset?.maingrid; if (!id) return;
    const p = M.findPost(id); p.onMainGrid = e.target.checked; M.save();
    M.toast(p.onMainGrid ? 'เพิ่มลงตารางหลักแล้ว' : 'นำออกจากตารางหลักแล้ว');
  });

  M.Tabs.profile = {
    render() {
      const st = M.st, me = st.me, tab = st.pfTab || 'grid';
      const pro = me.type !== 'personal';
      return `<header class="top glass"><button class="pf-handle" data-act="accountSwitch">${st.settings.private ? I('lock', 16) : ''}<b>${esc(me.handle)}</b>${I('chevDown', 16)}</button>
          <div class="bar-r"><button class="ibtn" data-act="openCreate" aria-label="สร้าง">${I('plus')}</button><button class="ibtn" data-act="page" data-page="menu" data-params="{}" aria-label="เมนูการตั้งค่า">${I('menu')}</button></div></header>
        <div class="col">${header(me, true)}
          <div class="pf-btns"><button class="btn sec" data-act="page" data-page="editProfile" data-params="{}">แก้ไขโปรไฟล์</button><button class="btn sec" data-act="shareProfile">แชร์โปรไฟล์</button>${pro ? '<button class="btn sec" data-act="page" data-page="dashboard" data-params="{}">แดชบอร์ด</button>' : ''}</div>
          ${pro ? `<button class="dash-strip" data-act="page" data-page="dashboard" data-params="{}"><span>${I('chart', 20)}</span><span class="row-tx"><span>แดชบอร์ดมืออาชีพ</span><small>เข้าถึง ${M.num(12400)} บัญชีใน 30 วันที่ผ่านมา</small></span>${I('chev', 18)}</button>` : ''}
          ${highlights(true)}${tabsBar(tab, true)}${tabContent(me, tab, true)}</div>`;
    },
    mount(el) { setupReorder(el); }
  };
  A.pfTab = el => {
    const top = M.topPage();
    if (top?.dataset.page === 'user') { top._params.tab = el.dataset.k; M.renderPage(top); return; }
    M.st.pfTab = el.dataset.k; M.st.reorder = false; M.renderTab('profile');
  };
  A.toggleReorder = () => { M.st.reorder = !M.st.reorder; if (!M.st.reorder) M.toast('บันทึกลำดับตารางแล้ว'); M.refresh(); };

  /* ลากสลับตำแหน่ง (pointer events ใช้ได้ทั้งเมาส์และนิ้ว) + กดค้างเพื่อเข้าโหมดจัดเรียง */
  function setupReorder(el) {
    const grid = el.querySelector('[data-grid]'); if (!grid) return;
    let press;
    grid.addEventListener('pointerdown', e => {
      const cell = e.target.closest('.cell'); if (!cell) return;
      if (!M.st.reorder) { press = setTimeout(() => { M.st.reorder = true; M.renderTab('profile'); navigator.vibrate?.(20); M.toast('โหมดจัดเรียง: ลากรูปเพื่อสลับตำแหน่ง'); }, 550); return; }
      e.preventDefault();
      const ghost = cell.cloneNode(true); ghost.classList.add('ghost');
      const r = cell.getBoundingClientRect();
      Object.assign(ghost.style, { width: r.width + 'px', height: r.height + 'px', left: r.left + 'px', top: r.top + 'px' });
      document.body.appendChild(ghost); cell.classList.add('dragging');
      const ox = e.clientX - r.left, oy = e.clientY - r.top;
      let target = null;
      const move = ev => {
        ghost.style.left = ev.clientX - ox + 'px'; ghost.style.top = ev.clientY - oy + 'px';
        ghost.style.display = 'none'; const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.cell'); ghost.style.display = '';
        grid.querySelectorAll('.drop').forEach(c => c.classList.remove('drop'));
        target = under && under !== cell && grid.contains(under) ? under : null;
        target?.classList.add('drop');
      };
      const up = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        ghost.remove(); cell.classList.remove('dragging');
        if (target) {
          const order = M.st.me.gridOrder, a = order.indexOf(cell.dataset.id), b = order.indexOf(target.dataset.id);
          if (a > -1 && b > -1) { order.splice(a, 1); order.splice(b, 0, cell.dataset.id); M.save(); M.renderTab('profile'); }
          else M.toast('โพสต์ที่ถูกแท็กจัดเรียงไม่ได้');
        }
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
    const cancel = () => clearTimeout(press);
    grid.addEventListener('pointerup', cancel); grid.addEventListener('pointerleave', cancel); grid.addEventListener('pointermove', e => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) cancel(); });
    grid.addEventListener('click', e => { if (M.st.reorder) { e.stopPropagation(); e.preventDefault(); } }, true);
    grid.addEventListener('contextmenu', e => e.preventDefault());
  }

  /* โปรไฟล์คนอื่น */
  M.Pages.user = {
    render(p) {
      const st = M.st, u = M.user(p.id), tab = p.tab || 'grid';
      if (st.blocked.includes(u.id)) return M.bar(esc(u.handle)) + `<div class="scroll"><div class="empty">${I('ban', 40)}<p>คุณบล็อกบัญชีนี้อยู่</p><button class="btn sec" data-act="unblock" data-id="${u.id}">เลิกบล็อก</button></div></div>`;
      const fol = st.following.includes(u.id), req = st.requested.includes(u.id);
      const locked = u.private && !fol;
      return M.bar(`${u.private ? I('lock', 16) : ''} ${esc(u.handle)}`, `<button class="ibtn" data-act="userMenu" data-id="${u.id}" aria-label="ตัวเลือก">${I('more')}</button>`) + `<div class="scroll"><div class="col">
        ${header(u, false)}
        <div class="pf-btns"><button class="btn ${fol ? 'sec' : 'pri'}" data-act="follow" data-id="${u.id}">${fol ? 'กำลังติดตาม' : req ? 'ส่งคำขอแล้ว' : 'ติดตาม'}</button>
          <button class="btn sec" data-act="dmUser" data-id="${u.id}">ส่งข้อความ</button>
          <button class="btn sec icon-only" data-act="callUser" data-id="${u.id}" aria-label="โทร">${I('phone', 18)}</button></div>
        ${locked ? `<div class="empty">${I('lock', 40)}<p><b>บัญชีนี้เป็นส่วนตัว</b><br>ติดตามบัญชีนี้เพื่อดูรูปภาพและวิดีโอ</p></div>` : `${tabsBar(tab)}${tabContent(u, tab, false)}`}
      </div></div>`;
    }
  };
  A.userMenu = el => {
    const u = M.user(el.dataset.id), st = M.st;
    M.menu([
      { label: st.closeFriends.includes(u.id) ? 'นำออกจากเพื่อนสนิท' : 'เพิ่มเป็นเพื่อนสนิท', icon: 'star', act: () => M.toggleList('closeFriends', u.id) },
      { label: st.muted.includes(u.id) ? 'เปิดเสียง' : 'ปิดเสียงโพสต์และสตอรี่', icon: 'bellOff', act: () => M.toggleList('muted', u.id) },
      { label: st.restricted.includes(u.id) ? 'เลิกจำกัด' : 'จำกัด', icon: 'minus', act: () => M.toggleList('restricted', u.id) },
      { label: 'คัดลอกลิงก์โปรไฟล์', icon: 'link', act: () => { navigator.clipboard?.writeText(`https://mali.example/${u.handle}`).catch(() => {}); M.toast('คัดลอกแล้ว'); } },
      { label: 'บล็อก', icon: 'ban', danger: true, act: () => M.blockUser(u.id) },
      { label: 'รายงาน', icon: 'flag', danger: true, act: () => M.report(u) }
    ], u.handle);
  };
  A.unblock = el => M.toggleList('blocked', el.dataset.id);
  A.dmUser = el => M.openChat(M.ensureDM(el.dataset.id).id);
  A.callUser = el => M.push('call', { userId: el.dataset.id, video: false });

  A.shareProfile = () => {
    const me = M.st.me, url = `https://mali.example/${me.handle}`;
    M.sheet(`<div class="qr-card">${M.avatar(me, 56)}<b>@${esc(me.handle)}</b>${M.qrArt(url)}<p class="muted small">ให้เพื่อนสแกนเพื่อเปิดโปรไฟล์ (คิวอาร์ตกแต่ง ใช้สแกนจริงไม่ได้ในต้นแบบ)</p></div>
      <div class="dlg-a"><button class="btn sec" data-c>คัดลอกลิงก์</button><button class="btn pri" data-s>แชร์</button></div>`, { title: 'แชร์โปรไฟล์', mount: sh => {
      sh.querySelector('[data-c]').onclick = () => { navigator.clipboard?.writeText(url).catch(() => {}); M.toast('คัดลอกลิงก์แล้ว'); };
      sh.querySelector('[data-s]').onclick = () => navigator.share ? navigator.share({ url }).catch(() => {}) : M.toast(url);
    } });
  };
  M.qrArt = str => {
    const r = M.rng(M.hash(str)); let cells = '';
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (finder) { const fx = x % 14 > 6 ? x - 14 : x, fy = y % 14 > 6 ? y - 14 : y, ax = x > 13 ? x - 14 : x, ay = y > 13 ? y - 14 : y; const on = ax === 0 || ax === 6 || ay === 0 || ay === 6 || (ax > 1 && ax < 5 && ay > 1 && ay < 5); if (on) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`; void fx; void fy; }
      else if (r() > .52) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    return `<svg class="qr" viewBox="-1 -1 23 23" width="180" height="180" fill="var(--tx)" aria-hidden="true">${cells}</svg>`;
  };
  A.myFollowers = () => M.push('peopleList', { kind: 'followers' });
  A.myFollowing = () => M.push('peopleList', { kind: 'following' });

  A.accountSwitch = () => M.menu([
    { label: M.st.me.handle, sub: 'บัญชีปัจจุบัน', icon: 'check' },
    { label: 'เพิ่มบัญชี', sub: 'ต้นแบบนี้รองรับบัญชีเดียว', icon: 'plus', act: () => M.toast('ต้นแบบนี้รองรับบัญชีเดียว') },
    { label: 'ศูนย์บัญชี', icon: 'user', act: () => M.push('security') }
  ], 'สลับบัญชี');

  A.newHighlight = async () => {
    if (!M.st.archive.length && !M.st.myStory.items.length) return M.toast('ยังไม่มีสตอรี่ในคลัง');
    M.push('archive', { pick: true });
  };

  /* โน้ต (อยู่ 24 ชม.) */
  A.editNote = () => {
    const st = M.st, cur = st.me.note;
    let music = cur?.music || '';
    let aud = cur?.aud || 'followers';
    const sh = M.sheet(`<div class="note-edit"><div class="note-prev"><span class="note-bub">${esc(cur?.text || 'แบ่งปันความคิด…')}</span>${M.avatar(st.me, 64)}</div>
      <input class="field" maxlength="60" placeholder="แบ่งปันความคิด… (สูงสุด 60 ตัวอักษร)" value="${esc(cur?.text || '')}" data-t>
      <h3 class="sec-t">เพลง</h3><div class="chips">${M.TRACKS.map(t => `<button class="chip${music === t.id ? ' on' : ''}" data-m="${t.id}">${I('music', 14)} ${esc(t.name)}</button>`).join('')}</div>
      <h3 class="sec-t">แชร์กับ</h3><div class="seg">${[['followers', 'ผู้ติดตามที่คุณติดตามกลับ'], ['close', 'เพื่อนสนิท']].map(([v, l]) => `<button class="${aud === v ? 'on' : ''}" data-a="${v}">${l}</button>`).join('')}</div>
      <p class="note">โน้ตจะแสดงเหนือรูปโปรไฟล์ในหน้าแชตเป็นเวลา 24 ชั่วโมง</p>
      <div class="dlg-a">${cur ? '<button class="btn sec" data-del>ลบโน้ต</button>' : ''}<button class="btn pri" data-save>แชร์</button></div></div>`, { title: 'โน้ตใหม่' });
    const inp = sh.querySelector('[data-t]'), prev = sh.querySelector('.note-prev .note-bub');
    inp.oninput = () => prev.textContent = inp.value || 'แบ่งปันความคิด…';
    sh.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.m) { music = music === b.dataset.m ? '' : b.dataset.m; sh.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x.dataset.m === music)); }
      if (b.dataset.a) { aud = b.dataset.a; sh.querySelectorAll('[data-a]').forEach(x => x.classList.toggle('on', x.dataset.a === aud)); }
      if (b.hasAttribute('data-del')) { st.me.note = null; M.closeSheet(); M.refresh(); }
      if (b.hasAttribute('data-save')) { if (!inp.value.trim() && !music) return M.toast('พิมพ์ข้อความหรือเลือกเพลง'); st.me.note = { text: inp.value.trim(), music, aud, ts: Date.now() }; M.closeSheet(); M.toast('แชร์โน้ตแล้ว อยู่ได้ 24 ชั่วโมง'); M.refresh(); }
    };
  };

  /* แก้ไขโปรไฟล์ */
  M.Pages.editProfile = {
    render() {
      const me = M.st.me;
      return M.bar('แก้ไขโปรไฟล์', '<button class="link acc" data-act="saveProfile">เสร็จ</button>') + `<div class="scroll"><form class="col pad form" data-pf>
        ${M.bannerHTML(me, true)}
        <div class="center ep-av">${M.avatar(me, 86)}<button type="button" class="link acc" data-act="changeAvatar">เปลี่ยนรูปโปรไฟล์</button>${me.photo ? '<button type="button" class="link muted" data-act="removeAvatar">ลบรูป</button>' : ''}</div>
        <div><span class="lbl">สีวงสตอรี่ของคุณ</span><div data-ringbox>${M.ringPicker(me.ringColor || '#c4411a')}</div></div>
        <label>ชื่อ<input class="field" name="name" value="${esc(me.name)}" maxlength="40"></label>
        <button type="button" class="row ep-row" data-act="openChangeHandle"><span class="row-tx"><small>ชื่อผู้ใช้</small><span translate="no">${esc(me.handle)}</span></span>${I('chev', 18)}</button>
        <label>สรรพนาม<input class="field" name="pronoun" value="${esc(me.pronoun || '')}" maxlength="20" placeholder="ไม่บังคับ"></label>
        <label>Bio<textarea class="field" name="bio" rows="3" maxlength="150">${esc(me.bio)}</textarea></label>
        <label>ลิงก์<input class="field" name="link" value="${esc(me.link || '')}" placeholder="https://"></label>
        <p class="note">ลิงก์ใน Bio จะถูกตรวจสอบหาเว็บหลอกลวงก่อนบันทึก</p>
      </form></div>`;
    }
  };
  M.Pages.editProfile.mount = el => M.wireRingPicker(el.querySelector('[data-ringbox]'), c => { M.st.me.ringColor = c; M.applyAppearance(); M.save(); el.querySelector('[data-ringbox]').innerHTML = M.ringPicker(c); M.Pages.editProfile.mount(el); });
  A.saveProfile = () => {
    const f = M.$('[data-pf]'), me = M.st.me;
    const link = f.link.value.trim();
    if (link) { const s = M.sec.scanUrl(link, false); if (s.level === 'danger') return M.toast('บันทึกลิงก์ไม่ได้: ' + s.reasons[0]); }
    Object.assign(me, { name: f.name.value.trim() || me.name, pronoun: f.pronoun.value.trim(), bio: f.bio.value.trim(), link });
    M.toast('บันทึกโปรไฟล์แล้ว'); M.back(); M.refresh();
  };
  A.changeAvatar = async () => {
    const [file] = await M.pickFiles('image/*'); if (!file) return;
    if (!await M.adult.guard(file, 'avatar')) return;
    const r = await M.sec.processImage(file, 320);
    M.st.me.photo = r.dataUrl;
    M.toast(r.gps ? 'ลบพิกัด GPS ออกจากรูปแล้ว' : 'เปลี่ยนรูปโปรไฟล์แล้ว'); M.refresh();
  };
  A.removeAvatar = () => { delete M.st.me.photo; M.refresh(); };

  /* รายชื่อคน */
  M.Pages.peopleList = {
    render(p) {
      const st = M.st;
      const T = { followers: 'ผู้ติดตาม', following: 'กำลังติดตาม', closeFriends: 'เพื่อนสนิท', blocked: 'บัญชีที่ถูกบล็อก', restricted: 'บัญชีที่ถูกจำกัด', muted: 'บัญชีที่ปิดเสียง' };
      let ids;
      if (p.kind === 'followers') ids = Object.keys(st.users).filter(id => !st.users[id].official && id !== 'stranger');
      else if (p.kind === 'following') ids = st.following;
      else if (p.kind === 'closeFriends') ids = Object.keys(st.users).filter(id => st.users[id].friend);
      else ids = st[p.kind];
      const desc = { closeFriends: 'เลือกคนที่จะเห็นสตอรี่ โน้ต และโพสต์ที่แชร์เฉพาะเพื่อนสนิท เขาจะไม่ได้รับแจ้งเมื่อถูกเพิ่มหรือนำออก', restricted: 'คนที่ถูกจำกัดจะไม่เห็นว่าคุณออนไลน์หรืออ่านข้อความแล้ว และความคิดเห็นใหม่ของเขาจะเห็นเฉพาะเขา', muted: 'คุณยังติดตามอยู่ แต่จะไม่เห็นโพสต์และสตอรี่ในฟีด', blocked: 'บัญชีเหล่านี้ติดต่อหรือดูโปรไฟล์คุณไม่ได้' }[p.kind];
      return M.bar(T[p.kind]) + `<div class="scroll"><div class="col">${desc ? `<p class="note pad">${desc}</p>` : ''}
        <div class="pad"><input class="field" placeholder="ค้นหา" data-filter></div>
        <div class="rows" data-list>${ids.map(id => { const u = M.user(id); const on = p.kind === 'closeFriends' && st.closeFriends.includes(id);
          return `<div class="row" data-name="${esc(u.name + u.handle)}">${M.avatar(u, 44)}<button class="row-tx" data-act="openUser" data-id="${id}"><span>${M.handle(u, false)}</span><small>${esc(u.name)}</small></button>
          ${p.kind === 'closeFriends' ? `<input type="checkbox" class="check" data-cf="${id}" ${on ? 'checked' : ''} aria-label="เพื่อนสนิท">`
            : ['blocked', 'restricted', 'muted'].includes(p.kind) ? `<button class="btn sm sec" data-act="unlist" data-k="${p.kind}" data-id="${id}">${{ blocked: 'เลิกบล็อก', restricted: 'เลิกจำกัด', muted: 'เปิดเสียง' }[p.kind]}</button>`
            : p.kind === 'following' ? `<button class="btn sm sec" data-act="follow" data-id="${id}">กำลังติดตาม</button>` : ''}</div>`; }).join('') || '<p class="empty">ไม่มีรายชื่อ</p>'}</div></div></div>`;
    },
    mount(el) {
      el.querySelector('[data-filter]').oninput = e => el.querySelectorAll('[data-name]').forEach(r => r.hidden = !r.dataset.name.toLowerCase().includes(e.target.value.toLowerCase()));
      el.addEventListener('change', e => { const id = e.target.dataset.cf; if (!id) return; const st = M.st; st.closeFriends = e.target.checked ? [...st.closeFriends, id] : st.closeFriends.filter(x => x !== id); M.save(); });
    }
  };
  A.unlist = el => M.toggleList(el.dataset.k, el.dataset.id);
})(window.M);
