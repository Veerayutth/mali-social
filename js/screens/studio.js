'use strict';
/* สตูดิโอ: กล้องเต็มจอ (โพสต์ / สตอรี่ / Instants / Reels), สติกเกอร์เคลื่อนไหวและ GIF ของคุณ,
   ตัวเลือกเพลงแบบมีแท็บ และสีบับเบิลโน้ต — ออกแบบใหม่ในสไตล์ของมะลิ */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;

  /* ---------------- สติกเกอร์เคลื่อนไหว ---------------- */
  M.ANIMS = { bounce: 'เด้ง', wiggle: 'ส่าย', float: 'ลอย', pulse: 'เต้น', spin: 'หมุน', shake: 'สั่น' };
  M.ANIM_STICKERS = [[0, 'bounce'], [1, 'pulse'], [2, 'shake'], [3, 'wiggle'], [4, 'float'], [5, 'wiggle'], [6, 'spin'], [7, 'bounce']];
  const baseSticker = M.sticker;
  M.sticker = (i, size = 96, anim) => {
    const html = baseSticker(i, size);
    return anim && M.ANIMS[anim] ? html.replace('class="stk"', `class="stk anim-${anim}"`) : html;
  };
  // GIF ของผู้ใช้ เก็บเป็น data URL ในเครื่อง ตรวจผ่านตัวกรอง 18+ ก่อน
  const safeImg = s => typeof s === 'string' && /^data:image\/(gif|png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : '';
  M.gifHTML = (src, size = 96) => safeImg(src) ? `<span class="gif-stk" style="--s:${size}px"><img src="${safeImg(src)}" alt="GIF"></span>` : '';
  M.addMyGif = async () => {
    const [f] = await M.pickFiles('image/gif,image/webp,image/png', false);
    if (!f) return null;
    if (f.size > 2 << 20) { M.toast('GIF ต้องไม่เกิน 2 MB'); return null; }
    const v = await M.adult.guard(f, 'avatar'); // สติกเกอร์ใช้ได้ทุกที่ จึงใช้เกณฑ์เดียวกับรูปสาธารณะ
    if (!v) return null;
    const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    if (!safeImg(data)) { M.toast('ไฟล์นี้ใช้เป็นสติกเกอร์ไม่ได้'); return null; }
    const st = M.st; st.myGifs = [data, ...(st.myGifs || []).filter(x => x !== data)].slice(0, 12); M.save();
    return data;
  };

  /* ---------------- เพลง ---------------- */
  // ชื่อเพลงและศิลปินสมมติทั้งหมด
  const MORE_TRACKS = [
    { id: 't6', name: 'ลมหนาวมาเยือน', artist: 'บ้านริมคลอง', len: '3:41', trend: 1 },
    { id: 't7', name: 'จักรยานคันเก่า', artist: 'ปลายฟ้า', len: '2:59', trend: 1 },
    { id: 't8', name: 'ดาวบนดาดฟ้า', artist: 'นครไลต์', len: '3:18' },
    { id: 't9', name: 'กาแฟแก้วที่สอง', artist: 'ทิวสน', len: '2:37', trend: 1 },
    { id: 't10', name: 'เดินเล่นริมทะเล', artist: 'วงลมเหนือ', len: '4:12' },
    { id: 't11', name: 'ฝันกลางวัน', artist: 'เด็กหลังห้อง', len: '3:05', trend: 1 },
    { id: 't12', name: 'ถนนสายเดิม', artist: 'บรรเลงกลางเมือง', len: '3:50' }
  ];
  MORE_TRACKS.forEach(t => { if (!M.TRACKS.some(x => x.id === t.id)) M.TRACKS.push(t); });
  /** เปิดตัวเลือกเพลง คืนค่า id ของเพลง ('' = ไม่ใส่เพลง, null = ยกเลิก) */
  M.pickMusic = (cur = '') => new Promise(res => {
    let tab = 'for', q = '', done = false;
    const st = M.st; st.savedTracks = st.savedTracks || [];
    const finish = v => { if (done) return; done = true; res(v); };
    const sh = M.sheet(`<div class="mp"><form class="searchf mp-s" data-ms>${I('search', 18)}<input class="field" name="q" placeholder="ค้นหาเพลงหรือศิลปิน" autocomplete="off" aria-label="ค้นหาเพลง"></form>
      <div class="chips hscroll mp-tabs">${[['for', 'สำหรับคุณ'], ['trend', 'กำลังมาแรง'], ['saved', 'บันทึกแล้ว'], ['orig', 'เสียงต้นฉบับ']].map(([k, l]) => `<button class="chip${k === tab ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="rows mp-list" data-list></div><p class="note">เพลงในต้นแบบเป็นชื่อสมมติ ไม่มีเสียงจริง</p></div>`, { title: 'เลือกเพลง', onClose: () => finish(null) });
    const list = sh.querySelector('[data-list]');
    const draw = () => {
      if (tab === 'orig') { list.innerHTML = `<button class="row" data-pick=""><span class="row-ic">${I('speaker', 22)}</span><span class="row-tx"><span>ใช้เสียงต้นฉบับ</span><small>ไม่ใส่เพลง ใช้เสียงจากวิดีโอของคุณ</small></span>${!cur ? I('check', 20, 'acc') : ''}</button>`; return; }
      let ts = M.TRACKS.filter(t => !q || (t.name + t.artist).toLowerCase().includes(q.toLowerCase()));
      if (tab === 'trend') ts = ts.filter(t => t.trend);
      if (tab === 'saved') ts = ts.filter(t => st.savedTracks.includes(t.id));
      list.innerHTML = ts.length ? ts.map(t => `<div class="row mp-row"><button class="mp-pick" data-pick="${t.id}"><span class="mp-art" style="--h:${M.hash(t.id) % 360}">${I('music', 18)}</span><span class="row-tx"><span>${esc(t.name)}</span><small>${esc(t.artist)} · ${t.len}</small></span>${cur === t.id ? I('check', 20, 'acc') : ''}</button>
        <button class="ibtn sm${st.savedTracks.includes(t.id) ? ' acc' : ''}" data-save="${t.id}" aria-label="${st.savedTracks.includes(t.id) ? 'เลิกบันทึก' : 'บันทึก'}" aria-pressed="${st.savedTracks.includes(t.id)}">${I('bookmark', 20)}</button></div>`).join('')
        : `<p class="empty">${tab === 'saved' ? 'ยังไม่ได้บันทึกเพลง แตะไอคอนบันทึกข้างเพลงที่ชอบ' : 'ไม่พบเพลง'}</p>`;
    };
    draw();
    const f = sh.querySelector('[data-ms]');
    f.q.oninput = () => { q = f.q.value.trim(); draw(); };
    f.onsubmit = e => e.preventDefault();
    sh.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; sh.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); draw(); }
      if (b.dataset.save) { const id = b.dataset.save; st.savedTracks = st.savedTracks.includes(id) ? st.savedTracks.filter(x => x !== id) : [id, ...st.savedTracks]; M.save(); draw(); }
      if (b.dataset.pick !== undefined) { finish(b.dataset.pick); M.closeSheet(); }
    };
  });

  /* ---------------- สีบับเบิลโน้ต ---------------- */
  M.NOTE_COLORS = [['', 'ปกติ'], ['#f6d365', 'เหลือง'], ['#ffd8a8', 'พีช'], ['#b2f2bb', 'มินต์'], ['#a5d8ff', 'ฟ้า'], ['#c4411a', 'ส้มอิฐ'], ['#1f1b16', 'หมึก']];
  const darkBg = c => ['#c4411a', '#1f1b16'].includes(c);
  M.noteStyle = n => n?.color && M.NOTE_COLORS.some(([c]) => c === n.color) ? ` style="background:${n.color};border-color:transparent;color:${darkBg(n.color) ? '#fff' : '#1f1b16'}"` : '';

  // ตัวแก้ไขโน้ต (แทนของเดิม): ข้อความ + สีบับเบิล + เพลงจากตัวเลือกเพลง + กลุ่มผู้ชม
  A.editNote = () => {
    const st = M.st, cur = st.me.note;
    let music = cur?.music || '', aud = cur?.aud || 'followers', color = cur?.color || '';
    const sh = M.sheet(`<div class="note-edit"><div class="note-prev"><span class="note-bub" data-prev>${esc(cur?.text || 'แบ่งปันความคิด…')}</span>${M.avatar(st.me, 72)}</div>
      <input class="field" maxlength="60" placeholder="แบ่งปันความคิด… (สูงสุด 60 ตัวอักษร)" value="${esc(cur?.text || '')}" data-t>
      <h3 class="sec-t">สีบับเบิล</h3><div class="note-colors" role="radiogroup" aria-label="สีบับเบิล">${M.NOTE_COLORS.map(([c, l]) => `<button role="radio" aria-checked="${c === color}" aria-label="${l}" class="${c === color ? 'on' : ''}" data-col="${c}" style="background:${c || 'var(--card)'}"></button>`).join('')}</div>
      <h3 class="sec-t">เพลง</h3><button class="row note-music" data-music><span class="row-ic">${I('music', 20)}</span><span class="row-tx"><span data-mname>${music ? esc(M.TRACKS.find(t => t.id === music)?.name || '') : 'เพิ่มเพลง'}</span></span>${I('chev', 18)}</button>
      <h3 class="sec-t">แชร์กับ</h3><div class="seg">${[['followers', 'ผู้ติดตามที่คุณติดตามกลับ'], ['close', 'เพื่อนสนิท']].map(([v, l]) => `<button class="${aud === v ? 'on' : ''}" data-a="${v}">${l}</button>`).join('')}</div>
      <p class="note">โน้ตจะแสดงเหนือรูปโปรไฟล์ในหน้าแชตเป็นเวลา 24 ชั่วโมง</p>
      <div class="dlg-a">${cur ? '<button class="btn sec" data-del>ลบโน้ต</button>' : ''}<button class="btn pri" data-save>แชร์</button></div></div>`, { title: cur ? 'แก้ไขโน้ต' : 'โน้ตใหม่' });
    const inp = sh.querySelector('[data-t]'), prev = sh.querySelector('[data-prev]');
    const paint = () => { prev.textContent = inp.value || (music ? '♪ ' + (M.TRACKS.find(t => t.id === music)?.name || '') : 'แบ่งปันความคิด…'); prev.setAttribute('style', (M.noteStyle({ color }).match(/style="([^"]*)"/) || [])[1] || ''); };
    paint();
    inp.oninput = paint;
    sh.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.col !== undefined) { color = b.dataset.col; sh.querySelectorAll('[data-col]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); paint(); }
      if (b.dataset.a) { aud = b.dataset.a; sh.querySelectorAll('[data-a]').forEach(x => x.classList.toggle('on', x.dataset.a === aud)); }
      if (b.hasAttribute('data-music')) {
        // เปิดตัวเลือกเพลงซ้อน แล้วกลับมาที่โน้ตพร้อมค่าที่เลือก
        const text = inp.value;
        const v = await M.pickMusic(music);
        if (v !== null) music = v;
        st.me._noteDraft = { text, color, aud, music };
        A.editNoteDraft();
      }
      if (b.hasAttribute('data-del')) { st.me.note = null; M.closeSheet(); M.refresh(); }
      if (b.hasAttribute('data-save')) { if (!inp.value.trim() && !music) return M.toast('พิมพ์ข้อความหรือเลือกเพลง'); st.me.note = { text: inp.value.trim(), music, aud, color, ts: Date.now() }; M.closeSheet(); M.toast('แชร์โน้ตแล้ว อยู่ได้ 24 ชั่วโมง'); M.refresh(); }
    };
  };
  // เปิดตัวแก้ไขโน้ตอีกครั้งพร้อมร่างเดิม (หลังกลับจากตัวเลือกเพลง)
  A.editNoteDraft = () => {
    const st = M.st, d = st.me._noteDraft; delete st.me._noteDraft;
    const real = st.me.note;
    st.me.note = { ...(real || {}), ...d, ts: real?.ts || Date.now() };
    A.editNote();
    st.me.note = real; // ยังไม่บันทึกจนกว่าจะกดแชร์
  };

  /* ---------------- กล้องเต็มจอ ---------------- */
  const MODES = [['post', 'โพสต์'], ['story', 'สตอรี่'], ['instant', 'Instants'], ['reel', 'Reels']];
  const TEXT_BGS = ['#c4411a', '#1f1b16', '#2f9e44', '#1971c2', '#f6d365', '#e8590c'];
  M.Pages.camera = {
    cls: 'dark fade', static: true,
    render(p) {
      const s = p.s || (p.s = { mode: p.mode || 'story', facing: 'user', filter: 'none', tool: '', flash: false, shots: [], textBg: 0 });
      const isText = s.tool === 'text';
      return `<div class="cam" data-cam>
        <div class="cam-view">${isText ? `<div class="cam-text" style="background:${TEXT_BGS[s.textBg]}"><textarea data-ctext maxlength="200" placeholder="พิมพ์อะไรสักอย่าง…" aria-label="ข้อความสตอรี่" style="color:${s.textBg === 4 ? '#1f1b16' : '#fff'}">${esc(s.text || '')}</textarea></div>`
          : `<video data-v autoplay playsinline muted class="${s.facing === 'user' ? 'mirror' : ''}" style="filter:${M.FILTERS[s.filter] || 'none'}"></video><div class="cam-off" hidden>${I('videoOff', 40)}<p>เปิดกล้องไม่ได้</p><small>อนุญาตการใช้กล้องในการตั้งค่าเบราว์เซอร์ หรือเลือกรูปจากเครื่องแทน</small></div>`}
          ${s.tool === 'layout' ? `<div class="cam-grid">${[0, 1, 2, 3].map(i => `<span>${s.shots[i] ? `<img src="${s.shots[i]}" alt="">` : ''}</span>`).join('')}</div>` : ''}
          <div class="cam-flash" hidden></div><div class="cam-rec" hidden><i></i><span data-rect>0:00</span></div>
        </div>
        <header class="cam-top"><button class="cbtn" data-c="close" aria-label="ปิดกล้อง">${I('x', 26)}</button>
          ${isText ? '' : `<button class="cbtn${s.flash ? ' on' : ''}" data-c="flash" aria-label="${s.flash ? 'ปิดแฟลช' : 'เปิดแฟลช'}" aria-pressed="${s.flash}">${I(s.flash ? 'sun' : 'moon', 24)}</button>`}
          <span class="cam-fname">${s.filter !== 'none' ? esc(M.FILTER_TH[s.filter]) : ''}</span></header>
        <nav class="cam-tools" aria-label="เครื่องมือกล้อง">
          <button data-c="text" class="${isText ? 'on' : ''}" aria-pressed="${isText}"><b>Aa</b><span>ข้อความ</span></button>
          ${s.mode === 'story' || s.mode === 'reel' ? `<button data-c="loop" class="${s.tool === 'loop' ? 'on' : ''}" aria-pressed="${s.tool === 'loop'}">${I('repost', 24)}<span>วนซ้ำ</span></button>` : ''}
          ${s.mode !== 'reel' ? `<button data-c="layout" class="${s.tool === 'layout' ? 'on' : ''}" aria-pressed="${s.tool === 'layout'}">${I('grid', 24)}<span>เลย์เอาต์</span></button>` : ''}
          <button data-c="fx">${I('filters', 24)}<span>เอฟเฟกต์</span></button>
          ${isText ? `<button data-c="bg"><i class="cam-swatch" style="background:${TEXT_BGS[(s.textBg + 1) % TEXT_BGS.length]}"></i><span>สีพื้น</span></button>` : ''}
        </nav>
        <div class="cam-bottom">
          <div class="cam-ctl">
            <button class="cam-gal" data-c="gallery" aria-label="เลือกจากคลังรูป">${I('image', 26)}</button>
            <button class="cam-shutter${s.mode === 'reel' ? ' rec' : ''}" data-shutter aria-label="${isText ? 'ใช้ข้อความนี้' : s.mode === 'reel' ? 'กดค้างเพื่ออัดวิดีโอ' : 'ถ่ายรูป (กดค้างเพื่ออัดวิดีโอ)'}">${isText ? I('check', 30) : ''}</button>
            <button class="cbtn" data-c="flip" aria-label="สลับกล้องหน้า/หลัง" ${isText ? 'disabled' : ''}>${I('flip', 26)}</button>
          </div>
          <div class="cam-modes" role="tablist">${MODES.map(([k, l]) => `<button role="tab" aria-selected="${s.mode === k}" class="${s.mode === k ? 'on' : ''}" data-mode="${k}">${l}</button>`).join('')}</div>
          <p class="cam-hint">${isText ? 'พิมพ์ข้อความแล้วแตะปุ่มตรงกลาง' : s.tool === 'loop' ? 'แตะเพื่อถ่ายวิดีโอสั้นที่เล่นไปกลับ' : s.tool === 'layout' ? `ถ่ายให้ครบ 4 ภาพ (${s.shots.length}/4)` : s.mode === 'reel' ? 'กดค้างเพื่ออัด ปล่อยเพื่อหยุด' : s.mode === 'instant' ? 'ถ่ายแล้วส่งให้เพื่อนดูได้ครั้งเดียว' : 'แตะเพื่อถ่าย กดค้างเพื่ออัดวิดีโอ'}</p>
        </div></div>`;
    },
    async mount(el, p) {
      const s = p.s;
      const v = el.querySelector('[data-v]');
      if (v) await startCam(el, s, v);
      const ta = el.querySelector('[data-ctext]');
      if (ta) { ta.oninput = () => { s.text = ta.value; }; setTimeout(() => ta.focus(), 100); }
      wire(el, p);
    },
    unmount(el) { stopCam(el); }
  };
  async function startCam(el, s, v) {
    if (el._stream && el._facing === s.facing) { v.srcObject = el._stream; return; }
    stopCam(el);
    try {
      el._stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: s.facing, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false });
      el._facing = s.facing; v.srcObject = el._stream;
    } catch {
      el.querySelector('.cam-off').hidden = false; v.hidden = true;
    }
  }
  function stopCam(el) { el._stream?.getTracks().forEach(t => t.stop()); el._stream = null; el._rec?.stop?.(); }

  // ถ่ายภาพจากวิดีโอเป็น data URL (กลับด้านภาพจากกล้องหน้าให้ตรงกับที่เห็น)
  function grab(el, s, max = 1440) {
    const v = el.querySelector('[data-v]');
    if (!v || !v.videoWidth) return null;
    const k = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
    const x = c.getContext('2d');
    if (s.facing === 'user') { x.translate(c.width, 0); x.scale(-1, 1); }
    x.drawImage(v, 0, 0, c.width, c.height);
    return c;
  }
  async function flash(el, s) {
    if (!s.flash) return;
    const track = el._stream?.getVideoTracks()[0];
    if (s.facing === 'environment' && track?.getCapabilities?.().torch) { try { await track.applyConstraints({ advanced: [{ torch: true }] }); await M.sleep(250); setTimeout(() => track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {}), 400); return; } catch {} }
    const f = el.querySelector('.cam-flash'); f.hidden = false; await M.sleep(180); setTimeout(() => { f.hidden = true; }, 250);
  }
  const toBlob = c => new Promise(r => c.toBlob(r, 'image/jpeg', .9));

  // ส่งผลลัพธ์ต่อไปยังตัวแก้ไขหรือแชต
  async function deliver(p, slide) {
    const mode = p.s.mode;
    if (slide.img) {
      const v = await M.adult.guard(await (await fetch(slide.img)).blob(), mode === 'instant' ? 'chat' : 'post');
      if (!v) return;
      slide.sensitive = v.verdict === 'sensitive';
    }
    if (p.s.filter !== 'none') slide.filter = p.s.filter;
    if (mode === 'instant') return sendInstant(slide);
    M.back();
    setTimeout(() => M.push('editor', { type: mode, fromPost: slide }), 320);
  }
  function sendInstant(slide) {
    if (!slide.img) return M.toast('Instants ส่งได้เฉพาะรูป');
    const friends = Object.values(M.st.users).filter(u => u.friend);
    M.menu(friends.map(u => ({ label: u.name, sub: '@' + u.handle, icon: 'send', act: () => {
      const c = M.ensureDM(u.id);
      M.sendMsg(c, { type: 'instant', img: slide.img, viewOnce: true });
      M.toast(`ส่ง Instants ให้ ${u.name} แล้ว ดูได้ครั้งเดียว`);
      M.back();
    } })), 'ส่ง Instants ให้');
  }

  // บันทึกวิดีโอจากกล้องด้วย MediaRecorder
  function recorder(stream) {
    const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const mimeType = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
    if (!mimeType) return null;
    return new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4e6 });
  }
  async function record(el, p, stopWhen) {
    const s = p.s;
    let stream = el._stream; if (!stream) return M.toast('เปิดกล้องไม่ได้');
    // ขอเสียงตอนอัดเท่านั้น ถ้าไม่ได้รับอนุญาตก็อัดภาพอย่างเดียว
    let mic = null;
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); stream = new MediaStream([...el._stream.getVideoTracks(), ...mic.getAudioTracks()]); } catch {}
    const rec = recorder(stream);
    if (!rec) { mic?.getTracks().forEach(t => t.stop()); return M.toast('เบราว์เซอร์นี้อัดวิดีโอไม่ได้'); }
    const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const max = s.mode === 'reel' ? 90 : 15, ui = el.querySelector('.cam-rec'), lbl = el.querySelector('[data-rect]');
    const t0 = Date.now(); ui.hidden = false; el.querySelector('[data-shutter]').classList.add('recording');
    const iv = setInterval(() => { const sec = (Date.now() - t0) / 1000; lbl.textContent = M.dur(sec); if (sec >= max) rec.stop(); }, 200);
    el._rec = rec;
    const done = new Promise(r => { rec.onstop = r; });
    rec.start(250);
    stopWhen(() => { if (rec.state === 'recording') rec.stop(); });
    await done;
    clearInterval(iv); mic?.getTracks().forEach(t => t.stop()); el._rec = null;
    ui.hidden = true; el.querySelector('[data-shutter]')?.classList.remove('recording');
    if ((Date.now() - t0) < 600) return M.toast('กดค้างนานขึ้นเพื่ออัดวิดีโอ');
    const type = rec.mimeType.split(';')[0];
    const file = new File(chunks, `mali-${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type });
    deliver(p, { vid: M.saveVideo(file), video: true, art: { kind: 'abstract', seed: 5 }, overlays: [] });
  }
  // วนซ้ำ: เก็บเฟรมสั้นๆ แล้วเล่นไปกลับเป็นวิดีโอ
  async function loop(el, p) {
    const frames = [];
    el.querySelector('.cam-rec').hidden = false;
    for (let i = 0; i < 14; i++) { const c = grab(el, p.s, 720); if (c) frames.push(c); await M.sleep(70); }
    el.querySelector('.cam-rec').hidden = true;
    if (frames.length < 4) return M.toast('ถ่ายไม่สำเร็จ');
    const out = document.createElement('canvas'); out.width = frames[0].width; out.height = frames[0].height;
    const ctx = out.getContext('2d');
    const rec = recorder(out.captureStream(30));
    if (!rec) return M.toast('เบราว์เซอร์นี้สร้างวิดีโอวนซ้ำไม่ได้');
    const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => { rec.onstop = r; });
    M.toast('กำลังสร้างวิดีโอวนซ้ำ…', { ms: 1500 });
    rec.start();
    const seq = [...frames, ...frames.slice(1, -1).reverse()];
    for (let n = 0; n < 3; n++) for (const f of seq) { ctx.drawImage(f, 0, 0); await M.sleep(45); }
    rec.stop(); await done;
    const type = rec.mimeType.split(';')[0];
    deliver(p, { vid: M.saveVideo(new File(chunks, `loop.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type })), video: true, art: { kind: 'abstract', seed: 7 }, overlays: [] });
  }
  // เลย์เอาต์ 2×2
  async function layoutShot(el, p) {
    const s = p.s, c = grab(el, s, 900); if (!c) return;
    await flash(el, s);
    s.shots.push(c.toDataURL('image/jpeg', .85));
    if (s.shots.length < 4) { M.renderPage(el); return; }
    const W = 1080, H = 1440, out = document.createElement('canvas'); out.width = W; out.height = H;
    const x = out.getContext('2d'); x.fillStyle = '#f7f4ee'; x.fillRect(0, 0, W, H);
    const imgs = await Promise.all(s.shots.map(src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; })));
    imgs.forEach((im, i) => {
      const cw = W / 2 - 6, ch = H / 2 - 6, cx = (i % 2) * (W / 2) + 3, cy = Math.floor(i / 2) * (H / 2) + 3;
      const k = Math.max(cw / im.width, ch / im.height), w = im.width * k, h = im.height * k;
      x.save(); x.beginPath(); x.rect(cx, cy, cw, ch); x.clip(); x.drawImage(im, cx + (cw - w) / 2, cy + (ch - h) / 2, w, h); x.restore();
    });
    s.shots = []; s.tool = '';
    deliver(p, { img: out.toDataURL('image/jpeg', .88), overlays: [] });
  }
  // สตอรี่ข้อความ: วาดข้อความลงพื้นสี
  function textStory(p) {
    const s = p.s, t = (s.text || '').trim();
    if (!t) return M.toast('พิมพ์ข้อความก่อน');
    const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = TEXT_BGS[s.textBg]; x.fillRect(0, 0, W, H);
    x.fillStyle = s.textBg === 4 ? '#1f1b16' : '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const font = getComputedStyle(document.body).fontFamily;
    let size = 96; x.font = `600 ${size}px ${font}`;
    // ตัดบรรทัดตามความกว้าง (ภาษาไทยไม่มีช่องว่าง จึงตัดทีละตัวอักษรเมื่อจำเป็น)
    const wrap = () => { const lines = []; for (const para of t.split('\n')) { let line = ''; for (const ch of Array.from(para)) { if (x.measureText(line + ch).width > W - 160) { lines.push(line); line = ch; } else line += ch; } lines.push(line); } return lines; };
    let lines = wrap(); while (lines.length * size * 1.3 > H - 400 && size > 40) { size -= 8; x.font = `600 ${size}px ${font}`; lines = wrap(); }
    lines.forEach((l, i) => x.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * size * 1.3));
    M.back();
    setTimeout(() => M.push('editor', { type: s.mode === 'reel' ? 'story' : s.mode === 'instant' ? 'story' : s.mode, fromPost: { img: c.toDataURL('image/jpeg', .9), overlays: [] } }), 320);
  }

  function wire(el, p) {
    const s = p.s;
    el.onclick = async e => {
      const b = e.target.closest('[data-c],[data-mode]'); if (!b) return;
      if (b.dataset.mode) { s.mode = b.dataset.mode; if (s.mode === 'reel' && s.tool === 'layout') s.tool = ''; if (s.mode !== 'story' && s.mode !== 'reel' && s.tool === 'loop') s.tool = ''; M.renderPage(el); return; }
      const k = b.dataset.c;
      if (k === 'close') return M.back();
      if (k === 'flash') s.flash = !s.flash;
      if (k === 'flip') { s.facing = s.facing === 'user' ? 'environment' : 'user'; stopCam(el); }
      if (k === 'text') s.tool = s.tool === 'text' ? '' : 'text';
      if (k === 'loop') s.tool = s.tool === 'loop' ? '' : 'loop';
      if (k === 'layout') { s.tool = s.tool === 'layout' ? '' : 'layout'; s.shots = []; }
      if (k === 'bg') s.textBg = (s.textBg + 1) % TEXT_BGS.length;
      if (k === 'fx') { const ks = Object.keys(M.FILTERS); s.filter = ks[(ks.indexOf(s.filter) + 1) % ks.length]; const vv = el.querySelector('[data-v]'); if (vv) { vv.style.filter = M.FILTERS[s.filter]; el.querySelector('.cam-fname').textContent = s.filter !== 'none' ? M.FILTER_TH[s.filter] : ''; } return; }
      if (k === 'gallery') {
        const [f] = await M.pickFiles(s.mode === 'instant' ? 'image/*' : 'image/*,video/*', false); if (!f) return;
        if (f.type.startsWith('video')) return deliver(p, { vid: M.saveVideo(f), video: true, art: { kind: 'abstract', seed: 5 }, overlays: [] });
        try { const r = await M.sec.processImage(f); return deliver(p, { img: r.dataUrl, overlays: [] }); } catch { return M.toast('เปิดไฟล์นี้ไม่ได้'); }
      }
      M.renderPage(el);
    };
    // ปุ่มชัตเตอร์: แตะ = ถ่ายรูป, กดค้าง = อัดวิดีโอ
    const sh = el.querySelector('[data-shutter]');
    let holdT = null, stopper = null, recording = false, skipClick = false;
    sh.onpointerdown = e => {
      e.preventDefault();
      if (s.tool === 'text' || s.tool === 'loop' || s.tool === 'layout' || s.mode === 'instant' || s.mode === 'post') return;
      holdT = setTimeout(() => { holdT = null; recording = true; record(el, p, fn => { stopper = fn; }); }, s.mode === 'reel' ? 0 : 350);
    };
    const up = async () => {
      if (holdT) { clearTimeout(holdT); holdT = null; }
      if (recording) { recording = false; skipClick = true; stopper?.(); return; }
    };
    sh.onpointerup = up; sh.onpointerleave = () => { if (recording) up(); };
    sh.onclick = async () => {
      if (skipClick) { skipClick = false; return; }
      if (recording || s.mode === 'reel' && s.tool !== 'text' && s.tool !== 'loop') return;
      if (s.tool === 'text') return textStory(p);
      if (s.tool === 'loop') return loop(el, p);
      if (s.tool === 'layout') return layoutShot(el, p);
      const c = grab(el, s); if (!c) return M.toast('กล้องยังไม่พร้อม');
      await flash(el, s);
      deliver(p, { img: c.toDataURL('image/jpeg', .9), overlays: [] });
    };
    // ปัดซ้าย/ขวาเพื่อเปลี่ยนโหมด
    let sx = null;
    const view = el.querySelector('.cam-view');
    view.onpointerdown = e => { sx = e.clientX; };
    view.onpointerup = e => {
      if (sx == null || s.tool === 'text') return;
      const dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) < 60) return;
      const i = MODES.findIndex(m => m[0] === s.mode), j = M.clamp(i + (dx < 0 ? 1 : -1), 0, MODES.length - 1);
      if (i !== j) { s.mode = MODES[j][0]; M.renderPage(el); }
    };
  }
  /* ---------------- เปลี่ยนชื่อผู้ใช้ ----------------
     กติกาเดียวกันทั้งบัญชีในเครื่องและบัญชีออนไลน์: เปลี่ยนได้ 5 ครั้งใน 30 นาที
     และชื่อเดิมถูกกันไว้ให้คุณเปลี่ยนกลับได้ภายใน 14 วัน */
  const RES_MS = 14 * 864e5, WIN_MS = 30 * 60e3, MAXC = 5;
  const fmtOk = h => /^[a-z0-9_.]{3,30}$/.test(h) && !/^\.|\.$|\.\./.test(h);
  const localInfo = () => {
    const me = M.st.me, log = (me.handleLog || []).filter(x => Date.now() - x.ts < RES_MS);
    const prev = log.at(-1);
    return { handle: me.handle, previous: prev && prev.old !== me.handle ? { handle: prev.old, until: prev.ts + RES_MS } : null, left: Math.max(0, MAXC - log.filter(x => Date.now() - x.ts < WIN_MS).length) };
  };
  const localTaken = h => Object.values(M.st.users).some(u => u.handle.toLowerCase() === h);
  M.Pages.changeHandle = {
    render(p) {
      const i = p.info;
      if (!i) return M.bar('ชื่อผู้ใช้') + '<div class="scroll"><p class="muted center pad">กำลังโหลด…</p></div>';
      const v = p.value ?? i.handle;
      return M.bar('ชื่อผู้ใช้', `<button class="link acc" data-act="saveHandle" ${p.ok === false || v === i.handle ? 'disabled' : ''}>เสร็จแล้ว</button>`) + `<div class="scroll"><form class="col pad form ch-form" data-chf>
        <label class="ch-field"><span>ชื่อผู้ใช้</span><span class="ch-in"><input class="field" name="h" value="${esc(v)}" maxlength="30" autocapitalize="off" autocomplete="off" spellcheck="false" translate="no" aria-describedby="chMsg">
          <button type="button" class="ibtn sm" data-act="clearHandle" aria-label="ล้าง">${I('x', 16)}</button></span></label>
        <p id="chMsg" class="ch-msg ${p.ok === false ? 'neg' : p.ok ? 'pos' : ''}" role="status">${p.msg ? esc(p.msg) : ''}</p>
        ${i.previous ? `<p class="note">เปลี่ยนกลับเป็น <b translate="no">${esc(i.previous.handle)}</b> ได้ถึง ${new Date(i.previous.until).toLocaleDateString(M.locale(), { day: 'numeric', month: 'short' })} ช่วงนี้คนอื่นใช้ชื่อนี้ไม่ได้ <button type="button" class="link acc" data-act="revertHandle">ใช้ชื่อเดิม</button></p>`
          : `<p class="note">หลังเปลี่ยน คุณจะเปลี่ยนกลับเป็น <b translate="no">${esc(i.handle)}</b> ได้ภายใน 14 วัน และช่วงนั้นคนอื่นใช้ชื่อนี้ไม่ได้</p>`}
        <p class="note">แก้ไขชื่อผู้ใช้ได้สูงสุด 5 ครั้งใน 30 นาที (เหลือ ${i.left} ครั้ง)</p>
        <p class="note">ลิงก์โปรไฟล์และการพูดถึง @ ชื่อเดิมจะไม่พาไปที่โปรไฟล์คุณอีก</p></form></div>`;
    },
    mount(el, p) {
      if (!p.info) { (p.online ? M.cloud.api('GET', '/me/handle') : Promise.resolve(localInfo())).then(i => { p.info = i; M.renderPage(el); }).catch(e => { M.toast(e.message); M.back(); }); return; }
      const inp = el.querySelector('[data-chf] input');
      const check = M.debounce(async () => {
        const h = inp.value.trim().toLowerCase().replace(/^@/, ''); p.value = h;
        if (h === p.info.handle) { p.ok = null; p.msg = ''; }
        else if (!fmtOk(h)) { p.ok = false; p.msg = 'ใช้ได้เฉพาะ a-z 0-9 _ . ยาว 3–30 ตัว และห้ามขึ้นต้นหรือลงท้ายด้วยจุด'; }
        else if (p.online) { try { const r = await M.cloud.api('GET', '/handle-available?h=' + encodeURIComponent(h)); p.ok = r.ok; p.msg = r.ok ? 'ใช้ชื่อนี้ได้' : 'ชื่อนี้มีคนใช้แล้ว'; } catch (e) { p.ok = null; p.msg = e.message; } }
        else { p.ok = !localTaken(h); p.msg = p.ok ? 'ใช้ชื่อนี้ได้' : 'ชื่อนี้มีคนใช้แล้ว'; }
        const pos = inp.selectionStart; M.renderPage(el); const i2 = el.querySelector('[data-chf] input'); i2.focus(); i2.setSelectionRange(pos, pos);
      }, 350);
      inp.oninput = check;
      el.querySelector('[data-chf]').onsubmit = e => { e.preventDefault(); A.saveHandle(); };
    }
  };
  A.openChangeHandle = el => M.push('changeHandle', { online: el?.dataset?.online === '1' });
  A.clearHandle = () => { const pg = M.topPage(); pg._params.value = ''; pg._params.ok = false; pg._params.msg = ''; M.renderPage(pg); pg.querySelector('[data-chf] input').focus(); };
  A.revertHandle = () => { const pg = M.topPage(); pg._params.value = pg._params.info.previous.handle; pg._params.ok = true; pg._params.msg = 'ใช้ชื่อเดิมได้'; M.renderPage(pg); };
  A.saveHandle = async () => {
    const pg = M.topPage(), p = pg._params, h = (p.value ?? '').toLowerCase();
    if (!h || h === p.info.handle) return;
    if (!fmtOk(h)) return M.toast('ชื่อผู้ใช้ไม่ถูกต้อง');
    if (p.online) {
      try { const d = await M.cloud.api('POST', '/me/handle', { handle: h }); M.cloud.me = d.user; }
      catch (e) { return M.toast(e.message); }
    } else {
      const i = localInfo();
      if (!i.left) return M.toast('เปลี่ยนชื่อผู้ใช้ได้สูงสุด 5 ครั้งใน 30 นาที ลองใหม่ภายหลัง');
      if (localTaken(h)) return M.toast('ชื่อนี้มีคนใช้แล้ว');
      const me = M.st.me; me.handleLog = [...(me.handleLog || []), { old: me.handle, new: h, ts: Date.now() }].slice(-20); me.handle = h;
    }
    M.toast(`เปลี่ยนชื่อผู้ใช้เป็น @${h} แล้ว`); M.back(); M.refresh();
  };

  A.openCamera = el => M.push('camera', { mode: el?.dataset?.mode || 'story' });
})(window.M);
