'use strict';
/* ทางลัดแบบ "หน้าหลัก": เพื่อน กลุ่ม บริการ บัญชีทางการ */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;

  /* ---------- ทางลัด ---------- */
  M.Pages.friends = {
    render() {
      const st = M.st, friends = Object.values(st.users).filter(u => u.friend);
      const fav = friends.filter(u => st.closeFriends.includes(u.id));
      const row = u => `<div class="row" data-n="${esc(u.name + u.handle)}"><button class="row-tx inline" data-act="openUser" data-id="${u.id}">${M.avatar(u, 44)}<span class="row-tx"><span>${esc(u.name)}</span><small>${st.notes[u.id] ? esc(st.notes[u.id].text) : esc(u.handle)}</small></span></button>
        <button class="ibtn" data-act="dmUser" data-id="${u.id}" aria-label="แชต">${I('chat', 20)}</button><button class="ibtn" data-act="callUser2" data-id="${u.id}" data-video="0" aria-label="โทร">${I('phone', 20)}</button></div>`;
      return M.bar('เพื่อน', `<button class="ibtn" data-act="addFriend" aria-label="เพิ่มเพื่อน">${I('userPlus')}</button>`) + `<div class="scroll"><div class="col">
        <div class="me-card">${M.avatar(st.me, 56)}<div><b>${esc(st.me.name)}</b><small class="muted">${st.me.note ? esc(st.me.note.text) : 'ตั้งข้อความสถานะด้วยโน้ต'}</small></div><button class="ibtn" data-act="shareProfile" aria-label="คิวอาร์โค้ดของฉัน">${I('qr')}</button></div>
        <div class="pad"><input class="field" placeholder="ค้นหาเพื่อน" data-ff></div>
        <h3 class="sec-t pad">รายการโปรด ${fav.length}</h3><div class="rows">${fav.map(row).join('')}</div>
        <h3 class="sec-t pad">เพื่อน ${friends.length}</h3><div class="rows">${friends.map(row).join('')}</div></div></div>`;
    },
    mount(el) { el.querySelector('[data-ff]').oninput = e => el.querySelectorAll('[data-n]').forEach(r => r.hidden = !r.dataset.n.toLowerCase().includes(e.target.value.toLowerCase())); }
  };
  A.addFriend = async () => {
    const h = await M.prompt('เพิ่มเพื่อนด้วยชื่อผู้ใช้', '', 'เช่น kao.phum', { ok: 'ค้นหา' });
    if (!h) return;
    const u = M.userByHandle(h.replace(/^@/, ''));
    if (!u || u.id === 'me') return M.toast('ไม่พบผู้ใช้นี้');
    u.friend = true; if (!M.st.following.includes(u.id)) M.st.following.push(u.id);
    M.toast(`เพิ่ม ${u.name} เป็นเพื่อนแล้ว`); M.refresh();
  };
  M.Pages.groups = {
    render() {
      const gs = M.st.chats.filter(c => c.type === 'group');
      return M.bar('กลุ่ม', `<button class="ibtn" data-act="newChat" aria-label="สร้างกลุ่ม">${I('plus')}</button>`) + `<div class="scroll"><div class="col"><div class="rows">${gs.map(g => `<button class="row" data-act="openChat" data-id="${g.id}"><span class="av grp" style="--s:48px">${I('users', 22)}</span><span class="row-tx"><span>${esc(g.name)}</span><small>${g.members.length + 1} สมาชิก</small></span></button>`).join('')}</div>
        <div class="center pad"><button class="btn sec" data-act="newChat">${I('plus', 18)} สร้างกลุ่มใหม่</button></div></div></div>`;
    }
  };
  const SERVICES = [
    ['stickers', 'smile', 'สติกเกอร์'], ['theme', 'moon', 'ธีม'], ['news', 'newspaper', 'ข่าว'], ['weather', 'cloud', 'สภาพอากาศ'],
    ['calendar', 'calendar', 'นัดหมาย'], ['games', 'gamepad', 'เกม'], ['gift', 'gift', 'ของขวัญ'], ['help', 'info', 'ช่วยเหลือ']
  ];
  M.Pages.services = {
    render: () => M.bar('บริการ') + `<div class="scroll"><div class="col pad"><div class="svc">${SERVICES.map(([k, ic, l]) => `<button data-act="service" data-k="${k}"><span>${I(ic, 26)}</span>${l}</button>`).join('')}</div>
      <p class="note">บริการในต้นแบบนี้เปิดได้บางส่วน รายการอื่นแสดงเพื่อการออกแบบเท่านั้น</p></div></div>`
  };
  A.service = el => {
    const k = el.dataset.k;
    if (k === 'stickers') return M.sheet(`<p class="muted small">ชุด "น้องตูม" สติกเกอร์ต้นฉบับของแอป ใช้ได้ฟรีในแชต</p><div class="stk-grid">${M.STICKERS.map((_, i) => M.sticker(i, 84)).join('')}</div>`, { title: 'สติกเกอร์ของคุณ' });
    if (k === 'theme') return M.A.choice({ dataset: { k: 'settings.theme', label: 'ธีม', opts: JSON.stringify([['light', 'สว่าง'], ['dark', 'มืด'], ['system', 'ตามระบบ']]) } });
    if (k === 'news') return M.openChat('o_news');
    if (k === 'weather') return M.sheet(`<div class="wx"><b>กรุงเทพฯ</b><span class="wx-t">32°</span><span class="muted">มีเมฆบางส่วน · ฝนเล็กน้อยช่วงเย็น</span><div class="wx-row">${['13:00', '15:00', '17:00', '19:00'].map((t, i) => `<span><small class="muted">${t}</small><b>${32 - i}°</b></span>`).join('')}</div></div><p class="note">ข้อมูลตัวอย่าง ไม่ใช่การพยากรณ์จริง</p>`, { title: 'สภาพอากาศ' });
    if (k === 'help') return M.push('about');
    M.toast('บริการนี้แสดงเพื่อการออกแบบ ยังไม่เปิดใช้ในต้นแบบ');
  };
  M.Pages.officials = {
    render() {
      const st = M.st, offs = Object.values(st.users).filter(u => u.official);
      return M.bar('บัญชีทางการ') + `<div class="scroll"><div class="col"><p class="note pad">บัญชีที่มีเครื่องหมายยืนยันผ่านการตรวจสอบตัวตนแล้ว ระวังบัญชีปลอมที่ใช้ชื่อคล้ายกัน</p><div class="rows">${offs.map(u => {
        const c = st.chats.find(x => x.type === 'official' && x.members[0] === u.id);
        return `<div class="row">${M.avatar(u, 48)}<span class="row-tx"><span>${esc(u.name)} <span class="vf">${I('verified', 14)}</span></span><small>${esc(u.bio)}</small></span>
          ${c ? `<button class="btn sm sec" data-act="openChat" data-id="${c.id}">แชต</button>` : ''}<button class="btn sm ${st.following.includes(u.id) ? 'sec' : 'pri'}" data-act="follow" data-id="${u.id}">${st.following.includes(u.id) ? 'เพิ่มแล้ว' : 'เพิ่ม'}</button></div>`;
      }).join('')}</div></div></div>`;
    }
  };
})(window.M);
