'use strict';
/* ตัวดูสตอรี่ (หมดอายุใน 24 ชม.) และไฮไลต์ */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;
  const DUR = 5000;

  A.openStory = el => {
    const id = el.dataset.id;
    if (id === 'me') return M.push('story', { queue: ['me'], i: 0 });
    const st = M.st;
    const queue = st.stories.filter(s => M.activeStory(s.userId) && !st.muted.includes(s.userId) && !st.blocked.includes(s.userId)).map(s => s.userId);
    M.push('story', { queue, i: Math.max(0, queue.indexOf(id)) });
  };
  A.newStory = () => M.push('camera', { mode: 'story' });
  A.openHighlight = el => {
    const h = M.st.highlights.find(x => x.id === el.dataset.id);
    M.push('story', { highlight: h.id, queue: ['me'], i: 0 });
  };

  const groupFor = (p, uid) => {
    if (p.highlight) { const h = M.st.highlights.find(x => x.id === p.highlight); return { userId: 'me', items: h.items.map((it, i) => ({ ...it, id: h.id + i, ts: Date.now() })), title: h.title }; }
    if (uid === 'me') return { userId: 'me', items: M.st.myStory.items, mine: true };
    const s = M.st.stories.find(x => x.userId === uid);
    return { ...s, items: s.items.filter(it => Date.now() - it.ts < M.T.DAY) };
  };

  M.Pages.story = {
    cls: 'dark fade', static: true,
    render: () => '<div class="story-v"></div>',
    mount(el, p) {
      const box = el.querySelector('.story-v');
      let gi = p.i, ii = 0, start = 0, elapsed = 0, paused = false, raf = 0, g;
      const st = M.st;
      const show = () => {
        const uid = p.queue[gi];
        g = groupFor(p, uid);
        if (!g || !g.items.length) return next(true);
        const it = g.items[ii];
        const u = M.user(g.userId);
        const blurred = it.hidden && !it.revealed && !g.mine;
        box.innerHTML = `
          <div class="sv-media${blurred ? ' blur' : ''}">${M.media(it, { motion: it.video })}</div>
          <div class="sv-top">
            <div class="sv-bars">${g.items.map((_, j) => `<i><b style="width:${j < ii ? 100 : 0}%"></b></i>`).join('')}</div>
            <div class="sv-h">${M.avatar(u, 32)}<b>${esc(p.highlight ? g.title : u.handle)}</b>
              <span class="muted">${p.highlight ? 'ไฮไลต์' : M.ago(it.ts) + ' · ' + M.left24(it.ts)}</span>
              ${g.closeFriends || it.audience === 'close' ? '<span class="pill cf">เพื่อนสนิท</span>' : ''}
              <span class="sp"></span>
              <button class="ibtn" data-sv="pause" aria-label="หยุด/เล่น">${I(paused ? 'play' : 'pause', 20)}</button>
              <button class="ibtn" data-sv="close" aria-label="ปิด">${I('x')}</button></div>
          </div>
          ${blurred ? `<div class="sv-hidden">${I('eyeOff', 28)}<p>ภาพนี้ถูกซ่อนไว้ ส่งคำขอเพื่อดูภาพเต็ม</p><button class="btn pri" data-sv="askReveal">ขอดูภาพ</button></div>` : ''}
          ${it.sticker?.type === 'addyours' ? `<div class="addyours"><small>Add Yours</small><b>${esc(it.sticker.prompt)}</b><span class="muted">${M.num(it.sticker.count + (it.sticker.joined ? 1 : 0))} คนร่วมเล่น</span><button class="btn sm pri" data-sv="addYours">${it.sticker.joined ? 'ร่วมแล้ว' : 'ร่วมเล่น'}</button></div>` : ''}
          <button class="sv-nav prev" data-sv="prev" aria-label="ก่อนหน้า"></button><button class="sv-nav next" data-sv="next" aria-label="ถัดไป"></button>
          <div class="sv-foot">${g.mine || p.highlight
            ? `<button class="btn sm ghost-d" data-sv="viewers">${I('eye', 18)} ผู้ชม ${(it.views || 0)} คน</button><span class="sp"></span>${p.highlight ? `<button class="btn sm ghost-d" data-sv="hlMenu">${I('more', 18)} เพิ่มเติม</button>` : `<button class="btn sm ghost-d" data-sv="toHighlight">${I('star', 18)} ไฮไลต์</button><button class="ibtn" data-sv="delete" aria-label="ลบ">${I('trash', 20)}</button>`}`
            : `<form class="sv-reply"><input class="field d" name="t" placeholder="ตอบกลับ ${esc(u.handle)}" autocomplete="off"><button class="ibtn like${it.liked ? ' on' : ''}" type="button" data-sv="like" aria-label="ถูกใจ">${I('heart')}</button><button class="ibtn" aria-label="ส่ง">${I('send')}</button></form>`}</div>`;
        const f = box.querySelector('.sv-reply');
        if (f) {
          f.t.onfocus = () => { paused = true; };
          f.t.onblur = () => { paused = false; };
          f.onsubmit = e => {
            e.preventDefault(); const t = f.t.value.trim(); if (!t) return;
            if (st.settings.storyReplies === 'off') { M.toast('ปิดการตอบกลับสตอรี่'); return; }
            const chat = M.ensureDM(u.id);
            chat.messages.push({ id: M.uid('x'), from: 'me', type: 'storyReply', art: it.art, img: it.img, text: t, ts: Date.now(), status: 'sent' });
            f.t.value = ''; f.t.blur(); M.toast(`ส่งถึง ${u.handle} แล้ว`); M.save(); M.botReply(chat);
          };
        }
        if (g.mine && it.views == null) it.views = 0;
        start = performance.now(); elapsed = 0;
      };
      const dur = () => (g?.items[ii]?.video ? 8000 : DUR);
      const tick = now => {
        raf = requestAnimationFrame(tick);
        if (!g) return;
        if (paused) { start = now - elapsed; return; }
        elapsed = now - start;
        const bar = box.querySelectorAll('.sv-bars b')[ii];
        if (bar) bar.style.width = Math.min(100, elapsed / dur() * 100) + '%';
        if (elapsed >= dur()) next();
      };
      const markSeen = () => { if (!p.highlight && g && !g.mine) { const s = st.stories.find(x => x.userId === g.userId); if (s) s.seen = true; M.save(); } };
      function next(skipGroup) {
        if (!skipGroup && ii < g.items.length - 1) { ii++; return show(); }
        markSeen();
        if (gi < p.queue.length - 1) { gi++; ii = 0; return show(); }
        cancelAnimationFrame(raf); M.back();
      }
      const prev = () => { if (ii > 0) ii--; else if (gi > 0) { gi--; ii = 0; } show(); };
      box.onclick = async e => {
        const b = e.target.closest('[data-sv]'); if (!b) return;
        if (justHeld) { justHeld = false; return; }
        const a = b.dataset.sv, it = g.items[ii];
        if (a === 'next') next(); else if (a === 'prev') prev();
        else if (a === 'close') { cancelAnimationFrame(raf); markSeen(); M.back(); }
        else if (a === 'pause') { paused = !paused; b.innerHTML = I(paused ? 'play' : 'pause', 20); }
        else if (a === 'like') { it.liked = !it.liked; b.classList.toggle('on', it.liked); M.save(); }
        else if (a === 'askReveal') {
          const chat = M.ensureDM(g.userId);
          chat.messages.push({ id: M.uid('x'), from: 'me', type: 'text', text: 'ขอดูภาพเต็มในสตอรี่หน่อย', ts: Date.now(), status: 'sent' });
          paused = true; M.toast('ส่งคำขอแล้ว รอเจ้าของอนุญาต…');
          setTimeout(() => { it.revealed = true; M.save(); M.toast(`${M.user(g.userId).handle} อนุญาตให้ดูแล้ว (จำลอง)`); paused = false; show(); }, 1800);
        }
        else if (a === 'addYours') { cancelAnimationFrame(raf); M.back(); setTimeout(() => M.push('editor', { type: 'story', addYours: it.sticker.prompt, joinFrom: { uid: g.userId, id: it.id } }), 320); }
        else if (a === 'viewers') {
          paused = true;
          const viewers = st.closeFriends.concat(st.following).slice(0, Math.max(3, it.views || 0)).filter((v, i, arr) => arr.indexOf(v) === i);
          M.sheet(`<div class="rows">${viewers.map(v => `<div class="row tight">${M.avatar(M.user(v), 36)}<span class="row-tx"><span>${esc(M.user(v).handle)}</span></span></div>`).join('')}</div><p class="note">รายชื่อผู้ชมเป็นข้อมูลจำลอง</p>`, { title: 'ผู้ชม', onClose: () => { paused = false; } });
        }
        else if (a === 'toHighlight') {
          paused = true;
          const title = await M.prompt('เพิ่มลงไฮไลต์', '', 'ชื่อไฮไลต์ใหม่ หรือชื่อเดิม', { ok: 'เพิ่ม' });
          paused = false;
          if (!title) return;
          let h = st.highlights.find(x => x.title === title);
          if (!h) { h = { id: M.uid('h'), title, items: [] }; st.highlights.push(h); }
          h.items.push({ art: it.art, img: it.img, overlays: it.overlays });
          M.toast(`เพิ่มลง "${title}" แล้ว`); M.save();
        }
        else if (a === 'hlMenu') {
          paused = true;
          const h = st.highlights.find(x => x.id === p.highlight);
          M.menu([
            { label: 'แก้ไขไฮไลต์', sub: 'เปลี่ยนชื่อ หรือใช้ภาพนี้เป็นปก', icon: 'edit', act: async () => {
              const t = await M.prompt('แก้ไขไฮไลต์', h.title, 'ชื่อไฮไลต์', { max: 16, ok: 'บันทึก' });
              if (t && t.trim()) h.title = t.trim();
              if (ii > 0 && await M.confirm('ใช้ภาพนี้เป็นปกไฮไลต์ไหม', '', 'ใช้เป็นปก')) h.items.unshift(...h.items.splice(ii, 1));
              M.save(); paused = false; M.toast('บันทึกไฮไลต์แล้ว');
            } },
            { label: 'จัดเก็บไฮไลต์', sub: 'ซ่อนจากโปรไฟล์ กู้คืนได้ที่คลังสตอรี่', icon: 'archive', act: () => {
              h.archived = true; M.save(); cancelAnimationFrame(raf); M.back(); M.refresh(); M.toast('จัดเก็บไฮไลต์แล้ว ดูได้ที่คลังสตอรี่');
            } },
            { label: 'ลบออกจากไฮไลต์', icon: 'trash', danger: true, act: async () => {
              if (!(await M.confirm('ลบสตอรี่นี้ออกจากไฮไลต์ไหม', 'สตอรี่ยังอยู่ในคลังสตอรี่', 'ลบออก', true))) { paused = false; return; }
              h.items.splice(ii, 1); if (!h.items.length) st.highlights = st.highlights.filter(x => x !== h);
              M.save(); cancelAnimationFrame(raf); M.back(); M.refresh();
            } }
          ], esc(h.title));
        }
        else if (a === 'delete') {
          paused = true;
          if (await M.confirm('ลบสตอรี่นี้ไหม', '', 'ลบ', true)) {
            if (p.highlight) { const h = st.highlights.find(x => x.id === p.highlight); h.items.splice(ii, 1); if (!h.items.length) st.highlights = st.highlights.filter(x => x !== h); }
            else st.myStory.items.splice(ii, 1);
            M.save(); cancelAnimationFrame(raf); M.back(); M.refresh(); return;
          }
          paused = false;
        }
      };
      // กดค้างเพื่อหยุดชั่วคราว
      let holdT, justHeld = false;
      box.addEventListener('pointerdown', e => { if (e.target.closest('.sv-nav')) holdT = setTimeout(() => { paused = true; box.classList.add('held'); }, 250); });
      box.addEventListener('pointerup', () => { clearTimeout(holdT); if (box.classList.contains('held')) { box.classList.remove('held'); justHeld = true; setTimeout(() => paused = false, 10); } });
      show();
      raf = requestAnimationFrame(tick);
      el._stop = () => cancelAnimationFrame(raf);
    },
    unmount(el) { el._stop?.(); M.refresh(); }
  };
})(window.M);
