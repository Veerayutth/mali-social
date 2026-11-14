'use strict';
/* หน้าหลัก: ส่วนหัว + สตอรี่ + ทางลัดแบบชุมชน + ฟีด และส่วนประกอบโพสต์ที่ใช้ซ้ำ */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;

  /* ---------- อัลกอริทึมฟีด ---------- */
  const W = { less: .35, normal: 1, more: 1.7 };
  const weight = v => typeof v === 'number' ? (v === 1 ? 1 : v) : W[v] ?? 1;
  M.visiblePost = p => !(p.sensitive && p.userId !== 'me' && (M.st.settings.teen || M.st.settings.sensitive === 'less')) && !M.st.blocked.includes(p.userId) && !M.st.muted.includes(p.userId) && !p.hidden && !M.st.notInterested.includes(p.id);
  M.rankFeed = () => {
    const st = M.st, now = Date.now();
    const list = st.posts.filter(p => M.visiblePost(p) && (p.userId === 'me' || st.following.includes(p.userId) || p.collab.some(c => st.following.includes(c))) && !p.trial);
    if (st.settings.feedOrder === 'latest') return list.sort((a, b) => b.ts - a.ts);
    return list.map(p => {
      const ageH = (now - p.ts) / 3.6e6;
      const recency = Math.exp(-ageH / 30);
      const interest = (p.tags || []).reduce((s, t) => s + weight(st.interests[t]), 0) / Math.max(1, (p.tags || []).length);
      const close = st.closeFriends.includes(p.userId) ? 1.25 : 1;
      const eng = Math.log10((p.likes || 0) + 10) / 5;
      return { p, s: recency * interest * close + eng * .12 };
    }).sort((a, b) => b.s - a.s).map(x => x.p);
  };

  /* ---------- ส่วนประกอบ ---------- */
  M.activeStory = uid => {
    if (uid === 'me') return M.st.myStory.items.length ? M.st.myStory : null;
    return M.st.stories.find(s => s.userId === uid && s.items.some(it => Date.now() - it.ts < M.T.DAY));
  };
  M.ringAv = (u, size, act = 'openUser') => {
    const s = M.activeStory(u.id);
    const live = M.st.lives.find(l => l.userId === u.id);
    const cls = live ? 'ring live' : s ? (s.seen ? 'ring seen' : s.closeFriends ? 'ring cf' : 'ring') : '';
    const a = s || live ? `data-act="${live ? 'watchLive' : 'openStory'}" data-id="${u.id}"` : `data-act="${act}" data-id="${u.id}"`;
    const ring = cls === 'ring' ? M.ringStyle(u) : '';
    return `<button class="${cls || 'noring'}"${ring} ${a} aria-label="${esc(u.handle)}">${M.avatar(u, size)}</button>`;
  };
  M.handle = (u, link = true) => `<b class="hd"${link ? ` data-act="openUser" data-id="${u.id}"` : ''}>${esc(u.handle)}</b>${u.verified ? `<span class="vf" title="ยืนยันแล้ว">${I('verified', 14)}</span>` : ''}`;

  const likeLine = p => {
    const st = M.st, mine = p.userId === 'me';
    if ((mine && p.hideLikes) || (!mine && st.settings.hideLikesOthers)) {
      const friend = M.user(st.following[0]);
      return `<p class="likes">ถูกใจโดย <b>${esc(friend.handle)}</b> และคนอื่นๆ</p>`;
    }
    return `<p class="likes">ถูกใจ ${M.fullNum(p.likes)} คน</p>`;
  };

  M.postCard = (p, opts = {}) => {
    const u = M.user(p.userId);
    const collab = p.collab.length ? ` และ ${p.collab.map(c => M.handle(M.user(c))).join(', ')}` : '';
    const many = p.slides.length > 1;
    const ar = p.aspect || '3/4';
    const visibleComments = p.comments.filter(c => !M.sec.isHiddenWord(c.text));
    return `<article class="post" data-post="${p.id}">
      <header class="post-h">
        ${M.ringAv(u, 36)}
        <div class="post-who"><div>${M.handle(u)}${collab}${p.reposted && opts.repostBy ? '' : ''}</div>${p.location ? `<small>${esc(p.location)}</small>` : p.collab.length ? '<small>โพสต์ร่วมกัน</small>' : ''}</div>
        ${u.id !== 'me' && !M.st.following.includes(u.id) ? `<button class="btn sm sec" data-act="follow" data-id="${u.id}">ติดตาม</button>` : ''}
        <button class="ibtn" data-act="postMenu" data-id="${p.id}" aria-label="ตัวเลือก">${I('more')}</button>
      </header>
      <div class="carousel" data-dbl="likePost" data-id="${p.id}" style="aspect-ratio:${ar}">
        <div class="track" data-id="${p.id}">${p.slides.map(s => `<div class="slide">${M.media(s)}${s.video || s.vid ? `<span class="vbadge">${I('play', 14)}</span>` : ''}</div>`).join('')}</div>
        ${p.sensitive && !p.revealed ? `<button class="sens" data-act="revealPost" data-id="${p.id}">${I('eyeOff', 26)}<b>เนื้อหาที่ละเอียดอ่อน</b><small>ตัวกรองภาพ 18+ ทำเครื่องหมายภาพนี้ไว้ แตะเพื่อดู</small></button>` : ''}
        ${many ? `<span class="count">1/${p.slides.length}</span><div class="dots">${p.slides.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
      </div>
      <div class="post-a">
        <button class="ibtn like${p.liked ? ' on' : ''}" data-act="likePost" data-id="${p.id}" aria-label="ถูกใจ" aria-pressed="${p.liked}">${I('heart')}</button>
        <button class="ibtn" data-act="comments" data-id="${p.id}" aria-label="ความคิดเห็น">${I('comment')}</button>
        <button class="ibtn${p.reposted ? ' on-acc' : ''}" data-act="repost" data-id="${p.id}" aria-label="รีโพสต์">${I('repost')}</button>
        <button class="ibtn" data-act="share" data-id="${p.id}" aria-label="แชร์">${I('send')}</button>
        <span class="sp"></span>
        <button class="ibtn save${p.saved ? ' on' : ''}" data-act="savePost" data-id="${p.id}" aria-label="บันทึก">${I('bookmark')}</button>
      </div>
      <div class="post-b">
        ${likeLine(p)}
        ${p.slides.some(s => s.caption) ? `<p class="slidecap" data-cap="${p.id}">${esc(p.slides[0].caption || '')}</p>` : ''}
        <p class="cap">${M.handle(u)} ${M.richText(p.caption)}</p>
        ${p.commentsOff ? '<p class="muted small">ปิดการแสดงความคิดเห็น</p>' : visibleComments.length ? `<button class="link muted" data-act="comments" data-id="${p.id}">ดูความคิดเห็นทั้งหมด ${visibleComments.length} รายการ</button>` : ''}
        <p class="muted small">${M.ago(p.ts)}${p.trial ? ' · ทดลองโพสต์ (Trial)' : ''}</p>
      </div>
    </article>`;
  };

  // อัปเดตตัวนับสไลด์และแคปชันแยกสไลด์เมื่อเลื่อน
  document.addEventListener('scroll', e => {
    const t = e.target;
    if (!t.classList?.contains('track')) return;
    const i = Math.round(t.scrollLeft / t.clientWidth);
    const p = M.st.posts.find(x => x.id === t.dataset.id);
    const car = t.parentElement;
    car.querySelector('.count') && (car.querySelector('.count').textContent = `${i + 1}/${t.children.length}`);
    car.querySelectorAll('.dots i').forEach((d, j) => d.classList.toggle('on', j === i));
    const cap = car.closest('.post')?.querySelector('.slidecap');
    if (cap && p) cap.textContent = p.slides[i]?.caption || '';
  }, true);

  const findPost = id => M.st.posts.find(p => p.id === id);
  M.findPost = findPost;

  A.likePost = (el, ev, dbl) => {
    const p = findPost(el.dataset.id); if (!p) return;
    if (dbl && p.liked) { M.heartBurst(el, ev.clientX, ev.clientY); return; }
    p.liked = !p.liked; p.likes += p.liked ? 1 : -1;
    if (dbl) M.heartBurst(el, ev.clientX, ev.clientY);
    document.querySelectorAll(`.post[data-post="${p.id}"]`).forEach(card => {
      const b = card.querySelector('.like'); b.classList.toggle('on', p.liked); b.setAttribute('aria-pressed', p.liked);
      card.querySelector('.likes').outerHTML = likeLine(p);
    });
    (p.tags || []).forEach(t => { if (p.liked && typeof M.st.interests[t] === 'number') M.st.interests[t] = Math.min(1.6, M.st.interests[t] + .05); });
    M.save();
  };
  A.revealPost = async el => {
    const p = findPost(el.dataset.id);
    if (M.st.settings.teen) return M.toast('บัญชีวัยรุ่นดูเนื้อหานี้ไม่ได้');
    if (!await M.confirm('ดูภาพที่ละเอียดอ่อนไหม', 'ภาพนี้อาจมีเนื้อหาไม่เหมาะสม', 'ดูภาพ')) return;
    p.revealed = true; M.refresh();
  };
  A.savePost = el => {
    const p = findPost(el.dataset.id);
    p.saved = !p.saved;
    M.st.saved = p.saved ? [p.id, ...M.st.saved] : M.st.saved.filter(x => x !== p.id);
    document.querySelectorAll(`.post[data-post="${p.id}"] .save`).forEach(b => b.classList.toggle('on', p.saved));
    M.toast(p.saved ? 'บันทึกแล้ว ดูได้ที่ ≡ > รายการที่บันทึกไว้' : 'นำออกจากรายการที่บันทึกแล้ว');
    M.save();
  };
  A.repost = el => {
    const p = findPost(el.dataset.id);
    if (p.userId === 'me') { M.toast('รีโพสต์ได้เฉพาะโพสต์ของคนอื่น'); return; }
    p.reposted = !p.reposted;
    M.toast(p.reposted ? 'รีโพสต์แล้ว แสดงในแท็บรีโพสต์บนโปรไฟล์ของคุณ' : 'ยกเลิกรีโพสต์แล้ว');
    M.refresh();
  };
  A.follow = el => {
    const id = el.dataset.id, u = M.user(id), st = M.st;
    if (!M.sec.guard('follow', 15, 60000, 'ติดตาม')) return;
    if (st.following.includes(id)) {
      st.following = st.following.filter(x => x !== id); u.followers--; M.toast(`เลิกติดตาม ${u.handle} แล้ว`);
    } else if (st.requested.includes(id)) {
      st.requested = st.requested.filter(x => x !== id); M.toast('ยกเลิกคำขอแล้ว');
    } else if (u.private) {
      st.requested.push(id); M.toast('ส่งคำขอติดตามแล้ว');
      setTimeout(() => { if (!st.requested.includes(id)) return; st.requested = st.requested.filter(x => x !== id); st.following.push(id); u.followers++; M.toast(`${u.handle} อนุมัติคำขอของคุณแล้ว (จำลอง)`); M.refresh(); }, 4000);
    } else { st.following.push(id); u.followers++; }
    M.refresh();
  };
  A.openUser = el => { const id = el.dataset.id; M.closeSheet(true); id === 'me' ? M.go('profile') : M.push('user', { id }); };
  A.openHandle = el => { const u = M.userByHandle(el.dataset.q); u ? A.openUser({ dataset: { id: u.id } }) : M.toast('ไม่พบบัญชีนี้'); };
  A.searchTag = el => M.push('explore', { q: el.dataset.q });

  /* ---------- ความคิดเห็น ---------- */
  const findAny = id => findPost(id) || M.st.reels.find(r => r.id === id);
  M.openComments = id => {
    const p = findAny(id);
    let reveal = false;
    const draw = () => {
      const st = M.st, owner = p.userId === 'me';
      const hidden = p.comments.filter(c => M.sec.isHiddenWord(c.text));
      const list = p.comments.filter(c => reveal || !M.sec.isHiddenWord(c.text)).filter(c => !st.blocked.includes(c.userId));
      return `<div class="cmts">${list.length ? list.map(c => {
        const u = M.user(c.userId), restricted = st.restricted.includes(c.userId);
        return `<div class="cmt">${M.avatar(u, 32)}<div class="cmt-b"><p>${M.handle(u)} <span class="muted small">${M.ago(c.ts)}</span></p><p>${M.richText(c.text)}</p>
          ${restricted ? '<p class="muted small">จำกัดไว้ · คนอื่นจะไม่เห็นความคิดเห็นนี้จนกว่าคุณจะอนุมัติ</p>' : ''}
          ${M.sec.isHiddenWord(c.text) ? '<p class="muted small">ซ่อนอัตโนมัติจากคำที่ซ่อน</p>' : ''}</div>
          <button class="ibtn sm${c.liked ? ' like on' : ''}" data-cl="${c.id}" aria-label="ถูกใจความคิดเห็น">${I('heart', 16)}<small>${c.likes || ''}</small></button></div>`;
      }).join('') : '<p class="empty">ยังไม่มีความคิดเห็น เริ่มคนแรกได้เลย</p>'}
      ${hidden.length && !reveal ? `<button class="link muted" data-reveal>ซ่อน ${hidden.length} ความคิดเห็นตามคำที่ซ่อน · ดู</button>` : ''}</div>
      ${p.commentsOff ? '<p class="note">ปิดการแสดงความคิดเห็นในโพสต์นี้</p>' : `<form class="composer">${M.avatar(st.me, 32)}<input class="field" name="t" placeholder="แสดงความคิดเห็นในชื่อ ${esc(st.me.handle)}" maxlength="300" autocomplete="off"><button class="btn sm pri">โพสต์</button></form>`}`;
    };
    const sh = M.sheet('', { title: 'ความคิดเห็น', cls: 'tall' });
    const body = sh.querySelector('.sheet-b');
    const mount = () => {
      body.innerHTML = draw();
      body.querySelector('[data-reveal]')?.addEventListener('click', () => { reveal = true; mount(); });
      body.querySelectorAll('[data-cl]').forEach(b => b.onclick = () => { const c = p.comments.find(x => x.id === b.dataset.cl); c.liked = !c.liked; c.likes = (c.likes || 0) + (c.liked ? 1 : -1); M.save(); mount(); });
      const f = body.querySelector('form');
      if (f) f.onsubmit = e => {
        e.preventDefault();
        const t = f.t.value.trim(); if (!t) return;
        if (!M.sec.guard('comment', 6, 30000, 'แสดงความคิดเห็น')) return;
        p.comments.push({ id: M.uid('c'), userId: 'me', text: t, ts: Date.now(), likes: 0 });
        M.save(); mount(); body.scrollTop = body.scrollHeight;
        document.querySelectorAll(`.post[data-post="${p.id}"]`).forEach(() => {});
      };
    };
    mount();
  };
  A.comments = el => M.openComments(el.dataset.id);

  /* ---------- แชร์ ---------- */
  M.openShare = (id, kind = 'post') => {
    const st = M.st;
    const people = [...st.closeFriends, ...st.following].filter((v, i, a) => a.indexOf(v) === i && !M.user(v).official).slice(0, 12);
    const groups = st.chats.filter(c => c.type === 'group');
    const sel = new Set();
    const sh = M.sheet(`<input class="field" placeholder="ค้นหา" data-q>
      <div class="share-grid">${people.map(uid => `<button class="share-p" data-uid="dm:${uid}">${M.avatar(M.user(uid), 56)}<span>${esc(M.user(uid).name.split(' ')[0])}</span></button>`).join('')}
      ${groups.map(g => `<button class="share-p" data-uid="ch:${g.id}"><span class="av grp" style="--s:56px">${I('users', 26)}</span><span>${esc(g.name)}</span></button>`).join('')}</div>
      <input class="field" placeholder="เขียนข้อความ (ไม่บังคับ)" data-msg>
      <div class="share-acts">
        <button class="sa" data-sa="story">${I('plus')}<span>เพิ่มลงสตอรี่</span></button>
        <button class="sa" data-sa="copy">${I('link')}<span>คัดลอกลิงก์</span></button>
        <button class="sa" data-sa="repost">${I('repost')}<span>รีโพสต์</span></button>
        <button class="sa" data-sa="native">${I('upload')}<span>แชร์ไปที่…</span></button>
      </div>
      <button class="btn pri block" data-send disabled>ส่ง</button>`, { title: 'แชร์' });
    const btn = sh.querySelector('[data-send]');
    sh.querySelectorAll('.share-p').forEach(b => b.onclick = () => { b.classList.toggle('on'); sel.has(b.dataset.uid) ? sel.delete(b.dataset.uid) : sel.add(b.dataset.uid); btn.disabled = !sel.size; btn.textContent = sel.size ? `ส่งถึง ${sel.size} คน/กลุ่ม` : 'ส่ง'; });
    sh.querySelector('[data-q]').oninput = e => sh.querySelectorAll('.share-p').forEach(b => b.hidden = !b.textContent.includes(e.target.value.trim()));
    btn.onclick = () => {
      const note = sh.querySelector('[data-msg]').value.trim();
      sel.forEach(k => {
        const [t, v] = k.split(':');
        const chat = t === 'dm' ? M.ensureDM(v) : st.chats.find(c => c.id === v);
        chat.messages.push({ id: M.uid('x'), from: 'me', type: kind === 'reel' ? 'reel' : 'post', postId: id, ts: Date.now(), status: 'sent' });
        if (note) chat.messages.push({ id: M.uid('x'), from: 'me', type: 'text', text: note, ts: Date.now(), status: 'sent' });
      });
      M.closeSheet(); M.toast('ส่งแล้ว'); M.refresh();
    };
    sh.querySelectorAll('[data-sa]').forEach(b => b.onclick = async () => {
      const a = b.dataset.sa, url = `https://mali.example/${kind === 'reel' ? 'r' : 'p'}/${id}`;
      if (a === 'copy') { try { await navigator.clipboard.writeText(url); M.toast('คัดลอกลิงก์แล้ว'); } catch { M.toast(url); } }
      if (a === 'repost') { M.closeSheet(); kind === 'reel' ? M.A.repostReel({ dataset: { id } }) : A.repost({ dataset: { id } }); }
      if (a === 'story') { M.closeSheet(); const p = findAny(id); M.push('editor', { type: 'story', fromPost: p.slides ? p.slides[0] : { art: p.art } }); }
      if (a === 'native') { if (navigator.share) navigator.share({ title: 'มะลิ', url }).catch(() => {}); else M.toast('เบราว์เซอร์นี้ไม่รองรับเมนูแชร์ของระบบ'); }
    });
  };
  A.share = el => M.openShare(el.dataset.id);

  /* ---------- เมนูโพสต์ ---------- */
  A.postMenu = el => {
    const p = findPost(el.dataset.id), st = M.st, u = M.user(p.userId);
    if (p.userId === 'me') return M.menu([
      { label: 'แก้ไขแคปชันและสไลด์', icon: 'edit', act: () => M.push('editPost', { id: p.id }) },
      { label: p.commentsOff ? 'เปิดการแสดงความคิดเห็น' : 'ปิดการแสดงความคิดเห็น', icon: 'comment', act: () => { p.commentsOff = !p.commentsOff; M.refresh(); } },
      { label: p.hideLikes ? 'แสดงยอดถูกใจ' : 'ซ่อนยอดถูกใจ', icon: 'eyeOff', act: () => { p.hideLikes = !p.hideLikes; M.refresh(); } },
      { label: 'ลบโพสต์', icon: 'trash', danger: true, act: async () => { if (await M.confirm('ลบโพสต์นี้ไหม', 'ลบแล้วกู้คืนไม่ได้ในต้นแบบนี้', 'ลบ', true)) { st.posts = st.posts.filter(x => x !== p); st.me.gridOrder = st.me.gridOrder.filter(x => x !== p.id); M.toast('ลบโพสต์แล้ว'); M.refresh(); } } }
    ]);
    M.menu([
      { label: p.saved ? 'เลิกบันทึก' : 'บันทึก', icon: 'bookmark', act: () => A.savePost({ dataset: { id: p.id } }) },
      { label: 'ไม่สนใจ', sub: 'เห็นโพสต์แบบนี้น้อยลง', icon: 'eyeOff', act: () => { st.notInterested.push(p.id); (p.tags || []).forEach(t => st.interests[t] = 'less'); M.toast('เราจะแสดงโพสต์แบบนี้น้อยลง', { action: 'เลิกทำ', onAction: () => { st.notInterested = st.notInterested.filter(x => x !== p.id); M.refresh(); } }); M.refresh(); } },
      { label: `ปิดเสียง ${u.handle}`, sub: 'ซ่อนโพสต์และสตอรี่โดยไม่เลิกติดตาม', icon: 'bellOff', act: () => { st.muted.push(u.id); M.toast(`ปิดเสียง ${u.handle} แล้ว`); M.refresh(); } },
      { label: st.restricted.includes(u.id) ? `เลิกจำกัด ${u.handle}` : `จำกัด ${u.handle}`, sub: 'ความคิดเห็นใหม่ของเขาจะเห็นเฉพาะเขา', icon: 'minus', act: () => M.toggleList('restricted', u.id) },
      { label: `บล็อก ${u.handle}`, icon: 'ban', danger: true, act: () => M.blockUser(u.id) },
      { label: 'รายงาน', icon: 'flag', danger: true, act: () => M.report(u) },
      { label: 'เกี่ยวกับบัญชีนี้', icon: 'info', act: () => M.sheet(`<div class="about">${M.avatar(u, 64)}<h3>${esc(u.handle)}</h3><p class="muted">${esc(u.name)}</p><div class="rows"><div class="row"><span class="row-tx"><span>ประเภทบัญชี</span><small>${{ personal: 'ส่วนตัว', creator: 'ครีเอเตอร์', business: 'ธุรกิจ' }[u.type]}</small></span></div><div class="row"><span class="row-tx"><span>ผู้ติดตาม</span><small>${M.fullNum(u.followers)}</small></span></div><div class="row"><span class="row-tx"><span>ยืนยันตัวตน</span><small>${u.verified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}</small></span></div></div></div>`, { title: 'เกี่ยวกับบัญชีนี้' }) }
    ]);
  };
  M.toggleList = (key, id) => {
    const st = M.st, on = st[key].includes(id);
    st[key] = on ? st[key].filter(x => x !== id) : [...st[key], id];
    M.toast({ restricted: on ? 'เลิกจำกัดแล้ว' : 'จำกัดบัญชีแล้ว', muted: on ? 'เปิดเสียงแล้ว' : 'ปิดเสียงแล้ว', blocked: on ? 'เลิกบล็อกแล้ว' : 'บล็อกแล้ว', closeFriends: on ? 'นำออกจากเพื่อนสนิทแล้ว' : 'เพิ่มเป็นเพื่อนสนิทแล้ว' }[key]);
    M.refresh();
  };
  M.blockUser = async id => {
    const u = M.user(id);
    if (!await M.confirm(`บล็อก ${u.handle} ไหม`, 'เขาจะส่งข้อความ ดูโปรไฟล์ หรือค้นหาคุณไม่ได้ และจะไม่ได้รับแจ้งว่าถูกบล็อก', 'บล็อก', true)) return;
    const st = M.st;
    if (!st.blocked.includes(id)) st.blocked.push(id);
    st.following = st.following.filter(x => x !== id);
    M.toast(`บล็อก ${u.handle} แล้ว`);
    M.refresh();
  };
  M.report = u => M.menu(['สแปม', 'หลอกลวงหรือฉ้อโกง', 'ภาพโป๊เปลือยหรือกิจกรรมทางเพศ', 'การกลั่นแกล้งหรือคุกคาม', 'ความรุนแรงหรือองค์กรอันตราย', 'ข้อมูลเท็จ', 'อื่นๆ'].map(r => ({ label: r, act: () => M.toast('ขอบคุณที่รายงาน ทีมงานจะตรวจสอบ (จำลอง) และไม่แจ้งให้อีกฝ่ายทราบว่าใครรายงาน') })), `รายงาน ${u.handle}`);

  /* ---------- อัลกอริทึมของคุณ ---------- */
  A.algorithm = () => {
    const st = M.st;
    const draw = () => `<p class="muted small">เลือกหัวข้อที่อยากเห็นมากขึ้นหรือน้อยลง ฟีดและ Reels จะเรียงใหม่ทันที</p>
      <div class="rows">${Object.entries(M.TOPICS).map(([k, lbl]) => {
        const v = typeof st.interests[k] === 'number' ? 'normal' : st.interests[k];
        return `<div class="row"><span class="row-tx"><span>${lbl}</span></span><div class="seg sm">${[['less', 'น้อยลง'], ['normal', 'ปกติ'], ['more', 'มากขึ้น']].map(([vv, l]) => `<button class="${v === vv ? 'on' : ''}" data-t="${k}" data-v="${vv}">${l}</button>`).join('')}</div></div>`;
      }).join('')}</div>
      <h3 class="sec-t">ลำดับฟีด</h3><div class="seg">${[['smart', 'ตามความสนใจ'], ['latest', 'ล่าสุดก่อน']].map(([v, l]) => `<button class="${st.settings.feedOrder === v ? 'on' : ''}" data-order="${v}">${l}</button>`).join('')}</div>`;
    const sh = M.sheet(draw(), { title: 'อัลกอริทึมของคุณ' });
    const b = sh.querySelector('.sheet-b');
    b.onclick = e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.t) st.interests[t.dataset.t] = t.dataset.v === 'normal' ? 1 : t.dataset.v;
      if (t.dataset.order) st.settings.feedOrder = t.dataset.order;
      b.innerHTML = draw(); M.refresh();
    };
  };

  /* ---------- แท็บหน้าหลัก ---------- */
  const shortcuts = [
    ['profile', 'user', 'โปรไฟล์'], ['friends', 'userPlus', 'เพื่อน'], ['groups', 'users', 'กลุ่ม'],
    ['services', 'apps', 'บริการ'], ['officials', 'verified', 'บัญชีทางการ']
  ];
  const suggested = () => Object.values(M.st.users).filter(u => !M.st.following.includes(u.id) && !M.st.blocked.includes(u.id) && u.id !== 'stranger');
  const suggestCard = () => {
    const list = suggested(); if (!list.length) return '';
    return `<section class="suggest"><div class="sec-row"><h3 class="sec-t">แนะนำสำหรับคุณ</h3><button class="link" data-act="openExplore">ดูทั้งหมด</button></div>
      <div class="hscroll">${list.map(u => `<div class="sg-card">${M.avatar(u, 64)}<b>${esc(u.handle)}</b><small class="muted">${u.category ? esc(u.category) : 'ผู้ติดตาม ' + M.num(u.followers)}</small><button class="btn sm pri" data-act="follow" data-id="${u.id}">ติดตาม</button></div>`).join('')}</div></section>`;
  };
  M.storiesBar = () => {
    const st = M.st;
    const users = st.stories.filter(s => M.activeStory(s.userId) && !st.muted.includes(s.userId) && !st.blocked.includes(s.userId))
      .sort((a, b) => (a.seen - b.seen) || (st.closeFriends.includes(b.userId) - st.closeFriends.includes(a.userId)));
    const mine = M.activeStory('me');
    return `<div class="stories hscroll" role="list">
      <div class="st-it" role="listitem"><button class="${mine ? 'ring' : 'noring'} me"${mine ? M.ringStyle(st.me) : ''} data-act="${mine ? 'openStory' : 'newStory'}" data-id="me">${M.avatar(st.me, 64)}${mine ? '' : `<span class="st-plus">${I('plus', 14)}</span>`}</button><span>สตอรี่ของคุณ</span></div>
      ${st.lives.map(l => `<div class="st-it" role="listitem"><button class="ring live" data-act="watchLive" data-id="${l.userId}">${M.avatar(M.user(l.userId), 64)}<span class="live-tag">LIVE</span></button><span>${esc(M.user(l.userId).handle)}</span></div>`).join('')}
      ${users.map(s => { const u = M.user(s.userId); return `<div class="st-it" role="listitem"><button class="ring${s.seen ? ' seen' : s.closeFriends ? ' cf' : ''}"${s.seen || s.closeFriends ? '' : M.ringStyle(u)} data-act="openStory" data-id="${u.id}">${M.avatar(u, 64)}</button><span>${esc(u.handle)}</span></div>`; }).join('')}
    </div>`;
  };

  M.Tabs.home = {
    render() {
      const st = M.st;
      const feed = M.rankFeed();
      const unreadN = st.notifications.filter(n => !n.read).length;
      return `<header class="top glass">
          <div class="brand">${M.logo(26)}<span class="wordmark">มะลิ</span></div>
          <div class="bar-r">
            <button class="ibtn" data-act="openExplore" aria-label="สำรวจ">${I('search')}</button>
            <button class="ibtn" data-act="openCalls" aria-label="การโทร">${I('phone')}</button>
            <button class="ibtn dotwrap" data-act="openNotifs" aria-label="การแจ้งเตือน">${I('heart')}${unreadN ? '<i class="dot"></i>' : ''}</button>
          </div></header>
        <div class="home-grid"><div class="col">
          ${M.storiesBar()}
          <nav class="shortcuts" aria-label="ทางลัด">${shortcuts.map(([k, ic, l]) => `<button data-act="shortcut" data-k="${k}"><span>${I(ic, 22)}</span>${l}</button>`).join('')}</nav>
          ${M.tip('home', 'แตะรูปสองครั้งเพื่อถูกใจ ปัดซ้ายขวาดูรูปอื่นในโพสต์ และแตะ "เรียงตามความสนใจ" เพื่อปรับฟีดเอง')}
          <div class="feed-h"><button class="link" data-act="algorithm">${I('tune', 18)} ${st.settings.feedOrder === 'smart' ? 'เรียงตามความสนใจ' : 'ล่าสุดก่อน'}</button></div>
          ${feed.map((p, i) => M.postCard(p) + (i === 2 ? suggestCard() : '')).join('') || '<p class="empty">ยังไม่มีโพสต์ ลองติดตามเพื่อนจากหน้าสำรวจ</p>'}
          <p class="end muted">ดูโพสต์ใหม่ครบแล้ว</p>
        </div>
        <aside class="side">
          <div class="me-row">${M.avatar(st.me, 44)}<div><b>${esc(st.me.handle)}</b><small class="muted">${esc(st.me.name)}</small></div></div>
          <h3 class="sec-t">แนะนำสำหรับคุณ</h3>
          ${suggested().slice(0, 5).map(u => `<div class="row tight">${M.avatar(u, 36)}<span class="row-tx"><span>${M.handle(u)}</span><small>${esc(u.category || 'แนะนำสำหรับคุณ')}</small></span><button class="link acc" data-act="follow" data-id="${u.id}">ติดตาม</button></div>`).join('')}
          <h3 class="sec-t">กำลังเป็นที่นิยม</h3>
          <div class="chips">${M.TRENDS.map(t => `<button class="chip" data-act="searchTag" data-q="${t}">${t}</button>`).join('')}</div>
          <p class="note">ต้นแบบเพื่อการออกแบบ ข้อมูลทั้งหมดเป็นตัวอย่าง</p>
        </aside></div>`;
    }
  };
  M.TRENDS = ['#ทะเลหมอก', '#ขนมไทย', '#คาเฟ่อารีย์', '#ถนนคนเดิน', '#เดินเมืองเก่า', '#ทะเลไทย'];

  A.shortcut = el => {
    const k = el.dataset.k;
    if (k === 'profile') return M.go('profile');
    M.push(k);
  };
  A.openExplore = () => M.push('explore', {});
  A.openNotifs = () => M.push('notifications');
  A.openCalls = () => M.push('calls');

  /* หน้าโพสต์เดี่ยว */
  M.Pages.post = {
    render: p => {
      const post = findPost(p.id);
      if (!post) return M.bar('โพสต์') + '<p class="empty">โพสต์นี้ถูกลบแล้ว</p>';
      const more = M.st.posts.filter(x => x.userId === post.userId && x.id !== post.id).slice(0, 9);
      return M.bar('โพสต์') + `<div class="scroll"><div class="col">${M.postCard(post)}
        ${more.length ? `<h3 class="sec-t pad">โพสต์อื่นจาก ${esc(M.user(post.userId).handle)}</h3><div class="grid3">${more.map(M.gridTile).join('')}</div>` : ''}</div></div>`;
    }
  };
  M.gridTile = p => `<button class="tile" data-act="openPost" data-id="${p.id}" aria-label="เปิดโพสต์">${M.media(p.slides ? p.slides[0] : { art: p.art })}${p.slides && p.slides.length > 1 ? `<span class="tile-ic">${I('copy', 16)}</span>` : (p.slides?.[0]?.video || !p.slides) ? `<span class="tile-ic">${I('reels', 16)}</span>` : ''}</button>`;
  A.openPost = el => { const id = el.dataset.id; if (id.startsWith('r')) return M.push('reelOne', { id }); M.push('post', { id }); };
})(window.M);
