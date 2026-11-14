'use strict';
/* เมนู ≡ : ความเป็นส่วนตัว การโต้ตอบ สิ่งที่บันทึก คลังสตอรี่ แดชบอร์ดมืออาชีพ บัญชีวัยรุ่น เกี่ยวกับต้นแบบ */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;
  const AUD = [['everyone', 'ทุกคน'], ['followers', 'คนที่คุณติดตาม'], ['off', 'ไม่มีใคร']];

  M.Pages.menu = {
    render() {
      const st = M.st, s = st.settings;
      return M.bar('การตั้งค่าและกิจกรรม') + `<div class="scroll"><div class="col">
        <div class="pad"><input class="field" placeholder="ค้นหาการตั้งค่า" data-ms></div>
        <div data-mlist>${M.rows([
          { t: 'head', label: 'บัญชีของคุณ' },
          { t: 'nav', label: 'ศูนย์บัญชี', sub: 'รหัสผ่าน ความปลอดภัย ข้อมูลส่วนตัว', icon: 'user', page: 'security' },
          { t: 'head', label: 'วิธีที่คุณใช้มะลิ' },
          { t: 'nav', label: 'รายการที่บันทึกไว้', icon: 'bookmark', page: 'saved', value: st.saved.length || '' },
          { t: 'nav', label: 'คลังข้อมูล', sub: 'สตอรี่เก่าที่หมดอายุแล้ว', icon: 'archive', page: 'archive' },
          { t: 'nav', label: 'อัลกอริทึมของคุณ', sub: 'เลือกหัวข้อที่อยากเห็นมากขึ้นหรือน้อยลง', icon: 'tune', act: 'algorithm' },
          { t: 'toggle', k: 'settings.notifPause', label: 'หยุดการแจ้งเตือนทั้งหมดชั่วคราว', icon: 'bellOff' },
          { t: 'nav', label: 'เวลาที่ใช้', sub: s.dailyLimit ? `จำกัด ${s.dailyLimit} นาทีต่อวัน` : 'ตั้งเวลาเตือนให้พัก', icon: 'hourglass', page: 'family' },
          { t: 'head', label: 'สำหรับครีเอเตอร์และธุรกิจ' },
          { t: 'nav', label: 'แดชบอร์ดมืออาชีพ', sub: 'สถิติ ผู้ติดตาม เครื่องมือสร้างรายได้', icon: 'chart', page: 'dashboard' },
          { t: 'nav', label: 'ช่องบรอดแคสต์ของคุณ', sub: st.channel ? 'เปิดช่อง' : 'ส่งข้อความทางเดียวถึงผู้ติดตามจำนวนมาก', icon: 'megaphone', act: 'myChannel' },
          { t: 'head', label: 'ใครมองเห็นเนื้อหาของคุณ' },
          { t: 'nav', label: 'ความเป็นส่วนตัวของบัญชี', icon: 'lock', page: 'privacy', value: s.private ? 'ส่วนตัว' : 'สาธารณะ' },
          { t: 'nav', label: 'เพื่อนสนิท', icon: 'star', page: 'peopleList', params: { kind: 'closeFriends' }, value: st.closeFriends.length },
          { t: 'nav', label: 'บล็อกแล้ว', icon: 'ban', page: 'peopleList', params: { kind: 'blocked' }, value: st.blocked.length || '' },
          { t: 'nav', label: 'แผนที่เพื่อนและตำแหน่ง', icon: 'map', page: 'friendsMap' },
          { t: 'head', label: 'วิธีที่ผู้อื่นโต้ตอบกับคุณ' },
          { t: 'nav', label: 'ข้อความและการตอบกลับสตอรี่', icon: 'chat', page: 'interactions', params: { sec: 'messages' } },
          { t: 'nav', label: 'แท็กและการพูดถึง', icon: 'tag', page: 'interactions', params: { sec: 'tags' } },
          { t: 'nav', label: 'ความคิดเห็นและคำที่ซ่อน', icon: 'comment', page: 'interactions', params: { sec: 'comments' } },
          { t: 'nav', label: 'บัญชีที่จำกัด', icon: 'minus', page: 'peopleList', params: { kind: 'restricted' }, value: st.restricted.length || '' },
          { t: 'nav', label: 'บัญชีที่ปิดเสียง', icon: 'bellOff', page: 'peopleList', params: { kind: 'muted' }, value: st.muted.length || '' },
          { t: 'head', label: 'สิ่งที่คุณเห็น' },
          { t: 'toggle', k: 'settings.hideLikesOthers', label: 'ซ่อนยอดถูกใจในโพสต์ของคนอื่น', icon: 'eyeOff' },
          { t: 'choice', k: 'settings.adultFilter', label: 'ตัวกรองภาพ 18+', sub: 'ตรวจรูปก่อนอัปโหลดด้วยโมเดลในเครื่อง ปิดไม่ได้', icon: 'shieldCheck', options: [['standard', 'มาตรฐาน'], ['strict', 'เข้มงวด']] },
          { t: 'choice', k: 'settings.sensitive', label: 'เนื้อหาที่ละเอียดอ่อน', icon: 'shield', options: [['more', 'แสดงมากขึ้น'], ['standard', 'มาตรฐาน'], ['less', 'แสดงน้อยลง']] },
          { t: 'toggle', k: 'settings.autoDub', label: 'พากย์ Reels เป็นภาษาอื่นอัตโนมัติ', sub: 'จำลองการแปลเสียงพูดด้วย AI', icon: 'translate' },
          { t: 'head', label: 'ความปลอดภัยและครอบครัว' },
          { t: 'nav', label: 'ศูนย์ความปลอดภัย', sub: 'ตรวจสอบความปลอดภัย 2FA อุปกรณ์ที่เข้าสู่ระบบ', icon: 'shieldCheck', page: 'security' },
          { t: 'nav', label: 'บัญชีวัยรุ่นและการดูแลโดยผู้ปกครอง', icon: 'family', page: 'family' },
          { t: 'head', label: 'แอปและสื่อ' },
          { t: 'nav', label: 'แอปและเว็บไซต์ที่เชื่อมต่อ', icon: 'link', page: 'apps' },
          { t: 'nav', label: 'ภาษา', icon: 'translate', page: 'language', value: (M.LANGS.find(l => l[0] === (s.lang || 'th')) || M.LANGS[0])[1] },
          { t: 'nav', label: 'ฟอนต์และขนาดตัวอักษร', icon: 'type', page: 'fonts', value: (M.FONTS.find(f => f[0] === (s.font || 'Anuphan')) || M.FONTS[0])[1].split(' (')[0] },
          { t: 'nav', label: 'สีวงสตอรี่', sub: 'สีของวงรอบรูปโปรไฟล์เมื่อคุณลงสตอรี่', icon: 'star', page: 'ringColor' },
          { t: 'choice', k: 'settings.theme', label: 'ธีม', icon: 'moon', options: [['light', 'สว่าง'], ['dark', 'มืด'], ['system', 'ตามระบบ']] },
          { t: 'head', label: 'ข้อมูลและแอป' },
          { t: 'nav', label: 'ติดตั้งมะลิลงเครื่อง', sub: 'เปิดจากหน้าจอหลักและใช้แบบออฟไลน์ได้', icon: 'upload', act: 'installApp' },
          { t: 'nav', label: 'สำรองข้อมูลเป็นไฟล์', sub: 'โพสต์ แชต รูป วิดีโอ และการตั้งค่า ใช้ย้ายไปเครื่องอื่นได้', icon: 'archive', act: 'backupData' },
          { t: 'nav', label: 'กู้คืนจากไฟล์สำรอง', icon: 'undo', act: 'restoreData' },
          { t: 'head', label: 'ช่วยเหลือ' },
          { t: 'nav', label: 'ให้น้องตูมแนะนำการใช้งานอีกครั้ง', icon: 'info', act: 'resetTips' },
          { t: 'nav', label: 'เกี่ยวกับต้นแบบนี้และข้อจำกัด', icon: 'info', page: 'about' },
          { t: 'nav', label: 'รีเซ็ตข้อมูลตัวอย่าง', icon: 'undo', act: 'resetData' },
          { t: 'nav', label: 'ออกจากระบบ', icon: 'logout', act: 'logout' }
        ])}</div></div></div>`;
    },
    mount(el) {
      el.querySelector('[data-ms]').oninput = e => {
        const q = e.target.value.trim();
        el.querySelectorAll('[data-mlist] .row').forEach(r => r.hidden = q && !r.textContent.includes(q));
        el.querySelectorAll('[data-mlist] .sec-t').forEach(h => h.hidden = !!q);
      };
    }
  };
  A.resetTips = () => { M.st.tips = {}; M.toast('น้องตูมจะกลับมาแนะนำในแต่ละหน้า'); M.refresh(); };
  /* ---------- ติดตั้งแอป ---------- */
  A.installApp = async () => {
    if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) return M.toast('คุณกำลังใช้มะลิแบบแอปที่ติดตั้งแล้ว');
    if (M.installPrompt) { M.installPrompt.prompt(); const r = await M.installPrompt.userChoice; M.installPrompt = null; if (r.outcome !== 'accepted') M.toast('ยกเลิกการติดตั้ง'); return; }
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const file = location.protocol === 'file:';
    M.sheet(`<div class="dlg"><h2>ติดตั้งมะลิลงเครื่อง</h2>
      ${file ? `<p class="muted">ตอนนี้เปิดจากไฟล์โดยตรง ซึ่งติดตั้งเป็นแอปไม่ได้ ให้เปิดผ่านเว็บเซิร์ฟเวอร์ก่อน เช่นรันคำสั่ง <code>python3 -m http.server 5173</code> ในโฟลเดอร์แอป แล้วเปิด localhost:5173 หรืออัปโหลดขึ้นโฮสต์ฟรีอย่าง GitHub Pages</p>`
        : ios ? `<p class="muted">ใน Safari แตะปุ่มแชร์ แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"</p>`
        : `<p class="muted">เปิดเมนูของเบราว์เซอร์ แล้วเลือก "ติดตั้งแอป" หรือ "เพิ่มไปยังหน้าจอหลัก" ถ้าไม่เห็นตัวเลือกนี้ แปลว่าเบราว์เซอร์ยังไม่รองรับ</p>`}
      <div class="dlg-a"><button class="btn pri" data-act="closeSheet">เข้าใจแล้ว</button></div></div>`);
  };

  /* ---------- สำรองและกู้คืนข้อมูล (ฟรี ไม่ต้องมีเซิร์ฟเวอร์) ---------- */
  const blobToData = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  A.backupData = async () => {
    M.toast('กำลังเตรียมไฟล์สำรอง…');
    const files = {};
    try { for (const k of await M.idb.keys()) { if (k === 'state') continue; const v = await M.idb.get(k); if (v instanceof Blob) files[k] = await blobToData(v); } } catch (e) {}
    const data = { app: 'mali', format: 1, exported: new Date().toISOString(), state: M.st, files };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `mali-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    M.toast(`สร้างไฟล์สำรองแล้ว (${(blob.size / 1048576).toFixed(1)} MB) ไฟล์นี้มีข้อมูลส่วนตัว เก็บไว้ให้ดี`, { ms: 5000 });
  };
  A.restoreData = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      let data;
      try { data = JSON.parse(await f.text()); } catch (e) { return M.toast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของมะลิ'); }
      if (data?.app !== 'mali' || !data.state?.me || !Array.isArray(data.state.posts)) return M.toast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของมะลิ');
      if (!(await M.confirm('กู้คืนข้อมูลจากไฟล์นี้ไหม', `สำรองไว้เมื่อ ${new Date(data.exported).toLocaleString(M.locale())} ข้อมูลปัจจุบันในเครื่องนี้จะถูกแทนที่`, 'กู้คืน', true))) return;
      try {
        for (const [k, v] of Object.entries(data.files || {})) {
          if (!/^(v_|banner_)[\w-]+$/.test(k) || typeof v !== 'string' || !v.startsWith('data:')) continue; // รับเฉพาะคีย์และชนิดที่แอปสร้าง
          await M.idb.put(k, await (await fetch(v)).blob());
        }
        M.store.state = data.state; await M.store.saveNow();
        location.reload();
      } catch (e) { M.toast('กู้คืนไม่สำเร็จ'); }
    };
    inp.click();
  };
  A.resetData = async () => { if (await M.confirm('รีเซ็ตข้อมูลทั้งหมดไหม', 'โพสต์ แชต และการตั้งค่าที่คุณทำในเครื่องนี้จะหายไป', 'รีเซ็ต', true)) M.store.reset(); };

  /* ความเป็นส่วนตัวของบัญชี */
  M.onToggle['settings.private'] = v => {
    if (v && M.st.me.type !== 'personal') {
      M.confirm('ต้องสลับเป็นบัญชีส่วนบุคคลก่อน', 'บัญชีครีเอเตอร์และธุรกิจตั้งเป็นส่วนตัวไม่ได้ ต้องการสลับเป็นบัญชีส่วนบุคคลแล้วตั้งเป็นส่วนตัวไหม', 'สลับและตั้งเป็นส่วนตัว').then(ok => {
        if (ok) { M.st.me.type = 'personal'; M.st.settings.private = true; M.toast('สลับเป็นบัญชีส่วนบุคคลและตั้งเป็นส่วนตัวแล้ว'); M.refresh(); }
      });
      return false;
    }
    if (M.st.settings.teen && !v) { M.toast('บัญชีวัยรุ่นต้องเป็นบัญชีส่วนตัว'); return false; }
    setTimeout(() => M.toast(v ? 'บัญชีเป็นส่วนตัวแล้ว เฉพาะผู้ติดตามที่คุณอนุมัติเห็นโพสต์และสตอรี่' : 'บัญชีเป็นสาธารณะแล้ว'), 50);
  };
  M.Pages.privacy = {
    render() {
      const st = M.st, pro = st.me.type !== 'personal';
      return M.bar('ความเป็นส่วนตัวของบัญชี') + `<div class="scroll"><div class="col pad">${M.rows([
        { t: 'toggle', k: 'settings.private', label: 'บัญชีส่วนตัว', sub: pro ? 'บัญชีมืออาชีพต้องสลับเป็นบัญชีส่วนบุคคลก่อน' : 'เฉพาะคนที่คุณอนุมัติเท่านั้นที่เห็นโพสต์ สตอรี่ และรายชื่อผู้ติดตาม', icon: 'lock' },
        { t: 'note', text: 'เมื่อเป็นบัญชีส่วนตัว คนที่ติดตามอยู่แล้วจะยังติดตามต่อ ส่วนคนใหม่ต้องส่งคำขอ คำขอจะแสดงในหน้าการแจ้งเตือน' },
        { t: 'toggle', k: 'settings.activityStatus', label: 'แสดงสถานะการใช้งาน', sub: 'เมื่อปิด คุณจะไม่เห็นสถานะของคนอื่นเช่นกัน และจุดสีเขียวจะหายไป', icon: 'clock' },
        { t: 'nav', label: 'เพื่อนสนิท', sub: 'คนที่เห็นสตอรี่และโน้ตแบบเพื่อนสนิท', icon: 'star', page: 'peopleList', params: { kind: 'closeFriends' } },
        pro && { t: 'nav', label: 'สลับประเภทบัญชี', sub: 'ไปที่แดชบอร์ดมืออาชีพ', icon: 'user', page: 'dashboard' }
      ])}</div></div>`;
    }
  };
  M.Pages.interactions = {
    render(p) {
      const T = { messages: 'ข้อความและการตอบกลับสตอรี่', tags: 'แท็กและการพูดถึง', comments: 'ความคิดเห็นและคำที่ซ่อน' };
      const st = M.st;
      let rows;
      if (p.sec === 'messages') rows = [
        { t: 'choice', k: 'settings.messagesFrom', label: 'ใครส่งข้อความหาคุณได้', icon: 'chat', options: [['everyone', 'ทุกคน (คนที่ไม่ติดตามจะไปที่คำขอ)'], ['followers', 'ผู้ติดตามเท่านั้น'], ['off', 'ไม่มีใคร']] },
        { t: 'choice', k: 'settings.storyReplies', label: 'ใครตอบกลับสตอรี่ได้', icon: 'comment', options: AUD },
        { t: 'toggle', k: 'settings.readReceipts', label: 'แสดงว่าอ่านแล้ว', sub: 'ลดความกดดันในการตอบแชต เมื่อปิด คุณจะไม่เห็นสถานะอ่านของคนอื่นเช่นกัน', icon: 'check2' },
        { t: 'toggle', k: 'settings.activityStatus', label: 'แสดงสถานะการใช้งาน', icon: 'clock' },
        { t: 'toggle', k: 'settings.nudityProtect', label: 'ป้องกันภาพไม่เหมาะสม', sub: 'เบลอรูปที่อาจเป็นภาพโป๊เปลือยในข้อความอัตโนมัติ', icon: 'eyeOff' },
        { t: 'toggle', k: 'settings.linkScan', label: 'ตรวจลิงก์อันตรายในแชต', sub: 'เตือนก่อนเปิดเว็บหลอกลวงหรือมัลแวร์', icon: 'link' },
        { t: 'note', text: 'เคล็ดลับ: พิมพ์ @silent นำหน้าข้อความเพื่อส่งแบบเงียบ แตะข้อความของคุณเพื่อแก้ไขภายใน 60 นาที' }
      ];
      if (p.sec === 'tags') rows = [
        { t: 'choice', k: 'settings.tagsFrom', label: 'ใครแท็กคุณได้', icon: 'tag', options: AUD },
        { t: 'toggle', k: 'settings.tagApproval', label: 'อนุมัติแท็กด้วยตัวเอง', sub: 'โพสต์ที่แท็กคุณจะไม่แสดงบนโปรไฟล์จนกว่าคุณจะอนุมัติ', icon: 'check' },
        { t: 'choice', k: 'settings.mentionsFrom', label: 'ใครพูดถึงคุณได้', icon: 'user', options: AUD }
      ];
      if (p.sec === 'comments') rows = [
        { t: 'choice', k: 'settings.commentsFrom', label: 'อนุญาตความคิดเห็นจาก', icon: 'comment', options: [['everyone', 'ทุกคน'], ['followers', 'ผู้ติดตาม'], ['off', 'ปิดทุกโพสต์ใหม่']] },
        { t: 'toggle', k: 'settings.hiddenDefault', label: 'ซ่อนความคิดเห็นที่อาจไม่เหมาะสม', sub: 'กรองคำหยาบและสแปมที่พบบ่อยอัตโนมัติ', icon: 'shield' },
        { t: 'toggle', k: 'settings.hideLikesMine', label: 'ซ่อนยอดถูกใจในโพสต์ใหม่ของคุณ', icon: 'eyeOff' }
      ];
      return M.bar(T[p.sec]) + `<div class="scroll"><div class="col pad">${M.rows(rows)}
        ${p.sec === 'comments' ? `<h3 class="sec-t">คำที่ซ่อน</h3><p class="note">ความคิดเห็นและคำขอข้อความที่มีคำเหล่านี้จะถูกซ่อน</p>
          <div class="chips">${st.settings.hiddenWords.map((w, i) => `<button class="chip on" data-act="rmWord" data-i="${i}">${esc(w)} ${I('x', 12)}</button>`).join('')}</div>
          <form class="composer" data-hw><input class="field" name="w" placeholder="เพิ่มคำ วลี หรืออีโมจิ" maxlength="30"><button class="btn sm pri">เพิ่ม</button></form>` : ''}</div></div>`;
    },
    mount(el) {
      const f = el.querySelector('[data-hw]');
      if (f) f.onsubmit = e => { e.preventDefault(); const w = f.w.value.trim(); if (!w) return; M.st.settings.hiddenWords.push(w); M.refresh(); };
    }
  };
  A.rmWord = el => { M.st.settings.hiddenWords.splice(+el.dataset.i, 1); M.refresh(); };

  /* ที่บันทึกไว้ / คลัง */
  M.Pages.saved = {
    render() {
      const posts = M.st.saved.map(M.findPost).filter(Boolean), reels = M.st.reels.filter(r => r.saved);
      const all = [...posts, ...reels];
      return M.bar('รายการที่บันทึกไว้') + `<div class="scroll"><div class="col">${all.length ? `<div class="grid3">${all.map(M.gridTile).join('')}</div>` : `<div class="empty">${M.bud('happy', 64)}<p>แตะ ${I('bookmark', 16)} ใต้โพสต์เพื่อบันทึกไว้ดูภายหลัง เฉพาะคุณเท่านั้นที่เห็น</p></div>`}</div></div>`;
    }
  };
  A.unarchiveHl = el => { const h = M.st.highlights.find(x => x.id === el.dataset.id); if (h) { delete h.archived; M.toast(`แสดง "${h.title}" บนโปรไฟล์แล้ว`); M.refresh(); } };
  M.Pages.archive = {
    render(p) {
      const st = M.st;
      const items = [...st.myStory.items.map(i => ({ ...i, live: true })), ...st.archive];
      return M.bar(p.pick ? 'เลือกสตอรี่สำหรับไฮไลต์' : 'คลังสตอรี่', p.pick ? '<button class="link acc" data-act="makeHighlight">ถัดไป</button>' : '') + `<div class="scroll"><div class="col">
        <p class="note pad">สตอรี่ที่หมดอายุจะถูกเก็บไว้ที่นี่ เห็นเฉพาะคุณ</p>
        ${!p.pick && st.highlights.some(h => h.archived) ? `<h3 class="sec-t pad">ไฮไลต์ที่จัดเก็บ</h3><div class="rows">${st.highlights.filter(h => h.archived).map(h => `<div class="row"><span class="hl-c sm">${M.media(h.items[0])}</span><span class="row-tx"><span>${esc(h.title)}</span><small>${h.items.length} สตอรี่</small></span><button class="btn sm sec" data-act="unarchiveHl" data-id="${h.id}">แสดงบนโปรไฟล์</button></div>`).join('')}</div>` : ''}
        <div class="grid3 tall">${items.map(it => `<label class="cell arch">${M.media(it)}<span class="tile-n">${new Date(it.ts).toLocaleDateString(M.locale(), { day: 'numeric', month: 'short' })}${it.live ? ' · ยังไม่หมดอายุ' : ''}</span>${p.pick ? `<input type="checkbox" class="check" data-aid="${it.id}">` : ''}</label>`).join('') || '<p class="empty">ยังไม่มีสตอรี่ในคลัง</p>'}</div></div></div>`;
    }
  };
  A.makeHighlight = async () => {
    const st = M.st, ids = [...document.querySelectorAll('[data-aid]:checked')].map(i => i.dataset.aid);
    if (!ids.length) return M.toast('เลือกอย่างน้อยหนึ่งรายการ');
    const title = await M.prompt('ชื่อไฮไลต์', '', 'เช่น ทริปน่าน', { ok: 'สร้าง', max: 15 });
    if (!title) return;
    const pool = [...st.myStory.items, ...st.archive];
    st.highlights.unshift({ id: M.uid('h'), title, items: ids.map(id => { const x = pool.find(i => i.id === id); return { art: x.art, img: x.img, overlays: x.overlays }; }) });
    M.toast('สร้างไฮไลต์แล้ว'); M.back(); M.refresh();
  };

  /* ช่องบรอดแคสต์ของฉัน */
  A.myChannel = async () => {
    const st = M.st;
    if (st.channel) return M.openChat(st.channel);
    if (st.me.type === 'personal' && !await M.confirm('ช่องบรอดแคสต์สำหรับครีเอเตอร์', 'ต้องสลับเป็นบัญชีครีเอเตอร์ก่อน (บัญชีจะเป็นสาธารณะ)', 'สลับเป็นครีเอเตอร์')) return;
    st.me.type = st.me.type === 'personal' ? 'creator' : st.me.type; st.settings.private = false;
    const name = await M.prompt('ตั้งชื่อช่อง', `${st.me.name.split(' ')[0]} · อัปเดต`, '', { ok: 'สร้างช่อง' });
    if (!name) return;
    const c = { id: M.uid('b'), type: 'broadcast', name, owner: 'me', members: ['me'], memberCount: 0, unread: 0, messages: [{ id: M.uid('x'), from: 'sys', type: 'system', text: 'คุณสร้างช่องบรอดแคสต์ ผู้ติดตามเข้าร่วมได้ แต่ส่งข้อความได้เฉพาะคุณ', ts: Date.now() }] };
    st.chats.unshift(c); st.channel = c.id;
    setTimeout(() => { c.memberCount = 128; M.save(); }, 3000);
    M.openChat(c.id);
  };

  /* แดชบอร์ดมืออาชีพ */
  M.Pages.dashboard = {
    render(p) {
      const st = M.st, me = st.me, days = p.days || 30;
      const r = M.rng(days * 31 + 7);
      const series = Array.from({ length: days }, (_, i) => Math.round(200 + r() * 500 + i * 6 + (i % 7 === 5 ? 300 : 0)));
      const reach = series.reduce((a, b) => a + b, 0), max = Math.max(...series), peak = series.indexOf(max);
      const prev = Math.round(reach * (0.82 + r() * .1));
      const change = Math.round((reach - prev) / prev * 100);
      const bw = 300 / days;
      const pro = me.type !== 'personal';
      const top = st.posts.filter(x => x.userId === 'me').sort((a, b) => b.likes - a.likes).slice(0, 3);
      return M.bar('แดชบอร์ดมืออาชีพ') + `<div class="scroll"><div class="col pad">
        <h3 class="sec-t">ประเภทบัญชี</h3>
        <div class="seg">${[['personal', 'ส่วนบุคคล'], ['creator', 'ครีเอเตอร์'], ['business', 'ธุรกิจ']].map(([v, l]) => `<button class="${me.type === v ? 'on' : ''}" data-act="setAcctType" data-v="${v}">${l}</button>`).join('')}</div>
        ${pro ? '' : '<p class="note">สลับเป็นบัญชีครีเอเตอร์หรือธุรกิจเพื่อดูสถิติและใช้เครื่องมือสร้างรายได้ บัญชีมืออาชีพต้องเป็นสาธารณะ</p>'}
        ${pro ? `<div class="sec-row"><h3 class="sec-t">ภาพรวม</h3><div class="seg sm">${[7, 30, 90].map(d => `<button class="${days === d ? 'on' : ''}" data-act="dashDays" data-d="${d}">${d} วัน</button>`).join('')}</div></div>
        <div class="kpis">
          <div class="kpi"><small>บัญชีที่เข้าถึง</small><b>${M.fullNum(reach)}</b><span class="${change >= 0 ? 'pos' : 'neg'}">${change >= 0 ? '+' : ''}${change}% เทียบกับ ${days} วันก่อนหน้า</span></div>
          <div class="kpi"><small>การมีส่วนร่วม</small><b>${M.fullNum(Math.round(reach * .084))}</b><span class="muted">ถูกใจ ความคิดเห็น แชร์ บันทึก</span></div>
          <div class="kpi"><small>ผู้ติดตามทั้งหมด</small><b>${M.fullNum(me.followers)}</b><span class="pos">+${Math.round(days * 1.7)} ใน ${days} วัน</span></div>
        </div>
        <div class="chart-card"><div class="sec-row"><b>บัญชีที่เข้าถึงรายวัน</b><small class="muted">สูงสุด ${M.fullNum(max)} บัญชี</small></div>
          <svg viewBox="0 0 300 120" class="chart" role="img" aria-label="กราฟจำนวนบัญชีที่เข้าถึงรายวัน">
            ${[30, 60, 90].map(y => `<line x1="0" x2="300" y1="${y}" y2="${y}" stroke="var(--line)"/>`).join('')}
            ${series.map((v, i) => `<rect x="${(i * bw + bw * .15).toFixed(2)}" y="${(118 - v / max * 108).toFixed(1)}" width="${(bw * .7).toFixed(2)}" height="${(v / max * 108).toFixed(1)}" rx="1" fill="${i === peak ? 'var(--accent)' : 'var(--chart)'}"><title>วันที่ ${i + 1}: ${v}</title></rect>`).join('')}
          </svg><div class="chart-x"><small>${days} วันก่อน</small><small>วันนี้</small></div></div>
        <div class="chart-card"><b>ผู้ที่เข้าถึง</b><div class="split"><i style="width:38%"></i></div><div class="sec-row"><small>ผู้ติดตาม 38%</small><small class="muted">ยังไม่ติดตาม 62%</small></div></div>
        <h3 class="sec-t">คอนเทนต์ยอดนิยม</h3><div class="grid3">${top.map(M.gridTile).join('')}</div>
        <h3 class="sec-t">เครื่องมือ</h3>${M.rows([
          { t: 'toggle', k: 'settings.subscriptions', label: 'สมาชิกรายเดือน', sub: 'ผู้ติดตามสมัครเพื่อดูคอนเทนต์พิเศษ 59 บาท/เดือน (จำลอง ไม่มีการเก็บเงินจริง)', icon: 'star' },
          { t: 'toggle', k: 'settings.gifts', label: 'รับของขวัญใน Reels และไลฟ์', icon: 'gift' },
          { t: 'nav', label: 'ช่องบรอดแคสต์', sub: 'ส่งข้อความทางเดียวถึงผู้ติดตาม', icon: 'megaphone', act: 'myChannel' },
          { t: 'nav', label: 'Trial Reels', sub: 'ทดลองโพสต์ให้คนที่ยังไม่ติดตามก่อน', icon: 'reels', act: 'newReel' },
          { t: 'nav', label: 'โพสต์ร่วมกัน (Collab)', sub: 'เชิญได้สูงสุด 4 บัญชีตอนสร้างโพสต์', icon: 'users', act: 'openCreate' },
          { t: 'nav', label: 'ถ่ายทอดสด', icon: 'live', act: 'goLive' }
        ])}
        <p class="note">ตัวเลขทั้งหมดเป็นข้อมูลจำลองเพื่อการออกแบบ</p>` : ''}</div></div>`;
    }
  };
  A.dashDays = el => { const top = M.topPage(); top._params.days = +el.dataset.d; M.renderPage(top); };
  A.goLive = () => M.push('live', { mode: 'host' });
  A.setAcctType = async el => {
    const v = el.dataset.v, st = M.st;
    if (v === st.me.type) return;
    if (v !== 'personal' && st.settings.private) {
      if (!await M.confirm('บัญชีมืออาชีพต้องเป็นสาธารณะ', 'ทุกคนจะเห็นโพสต์ของคุณ ต้องการเปลี่ยนไหม', 'เปลี่ยน')) return;
      st.settings.private = false;
    }
    if (st.settings.teen && v !== 'personal') return M.toast('บัญชีวัยรุ่นเปลี่ยนเป็นบัญชีมืออาชีพไม่ได้');
    st.me.type = v; M.toast(`เปลี่ยนเป็นบัญชี${{ personal: 'ส่วนบุคคล', creator: 'ครีเอเตอร์', business: 'ธุรกิจ' }[v]}แล้ว`); M.refresh();
  };

  /* บัญชีวัยรุ่น + ผู้ปกครอง + เวลาที่ใช้ */
  M.onToggle['settings.teen'] = v => {
    const s = M.st.settings;
    if (v) { s.private = true; s.messagesFrom = 'followers'; s.sensitive = 'less'; s.sleepMode = true; M.st.me.type = 'personal'; setTimeout(() => M.toast('เปิดการป้องกันบัญชีวัยรุ่นแล้ว'), 50); }
  };
  M.Pages.family = {
    render() {
      const st = M.st, s = st.settings;
      return M.bar('บัญชีวัยรุ่นและเวลาที่ใช้') + `<div class="scroll"><div class="col pad">
        <div class="info-card">${I('family', 24)}<div><b>บัญชีวัยรุ่น</b><p class="muted small">สำหรับผู้ใช้อายุต่ำกว่า 18 ปี ระบบจะตั้งค่าที่ปลอดภัยให้อัตโนมัติ ในบริการจริงใช้ AI ประเมินอายุร่วมกับข้อมูลที่ผู้ใช้ให้ไว้ (ในต้นแบบเปิดปิดเองได้)</p></div></div>
        ${M.rows([
          { t: 'toggle', k: 'settings.teen', label: 'ใช้การป้องกันบัญชีวัยรุ่น', sub: 'บัญชีส่วนตัว รับข้อความจากผู้ติดตามเท่านั้น กรองเนื้อหาละเอียดอ่อนแบบเข้ม', icon: 'shieldCheck' },
          { t: 'toggle', k: 'settings.sleepMode', label: 'โหมดพักผ่อน 22:00–07:00', sub: 'ปิดการแจ้งเตือนและตอบกลับข้อความอัตโนมัติ', icon: 'moon' },
          { t: 'choice', k: 'settings.dailyLimit', label: 'เตือนเมื่อใช้ครบต่อวัน', icon: 'hourglass', options: [[0, 'ไม่จำกัด'], [30, '30 นาที'], [60, '1 ชั่วโมง'], [120, '2 ชั่วโมง']] }
        ])}
        <h3 class="sec-t">การดูแลโดยผู้ปกครอง</h3>
        ${st.parent ? `<div class="info-card">${I('users', 22)}<div><b>เชื่อมกับผู้ปกครองแล้ว</b><p class="muted small">ผู้ปกครองเห็นเวลาที่ใช้ รายชื่อบัญชีที่ติดตาม และต้องอนุมัติเมื่อคุณขอเปลี่ยนการตั้งค่าความปลอดภัย ผู้ปกครองไม่เห็นข้อความแชตของคุณ</p></div></div>
          <button class="btn sec block" data-act="parentOff">ยกเลิกการเชื่อม</button>`
        : `<p class="muted small">ส่งรหัสให้ผู้ปกครองกรอกในศูนย์ครอบครัว เพื่อดูเวลาที่ใช้ ตั้งเวลาพัก และอนุมัติคำขอเปลี่ยนการตั้งค่า</p><button class="btn pri block" data-act="parentInvite">สร้างรหัสเชิญผู้ปกครอง</button>`}
        <p class="note">การดูแลโดยผู้ปกครองในต้นแบบเป็นการจำลอง</p></div></div>`;
    }
  };
  A.parentInvite = () => {
    const code = [...crypto.getRandomValues(new Uint8Array(3))].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    M.sheet(`<p class="muted">ให้ผู้ปกครองกรอกรหัสนี้ภายใน 24 ชั่วโมง</p><p class="safety">${code.slice(0, 3)} ${code.slice(3)}</p><button class="btn pri block" data-act="parentLink">จำลอง: ผู้ปกครองกรอกรหัสแล้ว</button>`, { title: 'รหัสเชิญผู้ปกครอง' });
  };
  A.parentLink = () => { M.st.parent = true; M.closeSheet(); M.toast('เชื่อมกับผู้ปกครองแล้ว'); M.refresh(); };
  A.parentOff = async () => { if (await M.confirm('ยกเลิกการเชื่อมกับผู้ปกครองไหม', 'ผู้ปกครองจะได้รับแจ้ง', 'ยกเลิกการเชื่อม', true)) { M.st.parent = false; M.refresh(); } };


  /* ---------- ภาษา ---------- */
  M.Pages.language = {
    render() {
      const cur = M.st.settings.lang || 'th';
      const dev = M.i18n.supportsDevice();
      return M.bar('ภาษา') + `<div class="scroll"><div class="col pad">
        <p class="note">ไทยและอังกฤษมีคำแปลในตัวแอป ภาษาอื่นแปลจากอังกฤษด้วยตัวแปลภาษาในเบราว์เซอร์ (ทำงานในเครื่อง) ${dev ? 'ซึ่งเบราว์เซอร์นี้รองรับ' : 'ซึ่งเบราว์เซอร์นี้ไม่รองรับ จะแสดงเป็นภาษาอังกฤษแทน ลองเปิดด้วย Chrome รุ่นใหม่บนคอมพิวเตอร์'} ข้อความที่ผู้ใช้โพสต์จะแสดงตามภาษาที่เขียน</p>
        <input class="field" placeholder="ค้นหาภาษา" data-lq aria-label="ค้นหาภาษา">
        <div class="rows" data-langs>${M.LANGS.map(([code, native, en]) => `<button class="row tight" data-act="setLang" data-code="${code}" data-n="${M.esc((native + ' ' + en).toLowerCase())}"><span class="row-tx" translate="no"><span>${M.esc(native)}</span><small>${M.esc(en)}${code === 'th' || code === 'en' ? '' : ' · แปลในเครื่อง'}</small></span>${cur === code ? I('check', 20, 'acc') : ''}</button>`).join('')}</div>
        <button class="link muted" data-act="clearLangCache">ล้างคำแปลที่เก็บไว้</button>
      </div></div>`;
    },
    mount(el) { el.querySelector('[data-lq]').oninput = e => { const q = e.target.value.toLowerCase(); el.querySelectorAll('[data-langs] .row').forEach(r => r.hidden = !r.dataset.n.includes(q)); }; }
  };
  A.setLang = async el => {
    const code = el.dataset.code;
    M.st.settings.lang = code; M.save();
    const bar = document.createElement('div');
    bar.className = 'lang-progress'; bar.innerHTML = '<i></i><span>กำลังเตรียมภาษา…</span>';
    if (code !== 'th' && code !== 'en') document.body.appendChild(bar);
    const note = await M.i18n.set(code, { onProgress: p => { bar.querySelector('i').style.width = Math.round(p * 100) + '%'; } }).catch(() => 'error');
    bar.remove();
    M.applyAppearance();
    M.refresh();
    if (note === 'nofallback') M.toast('เบราว์เซอร์นี้ไม่มีตัวแปลภาษาในเครื่อง จึงแสดงเป็นภาษาอังกฤษ', { ms: 5000 });
  };
  A.clearLangCache = () => { M.i18n.clearCache(); M.toast('ล้างคำแปลแล้ว'); };

  /* ---------- ฟอนต์และขนาดตัวอักษร ---------- */
  M.Pages.fonts = {
    render() {
      const s = M.st.settings, cur = s.font || 'Anuphan';
      M.FONTS.forEach(([f, , w]) => M.loadFont(f, w));
      return M.bar('ฟอนต์และขนาดตัวอักษร') + `<div class="scroll"><div class="col pad">
        <div class="font-prev" style="font-family:var(--font)"><b>สวัสดี มะลิ</b><p>ตัวอย่างข้อความ อ่านง่ายทั้งบนมือถือและคอมพิวเตอร์ Aa 0123</p></div>
        <h3 class="sec-t">ขนาดตัวอักษร</h3>
        <div class="seg">${M.FONT_SIZES.map(([v, l]) => `<button class="${(s.fontScale || 1) === v ? 'on' : ''}" data-act="setFontSize" data-v="${v}">${l}</button>`).join('')}</div>
        <h3 class="sec-t">ฟอนต์</h3>
        <div class="font-list">${M.FONTS.map(([f, l]) => `<button class="font-it${cur === f ? ' on' : ''}" data-act="setFont" data-f="${M.esc(f)}" style="font-family:${f === 'system' ? 'system-ui' : `'${f}'`}, sans-serif"><span class="fi-s" translate="no">มะลิ Aa</span><span class="fi-n">${l}<small translate="no">${f === 'system' ? '' : M.esc(f)}</small></span>${cur === f ? I('check', 20, 'acc') : ''}</button>`).join('')}</div>
        <p class="note">ฟอนต์โหลดจาก Google Fonts ถ้าออฟไลน์จะใช้ฟอนต์ของระบบ ภาษาที่ใช้อักษรอื่น (เช่น จีน ญี่ปุ่น อาหรับ) จะเพิ่มฟอนต์ Noto ที่รองรับให้อัตโนมัติ</p>
      </div></div>`;
    }
  };
  A.setFont = el => { M.st.settings.font = el.dataset.f; M.applyAppearance(); M.refresh(); };
  A.setFontSize = el => { M.st.settings.fontScale = +el.dataset.v; M.applyAppearance(); M.refresh(); };

  /* ---------- สีวงสตอรี่ ---------- */
  M.Pages.ringColor = {
    render() {
      const me = M.st.me, cur = me.ringColor || '#c4411a';
      return M.bar('สีวงสตอรี่') + `<div class="scroll"><div class="col pad">
        <div class="ring-prev"><span class="ring"${M.ringStyle({ ringColor: cur })}>${M.avatar(me, 88)}</span><p class="muted small">วงรอบรูปโปรไฟล์ที่บอกว่าคุณลงสตอรี่แล้ว</p></div>
        <h3 class="sec-t">เลือกสี</h3><div data-ringbox>${M.ringPicker(cur)}</div>
        ${M.rows([{ t: 'toggle', k: 'settings.ringAll', label: 'ใช้สีนี้กับสตอรี่ของทุกคนที่ฉันเห็น', sub: 'ถ้าปิด จะเห็นสีที่แต่ละคนเลือกเอง', icon: 'eye' }])}
        <p class="note">วงสีเขียวยังใช้บอกสตอรี่ "เพื่อนสนิท" และวงสีเทาคือสตอรี่ที่ดูแล้ว เพื่อไม่ให้ความหมายสับสน</p>
      </div></div>`;
    },
    mount(el) { M.wireRingPicker(el.querySelector('[data-ringbox]'), c => { M.st.me.ringColor = c; M.applyAppearance(); M.refresh(); }); }
  };
  M.onToggle['settings.ringAll'] = () => { setTimeout(M.applyAppearance, 0); };

  /* ---------- ตัวกรองภาพ 18+ ---------- */
  A.testAdult = async () => {
    const [f] = await M.pickFiles('image/*'); if (!f) return;
    M.toast('กำลังตรวจ…');
    let r;
    try { r = await M.adult.check(f); } catch { return M.toast('เปิดไฟล์นี้ไม่ได้'); }
    const url = URL.createObjectURL(f);
    const label = { ok: 'ผ่าน ใช้ได้ตามปกติ', sensitive: 'อ่อนไหว จะถูกเบลอพร้อมคำเตือน และใช้เป็นรูปโปรไฟล์หรือแบนเนอร์ไม่ได้', blocked: 'เนื้อหา 18+ ห้ามอัปโหลด' }[r.verdict];
    M.sheet(`<div class="img-full small${r.verdict !== 'ok' ? ' blurimg' : ''}"><img src="${url}" alt=""></div>
      <div class="warn-card ${r.verdict === 'ok' ? 'ok' : r.verdict === 'sensitive' ? 'warn' : ''}">${I(r.verdict === 'ok' ? 'shieldCheck' : 'alert', 22)}<div><b>${label}</b><p class="muted small">ตัวตรวจ: ${r.engine === 'nsfwjs' ? 'โมเดล NSFWJS ในเครื่อง' : 'ฮิวริสติกสีผิว (โหลดโมเดลไม่ได้)'}</p></div></div>
      <div class="rows">${Object.entries(r.scores).map(([k, v]) => `<div class="row tight"><span class="row-tx"><span translate="no">${M.esc(k)}</span></span><span class="row-v">${Math.round(v * 100)}%</span></div>`).join('')}</div>
      <p class="note">ภาพไม่ถูกส่งออกจากเครื่อง ผลการตรวจอาจผิดพลาดได้ บริการจริงควรมีการตรวจซ้ำที่เซิร์ฟเวอร์และให้ผู้ใช้อุทธรณ์ได้</p>`, { title: 'ผลตรวจภาพ 18+', onClose: () => URL.revokeObjectURL(url) });
  };

  /* เกี่ยวกับต้นแบบ */
  M.Pages.about = {
    render: () => M.bar('เกี่ยวกับต้นแบบนี้') + `<div class="scroll"><div class="col pad prose">
      <div class="center">${M.logo(48)}<h2>มะลิ</h2><p class="muted">ต้นแบบแอปโซเชียลที่รวมการแชร์รูปและวิดีโอเข้ากับแชตและชุมชน</p>${M.bud('happy', 80)}<p class="muted small">น้องตูม ผู้ช่วยประจำแอป</p></div>
      <h3>ข้อจำกัดของต้นแบบ</h3><ul>
        <li>ไม่มีระบบหลังบ้าน ข้อมูลทั้งหมดเก็บใน IndexedDB ของเบราว์เซอร์เครื่องนี้ ไม่ซิงก์ไปเครื่องอื่น</li>
        <li>วิดีโอที่อัปโหลดอยู่ในหน่วยความจำชั่วคราว รีเฟรชแล้วจะหายไป</li>
        <li>เพื่อน การตอบแชต ผู้ชมไลฟ์ การโทร ยอดถูกใจหลังโพสต์ และสถิติแดชบอร์ด เป็นการจำลอง</li>
        <li>การสรุปแชตด้วย AI การพากย์ AI และการตรวจจับภาพไม่เหมาะสม เป็นการจำลอง ไม่ได้เรียกโมเดล AI จริง</li>
        <li>ทำงานจริงในเบราว์เซอร์: รหัส 2FA แบบ TOTP, แฮชรหัสผ่าน PBKDF2, แชตลับ ECDH + AES-GCM, ตรวจลิงก์ด้วยรายการบล็อก, จำกัดอัตราการส่ง, ลบ EXIF/GPS จากรูป</li>
      </ul>
      <button class="btn sec block" data-act="page" data-page="backend" data-params="{}">ดูระบบหลังบ้านที่ต้องมีในบริการจริง</button>
      <p class="note">ชื่อ โลโก้ คาแรกเตอร์ ภาพประกอบ และไอคอน สร้างขึ้นใหม่สำหรับต้นแบบนี้ บุคคลและบัญชีในข้อมูลตัวอย่างเป็นตัวละครสมมติ</p></div></div>`
  };
})(window.M);
