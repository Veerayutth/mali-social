'use strict';
/* Reels: วิดีโอสั้นแนวตั้งเต็มจอ เลื่อนขึ้นลง (scroll-snap) + วิดีโอยาวแนวนอน (Features) */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;
  const findReel = id => M.st.reels.find(r => r.id === id);

  const ranked = () => {
    const st = M.st;
    const w = v => typeof v === 'number' ? 1 : ({ less: .3, normal: 1, more: 1.8 }[v] || 1);
    return st.reels.filter(r => !st.blocked.includes(r.userId) && !st.muted.includes(r.userId) && !st.notInterested.includes(r.id))
      .map(r => ({ r, s: (r.tags || []).reduce((a, t) => a + w(st.interests[t]), 0) / Math.max(1, r.tags?.length || 1) * (r.trial && r.userId !== 'me' ? 1.1 : 1) - (Date.now() - r.ts) / 3.6e8 }))
      .sort((a, b) => b.s - a.s).map(x => x.r);
  };

  const reelHTML = (r, i) => {
    const u = M.user(r.userId), st = M.st;
    const following = st.following.includes(u.id) || u.id === 'me';
    const dub = st.settings.autoDub || r.dub;
    const dur = 12 + (M.hash(r.id) % 18);
    return `<section class="reel" data-reel="${r.id}" style="--dur:${dur}s">
      <div class="reel-media" data-dbl="likeReel" data-id="${r.id}">${r.vid && M.mem.videos[r.vid] ? `<video src="${M.mem.videos[r.vid]}" loop playsinline muted></video>` : `<div class="art kb">${M.scene(r.art.kind, r.art.seed)}</div>`}
        <div class="reel-paused">${I('play', 56)}</div></div>
      <div class="reel-shade"></div>
      <div class="reel-sub">${dub ? `<small>${I('translate', 14)} พากย์และแปลโดย AI (จำลอง)</small>${esc(r.sub?.en || '')}` : esc(r.sub?.th || '')}</div>
      <div class="reel-rail">
        <button class="rb like${r.liked ? ' on' : ''}" data-act="likeReel" data-id="${r.id}" aria-label="ถูกใจ">${I('heart', 28)}<span>${st.settings.hideLikesOthers && r.userId !== 'me' ? '' : M.num(r.likes)}</span></button>
        <button class="rb" data-act="comments" data-id="${r.id}" aria-label="ความคิดเห็น">${I('comment', 28)}<span>${M.num(r.comments.length)}</span></button>
        <button class="rb${r.reposted ? ' on-acc' : ''}" data-act="repostReel" data-id="${r.id}" aria-label="รีโพสต์">${I('repost', 28)}</button>
        <button class="rb" data-act="shareReel" data-id="${r.id}" aria-label="แชร์">${I('send', 28)}<span>${M.num(r.shares)}</span></button>
        <button class="rb" data-act="reelMenu" data-id="${r.id}" aria-label="ตัวเลือก">${I('more', 28)}</button>
        <button class="rb disc" data-act="openUser" data-id="${u.id}" aria-label="โปรไฟล์ผู้โพสต์">${M.avatar(u, 32)}</button>
      </div>
      <div class="reel-meta">
        <div class="reel-who"><button class="noring" data-act="openUser" data-id="${u.id}">${M.avatar(u, 32)}</button>${M.handle(u)}
          ${following ? '' : `<button class="btn sm ghost-d" data-act="follow" data-id="${u.id}">ติดตาม</button>`}
          ${r.trial ? '<span class="pill">ทดลอง · แสดงเฉพาะคนที่ยังไม่ติดตาม</span>' : ''}</div>
        <p>${M.richText(r.caption)}</p>
        ${r.long ? `<button class="long-link" data-act="longVideo" data-id="${r.id}">${I('film', 16)} <span>ดูวิดีโอเต็ม</span> · <span translate="no">${esc(r.long.title)}</span> · <span>${r.long.min} นาที</span></button>` : ''}
        <p class="audio">${I('music', 14)} <span class="marq"><span>${esc(r.audio)}</span></span></p>
      </div>
      <div class="reel-prog"><i></i></div>
    </section>`;
  };

  const observe = root => {
    const io = new IntersectionObserver(es => es.forEach(e => {
      const sec = e.target;
      const on = e.isIntersecting && e.intersectionRatio > .6;
      sec.classList.toggle('playing', on && !sec.classList.contains('user-paused'));
      const v = sec.querySelector('video'); if (v) on ? v.play().catch(() => {}) : v.pause();
    }), { root, threshold: [0, .6, 1] });
    root.querySelectorAll('.reel').forEach(s => io.observe(s));
    root._io?.disconnect(); root._io = io;
    // แตะครั้งเดียว = หยุด/เล่น
    root.onclick = e => {
      const m = e.target.closest('.reel-media'); if (!m) return;
      clearTimeout(root._t);
      root._t = setTimeout(() => {
        const sec = m.closest('.reel');
        sec.classList.toggle('user-paused');
        sec.classList.toggle('playing', !sec.classList.contains('user-paused'));
        const v = sec.querySelector('video'); if (v) sec.classList.contains('playing') ? v.play() : v.pause();
      }, 330);
    };
  };

  M.Tabs.reels = {
    render: () => `<div class="reels-top"><h1>Reels</h1><span class="sp"></span>
        <button class="ibtn" data-act="algorithm" aria-label="อัลกอริทึมของคุณ">${I('tune')}</button>
        <button class="ibtn" data-act="newReel" aria-label="สร้าง Reels">${I('camera')}</button></div>
      <div class="reels" id="reelsScroll">${ranked().map(reelHTML).join('')}
        <section class="reel end-reel"><div>${M.bud('wink', 80)}<p>ดู Reels ครบแล้ว ลองปรับหัวข้อที่สนใจหรือสร้าง Reels ของคุณเอง</p><button class="btn pri" data-act="newReel">สร้าง Reels</button></div></section></div>
      ${M.st.tips.reels ? '' : `<div class="reels-tip">${M.tip('reels', 'เลื่อนขึ้นเพื่อดูคลิปถัดไป แตะหนึ่งครั้งเพื่อหยุด แตะสองครั้งเพื่อถูกใจ')}</div>`}`,
    mount(el) {
      const sc = el.querySelector('#reelsScroll');
      if (el._top) sc.scrollTop = el._top;
      sc.onscroll = () => { el._top = sc.scrollTop; };
      observe(sc);
    },
    show(el) { const sc = el.querySelector('#reelsScroll'); sc && observe(sc); }
  };

  A.newReel = () => M.push('editor', { type: 'reel' });
  A.likeReel = (el, ev, dbl) => {
    const r = findReel(el.dataset.id); if (!r) return;
    const sec = el.closest('.reel');
    if (dbl) { M.heartBurst(sec.querySelector('.reel-media'), ev.clientX, ev.clientY); clearTimeout(sec.closest('.reels')?._t); if (r.liked) return; }
    r.liked = !r.liked; r.likes += r.liked ? 1 : -1;
    const b = sec.querySelector('.rb.like'); b.classList.toggle('on', r.liked); b.querySelector('span').textContent = M.num(r.likes);
    M.save();
  };
  A.repostReel = el => {
    const r = findReel(el.dataset.id);
    if (r.userId === 'me') return M.toast('รีโพสต์ได้เฉพาะคลิปของคนอื่น');
    r.reposted = !r.reposted;
    document.querySelectorAll(`.reel[data-reel="${r.id}"] [data-act="repostReel"]`).forEach(b => b.classList.toggle('on-acc', r.reposted));
    M.toast(r.reposted ? 'รีโพสต์แล้ว' : 'ยกเลิกรีโพสต์แล้ว'); M.save();
  };
  A.shareReel = el => M.openShare(el.dataset.id, 'reel');
  A.reelMenu = el => {
    const r = findReel(el.dataset.id), st = M.st;
    M.menu([
      { label: r.saved ? 'เลิกบันทึก' : 'บันทึก', icon: 'bookmark', act: () => { r.saved = !r.saved; M.toast(r.saved ? 'บันทึกแล้ว' : 'เลิกบันทึกแล้ว'); M.save(); } },
      { label: (st.settings.autoDub || r.dub) ? 'ปิดเสียงพากย์ AI' : 'เปิดเสียงพากย์ AI (ไทย → อังกฤษ)', sub: 'จำลองการแปลเสียงพูดและขยับปาก', icon: 'translate', act: () => { r.dub = !r.dub; M.renderTab('reels'); } },
      { label: 'ไม่สนใจ', icon: 'eyeOff', act: () => { st.notInterested.push(r.id); (r.tags || []).forEach(t => st.interests[t] = 'less'); M.toast('จะแสดงคลิปแบบนี้น้อยลง'); M.refresh(); } },
      { label: 'ปรับอัลกอริทึมของคุณ', icon: 'tune', act: () => A.algorithm() },
      r.userId !== 'me' && { label: 'รายงาน', icon: 'flag', danger: true, act: () => M.report(M.user(r.userId)) },
      r.userId === 'me' && r.trial && { label: 'เผยแพร่ให้ผู้ติดตามเห็น', sub: 'ย้ายจาก Trial ไปที่โปรไฟล์หลัก', icon: 'upload', act: () => { r.trial = false; M.toast('เผยแพร่ลงโปรไฟล์แล้ว'); M.refresh(); } }
    ]);
  };

  /* หน้า Reels เดี่ยว (เปิดจากตาราง/แชต) */
  M.Pages.reelOne = {
    cls: 'dark', static: true,
    render: p => `<div class="reels one">${reelHTML(findReel(p.id) || M.st.reels[0])}</div><button class="ibtn float-back" data-act="back" aria-label="ย้อนกลับ">${I('back')}</button>`,
    mount: el => observe(el.querySelector('.reels'))
  };

  /* วิดีโอยาวแนวนอน */
  M.Pages.longvideo = {
    cls: 'dark', static: true,
    render: p => {
      const r = findReel(p.id), u = M.user(r.userId), total = r.long.min * 60;
      const chapters = ['เตรียมวัตถุดิบ', 'ขั้นตอนหลัก', 'เคล็ดลับ', 'สรุป'];
      return `${M.bar(esc(r.long.title), '', { cls: 'dark' })}<div class="scroll"><div class="col">
        <div class="lv"><div class="art kb">${M.scene(r.art.kind, r.art.seed + 1)}</div><button class="lv-play" data-lv="play">${I('play', 40)}</button></div>
        <div class="lv-ctl"><span data-lv="t">0:00</span><input type="range" min="0" max="${total}" value="0" data-lv="seek" aria-label="ตำแหน่งวิดีโอ"><span>${M.dur(total)}</span></div>
        <div class="pad"><h2>${esc(r.long.title)}</h2><p class="muted">${esc(u.handle)} · ${M.num(r.likes * 3)} ครั้ง · วิดีโอแนวนอนยาวสูงสุด 90 นาที</p>
        <h3 class="sec-t">ช่วงในวิดีโอ</h3><div class="rows">${chapters.map((c, i) => `<button class="row" data-lv="ch" data-s="${Math.round(total * i / 4)}"><span class="row-tx"><span>${c}</span><small>${M.dur(total * i / 4)}</small></span></button>`).join('')}</div>
        <p class="note">ต้นแบบนี้จำลองเครื่องเล่นวิดีโอด้วยภาพเคลื่อนไหว</p></div></div></div>`;
    },
    mount(el, p) {
      const seek = el.querySelector('[data-lv="seek"]'), t = el.querySelector('[data-lv="t"]'), lv = el.querySelector('.lv');
      let playing = false;
      const set = v => { seek.value = v; t.textContent = M.dur(+v); };
      el._iv = setInterval(() => { if (playing) set(Math.min(+seek.max, +seek.value + 1)); }, 1000);
      seek.oninput = () => set(seek.value);
      el.onclick = e => {
        const b = e.target.closest('[data-lv]'); if (!b) return;
        if (b.dataset.lv === 'play') { playing = !playing; lv.classList.toggle('playing', playing); b.innerHTML = I(playing ? 'pause' : 'play', 40); }
        if (b.dataset.lv === 'ch') set(b.dataset.s);
      };
    },
    unmount: el => clearInterval(el._iv)
  };
  A.longVideo = el => M.push('longvideo', { id: el.dataset.id });
})(window.M);
