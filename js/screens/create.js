'use strict';
/* เครื่องมือสร้างคอนเทนต์: ปุ่ม + , ตัวแก้ไขภาพ/วิดีโอ (ฟิลเตอร์ ข้อความ สติกเกอร์ เพลง ตัดต่อ บทพูด), ไลฟ์ */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;
  const KIND_TAG = { sea: 'travel', mountain: 'nature', city: 'city', temple: 'travel', food: 'food', cafe: 'cafe', market: 'travel', forest: 'nature', flower: 'art', abstract: 'art' };

  A.openCreate = () => M.menu([
    { label: 'โพสต์', sub: 'รูปหรือวิดีโอสูงสุด 10 รายการ สัดส่วน 3:4', icon: 'grid', act: () => M.push('editor', { type: 'post' }) },
    { label: 'สตอรี่', sub: 'หายไปใน 24 ชั่วโมง', icon: 'clock', act: () => M.push('editor', { type: 'story' }) },
    { label: 'Reels', sub: 'วิดีโอสั้นแนวตั้ง ตัดต่อและใส่เพลงได้', icon: 'reels', act: () => M.push('editor', { type: 'reel' }) },
    { label: 'ถ่ายทอดสด', sub: 'ผู้ติดตามคอมเมนต์และขอร่วมไลฟ์ได้', icon: 'live', act: () => M.push('live', { mode: 'host' }) }
  ], 'สร้าง');

  const TITLES = { post: 'โพสต์ใหม่', story: 'สตอรี่ใหม่', reel: 'Reels ใหม่' };
  const TOOLS = {
    post: [['filter', 'filters', 'ฟิลเตอร์'], ['text', 'type', 'ข้อความ'], ['sticker', 'smile', 'สติกเกอร์'], ['music', 'music', 'เพลง']],
    story: [['filter', 'filters', 'ฟิลเตอร์'], ['text', 'type', 'ข้อความ'], ['sticker', 'smile', 'สติกเกอร์'], ['music', 'music', 'เพลง']],
    reel: [['filter', 'filters', 'ฟิลเตอร์'], ['text', 'type', 'ข้อความ'], ['sticker', 'smile', 'สติกเกอร์'], ['music', 'music', 'เพลง'], ['trim', 'scissors', 'ตัดต่อ'], ['script', 'script', 'บทพูด']]
  };

  M.Pages.editor = {
    static: true,
    render: () => '<div class="ed"></div>',
    mount(el, p) {
      const st = M.st;
      const d = el._d = {
        type: p.type, slides: [], cur: 0, tool: 'filter', caption: '', location: '', collab: [], audience: 'all', hidden: false,
        trial: false, dub: false, music: null, aspect: '3/4', trim: [0, 30], len: 30, speed: 1, script: '', prompting: false,
        commentsOff: false, hideLikes: false, longTitle: '', longMin: '', addYours: p.addYours || '', joinFrom: p.joinFrom
      };
      if (p.fromPost) d.slides.push({ ...p.fromPost, overlays: [] });
      if (p.addYours) d.slides.push({ art: { kind: 'cafe', seed: Math.floor(Math.random() * 900) }, overlays: [{ type: 'text', text: p.addYours, x: 20, y: 12, color: '#fff' }] });
      const root = el.querySelector('.ed');
      const slide = () => d.slides[d.cur];
      const ratio = () => d.type === 'post' ? d.aspect : '9/16';

      const stage = () => {
        const s = slide();
        if (!s) return `<div class="ed-stage empty" style="aspect-ratio:${ratio()}"><div>${M.bud('wow', 72)}<p>เลือกรูปหรือวิดีโอจากเครื่อง หรือใช้ภาพตัวอย่างด้านล่าง</p><button class="btn pri" data-e="upload">${I('upload', 18)} เลือกจากเครื่อง</button></div></div>`;
        return `<div class="ed-stage" style="aspect-ratio:${ratio()}" data-stage>
          <div class="ed-media">${M.media({ ...s, overlays: [] }, { motion: d.type === 'reel' })}${d.camOn ? '<video class="ed-cam" autoplay playsinline muted></video>' : ''}</div>
          ${(s.overlays || []).map((o, i) => `<span class="ov ${o.type === 'text' ? 'ov-text' : o.type === 'sticker' ? 'ov-stk' : 'ov-chip'} drag" data-ov="${i}" style="left:${o.x}%;top:${o.y}%;${o.color ? 'color:' + o.color : ''}">${o.type === 'sticker' ? M.sticker(o.i, 64) : (o.type === 'music' ? I('music', 14) + ' ' : o.type === 'loc' ? I('pin', 14) + ' ' : '') + esc(o.text)}</span>`).join('')}
          ${d.music ? `<span class="ed-music">${I('music', 14)} ${esc(M.TRACKS.find(t => t.id === d.music).name)}</span>` : ''}
          ${d.prompting ? `<div class="prompter"><div style="animation-duration:${Math.max(8, d.script.length / (d.promptSpeed || 6))}s">${esc(d.script).replace(/\n/g, '<br>')}</div></div>` : ''}
          ${d.type === 'reel' && d.dub ? `<span class="ed-dub">${I('translate', 14)} พากย์ AI: ไทย → อังกฤษ</span>` : ''}
          ${d.slides.length > 1 ? `<span class="count">${d.cur + 1}/${d.slides.length}</span>` : ''}
        </div>`;
      };
      const strip = () => `<div class="ed-strip hscroll">
        <button class="ed-th add" data-e="upload" aria-label="อัปโหลด">${I('upload', 20)}<small>อัปโหลด</small></button>
        ${d.slides.map((s, i) => `<div class="ed-th${i === d.cur ? ' on' : ''}"><button data-e="sel" data-i="${i}" aria-label="สไลด์ ${i + 1}">${M.media({ ...s, overlays: [] })}</button><button class="x" data-e="rm" data-i="${i}" aria-label="ลบ">${I('x', 12)}</button>${d.type === 'post' && i > 0 ? `<button class="mv" data-e="mv" data-i="${i}" aria-label="เลื่อนไปซ้าย">${I('back', 12)}</button>` : ''}</div>`).join('')}
        <span class="ed-sep"></span>
        ${M.SCENES.map((k, i) => `<button class="ed-th sample" data-e="sample" data-k="${k}" aria-label="ภาพตัวอย่าง ${M.SCENE_TH[k]}">${M.scene(k, 500 + i)}<small>${M.SCENE_TH[k]}</small></button>`).join('')}</div>`;
      const panel = () => {
        const s = slide();
        if (!s) return '';
        switch (d.tool) {
          case 'filter': return `<div class="hscroll chips">${Object.keys(M.FILTERS).map(f => `<button class="flt${(s.filter || 'none') === f ? ' on' : ''}" data-e="filter" data-f="${f}"><span style="filter:${M.FILTERS[f]}">${M.media({ ...s, overlays: [], filter: null })}</span>${M.FILTER_TH[f]}</button>`).join('')}</div>`;
          case 'text': return `<form class="row-form" data-txt><input class="field" name="t" placeholder="พิมพ์ข้อความบนภาพ" maxlength="60"><div class="swatches">${['#ffffff', '#1f1b16', '#c4411a', '#f6d365'].map((c, i) => `<label><input type="radio" name="c" value="${c}" ${i ? '' : 'checked'}><i style="background:${c}"></i></label>`).join('')}</div><button class="btn sm pri">เพิ่ม</button></form><p class="note">ลากข้อความบนภาพเพื่อย้าย แตะเพื่อลบ</p>`;
          case 'sticker': return `<div class="hscroll stk-row">${M.STICKERS.map((_, i) => `<button data-e="stk" data-i="${i}">${M.sticker(i, 64)}</button>`).join('')}</div>
            <div class="chips"><button class="chip" data-e="locstk">${I('pin', 14)} สถานที่</button>${d.type === 'story' ? `<button class="chip" data-e="addyours">Add Yours</button>` : ''}${d.music ? `<button class="chip" data-e="musicstk">${I('music', 14)} สติกเกอร์เพลง</button>` : ''}</div>
            ${d.addYours ? `<p class="note">สติกเกอร์ Add Yours: "${esc(d.addYours)}" เพื่อนแตะเพื่อเล่นต่อได้</p>` : ''}`;
          case 'music': return `<div class="rows">${M.TRACKS.map(t => `<button class="row tight" data-e="music" data-id="${t.id}"><span class="row-ic">${I('music', 20)}</span><span class="row-tx"><span>${esc(t.name)}</span><small>${esc(t.artist)} · ${t.len}</small></span>${d.music === t.id ? I('check', 20, 'acc') : ''}</button>`).join('')}</div><p class="note">เพลงในต้นแบบเป็นชื่อสมมติ ไม่มีเสียงจริง</p>`;
          case 'trim': return `<div class="trim"><div class="trim-bar"><i style="left:${d.trim[0] / d.len * 100}%;right:${100 - d.trim[1] / d.len * 100}%"></i></div>
            <label>เริ่ม ${M.dur(d.trim[0])}<input type="range" min="0" max="${d.len}" step="0.5" value="${d.trim[0]}" data-trim="0"></label>
            <label>จบ ${M.dur(d.trim[1])}<input type="range" min="0" max="${d.len}" step="0.5" value="${d.trim[1]}" data-trim="1"></label>
            <p class="muted small">ความยาวหลังตัด ${M.dur((d.trim[1] - d.trim[0]) / d.speed)}</p>
            <div class="seg">${[.5, 1, 2].map(v => `<button class="${d.speed === v ? 'on' : ''}" data-e="speed" data-v="${v}">${v}x</button>`).join('')}</div></div>`;
          case 'script': return `<textarea class="field" rows="4" placeholder="วางบทพูดที่นี่ ข้อความจะเลื่อนบนจอระหว่างถ่าย" data-script>${esc(d.script)}</textarea>
            <label class="muted small">ความเร็ว<input type="range" min="2" max="14" value="${d.promptSpeed || 6}" data-pspeed></label>
            <div class="dlg-a"><button class="btn sec" data-e="cam">${I('camera', 18)} ${d.camOn ? 'ปิดกล้อง' : 'เปิดกล้อง'}</button><button class="btn pri" data-e="prompt">${d.prompting ? 'หยุดอ่านบท' : 'เริ่มอ่านบท'}</button></div>
            <p class="note">เครื่องอ่านบท (Teleprompter) ต้นแบบนี้ยังไม่บันทึกวิดีโอจากกล้อง</p>`;
        }
        return '';
      };
      const people = () => Object.values(st.users).filter(u => !u.official && u.id !== 'stranger');
      const details = () => `<div class="ed-details form">
        ${d.type !== 'story' ? `<label>คำบรรยาย<textarea class="field" rows="3" maxlength="2200" placeholder="เขียนคำบรรยาย ใส่ #แท็ก หรือ @ชื่อผู้ใช้" data-f="caption">${esc(d.caption)}</textarea></label>` : ''}
        ${d.type === 'post' && d.slides.length > 1 ? `<label>คำบรรยายของสไลด์ ${d.cur + 1}<input class="field" maxlength="120" data-slidecap value="${esc(slide()?.caption || '')}" placeholder="แคปชันเฉพาะรูปนี้"></label>` : ''}
        ${d.type !== 'story' ? `<label>สถานที่<input class="field" data-f="location" value="${esc(d.location)}" placeholder="เพิ่มสถานที่"></label>` : ''}
        ${d.type === 'post' ? `<div><span class="lbl">สัดส่วนภาพ</span><div class="seg">${[['3/4', '3:4'], ['4/5', '4:5'], ['1/1', '1:1']].map(([v, l]) => `<button class="${d.aspect === v ? 'on' : ''}" data-e="aspect" data-v="${v}">${l}</button>`).join('')}</div></div>` : ''}
        ${d.type !== 'story' ? `<div><span class="lbl">เชิญร่วมเป็นเจ้าของ (Collab)</span><div class="chips">${people().map(u => `<button class="chip${d.collab.includes(u.id) ? ' on' : ''}" data-e="collab" data-id="${u.id}">${esc(u.handle)}</button>`).join('')}</div></div>` : ''}
        ${d.type === 'story' ? `<div><span class="lbl">แชร์กับ</span><div class="seg">${[['all', 'ทุกคน'], ['close', 'เพื่อนสนิท']].map(([v, l]) => `<button class="${d.audience === v ? 'on' : ''}" data-e="aud" data-v="${v}">${l}</button>`).join('')}</div></div>
          <div><span class="lbl">สีวงขอบสตอรี่ของคุณ</span><div data-ringbox>${M.ringPicker(st.me.ringColor || '#c4411a')}</div></div>
          <label class="row"><span class="row-tx"><span>ซ่อนภาพแบบเบลอ</span><small>ให้คนส่งคำขอทางแชตก่อนจึงเห็นภาพเต็ม</small></span><input type="checkbox" class="switch" data-c="hidden" ${d.hidden ? 'checked' : ''}></label>` : ''}
        ${d.type === 'reel' ? `<label class="row"><span class="row-tx"><span>Trial Reels</span><small>แสดงกับคนที่ยังไม่ติดตามก่อน ถ้าผลดีค่อยเผยแพร่ลงโปรไฟล์</small></span><input type="checkbox" class="switch" data-c="trial" ${d.trial ? 'checked' : ''}></label>
          <label class="row"><span class="row-tx"><span>แปลเสียงพากย์อัตโนมัติ</span><small>จำลองการพากย์ AI ไทย → อังกฤษพร้อมขยับปาก</small></span><input type="checkbox" class="switch" data-c="dub" ${d.dub ? 'checked' : ''}></label>
          <label>ลิงก์วิดีโอเต็ม (ไม่บังคับ)<input class="field" data-f="longTitle" value="${esc(d.longTitle)}" placeholder="ชื่อวิดีโอยาวแนวนอน"></label>
          <label>ความยาววิดีโอเต็ม (นาที สูงสุด 90)<input class="field" type="number" min="1" max="90" data-f="longMin" value="${esc(d.longMin)}"></label>` : ''}
        ${d.type !== 'story' ? `<label class="row"><span class="row-tx"><span>ปิดการแสดงความคิดเห็น</span></span><input type="checkbox" class="switch" data-c="commentsOff" ${d.commentsOff ? 'checked' : ''}></label>
          <label class="row"><span class="row-tx"><span>ซ่อนยอดถูกใจ</span></span><input type="checkbox" class="switch" data-c="hideLikes" ${d.hideLikes ? 'checked' : ''}></label>` : ''}
        <p class="note">${I('shield', 14)} รูปที่อัปโหลดจะถูกลบข้อมูล EXIF และพิกัด GPS ก่อนบันทึก</p>
      </div>`;
      const draw = () => {
        root.innerHTML = `${M.bar(TITLES[d.type], `<button class="btn sm pri" data-e="publish" ${d.slides.length ? '' : 'disabled'}>แชร์</button>`, { close: true })}
          <div class="scroll"><div class="ed-wrap"><div class="ed-left">${stage()}${strip()}</div>
          <div class="ed-right">${d.slides.length ? `<div class="seg tools">${TOOLS[d.type].map(([k, ic, l]) => `<button class="${d.tool === k ? 'on' : ''}" data-e="tool" data-k="${k}">${I(ic, 18)}<span>${l}</span></button>`).join('')}</div><div class="ed-panel">${panel()}</div>` : ''}${details()}</div></div></div>`;
        wire();
        if (d.camOn && el._stream) root.querySelector('.ed-cam').srcObject = el._stream;
      };
      const addFiles = async files => {
        const max = d.type === 'post' ? 10 : 1;
        if (d.type !== 'post') d.slides = [];
        for (const f of files.slice(0, max - d.slides.length)) {
          if (f.type.startsWith('video')) {
            const key = M.saveVideo(f);
            const len = await new Promise(r => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => r(v.duration || 30); v.onerror = () => r(30); v.src = M.mem.videos[key]; });
            d.len = Math.round(len * 2) / 2; d.trim = [0, d.len];
            d.slides.push({ vid: key, video: true, art: { kind: 'abstract', seed: 5 }, overlays: [] });
          } else {
            try {
              const v = await M.adult.guard(f, 'post');
              if (!v) continue;
              const r = await M.sec.processImage(f);
              d.slides.push({ img: r.dataUrl, overlays: [], sensitive: v.verdict === 'sensitive' });
              if (r.exif) M.toast(r.gps ? 'พบพิกัด GPS ในรูป ลบออกแล้วก่อนอัปโหลด' : 'ลบข้อมูล EXIF ออกจากรูปแล้ว');
            } catch { M.toast('เปิดไฟล์นี้ไม่ได้'); }
          }
        }
        d.cur = d.slides.length - 1; draw();
      };
      function wire() {
        root.querySelectorAll('[data-f]').forEach(i => i.oninput = () => { d[i.dataset.f] = i.value; });
        root.querySelectorAll('[data-c]').forEach(i => i.onchange = () => { d[i.dataset.c] = i.checked; if (i.dataset.c === 'dub') draw(); });
        const rb = root.querySelector('[data-ringbox]');
        if (rb) M.wireRingPicker(rb, c => { st.me.ringColor = c; M.applyAppearance(); M.save(); draw(); });
        const sc = root.querySelector('[data-slidecap]'); if (sc) sc.oninput = () => { slide().caption = sc.value; };
        root.querySelectorAll('[data-trim]').forEach(r => r.oninput = () => { const k = +r.dataset.trim; d.trim[k] = +r.value; if (d.trim[0] > d.trim[1] - 1) d.trim[k] = k ? d.trim[0] + 1 : d.trim[1] - 1; draw(); });
        const scr = root.querySelector('[data-script]'); if (scr) scr.oninput = () => { d.script = scr.value; };
        const ps = root.querySelector('[data-pspeed]'); if (ps) ps.oninput = () => { d.promptSpeed = +ps.value; };
        const tf = root.querySelector('[data-txt]');
        if (tf) tf.onsubmit = e => { e.preventDefault(); const t = tf.t.value.trim(); if (!t) return; slide().overlays.push({ type: 'text', text: t, color: tf.c.value, x: 25, y: 40 }); draw(); };
        // ลากองค์ประกอบบนภาพ
        const stg = root.querySelector('[data-stage]');
        stg?.querySelectorAll('[data-ov]').forEach(ov => ov.onpointerdown = e => {
          e.preventDefault(); ov.setPointerCapture(e.pointerId);
          const r = stg.getBoundingClientRect(), o = slide().overlays[+ov.dataset.ov];
          let moved = false; const sx = e.clientX, sy = e.clientY;
          ov.onpointermove = ev => {
            if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) moved = true;
            o.x = M.clamp((ev.clientX - r.left) / r.width * 100 - 5, 0, 90); o.y = M.clamp((ev.clientY - r.top) / r.height * 100 - 3, 0, 94);
            ov.style.left = o.x + '%'; ov.style.top = o.y + '%';
          };
          ov.onpointerup = async () => {
            ov.onpointermove = null;
            if (!moved && await M.confirm('ลบองค์ประกอบนี้ไหม', '', 'ลบ', true)) { slide().overlays.splice(+ov.dataset.ov, 1); draw(); }
          };
        });
      }
      root.onclick = async e => {
        const b = e.target.closest('[data-e]'); if (!b) return;
        const k = b.dataset.e;
        if (k === 'upload') { const files = await M.pickFiles(d.type === 'post' ? 'image/*,video/*' : 'image/*,video/*', d.type === 'post'); if (files.length) addFiles(files); return; }
        if (k === 'sample') { if (d.type !== 'post') d.slides = []; if (d.slides.length >= 10) return M.toast('ใส่ได้สูงสุด 10 รายการ'); d.slides.push({ art: { kind: b.dataset.k, seed: Math.floor(Math.random() * 999) }, overlays: [], video: d.type === 'reel' }); d.cur = d.slides.length - 1; }
        if (k === 'sel') d.cur = +b.dataset.i;
        if (k === 'rm') { d.slides.splice(+b.dataset.i, 1); d.cur = Math.max(0, Math.min(d.cur, d.slides.length - 1)); }
        if (k === 'mv') { const i = +b.dataset.i; [d.slides[i - 1], d.slides[i]] = [d.slides[i], d.slides[i - 1]]; d.cur = i - 1; }
        if (k === 'tool') d.tool = b.dataset.k;
        if (k === 'filter') slide().filter = b.dataset.f === 'none' ? null : b.dataset.f;
        if (k === 'stk') slide().overlays.push({ type: 'sticker', i: +b.dataset.i, x: 35, y: 35 });
        if (k === 'locstk') { const t = await M.prompt('สติกเกอร์สถานที่', d.location, 'เช่น ตลาดน้อย'); if (t) slide().overlays.push({ type: 'loc', text: t, x: 30, y: 70 }); }
        if (k === 'musicstk') slide().overlays.push({ type: 'music', text: M.TRACKS.find(t => t.id === d.music).name, x: 25, y: 20 });
        if (k === 'addyours') { const t = await M.prompt('สติกเกอร์ Add Yours', d.addYours, 'ชวนเพื่อนเล่นต่อ เช่น วิวจากหน้าต่างวันนี้'); if (t) d.addYours = t; }
        if (k === 'music') d.music = d.music === b.dataset.id ? null : b.dataset.id;
        if (k === 'speed') d.speed = +b.dataset.v;
        if (k === 'aspect') d.aspect = b.dataset.v;
        if (k === 'aud') d.audience = b.dataset.v;
        if (k === 'collab') { const id = b.dataset.id; d.collab = d.collab.includes(id) ? d.collab.filter(x => x !== id) : d.collab.length >= 4 ? (M.toast('เชิญได้สูงสุด 4 บัญชี'), d.collab) : [...d.collab, id]; }
        if (k === 'prompt') { if (!d.script.trim()) return M.toast('ใส่บทพูดก่อน'); d.prompting = !d.prompting; }
        if (k === 'cam') {
          if (d.camOn) { el._stream?.getTracks().forEach(t => t.stop()); el._stream = null; d.camOn = false; }
          else { try { el._stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); d.camOn = true; } catch { M.toast('ไม่ได้รับอนุญาตใช้กล้อง'); } }
        }
        if (k === 'publish') return publish();
        draw();
      };
      const publish = () => {
        if (!d.slides.length) return;
        if (!M.sec.guard('publish', 5, 60000, 'โพสต์')) return;
        const now = Date.now();
        const tags = [...new Set(d.slides.map(s => KIND_TAG[s.art?.kind] || 'art'))];
        if (d.type === 'post') {
          const post = { id: M.uid('post'), userId: 'me', ts: now, slides: d.slides.map(s => ({ ...s })), caption: d.caption, location: d.location, collab: [], tags, sensitive: d.slides.some(s => s.sensitive), likes: 0, liked: false, saved: false, comments: [], aspect: d.aspect, commentsOff: d.commentsOff, hideLikes: d.hideLikes };
          st.posts.unshift(post); st.me.gridOrder.unshift(post.id);
          if (d.collab.length) { M.toast(`ส่งคำเชิญโพสต์ร่วมถึง ${d.collab.length} บัญชีแล้ว`); setTimeout(() => { post.collab = d.collab; M.toast(`${M.user(d.collab[0]).handle} ยอมรับคำเชิญโพสต์ร่วมแล้ว (จำลอง)`); M.refresh(); }, 3500); }
          fakeEngagement(post.id);
        } else if (d.type === 'story') {
          const s = d.slides[0];
          st.myStory.items.push({ id: M.uid('si'), ts: now, art: s.art, img: s.img, vid: s.vid, video: s.video, filter: s.filter, overlays: s.overlays, audience: d.audience, hidden: d.hidden || !!s.sensitive, sticker: d.addYours ? { type: 'addyours', prompt: d.addYours, count: 0 } : null, views: 0 });
          if (d.joinFrom) { const ps = st.stories.find(x => x.userId === d.joinFrom.uid); const it = ps?.items.find(x => x.id === d.joinFrom.id); if (it?.sticker) it.sticker.joined = true; }
          setTimeout(() => { const it = st.myStory.items[st.myStory.items.length - 1]; if (it) { it.views = 7; M.save(); } }, 5000);
        } else {
          const s = d.slides[0];
          const tr = d.music && M.TRACKS.find(t => t.id === d.music);
          st.reels.unshift({ id: M.uid('reel'), userId: 'me', art: s.art || { kind: 'abstract', seed: 1 }, vid: s.vid, img: s.img, caption: d.caption, audio: tr ? `${tr.name} · ${tr.artist}` : `เสียงต้นฉบับ · ${st.me.handle}`, likes: 0, liked: false, comments: [], shares: 0, ts: now, tags, trial: d.trial, dub: d.dub,
            sub: { th: d.script.split('\n')[0] || d.caption.slice(0, 50), en: '(คำบรรยายแปลอัตโนมัติ จำลอง)' }, long: d.longTitle ? { title: d.longTitle, min: M.clamp(+d.longMin || 10, 1, 90) } : null, trim: d.trim, speed: d.speed });
        }
        M.save();
        M.toast(d.type === 'story' ? 'แชร์สตอรี่แล้ว จะหายไปใน 24 ชั่วโมง' : d.type === 'reel' && d.trial ? 'แชร์ Trial Reels แล้ว แสดงเฉพาะคนที่ยังไม่ติดตาม' : 'แชร์แล้ว');
        const dest = d.type === 'reel' ? 'reels' : d.type === 'post' ? 'profile' : 'home';
        M.back(); setTimeout(() => M.go(dest), 320);
      };
      draw();
    },
    unmount(el) { el._stream?.getTracks().forEach(t => t.stop()); }
  };

  // จำลองคนกดถูกใจหลังโพสต์ใหม่
  function fakeEngagement(postId) {
    const ids = ['ploy', 'ton', 'nok', 'fah'];
    ids.forEach((uid, i) => setTimeout(() => {
      const p = M.findPost(postId); if (!p) return;
      p.likes++;
      M.st.notifications.unshift({ id: M.uid('n'), type: i === 2 ? 'comment' : 'like', userId: uid, postId, text: i === 2 ? 'สวยมาก' : '', ts: Date.now(), read: false });
      if (i === 2) p.comments.push({ id: M.uid('c'), userId: uid, text: 'สวยมาก', ts: Date.now(), likes: 0 });
      M.refresh();
    }, 5000 + i * 3500));
  }

  /* แก้ไขโพสต์หลังเผยแพร่: แคปชัน + แคปชันแต่ละสไลด์ + สลับลำดับรูป */
  M.Pages.editPost = {
    render(p) {
      const post = M.findPost(p.id);
      return M.bar('แก้ไขโพสต์', '<button class="link acc" data-act="savePostEdit">เสร็จ</button>') + `<div class="scroll"><form class="col pad form" data-ep>
        <label>คำบรรยาย<textarea class="field" name="cap" rows="3">${esc(post.caption)}</textarea></label>
        <label>สถานที่<input class="field" name="loc" value="${esc(post.location || '')}"></label>
        <h3 class="sec-t">สไลด์ (ลากลำดับด้วยปุ่มลูกศร)</h3>
        ${post.slides.map((s, i) => `<div class="ep-row"><span class="thumb">${M.media(s)}</span><input class="field" data-sc="${i}" value="${esc(s.caption || '')}" placeholder="แคปชันสไลด์ ${i + 1}">
          <button type="button" class="ibtn sm" data-act="slideMove" data-id="${post.id}" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="ขึ้น">${I('back', 16)}</button></div>`).join('')}
      </form></div>`;
    }
  };
  const collectEdit = () => {
    const f = M.$('[data-ep]'), post = M.findPost(M.topPage()._params.id);
    post.caption = f.cap.value; post.location = f.loc.value;
    f.querySelectorAll('[data-sc]').forEach(i => post.slides[+i.dataset.sc].caption = i.value);
    return post;
  };
  A.slideMove = el => { const post = collectEdit(), i = +el.dataset.i; [post.slides[i - 1], post.slides[i]] = [post.slides[i], post.slides[i - 1]]; M.renderPage(M.topPage()); };
  A.savePostEdit = () => { collectEdit(); M.toast('บันทึกการแก้ไขแล้ว'); M.back(); M.refresh(); };

  /* ---------- ถ่ายทอดสด ---------- */
  A.watchLive = el => M.push('live', { mode: 'watch', userId: el.dataset.id });
  const LIVE_C = ['สวัสดีครับ', 'ดูจากเชียงราย', 'ภาพชัดมาก', 'ขอเพลงหน่อย', 'สวยมาก', 'มาแล้วๆ', 'ขอบคุณที่ไลฟ์นะ', 'กดหัวใจรัวๆ', 'อยู่ที่ไหนคะ', 'คนเยอะไหม'];
  M.Pages.live = {
    cls: 'dark fade', static: true,
    render: () => '<div class="live-v"></div>',
    mount(el, p) {
      const st = M.st, root = el.querySelector('.live-v');
      const host = p.mode === 'host';
      const L = el._L = { phase: host ? 'setup' : 'live', title: '', aud: 'public', viewers: host ? 0 : (st.lives.find(l => l.userId === p.userId)?.viewers || 800), comments: [], peak: 0, sec: 0, guest: null, requests: [], pending: false, hearts: 0, cam: false };
      const hostU = host ? st.me : M.user(p.userId);
      const bgArt = host ? { kind: 'cafe', seed: 777 } : st.lives.find(l => l.userId === p.userId)?.art || { kind: 'market', seed: 1 };
      const draw = () => {
        if (L.phase === 'setup') {
          root.innerHTML = `${M.bar('ถ่ายทอดสด', '', { cls: 'dark', close: true })}<div class="live-setup">
            <div class="live-prev">${L.cam ? '<video autoplay playsinline muted></video>' : `<div class="art kb">${M.scene(bgArt.kind, bgArt.seed)}</div>`}</div>
            <input class="field d" placeholder="ตั้งชื่อไลฟ์" data-lt value="${esc(L.title)}" maxlength="60">
            <div class="seg d">${[['public', 'สาธารณะ'], ['close', 'เพื่อนสนิท'], ['practice', 'ซ้อมก่อน (เห็นคนเดียว)']].map(([v, l]) => `<button class="${L.aud === v ? 'on' : ''}" data-l="aud" data-v="${v}">${l}</button>`).join('')}</div>
            <div class="dlg-a"><button class="btn ghost-d" data-l="cam">${I('camera', 18)} ${L.cam ? 'ปิดกล้อง' : 'ใช้กล้องจริง'}</button><button class="btn pri" data-l="start">${I('live', 18)} เริ่มไลฟ์</button></div>
            <p class="muted small center">ต้นแบบนี้ไม่ส่งภาพออกไปจริง ผู้ชมและคอมเมนต์เป็นการจำลอง</p></div>`;
          root.querySelector('[data-lt]').oninput = e => L.title = e.target.value;
        } else if (L.phase === 'live') {
          root.innerHTML = `<div class="live-stage${L.guest ? ' split' : ''}">
              <div class="live-main">${host && L.cam ? '<video autoplay playsinline muted></video>' : `<div class="art kb">${M.scene(bgArt.kind, bgArt.seed)}</div>`}<span class="live-name">${esc(hostU.handle)}</span></div>
              ${L.guest ? `<div class="live-guest">${L.guest === 'me' && L.cam ? '<video autoplay playsinline muted></video>' : `<div class="art kb">${M.scene('city', M.hash(L.guest) % 99)}</div>`}<span class="live-name">${esc(M.user(L.guest).handle)}</span>${host ? `<button class="ibtn sm" data-l="kick" aria-label="นำออก">${I('x', 16)}</button>` : ''}</div>` : ''}
            </div>
            <div class="live-top">${M.avatar(hostU, 32)}<b>${esc(hostU.handle)}</b><span class="pill live-pill">LIVE</span><span class="pill">${I('eye', 14)} <span data-vw>${M.num(L.viewers)}</span></span><span class="muted" data-tm>${M.dur(L.sec)}</span><span class="sp"></span>
              <button class="ibtn" data-l="${host ? 'end' : 'leave'}" aria-label="${host ? 'จบไลฟ์' : 'ออก'}">${I('x')}</button></div>
            ${host && L.requests.length ? `<div class="live-req">${M.avatar(M.user(L.requests[0]), 32)}<span><b>${esc(M.user(L.requests[0]).handle)}</b> ขอร่วมไลฟ์</span><button class="btn sm pri" data-l="accept">ยอมรับ</button><button class="btn sm ghost-d" data-l="decline">ปฏิเสธ</button></div>` : ''}
            <div class="live-cm" data-cm>${L.comments.slice(-6).map(c => `<p><b>${esc(c.h)}</b> ${esc(c.t)}</p>`).join('')}</div>
            <form class="live-foot" data-lf><input class="field d" name="t" placeholder="แสดงความคิดเห็น" autocomplete="off">
              ${host ? '' : `<button type="button" class="btn sm ghost-d" data-l="join" ${L.pending || L.guest ? 'disabled' : ''}>${L.guest === 'me' ? 'กำลังร่วมไลฟ์' : L.pending ? 'ส่งคำขอแล้ว' : 'ขอร่วมไลฟ์'}</button>`}
              <button type="button" class="ibtn like" data-l="heart" aria-label="ส่งหัวใจ">${I('heart')}</button></form>
            <div class="hearts" data-hearts></div>`;
          root.querySelector('[data-lf]').onsubmit = e => { e.preventDefault(); const t = e.target.t.value.trim(); if (!t) return; if (!M.sec.guard('livecm', 5, 10000, 'คอมเมนต์')) return; if (M.sec.isHiddenWord(t)) return M.toast('ความคิดเห็นมีคำที่ถูกกรอง'); L.comments.push({ h: st.me.handle, t }); e.target.t.value = ''; drawComments(); };
        } else {
          root.innerHTML = `${M.bar('สรุปไลฟ์', '', { cls: 'dark', noBack: true })}<div class="live-setup"><div class="center">${M.bud('thanks', 80)}<h2>จบไลฟ์แล้ว</h2></div>
            <div class="stats3"><div><b>${M.num(L.peak)}</b><small>ผู้ชมสูงสุด</small></div><div><b>${L.comments.length}</b><small>ความคิดเห็น</small></div><div><b>${M.dur(L.sec)}</b><small>ระยะเวลา</small></div></div>
            <div class="dlg-a"><button class="btn ghost-d" data-l="discard">ไม่บันทึก</button><button class="btn pri" data-l="save">แชร์ลง Reels</button></div></div>`;
        }
        attachCam();
      };
      const attachCam = () => root.querySelectorAll('video').forEach(v => { if (el._stream) v.srcObject = el._stream; });
      const drawComments = () => { const cm = root.querySelector('[data-cm]'); if (cm) cm.innerHTML = L.comments.slice(-6).map(c => `<p><b>${esc(c.h)}</b> ${esc(c.t)}</p>`).join(''); };
      const tick = () => {
        if (L.phase !== 'live') return;
        L.sec++;
        L.viewers = Math.max(1, Math.round(L.viewers + (host ? Math.random() * 9 : (Math.random() - .45) * 15)));
        L.peak = Math.max(L.peak, L.viewers);
        if (Math.random() < .6) { const ids = Object.values(st.users).filter(u => !u.official); L.comments.push({ h: M.pick(ids).handle, t: M.pick(LIVE_C) }); drawComments(); }
        if (Math.random() < .3) heart();
        if (host && L.sec === 6 && !L.guest) { L.requests.push('ploy'); draw(); }
        const vw = root.querySelector('[data-vw]'); if (vw) vw.textContent = M.num(L.viewers);
        const tm = root.querySelector('[data-tm]'); if (tm) tm.textContent = M.dur(L.sec);
      };
      const heart = () => { const h = root.querySelector('[data-hearts]'); if (!h) return; const s = document.createElement('i'); s.innerHTML = I('heart', 22); s.style.left = (Math.random() * 30) + 'px'; h.appendChild(s); setTimeout(() => s.remove(), 2000); };
      el._iv = setInterval(tick, 1000);
      root.onclick = async e => {
        const b = e.target.closest('[data-l]'); if (!b) return;
        const k = b.dataset.l;
        if (k === 'aud') L.aud = b.dataset.v;
        if (k === 'cam') {
          if (L.cam) { el._stream?.getTracks().forEach(t => t.stop()); el._stream = null; L.cam = false; }
          else { try { el._stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); L.cam = true; } catch { M.toast('ไม่ได้รับอนุญาตใช้กล้อง'); } }
        }
        if (k === 'start') { L.phase = 'live'; L.viewers = L.aud === 'practice' ? 1 : 3; M.toast(L.aud === 'practice' ? 'โหมดซ้อม: ไม่มีใครเห็น' : 'เริ่มไลฟ์แล้ว ผู้ติดตามได้รับการแจ้งเตือน (จำลอง)'); }
        if (k === 'heart') { L.hearts++; heart(); return; }
        if (k === 'accept') { L.guest = L.requests.shift(); M.toast(`${M.user(L.guest).handle} เข้าร่วมไลฟ์แล้ว`); }
        if (k === 'decline') L.requests.shift();
        if (k === 'kick') L.guest = null;
        if (k === 'join') {
          L.pending = true; M.toast('ส่งคำขอร่วมไลฟ์แล้ว');
          setTimeout(async () => {
            L.pending = false; L.guest = 'me';
            try { el._stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); L.cam = true; } catch { L.cam = false; }
            M.toast(`${hostU.handle} ยอมรับคำขอของคุณแล้ว (จำลอง)`); draw();
          }, 2500);
        }
        if (k === 'end') { if (!await M.confirm('จบไลฟ์ไหม', '', 'จบไลฟ์', true)) return; L.phase = 'end'; el._stream?.getTracks().forEach(t => t.stop()); el._stream = null; L.cam = false; }
        if (k === 'leave') return M.back();
        if (k === 'discard') return M.back();
        if (k === 'save') {
          st.reels.unshift({ id: M.uid('reel'), userId: 'me', art: bgArt, caption: `ไลฟ์: ${L.title || 'ไลฟ์ของฉัน'}`, audio: `เสียงต้นฉบับ · ${st.me.handle}`, likes: L.hearts, comments: [], shares: 0, ts: Date.now(), tags: ['travel'], sub: { th: L.title, en: '' } });
          M.save(); M.toast('บันทึกไลฟ์ลง Reels แล้ว'); return M.back();
        }
        draw();
      };
      draw();
    },
    unmount(el) { clearInterval(el._iv); el._stream?.getTracks().forEach(t => t.stop()); M.refresh(); }
  };
})(window.M);
