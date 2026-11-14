'use strict';
/* แชต: รายการ, ห้องแชต, โน้ต, Instants, แชตลับ E2EE, สรุปกลุ่ม, การโทร, แผนที่เพื่อน, ตรวจลิงก์ */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;
  const chatById = id => M.st.chats.find(c => c.id === id);
  M.chatById = chatById;

  M.ensureDM = (uid, secret = false) => {
    const st = M.st;
    let c = st.chats.find(x => x.type === 'dm' && x.members[0] === uid && !!x.secret === secret);
    if (!c) { c = { id: M.uid(secret ? 'sc' : 'c'), type: 'dm', members: [uid], unread: 0, messages: [], secret, replies: ['โอเค', 'ได้เลย', 'จริงด้วย', 'เดี๋ยวตอบนะ'] }; st.chats.unshift(c); }
    return c;
  };
  const title = c => c.name || (c.secret ? 'แชตลับ · ' : '') + M.user(c.members[0]).name;
  const lastMsg = c => c.messages[c.messages.length - 1];
  const preview = (c, m) => {
    if (!m) return 'เริ่มบทสนทนา';
    const who = m.from === 'me' ? 'คุณ: ' : c.type === 'group' ? (m.nick || M.user(m.from).name.split(' ')[0]) + ': ' : '';
    if (c.secret) return esc(who) + 'ข้อความที่เข้ารหัส';
    const t = { image: 'ส่งรูปภาพ', video: 'ส่งวิดีโอ', sticker: 'ส่งสติกเกอร์', post: 'แชร์โพสต์', reel: 'แชร์ Reels', instant: 'ส่ง Instant', storyReply: 'ตอบกลับสตอรี่', call: m.video ? 'วิดีโอคอล' : 'โทรด้วยเสียง' }[m.type];
    return esc(who) + (t ? esc(t) : `<span translate="no">${esc(m.text)}</span>`);
  };
  const chatAvatar = (c, s = 52) => {
    if (c.type === 'group') { const [a, b] = c.members; return `<span class="av-stack" style="--s:${s}px">${M.avatar(M.user(a), s * .7)}${M.avatar(M.user(b), s * .7)}</span>`; }
    if (c.type === 'broadcast') return `<span class="av-wrap">${M.avatar(M.user(c.owner), s)}<span class="av-badge">${I('megaphone', 12)}</span></span>`;
    const u = M.user(c.members[0]);
    return `<span class="av-wrap">${M.avatar(u, s)}${u.online && M.st.settings.activityStatus && !M.st.restricted.includes(u.id) ? '<i class="online"></i>' : ''}</span>`;
  };

  /* ---------- รายการแชต ---------- */
  const FILTERS = [['all', 'ทั้งหมด'], ['unread', 'ยังไม่ได้อ่าน'], ['dm', 'ส่วนตัว'], ['group', 'กลุ่ม'], ['channel', 'ช่อง'], ['request', 'คำขอ']];
  const listHTML = () => {
    const st = M.st, f = st.chatFilter || 'all', q = (st.chatQ || '').trim();
    let list = st.chats.filter(c => !(c.type === 'dm' && st.blocked.includes(c.members[0])));
    list = list.filter(c => f === 'request' ? c.request : !c.request);
    if (f === 'unread') list = list.filter(c => c.unread);
    if (f === 'dm') list = list.filter(c => c.type === 'dm');
    if (f === 'group') list = list.filter(c => c.type === 'group');
    if (f === 'channel') list = list.filter(c => c.type === 'broadcast' || c.type === 'official');
    if (q) list = list.filter(c => title(c).includes(q) || c.messages.some(m => (m.text || '').includes(q)));
    list.sort((a, b) => (lastMsg(b)?.ts || 0) - (lastMsg(a)?.ts || 0));
    const reqN = st.chats.filter(c => c.request).length;
    const notes = Object.entries(st.notes).filter(([uid, n]) => Date.now() - n.ts < M.T.DAY && !st.blocked.includes(uid));
    return `<div class="notes hscroll">
        <button class="note-it" data-act="editNote">${st.me.note ? `<span class="note-bub">${esc(st.me.note.text || '♪')}</span>` : '<span class="note-bub add">โน้ตของคุณ</span>'}${M.avatar(st.me, 60)}<span>โน้ตของคุณ</span></button>
        ${notes.map(([uid, n]) => `<button class="note-it" data-act="viewNote" data-id="${uid}"><span class="note-bub">${n.music ? I('music', 12) + ' ' + esc(M.TRACKS.find(t => t.id === n.music)?.name || '') : esc(n.text)}</span>${M.avatar(M.user(uid), 60)}<span>${esc(M.user(uid).name.split(' ')[0])}</span></button>`).join('')}
      </div>
      <div class="pad"><input class="field" placeholder="ค้นหา" value="${esc(st.chatQ || '')}" data-chatq aria-label="ค้นหาแชต"></div>
      <div class="chips hscroll pad">${FILTERS.map(([k, l]) => `<button class="chip${f === k ? ' on' : ''}" data-act="chatFilter" data-k="${k}">${l}${k === 'request' && reqN ? ` ${reqN}` : ''}</button>`).join('')}</div>
      ${M.tip('chat', 'พิมพ์ @silent นำหน้าข้อความเพื่อส่งแบบไม่มีเสียงแจ้งเตือน แตะข้อความของคุณเพื่อแก้ไขภายใน 60 นาที')}
      <div class="rows chats">${list.map(c => {
        const m = lastMsg(c);
        return `<button class="row chat-row${M.openId === c.id ? ' sel' : ''}" data-act="openChat" data-id="${c.id}">${chatAvatar(c)}
          <span class="row-tx"><span class="ct">${esc(title(c))}${c.type === 'official' ? `<span class="vf">${I('verified', 14)}</span>` : ''}${c.secret ? `<span class="muted">${I('lock', 13)}</span>` : ''}${c.muted ? `<span class="muted">${I('bellOff', 13)}</span>` : ''}</span>
          <small class="${c.unread ? 'strong' : ''}">${preview(c, m)}</small></span>
          <span class="row-end"><small class="muted">${m ? M.ago(m.ts) : ''}</small>${c.unread ? `<span class="badge">${c.unread > 99 ? '99+' : c.unread}</span>` : ''}</span></button>`;
      }).join('') || `<div class="empty">${M.bud('sleepy', 64)}<p>${f === 'request' ? 'ไม่มีคำขอข้อความ' : 'ไม่พบแชต'}</p></div>`}</div>`;
  };

  M.Tabs.chat = {
    render() {
      return `<header class="top glass"><h1 class="bar-t">แชต</h1><div class="bar-r">
          <button class="ibtn" data-act="openMap" aria-label="แผนที่เพื่อน">${I('map')}</button>
          <button class="ibtn" data-act="openInstants" aria-label="Instants">${I('camera')}</button>
          <button class="ibtn" data-act="openCalls" aria-label="การโทร">${I('phone')}</button>
          <button class="ibtn" data-act="newChat" aria-label="ข้อความใหม่">${I('edit')}</button></div></header>
        <div class="chat-split"><div class="chat-list">${listHTML()}</div><div class="chat-pane" id="chatPane">${M.openId && M.isWide() && chatById(M.openId) ? '' : `<div class="empty pane-empty">${M.bud('happy', 80)}<p>เลือกแชตเพื่อเริ่มคุย</p></div>`}</div></div>`;
    },
    mount(el) {
      const q = el.querySelector('[data-chatq]');
      q.oninput = M.debounce(() => { M.st.chatQ = q.value; const pos = q.selectionStart; M.renderTab('chat'); const q2 = M.$('.tab[data-tab="chat"] [data-chatq]'); q2.focus(); q2.setSelectionRange(pos, pos); }, 250);
      if (M.openId && M.isWide() && chatById(M.openId)) mountRoomInto(el.querySelector('#chatPane'), M.openId);
    }
  };
  A.chatFilter = el => { M.st.chatFilter = el.dataset.k; M.renderTab('chat'); };
  A.viewNote = el => {
    const uid = el.dataset.id, n = M.st.notes[uid], u = M.user(uid);
    const tr = n.music && M.TRACKS.find(t => t.id === n.music);
    M.sheet(`<div class="center">${M.avatar(u, 72)}<p class="note-big">${esc(n.text)}</p>${tr ? `<p class="muted">${I('music', 14)} ${esc(tr.name)} · ${esc(tr.artist)}</p>` : ''}<p class="muted small">${M.ago(n.ts)} · ${M.left24(n.ts)}</p></div>
      <form class="composer" data-nr><input class="field" name="t" placeholder="ตอบกลับ ${esc(u.name.split(' ')[0])}"><button class="btn sm pri">ส่ง</button></form>`, { title: 'โน้ต', mount: sh => {
      sh.querySelector('[data-nr]').onsubmit = e => { e.preventDefault(); const t = e.target.t.value.trim(); if (!t) return; const c = M.ensureDM(uid); c.messages.push({ id: M.uid('x'), from: 'me', type: 'text', text: `ตอบกลับโน้ต "${n.text}": ${t}`, ts: Date.now(), status: 'sent' }); M.closeSheet(); M.toast('ส่งแล้ว'); M.refresh(); };
    } });
  };

  M.openChat = id => {
    M.openId = id;
    const c = chatById(id); if (c) { c.unread = 0; }
    M.save();
    if (M.isWide()) { if (M.cur !== 'chat') M.go('chat'); else { while (M.stack.length) M.back(); M.renderTab('chat'); } }
    else M.push('room', { id });
    M.renderNav();
  };
  A.openChat = el => M.openChat(el.dataset.id);
  A.newChat = () => {
    const st = M.st;
    const people = Object.values(st.users).filter(u => !u.official && u.id !== 'stranger');
    const sel = new Set();
    const sh = M.sheet(`<input class="field" placeholder="ค้นหาเพื่อน" data-q>
      <div class="rows">${people.map(u => `<label class="row" data-n="${esc(u.name + u.handle)}">${M.avatar(u, 40)}<span class="row-tx"><span>${esc(u.name)}</span><small>${esc(u.handle)}</small></span><input type="checkbox" class="check" value="${u.id}"></label>`).join('')}</div>
      <label class="row"><span class="row-tx"><span>แชตลับ (เข้ารหัสต้นทางถึงปลายทาง)</span><small>ใช้ได้กับแชตส่วนตัวเท่านั้น</small></span><input type="checkbox" class="switch" data-secret></label>
      <button class="btn pri block" data-go>เริ่มแชต</button>`, { title: 'ข้อความใหม่' });
    sh.querySelector('[data-q]').oninput = e => sh.querySelectorAll('[data-n]').forEach(r => r.hidden = !r.dataset.n.includes(e.target.value));
    sh.addEventListener('change', e => { if (e.target.value && e.target.classList.contains('check')) e.target.checked ? sel.add(e.target.value) : sel.delete(e.target.value); });
    sh.querySelector('[data-go]').onclick = async () => {
      if (!sel.size) return M.toast('เลือกอย่างน้อยหนึ่งคน');
      const secret = sh.querySelector('[data-secret]').checked;
      M.closeSheet();
      if (sel.size === 1) { const uid = [...sel][0]; if (secret) return M.startSecret(uid); return M.openChat(M.ensureDM(uid).id); }
      const name = await M.prompt('ตั้งชื่อกลุ่ม', '', 'เช่น ทีมโปรเจกต์จบ');
      const g = { id: M.uid('g'), type: 'group', name: name || [...sel].map(u => M.user(u).name.split(' ')[0]).join(', '), members: [...sel], unread: 0, messages: [{ id: M.uid('x'), from: 'sys', type: 'system', text: 'คุณสร้างกลุ่มนี้', ts: Date.now() }], replies: ['สวัสดีทุกคน', 'โอเค', '555'] };
      st.chats.unshift(g); M.openChat(g.id);
    };
  };

  /* ---------- ห้องแชต ---------- */
  const status = c => {
    if (c.type === 'group') return `${c.members.length + 1} สมาชิก`;
    if (c.type === 'broadcast') return `ช่องบรอดแคสต์ · ${M.num(c.memberCount)} สมาชิก`;
    if (c.type === 'official') return 'บัญชีทางการ';
    const u = M.user(c.members[0]);
    if (!M.st.settings.activityStatus) return c.secret ? 'เข้ารหัสต้นทางถึงปลายทาง' : '';
    return (c.secret ? 'เข้ารหัสต้นทางถึงปลายทาง · ' : '') + (u.online ? 'ออนไลน์' : `ใช้งานล่าสุด ${M.ago(Date.now() - u.lastSeen * 60000)}ที่แล้ว`);
  };
  const roomHead = (c, inPane) => `<header class="bar glass">
      ${inPane ? '' : `<button class="ibtn" data-act="back" aria-label="ย้อนกลับ">${I('back')}</button>`}
      <button class="room-who" data-act="chatInfo" data-id="${c.id}">${chatAvatar(c, 36)}<span class="row-tx"><span>${esc(title(c))}</span><small>${status(c)}</small></span></button>
      <div class="bar-r">${['dm', 'group'].includes(c.type) ? `<button class="ibtn" data-act="startCall" data-id="${c.id}" data-video="0" aria-label="โทรด้วยเสียง">${I('phone')}</button><button class="ibtn" data-act="startCall" data-id="${c.id}" data-video="1" aria-label="วิดีโอคอล">${I('video')}</button>` : ''}
      <button class="ibtn" data-act="chatInfo" data-id="${c.id}" aria-label="ข้อมูลแชต">${I('info')}</button></div></header>`;

  const msgHTML = (c, m, i, arr) => {
    const mine = m.from === 'me';
    const prev = arr[i - 1];
    const day = !prev || new Date(prev.ts).toDateString() !== new Date(m.ts).toDateString() ? `<div class="day">${M.dayLabel(m.ts)}</div>` : '';
    if (m.type === 'system') return day + `<div class="sys">${esc(m.text)}</div>`;
    if (m.type === 'call') return day + `<div class="sys">${I(m.video ? 'video' : 'phone', 14)} ${m.missed ? 'สายที่ไม่ได้รับ' : (m.video ? 'วิดีโอคอล' : 'โทรด้วยเสียง') + ' · ' + M.dur(m.dur)} · ${M.clock(m.ts)}</div>`;
    const u = mine ? M.st.me : M.user(m.from);
    const showName = !mine && c.type === 'group' && prev?.from !== m.from;
    const text = c.secret ? (M.mem.plain[m.id] ?? '…กำลังถอดรหัส') : m.text;
    let body;
    switch (m.type) {
      case 'sticker': body = `<div class="msg-stk">${M.sticker(m.sticker, 120)}</div>`; break;
      case 'image': body = `<button class="msg-img${m.sensitive && !m.revealed && M.st.settings.nudityProtect ? ' blur' : ''}" data-act="viewImage" data-c="${c.id}" data-m="${m.id}">${M.media(m)}${m.sensitive && !m.revealed && M.st.settings.nudityProtect ? `<span class="blur-note">${I('eyeOff', 22)}<b>รูปนี้อาจมีเนื้อหาไม่เหมาะสม</b><small>ระบบเบลอให้อัตโนมัติ แตะเพื่อเลือกว่าจะดูไหม</small></span>` : ''}</button>`; break;
      case 'post': case 'reel': {
        const p = m.type === 'reel' ? M.st.reels.find(r => r.id === m.postId) : M.findPost(m.postId);
        body = p ? `<button class="msg-post" data-act="openPost" data-id="${p.id}"><span class="mp-h">${M.avatar(M.user(p.userId), 24)} ${esc(M.user(p.userId).handle)}</span><span class="mp-m">${M.media(p.slides ? p.slides[0] : { art: p.art })}${m.type === 'reel' ? `<span class="tile-ic">${I('reels', 16)}</span>` : ''}</span><span class="mp-c">${esc(p.caption.slice(0, 60))}</span></button>` : '<div class="bub">โพสต์ไม่พร้อมใช้งาน</div>';
        break;
      }
      case 'storyReply': body = `<div class="msg-sr"><small class="muted">${mine ? 'คุณตอบกลับสตอรี่' : 'ตอบกลับสตอรี่ของคุณ'}</small><span class="sr-m">${M.media(m)}</span><div class="bub">${esc(m.text)}</div></div>`; break;
      case 'instant': body = `<button class="msg-inst${m.opened ? ' opened' : ''}" data-act="viewInstant" data-c="${c.id}" data-m="${m.id}">${I('camera', 18)}<span>${m.opened ? 'Instant · เปิดแล้ว' : 'Instant · แตะเพื่อดู (ดูได้ครั้งเดียว)'}</span></button>`; break;
      default: body = `<div class="bub${c.secret ? ' enc' : ''}">${M.richText(text)}</div>`;
    }
    const meta = [m.edited ? 'แก้ไขแล้ว' : '', m.silent ? 'ส่งแบบเงียบ' : '', M.clock(m.ts)].filter(Boolean).join(' · ');
    const isLastMine = mine && !arr.slice(i + 1).some(x => x.from === 'me');
    const stat = isLastMine && c.type === 'dm' ? (m.status === 'read' && M.st.settings.readReceipts ? 'อ่านแล้ว' : m.status === 'read' || m.status === 'delivered' ? 'ส่งถึงแล้ว' : 'ส่งแล้ว') : '';
    const react = c.type === 'broadcast' ? `<button class="react${m.reacted ? ' on' : ''}" data-act="reactMsg" data-c="${c.id}" data-m="${m.id}">${I('heart', 14)} ${M.num((m.reacts || 0) + (m.reacted ? 1 : 0))}</button>` : '';
    return day + `<div class="msg${mine ? ' me' : ''}" data-mid="${m.id}">${!mine ? (prev?.from === m.from && !day ? '<span class="av-gap"></span>' : (m.nick ? `<span class="av" style="--s:28px;--h:${M.hash(m.nick) % 360}">${esc([...m.nick][0])}</span>` : M.avatar(u, 28))) : ''}
      <div class="msg-c">${showName ? `<small class="who">${esc(m.nick || u.name)}</small>` : ''}<div class="msg-tap" ${mine || m.type === 'text' ? `data-act="msgMenu" data-c="${c.id}" data-m="${m.id}"` : ''}>${body}</div>
      <small class="meta">${meta}${stat ? ' · ' + stat : ''}</small>${react}</div></div>`;
  };

  const composer = c => {
    const st = M.st;
    if (c.request) return `<div class="req-bar"><p class="muted small">${esc(M.user(c.members[0]).handle)} ต้องการส่งข้อความถึงคุณ เขาจะไม่รู้ว่าคุณเห็นข้อความจนกว่าคุณจะยอมรับ</p><div class="dlg-a"><button class="btn sec" data-act="reqDecide" data-id="${c.id}" data-v="block">บล็อก</button><button class="btn sec" data-act="reqDecide" data-id="${c.id}" data-v="del">ลบ</button><button class="btn pri" data-act="reqDecide" data-id="${c.id}" data-v="ok">ยอมรับ</button></div></div>`;
    if (c.type === 'broadcast' && c.owner !== 'me') return `<div class="req-bar"><p class="muted small center">ช่องนี้ส่งข้อความได้เฉพาะผู้สร้าง คุณกดถูกใจข้อความได้</p></div>`;
    return `<div class="stk-panel" hidden>${M.STICKERS.map((_, i) => `<button data-stk="${i}" aria-label="${M.STICKERS[i].t}">${M.sticker(i, 72)}</button>`).join('')}</div>
      <form class="composer chat-comp" data-comp>
        <button type="button" class="ibtn" data-act="attach" data-id="${c.id}" aria-label="แนบไฟล์">${I('plus')}</button>
        <input class="field" name="t" placeholder="${c.secret ? 'ข้อความเข้ารหัส' : 'ข้อความ'}" autocomplete="off" maxlength="1000" aria-label="พิมพ์ข้อความ">
        <button type="button" class="ibtn" data-stkbtn aria-label="สติกเกอร์">${I('smile')}</button>
        <button class="ibtn send" aria-label="ส่ง">${I('send')}</button>
      </form>`;
  };

  const roomBody = c => {
    const st = M.st;
    const unreadBig = c._unreadOnOpen >= 10 && c.type === 'group';
    const banner = unreadBig && !c._summary
      ? `<div class="room-banner"><div class="sum-cta">${I('list', 18)}<span>มี ${c._unreadOnOpen} ข้อความที่ยังไม่ได้อ่าน</span><button class="btn sm pri" data-act="summarize" data-id="${c.id}">สรุปให้อ่าน</button></div></div>`
      : c._summary ? `<div class="room-banner"><div class="sum-card"><div class="sec-row"><b>สรุป ${c._summary.count} ข้อความที่ยังไม่ได้อ่าน</b><button class="ibtn sm" data-act="closeSummary" data-id="${c.id}" aria-label="ปิดสรุป">${I('x', 16)}</button></div><small class="muted">สรุปอัตโนมัติในเครื่อง (จำลองการสรุปด้วย AI) · คุยมากที่สุด: ${esc(c._summary.top.join(', '))}</small><ul>${c._summary.points.map(p => `<li><b>${esc(p.who)}</b>: ${esc(p.text)}</li>`).join('')}</ul></div></div>` : '';
    return `${banner}<div class="room-msgs scroll" data-msgs>
      ${c.secret ? `<div class="e2ee-note">${I('lock', 18)}<p>ข้อความในแชตนี้เข้ารหัสต้นทางถึงปลายทาง ระบบ (รวมถึงเซิร์ฟเวอร์) อ่านไม่ได้</p><button class="link acc" data-act="safetyNumber" data-id="${c.id}">ดูรหัสความปลอดภัย</button></div>` : ''}
      ${c.request && c.messages.some(m => m.text && M.sec.scanUrl((m.text.match(/https?:\/\/\S+/) || [''])[0] || 'https://mali.example').level === 'danger') ? `<div class="warn-card">${I('alert', 20)}<p><b>ข้อความนี้อาจเป็นการหลอกลวง</b><br>มีลิงก์ที่ระบบตรวจพบว่าอันตราย อย่ากรอกรหัสผ่านหรือข้อมูลบัตร</p></div>` : ''}
      ${c.messages.map((m, i, arr) => msgHTML(c, m, i, arr)).join('')}
      <div class="typing" hidden><span></span><span></span><span></span></div>
    </div>${composer(c)}`;
  };

  function mountRoomInto(container, id, inPane = true) {
    const c = chatById(id);
    if (!c) return;
    container.innerHTML = `<div class="room">${roomHead(c, inPane)}${roomBody(c)}</div>`;
    wireRoom(container, c);
  }
  M.Pages.room = {
    static: true,
    render: p => { const c = chatById(p.id); if (c && c._unreadOnOpen == null) c._unreadOnOpen = 0; return `<div class="room">${roomHead(c)}${roomBody(c)}</div>`; },
    mount: (el, p) => wireRoom(el, chatById(p.id)),
    unmount: () => { M.openId = null; M.refresh(); }
  };
  // บันทึกจำนวนที่ยังไม่อ่านตอนเปิด (ใช้กับปุ่มสรุป)
  const _open = M.openChat;
  M.openChat = id => { const c = chatById(id); if (c) { c._unreadOnOpen = c.unread; c._summary = null; } _open(id); };

  M.redrawRoom = c => {
    const top = M.topPage();
    let host = null;
    if (top?.dataset.page === 'room' && top._params.id === c.id) host = top;
    else if (M.isWide() && M.openId === c.id) host = M.$('#chatPane');
    if (!host) return false;
    const box = host.querySelector('[data-msgs]');
    const nearBottom = box ? box.scrollHeight - box.scrollTop - box.clientHeight < 120 : true;
    const draft = host.querySelector('[data-comp] input')?.value || '';
    if (host.id === 'chatPane') mountRoomInto(host, c.id); else { host.innerHTML = `<div class="room">${roomHead(c)}${roomBody(c)}</div>`; wireRoom(host, c); }
    const inp = host.querySelector('[data-comp] input'); if (inp) inp.value = draft;
    const b2 = host.querySelector('[data-msgs]'); if (b2 && nearBottom) b2.scrollTop = b2.scrollHeight;
    return true;
  };

  function wireRoom(el, c) {
    c.unread = 0; M.save(); M.renderNav();
    const box = el.querySelector('[data-msgs]');
    box.scrollTop = box.scrollHeight;
    if (c.secret) decryptAll(c).then(() => { el.querySelectorAll('.bub.enc').length && M.redrawRoom(c); });
    const f = el.querySelector('[data-comp]');
    if (!f) return;
    const panel = el.querySelector('.stk-panel');
    el.querySelector('[data-stkbtn]').onclick = () => { panel.hidden = !panel.hidden; };
    panel.onclick = e => { const b = e.target.closest('[data-stk]'); if (!b) return; sendMsg(c, { type: 'sticker', sticker: +b.dataset.stk }); panel.hidden = true; };
    f.onsubmit = async e => {
      e.preventDefault();
      let t = f.t.value.trim(); if (!t) return;
      const editId = f.dataset.edit;
      if (editId) {
        const m = c.messages.find(x => x.id === editId);
        if (c.secret) { m.cipher = await M.sec.encrypt(c, t); M.mem.plain[m.id] = t; } else m.text = t;
        m.edited = true; delete f.dataset.edit; f.t.value = ''; M.save(); M.redrawRoom(c); return;
      }
      let silent = false;
      if (/^@silent\s+/i.test(t)) { silent = true; t = t.replace(/^@silent\s+/i, ''); M.toast('ส่งแบบเงียบ ผู้รับจะไม่ได้ยินเสียงแจ้งเตือน'); }
      const url = (t.match(/https?:\/\/\S+/) || [])[0];
      if (url && M.st.settings.linkScan) { const s = M.sec.scanUrl(url); if (s.level === 'danger' && !await M.confirm('ลิงก์นี้อาจเป็นอันตราย', s.reasons.join(' · ') + ' — ยังต้องการส่งไหม', 'ส่งต่อไป', true)) return; }
      f.t.value = '';
      sendMsg(c, { type: 'text', text: t, silent });
    };
  }

  async function decryptAll(c) {
    for (const m of c.messages) if (m.cipher && M.mem.plain[m.id] == null) { try { M.mem.plain[m.id] = await M.sec.decrypt(c, m.cipher); } catch { M.mem.plain[m.id] = '[ถอดรหัสไม่ได้]'; } }
  }

  async function sendMsg(c, msg) {
    if (!M.sec.guard('msg', 8, 10000, 'ส่งข้อความ')) return;
    const m = { id: M.uid('x'), from: 'me', ts: Date.now(), status: 'sent', ...msg };
    if (c.secret && m.type === 'text') { m.cipher = await M.sec.encrypt(c, m.text); M.mem.plain[m.id] = m.text; delete m.text; }
    c.messages.push(m);
    M.save(); M.redrawRoom(c);
    setTimeout(() => { m.status = 'delivered'; M.save(); }, 600);
    if (c.type !== 'broadcast' && c.type !== 'official') M.botReply(c); else if (c.type === 'official') M.botReply(c, 'ขอบคุณที่ติดต่อมา บัญชีทางการจะตอบกลับภายใน 24 ชั่วโมง (จำลอง)');
  }
  M.sendMsg = sendMsg;

  /* คู่สนทนาจำลอง */
  M.botReply = (c, fixed) => {
    if (c.request || c._typing) return;
    c._typing = true;
    const delay = 900 + Math.random() * 1400;
    const showTyping = on => { const h = M.topPage()?.dataset.page === 'room' ? M.topPage() : M.$('#chatPane'); h?.querySelector('.typing')?.toggleAttribute('hidden', !on); const b = h?.querySelector('[data-msgs]'); if (b && on) b.scrollTop = b.scrollHeight; };
    setTimeout(() => showTyping(true), 400);
    setTimeout(async () => {
      c._typing = false;
      c.messages.forEach(m => { if (m.from === 'me') m.status = 'read'; });
      let from = c.members[0], nick;
      if (c.type === 'group') from = M.pick(c.members);
      const text = fixed || M.pick(c.replies || ['โอเค', 'ได้เลย', 'จริง']);
      const m = { id: M.uid('x'), from, nick, type: 'text', text, ts: Date.now(), status: 'read' };
      if (c.secret) { m.cipher = await M.sec.encrypt(c, text); M.mem.plain[m.id] = text; delete m.text; }
      c.messages.push(m);
      const visible = M.redrawRoom(c);
      if (!visible) { c.unread = (c.unread || 0) + 1; if (!c.muted) M.toast(`${c.name || M.user(c.members[0]).name}: ${c.secret ? 'ข้อความใหม่ที่เข้ารหัส' : text}`); M.refresh(); }
      M.save();
    }, delay);
  };

  /* เมนูข้อความ: แก้ไขภายใน 60 นาที / ยกเลิกส่ง / คัดลอก */
  A.msgMenu = el => {
    const c = chatById(el.dataset.c), m = c.messages.find(x => x.id === el.dataset.m);
    const mine = m.from === 'me';
    const canEdit = mine && m.type === 'text' || (mine && m.cipher);
    const left = 60 - Math.floor((Date.now() - m.ts) / 60000);
    const text = c.secret ? M.mem.plain[m.id] : m.text;
    M.menu([
      canEdit && left > 0 && { label: 'แก้ไข', sub: `แก้ได้อีก ${left} นาที`, icon: 'edit', act: () => {
        const host = M.topPage()?.dataset.page === 'room' ? M.topPage() : M.$('#chatPane');
        const f = host.querySelector('[data-comp]'); f.dataset.edit = m.id; f.t.value = text; f.t.focus(); M.toast('กำลังแก้ไขข้อความ กดส่งเพื่อบันทึก');
      } },
      canEdit && left <= 0 && { label: 'แก้ไขไม่ได้แล้ว', sub: 'แก้ไขได้ภายใน 60 นาทีหลังส่ง', icon: 'clock' },
      text && { label: 'คัดลอก', icon: 'copy', act: () => { navigator.clipboard?.writeText(text).catch(() => {}); M.toast('คัดลอกแล้ว'); } },
      mine && { label: 'ยกเลิกการส่ง', icon: 'undo', danger: true, act: () => { c.messages = c.messages.filter(x => x !== m); M.save(); M.redrawRoom(c); M.toast('ยกเลิกการส่งแล้ว'); } },
      !mine && { label: 'รายงาน', icon: 'flag', danger: true, act: () => M.report(M.user(m.from)) }
    ]);
  };
  A.reactMsg = el => { const c = chatById(el.dataset.c), m = c.messages.find(x => x.id === el.dataset.m); m.reacted = !m.reacted; M.save(); M.redrawRoom(c); };
  A.reqDecide = async el => {
    const c = chatById(el.dataset.id), v = el.dataset.v;
    if (v === 'ok') { c.request = false; M.toast('ยอมรับคำขอแล้ว'); M.redrawRoom(c); M.refresh(); return; }
    if (v === 'block') { await M.blockUser(c.members[0]); }
    M.st.chats = M.st.chats.filter(x => x !== c); M.openId = null;
    if (M.topPage()?.dataset.page === 'room') M.back(); M.refresh();
  };
  A.summarize = el => {
    const c = chatById(el.dataset.id);
    const msgs = c.messages.slice(-c._unreadOnOpen);
    c._summary = M.sec.summarize(msgs);
    M.redrawRoom(c);
  };
  A.closeSummary = el => { const c = chatById(el.dataset.id); c._summary = null; c._unreadOnOpen = 0; M.redrawRoom(c); };
  A.viewImage = async el => {
    const c = chatById(el.dataset.c), m = c.messages.find(x => x.id === el.dataset.m);
    if (m.sensitive && !m.revealed && M.st.settings.nudityProtect) {
      if (!await M.confirm('ดูรูปที่อาจไม่เหมาะสมไหม', 'รูปนี้ถูกเบลอโดยการป้องกันภาพไม่เหมาะสม (การตรวจจับในต้นแบบเป็นการจำลอง) คุณบล็อกหรือรายงานผู้ส่งได้', 'ดูรูป')) return;
      m.revealed = true; M.save(); M.redrawRoom(c); return;
    }
    M.sheet(`<div class="img-full">${M.media(m)}</div>`, { cls: 'tall' });
  };
  A.viewInstant = el => {
    const c = chatById(el.dataset.c), m = c.messages.find(x => x.id === el.dataset.m);
    if (m.opened && m.from !== 'me') return M.toast('Instant ดูได้ครั้งเดียว');
    const p = M.push('instantView', { m });
    void p;
    if (m.from !== 'me') { m.opened = true; M.save(); }
  };
  M.Pages.instantView = {
    cls: 'dark fade', static: true,
    render: p => `<div class="inst-v">${M.media(p.m)}<div class="inst-h"><b>Instant</b><span class="muted">${M.ago(p.m.ts)} · ถ่ายสด ไม่ผ่านการแต่ง</span><span class="sp"></span><button class="ibtn" data-act="back" aria-label="ปิด">${I('x')}</button></div></div>`,
    unmount: () => M.refresh()
  };

  /* แนบไฟล์ */
  A.attach = el => {
    const c = chatById(el.dataset.id);
    M.menu([
      { label: 'รูปภาพหรือวิดีโอ', icon: 'image', act: async () => {
        const files = await M.pickFiles('image/*,video/*', true);
        for (const f of files.slice(0, 5)) {
          if (f.type.startsWith('video')) { const key = M.uid('v'); M.mem.videos[key] = URL.createObjectURL(f); await sendMsg(c, { type: 'image', vid: key, art: { kind: 'abstract', seed: 3 } }); }
          else {
            const v = await M.adult.guard(f, 'chat');
            if (!v) continue;
            const r = await M.sec.processImage(f, 1080);
            await sendMsg(c, { type: 'image', img: r.dataUrl, sensitive: v.verdict === 'sensitive' });
            if (r.gps) M.toast('ลบพิกัด GPS ออกจากรูปก่อนส่งแล้ว');
          }
        }
      } },
      { label: 'Instants', sub: 'ถ่ายรูปสดแล้วส่งทันที ไม่มีการแต่ง', icon: 'camera', act: () => M.push('instants', { chatId: c.id }) },
      { label: 'ภาพตัวอย่าง', sub: 'ส่งภาพประกอบจากคลังตัวอย่าง', icon: 'grid', act: () => sendMsg(c, { type: 'image', art: { kind: M.pick(M.SCENES), seed: Math.floor(Math.random() * 999) } }) },
      { label: 'แชร์โพสต์ที่บันทึกไว้', icon: 'bookmark', act: () => {
        const list = M.st.saved.map(M.findPost).filter(Boolean);
        if (!list.length) return M.toast('ยังไม่มีโพสต์ที่บันทึกไว้');
        M.menu(list.map(p => ({ label: M.user(p.userId).handle, sub: p.caption.slice(0, 40), act: () => sendMsg(c, { type: 'post', postId: p.id }) })), 'เลือกโพสต์');
      } },
      { label: 'แชร์ตำแหน่งปัจจุบัน', sub: 'ตำแหน่งจำลอง', icon: 'pin', act: () => sendMsg(c, { type: 'text', text: 'ตำแหน่งของฉัน: ใกล้สถานีอารีย์ (ตำแหน่งจำลอง)' }) }
    ]);
  };

  /* ข้อมูลแชต */
  A.chatInfo = el => M.push('chatInfo', { id: el.dataset.id });
  M.Pages.chatInfo = {
    render(p) {
      const c = chatById(p.id);
      const ppl = c.type === 'broadcast' ? [c.owner] : c.members;
      return M.bar('ข้อมูล') + `<div class="scroll"><div class="col pad">
        <div class="center">${chatAvatar(c, 80)}<h2>${esc(title(c))}</h2><p class="muted">${status(c)}</p></div>
        <div class="pf-btns">${['dm', 'group'].includes(c.type) ? `<button class="btn sec" data-act="startCall" data-id="${c.id}" data-video="0">${I('phone', 18)} โทร</button><button class="btn sec" data-act="startCall" data-id="${c.id}" data-video="1">${I('video', 18)} วิดีโอ</button>` : ''}
          ${c.type === 'dm' ? `<button class="btn sec" data-act="openUser" data-id="${c.members[0]}">${I('user', 18)} โปรไฟล์</button>` : ''}</div>
        ${M.rows([
          { t: 'nav', label: c.muted ? 'เปิดการแจ้งเตือน' : 'ปิดการแจ้งเตือน', icon: 'bellOff', act: 'muteChat', data: `data-id="${c.id}"` },
          c.type === 'dm' && !c.secret && { t: 'nav', label: 'เริ่มแชตลับ', sub: 'เข้ารหัสต้นทางถึงปลายทางด้วย ECDH + AES-GCM', icon: 'lock', act: 'startSecretFrom', data: `data-id="${c.members[0]}"` },
          c.secret && { t: 'nav', label: 'รหัสความปลอดภัย', sub: 'เทียบตัวเลขกับอีกฝ่ายเพื่อยืนยันว่าไม่มีคนดักกลาง', icon: 'shieldCheck', act: 'safetyNumber', data: `data-id="${c.id}"` },
          c.secret && { t: 'nav', label: 'ดูข้อมูลที่เก็บในเครื่อง', sub: 'แสดงข้อความในรูปแบบที่เข้ารหัสแล้ว', icon: 'eye', act: 'showCipher', data: `data-id="${c.id}"` },
          { t: 'toggle', k: 'settings.readReceipts', label: 'แสดงว่าอ่านแล้ว', sub: 'ปิดเพื่อไม่ให้อีกฝ่ายรู้ว่าคุณอ่านแล้ว (ใช้กับทุกแชต)', icon: 'check2' },
          c.type === 'dm' && { t: 'nav', label: 'จำกัดบัญชี', icon: 'minus', act: 'unlist', data: `data-k="restricted" data-id="${c.members[0]}"` },
          c.type === 'dm' && { t: 'nav', label: 'บล็อก', icon: 'ban', act: 'blockFromChat', data: `data-id="${c.members[0]}"` },
          { t: 'nav', label: 'ลบแชต', icon: 'trash', act: 'deleteChat', data: `data-id="${c.id}"` }
        ])}
        ${ppl.length ? `<h3 class="sec-t">สมาชิก</h3><div class="rows">${ppl.map(id => `<button class="row" data-act="openUser" data-id="${id}">${M.avatar(M.user(id), 40)}<span class="row-tx"><span>${esc(M.user(id).name)}</span><small>${esc(M.user(id).handle)}</small></span></button>`).join('')}</div>` : ''}
      </div></div>`;
    }
  };
  A.muteChat = el => { const c = chatById(el.dataset.id); c.muted = !c.muted; M.toast(c.muted ? 'ปิดการแจ้งเตือนแล้ว' : 'เปิดการแจ้งเตือนแล้ว'); M.refresh(); };
  A.blockFromChat = el => M.blockUser(el.dataset.id);
  A.deleteChat = async el => {
    if (!await M.confirm('ลบแชตนี้ไหม', 'ลบเฉพาะในเครื่องของคุณ', 'ลบ', true)) return;
    M.st.chats = M.st.chats.filter(c => c.id !== el.dataset.id); M.openId = null;
    while (M.stack.length) M.back();
    setTimeout(() => M.refresh(), 350);
  };

  /* ---------- แชตลับ ---------- */
  M.startSecret = async uid => {
    if (!M.sec.available) return M.toast('เบราว์เซอร์นี้ไม่รองรับ Web Crypto ให้เปิดผ่าน localhost หรือ https');
    const c = M.ensureDM(uid, true);
    if (!c.keys) {
      c.keys = await M.sec.e2eeSetup();
      c.messages.push({ id: M.uid('x'), from: 'sys', type: 'system', text: 'เริ่มแชตลับแล้ว ข้อความถูกเข้ารหัสด้วยกุญแจที่อยู่ในเครื่องเท่านั้น', ts: Date.now() });
      c.replies = ['ได้รับแล้ว', 'อันนี้เป็นความลับนะ', 'โอเค'];
    }
    M.openChat(c.id);
  };
  A.startSecretFrom = el => { M.back(); setTimeout(() => M.startSecret(el.dataset.id), 320); };
  A.safetyNumber = async el => {
    const c = chatById(el.dataset.id);
    const n = await M.sec.safetyNumber(c);
    M.sheet(`<p class="muted">เทียบตัวเลขชุดนี้กับเครื่องของ ${esc(M.user(c.members[0]).name)} ถ้าตรงกัน แปลว่าการเข้ารหัสไม่มีคนดักกลาง</p><p class="safety">${n}</p><p class="note">กุญแจลับสร้างด้วย ECDH P-256 และเข้ารหัสข้อความด้วย AES-GCM 256 บิต ในต้นแบบนี้ทั้งสองฝั่งอยู่ในเบราว์เซอร์เดียวกันเพื่อการสาธิต</p>`, { title: 'รหัสความปลอดภัย' });
  };
  A.showCipher = el => {
    const c = chatById(el.dataset.id);
    const rows = c.messages.filter(m => m.cipher).slice(-6).map(m => `<div class="cipher"><small class="muted">${M.clock(m.ts)} · iv ${esc(m.cipher.iv)}</small><code>${esc(m.cipher.ct)}</code></div>`).join('');
    M.sheet(rows || '<p class="empty">ยังไม่มีข้อความ</p>', { title: 'ข้อมูลที่เก็บในเครื่อง (เข้ารหัสแล้ว)' });
  };

  /* ---------- ลิงก์ ---------- */
  A.openLink = async el => {
    const url = el.dataset.url;
    const s = M.st.settings.linkScan ? M.sec.scanUrl(url) : { level: 'safe', reasons: [] };
    if (s.level === 'danger') {
      M.sheet(`<div class="warn-card big">${I('alert', 28)}<div><b>หยุดก่อน ลิงก์นี้อาจเป็นอันตราย</b><ul>${s.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul><p class="muted small">${esc(url)}</p></div></div>
        <div class="dlg-a"><button class="btn pri" data-act="closeSheet">กลับไปอย่างปลอดภัย</button></div><p class="note">มะลิจะไม่ขอรหัสผ่านหรือรหัส OTP ผ่านลิงก์ในแชต</p>`, { title: 'ตรวจพบลิงก์อันตราย' });
      return;
    }
    if (s.level === 'warn' || !/(^|\.)mali\.example$/.test(s.host || '')) {
      if (!await M.confirm('เปิดลิงก์ภายนอก', `${url}${s.reasons.length ? ' — ' + s.reasons.join(', ') : ''}`, 'เปิดลิงก์')) return;
    } else return M.toast('ลิงก์ภายในแอป (ตัวอย่าง) ไม่มีหน้าจริงในต้นแบบนี้');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /* ---------- การโทร ---------- */
  M.Pages.calls = {
    render() {
      const st = M.st;
      return M.bar('การโทร', `<button class="ibtn" data-act="newCall" aria-label="โทรใหม่">${I('plus')}</button>`) + `<div class="scroll"><div class="col">
        <h3 class="sec-t pad">ล่าสุด</h3><div class="rows">${st.calls.slice().sort((a, b) => b.ts - a.ts).map(k => { const u = M.user(k.userId); return `<div class="row">${M.avatar(u, 44)}<span class="row-tx"><span class="${k.missed ? 'neg' : ''}">${esc(u.name)}</span><small>${k.dir === 'out' ? 'โทรออก' : k.missed ? 'สายที่ไม่ได้รับ' : 'สายเข้า'} · ${k.video ? 'วิดีโอ' : 'เสียง'}${k.dur ? ' · ' + M.dur(k.dur) : ''} · ${M.ago(k.ts)}</small></span>
          <button class="ibtn" data-act="callUser2" data-id="${u.id}" data-video="0" aria-label="โทรด้วยเสียง">${I('phone')}</button><button class="ibtn" data-act="callUser2" data-id="${u.id}" data-video="1" aria-label="วิดีโอคอล">${I('video')}</button></div>`; }).join('')}</div>
        <p class="note pad">การโทรในต้นแบบเป็นการจำลอง ถ้าอนุญาตกล้อง จะเห็นภาพจากกล้องของคุณในหน้าต่างเล็ก</p></div></div>`;
    }
  };
  A.newCall = () => M.menu(Object.values(M.st.users).filter(u => u.friend).map(u => ({ label: u.name, sub: u.handle, icon: 'phone', act: () => M.push('call', { userId: u.id, video: false }) })), 'โทรหา');
  A.callUser2 = el => M.push('call', { userId: el.dataset.id, video: el.dataset.video === '1' });
  A.startCall = el => {
    const c = chatById(el.dataset.id);
    M.push('call', { chatId: c.id, userId: c.type === 'dm' ? c.members[0] : null, video: el.dataset.video === '1' });
  };
  M.Pages.call = {
    cls: 'dark fade', static: true,
    render(p) {
      const c = p.chatId && chatById(p.chatId);
      const name = c?.type === 'group' ? c.name : M.user(p.userId).name;
      const u = p.userId ? M.user(p.userId) : M.user(c.members[0]);
      return `<div class="call${p.video ? ' video' : ''}">
        <div class="call-remote">${p.video ? `<div class="art kb">${M.scene('city', M.hash(name) % 50)}</div>` : ''}</div>
        <div class="call-info">${p.video ? '' : M.avatar(u, 112)}<h2>${esc(name)}</h2><p data-cs>กำลังโทร…</p></div>
        <div class="call-self" ${p.video ? '' : 'hidden'}><video autoplay playsinline muted></video><span>${M.avatar(M.st.me, 48)}</span></div>
        <div class="call-ctl">
          <button class="cbtn" data-c="mic" aria-label="ปิดไมค์">${I('mic')}</button>
          <button class="cbtn${p.video ? '' : ' off'}" data-c="cam" aria-label="กล้อง">${I(p.video ? 'video' : 'videoOff')}</button>
          <button class="cbtn" data-c="flip" aria-label="สลับกล้อง">${I('flip')}</button>
          <button class="cbtn" data-c="spk" aria-label="ลำโพง">${I('speaker')}</button>
          <button class="cbtn end" data-c="end" aria-label="วางสาย">${I('phone')}</button></div>
        <p class="call-note">การโทรจำลอง ไม่มีการเชื่อมต่อจริง</p></div>`;
    },
    mount(el, p) {
      const cs = el.querySelector('[data-cs]');
      let sec = 0, connected = false, stream = null, cam = !!p.video, mic = true;
      const startCam = async () => {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); const v = el.querySelector('.call-self video'); v.srcObject = stream; el.querySelector('.call-self').classList.add('on-cam'); }
        catch { M.toast('ไม่ได้รับอนุญาตใช้กล้อง แสดงรูปโปรไฟล์แทน'); }
      };
      const stopCam = () => { stream?.getTracks().forEach(t => t.stop()); stream = null; el.querySelector('.call-self')?.classList.remove('on-cam'); };
      if (cam) startCam();
      const t1 = setTimeout(() => { connected = true; cs.textContent = '0:00'; }, 2400);
      const iv = setInterval(() => { if (connected) cs.textContent = M.dur(++sec); }, 1000);
      el._cleanup = () => { clearTimeout(t1); clearInterval(iv); stopCam(); };
      el.onclick = e => {
        const b = e.target.closest('[data-c]'); if (!b) return;
        const k = b.dataset.c;
        if (k === 'mic') { mic = !mic; b.innerHTML = I(mic ? 'mic' : 'micOff'); b.classList.toggle('off', !mic); }
        if (k === 'cam') { cam = !cam; b.innerHTML = I(cam ? 'video' : 'videoOff'); b.classList.toggle('off', !cam); el.querySelector('.call').classList.toggle('video', cam); el.querySelector('.call-self').hidden = !cam; cam ? startCam() : stopCam(); }
        if (k === 'spk') { b.classList.toggle('on'); M.toast(b.classList.contains('on') ? 'เปิดลำโพง' : 'ปิดลำโพง'); }
        if (k === 'flip') M.toast('สลับกล้อง (จำลอง)');
        if (k === 'end') {
          const st = M.st, uid = p.userId || chatById(p.chatId).members[0];
          st.calls.push({ id: M.uid('k'), userId: uid, video: cam || p.video, dir: 'out', dur: sec, ts: Date.now(), missed: !connected });
          const c = p.chatId ? chatById(p.chatId) : M.ensureDM(uid);
          c.messages.push({ id: M.uid('x'), from: 'me', type: 'call', video: p.video, dur: sec, missed: !connected, ts: Date.now() });
          M.save(); M.back();
        }
      };
    },
    unmount: el => { el._cleanup?.(); M.refresh(); }
  };

  /* ---------- Instants ---------- */
  A.openInstants = () => M.push('instants', {});
  M.Pages.instants = {
    cls: 'dark', static: true,
    render: p => `<div class="inst">
      <div class="inst-h">${M.bar('Instants', '', { cls: 'dark', close: true })}</div>
      <div class="inst-cam"><video autoplay playsinline muted></video><div class="art fallback">${M.scene('cafe', 900)}</div><canvas hidden></canvas></div>
      <p class="muted center small">ถ่ายแล้วส่งทันที ไม่มีฟิลเตอร์ ไม่มีการแต่ง ผู้รับดูได้ครั้งเดียว</p>
      <div class="inst-to hscroll">${(p.chatId ? [] : M.st.closeFriends).map(id => `<button class="share-p on" data-uid="${id}">${M.avatar(M.user(id), 44)}<span>${esc(M.user(id).name.split(' ')[0])}</span></button>`).join('')}</div>
      <div class="inst-ctl"><button class="shutter" data-shot aria-label="ถ่ายและส่ง"></button></div></div>`,
    async mount(el, p) {
      const v = el.querySelector('video');
      try { el._stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); v.srcObject = el._stream; el.querySelector('.fallback').hidden = true; }
      catch { v.hidden = true; }
      el.querySelectorAll('.share-p').forEach(b => b.onclick = () => b.classList.toggle('on'));
      el.querySelector('[data-shot]').onclick = async () => {
        let msg;
        if (el._stream && v.videoWidth) {
          const cv = el.querySelector('canvas'), s = Math.min(1, 720 / v.videoWidth);
          cv.width = v.videoWidth * s; cv.height = v.videoHeight * s;
          cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
          msg = { type: 'instant', img: cv.toDataURL('image/jpeg', .7), viewOnce: true };
        } else msg = { type: 'instant', art: { kind: 'cafe', seed: 900 }, viewOnce: true };
        const targets = p.chatId ? [chatById(p.chatId)] : [...el.querySelectorAll('.share-p.on')].map(b => M.ensureDM(b.dataset.uid));
        if (!targets.length) return M.toast('เลือกผู้รับอย่างน้อยหนึ่งคน');
        el.querySelector('.inst-cam').classList.add('flash');
        for (const c of targets) c.messages.push({ id: M.uid('x'), from: 'me', ts: Date.now(), status: 'sent', ...msg });
        M.save(); M.toast(`ส่ง Instant ถึง ${targets.length} แชตแล้ว`);
        setTimeout(() => M.back(), 350);
      };
    },
    unmount: el => { el._stream?.getTracks().forEach(t => t.stop()); M.refresh(); }
  };

  /* ---------- แผนที่เพื่อน ---------- */
  A.openMap = () => M.push('friendsMap');
  M.Pages.friendsMap = {
    render() {
      const st = M.st;
      const pins = [['ploy', 62, 38, 12], ['ton', 48, 30, 40], ['pim', 30, 62, 95], ['jirat', 70, 70, 5]].filter(([id]) => st.closeFriends.includes(id) || id === 'jirat');
      const posts = [['p1', 55, 34], ['p3', 40, 58], ['p10', 22, 50]];
      const share = st.settings.locationShare;
      return M.bar('แผนที่เพื่อน') + `<div class="scroll"><div class="map">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="100" height="100" fill="var(--map-bg)"/>
          <path d="M18 0 C28 20 12 35 26 52 S20 80 34 100" stroke="var(--map-water)" stroke-width="6" fill="none"/>
          ${[15, 35, 55, 75, 90].map(y => `<path d="M0 ${y} L100 ${y + 4}" stroke="var(--map-road)" stroke-width="1.2"/>`).join('')}
          ${[45, 65, 85].map(x => `<path d="M${x} 0 L${x - 6} 100" stroke="var(--map-road)" stroke-width="1.2"/>`).join('')}
          <rect x="72" y="40" width="14" height="10" rx="2" fill="var(--map-park)"/><rect x="50" y="78" width="10" height="12" rx="2" fill="var(--map-park)"/>
          <text x="74" y="38" font-size="3" fill="var(--tx3)">สวน</text><text x="52" y="22" font-size="3" fill="var(--tx3)">อารีย์</text><text x="30" y="88" font-size="3" fill="var(--tx3)">ฝั่งธนฯ</text><text x="66" y="62" font-size="3" fill="var(--tx3)">สีลม</text>
        </svg>
        ${posts.map(([id, x, y]) => { const p = M.findPost(id); return p ? `<button class="map-post" style="left:${x}%;top:${y}%" data-act="openPost" data-id="${id}" aria-label="โพสต์ที่ปักหมุด">${M.media(p.slides[0])}</button>` : ''; }).join('')}
        ${pins.map(([id, x, y, ago]) => `<button class="map-pin" style="left:${x}%;top:${y}%" data-act="openUser" data-id="${id}">${M.avatar(M.user(id), 40)}<small>${esc(M.user(id).name.split(' ')[0])} · ${ago} นาที</small></button>`).join('')}
        ${share !== 'off' ? `<span class="map-pin me" style="left:52%;top:46%">${M.avatar(st.me, 40)}<small>คุณ</small></span>` : ''}
      </div>
      <div class="col pad">
        <h3 class="sec-t">แชร์ตำแหน่งของคุณกับ</h3>
        <div class="seg">${[['off', 'ไม่แชร์'], ['close', 'เพื่อนสนิท'], ['mutual', 'คนที่ติดตามกันและกัน']].map(([v, l]) => `<button class="${share === v ? 'on' : ''}" data-act="setLoc" data-v="${v}">${l}</button>`).join('')}</div>
        <p class="note">ตำแหน่งทั้งหมดเป็นข้อมูลจำลอง ต้นแบบนี้ไม่อ่าน GPS จริง ตำแหน่งจะอัปเดตเฉพาะตอนเปิดแอป และหยุดแชร์ได้ทุกเมื่อ เพื่อนเห็นได้เฉพาะเมื่อคุณเลือกให้เห็นเท่านั้น</p>
      </div></div>`;
    }
  };
  A.setLoc = el => { M.st.settings.locationShare = el.dataset.v; M.toast(el.dataset.v === 'off' ? 'หยุดแชร์ตำแหน่งแล้ว' : 'กำลังแชร์ตำแหน่งโดยประมาณ'); M.refresh(); };
})(window.M);
