'use strict';
/* แชตและวิดีโอคอลข้ามเครื่องของจริง (ฟรี ไม่ต้องมีเซิร์ฟเวอร์ของเราเอง)
   - ใช้ PeerJS + WebRTC: เสียง ภาพ และข้อความวิ่งตรงระหว่างสองเครื่อง (เข้ารหัส DTLS-SRTP ตามมาตรฐาน WebRTC)
   - ใช้เซิร์ฟเวอร์จับคู่สาธารณะฟรีของ PeerJS (0.peerjs.com) เพื่อแลกข้อมูลเชื่อมต่อเท่านั้น และ STUN ของ Google หา IP สาธารณะ
   - ไม่มี TURN server: เครือข่ายบางแห่ง (เช่นมือถือบางค่าย หรือ NAT แบบเข้มงวด) อาจเชื่อมต่อไม่ได้
   - ข้อความไม่ถูกบันทึกลงเครื่อง ปิดหน้าแล้วหายไป */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;
  const LIB = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const LIB_SRI = 'sha384-nlUQ8ZqCbvStErob+biJNzSgltf6urV3VGqhfIfzhmg9RXmpeRm76ELw0pYnKlTR';
  const PREFIX = 'mali-p2p-';
  const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789'; // ตัดตัวที่สับสนง่าย เช่น l/1 o/0

  let libP = null;
  const loadLib = () => libP || (libP = new Promise((res, rej) => {
    if (window.Peer) return res(window.Peer);
    const s = document.createElement('script');
    s.src = LIB; s.integrity = LIB_SRI; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
    s.onload = () => res(window.Peer); s.onerror = () => { libP = null; rej(new Error('load')); };
    document.head.appendChild(s);
  }));
  const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALPHA[b % ALPHA.length]).join('');
  const fmt = c => c.slice(0, 3) + '-' + c.slice(3);
  const clean = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);

  // สถานะของการเชื่อมต่อ (อยู่ในหน่วยความจำเท่านั้น)
  const S = M.p2p = { peer: null, code: '', conn: null, call: null, local: null, remote: null, log: [], state: 'idle', partner: '', video: true, mic: true, err: '' };

  const setState = (state, extra = {}) => { Object.assign(S, { state }, extra); draw(); };
  const page = () => document.querySelector('.page[data-page="p2p"]');
  const draw = () => { const el = page(); if (el) M.renderPage(el); };

  const say = (from, text) => {
    S.log.push({ from, text, ts: Date.now() });
    const box = page()?.querySelector('[data-p2plog]');
    if (box) { box.insertAdjacentHTML('beforeend', bubble(S.log[S.log.length - 1])); box.scrollTop = box.scrollHeight; }
    else draw();
  };
  const bubble = m => m.from === 'sys'
    ? `<p class="p2p-sys">${esc(m.text)}</p>`
    : `<div class="msg ${m.from === 'me' ? 'me' : ''}"><div class="bub" translate="no">${esc(m.text)}</div></div>`;

  async function open() {
    if (S.peer && !S.peer.destroyed) return;
    setState('starting', { err: '' });
    let Peer;
    try { Peer = await loadLib(); } catch { return setState('error', { err: 'โหลดตัวเชื่อมต่อไม่ได้ ต้องออนไลน์' }); }
    S.code = newCode();
    const peer = S.peer = new Peer(PREFIX + S.code, { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } });
    peer.on('open', () => setState(S.conn ? S.state : 'ready'));
    peer.on('connection', c => { if (S.conn && S.conn.open) { c.on('open', () => { c.send({ t: 'busy' }); setTimeout(() => c.close(), 300); }); return; } attach(c); });
    peer.on('call', async call => {
      if (S.call) return call.close();
      const ok = await M.confirm('สายเข้า', `${S.partner || 'เพื่อน'} ขอวิดีโอคอล`, 'รับสาย');
      if (!ok) { S.conn?.send({ t: 'declined' }); return call.close(); }
      const stream = await media(); if (!stream) return call.close();
      call.answer(stream); bindCall(call);
    });
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    peer.on('error', e => {
      const map = { 'peer-unavailable': 'ไม่พบรหัสนี้ หรืออีกเครื่องปิดหน้าไปแล้ว', 'network': 'เชื่อมต่อเซิร์ฟเวอร์จับคู่ไม่ได้', 'unavailable-id': 'รหัสซ้ำ ลองใหม่อีกครั้ง', 'browser-incompatible': 'เบราว์เซอร์นี้ไม่รองรับ WebRTC', 'server-error': 'เซิร์ฟเวอร์จับคู่มีปัญหา ลองใหม่ภายหลัง' };
      const msg = map[e.type] || 'เชื่อมต่อไม่สำเร็จ';
      if (e.type === 'peer-unavailable') { S.conn = null; setState('ready', { err: msg }); }
      else setState('error', { err: msg });
    });
  }

  function attach(c) {
    S.conn = c;
    setState('connecting');
    const t = setTimeout(() => { if (S.state === 'connecting') { c.close(); S.conn = null; setState('ready', { err: 'เชื่อมต่อไม่สำเร็จ เครือข่ายอาจบล็อกการเชื่อมต่อตรง ลองใช้ Wi-Fi เดียวกัน' }); } }, 20000);
    c.on('open', () => {
      clearTimeout(t);
      c.send({ t: 'hello', name: M.st.me.name });
      S.log = []; setState('chat', { err: '' });
      say('sys', 'เชื่อมต่อแล้ว ข้อความส่งตรงถึงอีกเครื่องและไม่ถูกบันทึก');
    });
    c.on('data', d => {
      if (!d || typeof d !== 'object') return;
      if (d.t === 'hello') { S.partner = String(d.name || 'เพื่อน').slice(0, 40); draw(); }
      else if (d.t === 'msg') say('them', String(d.text || '').slice(0, 2000));
      else if (d.t === 'busy') { c.close(); S.conn = null; setState('ready', { err: 'อีกเครื่องกำลังคุยกับคนอื่นอยู่' }); }
      else if (d.t === 'declined') { M.toast('อีกฝ่ายไม่รับสาย'); endCall(true); }
    });
    c.on('close', () => { if (S.conn === c) { S.conn = null; endCall(true); S.partner = ''; setState('ready', { err: 'อีกฝ่ายออกจากการเชื่อมต่อแล้ว' }); } });
  }

  async function media() {
    try { S.local = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true }); }
    catch { try { S.local = await navigator.mediaDevices.getUserMedia({ audio: true }); M.toast('ใช้กล้องไม่ได้ โทรด้วยเสียงอย่างเดียว'); } catch { M.toast('ไม่ได้รับอนุญาตใช้ไมค์และกล้อง'); return null; } }
    S.mic = true; S.video = S.local.getVideoTracks().length > 0;
    return S.local;
  }
  function bindCall(call) {
    S.call = call;
    setState('call');
    call.on('stream', rs => { S.remote = rs; const v = page()?.querySelector('[data-remote]'); if (v) v.srcObject = rs; page()?.querySelector('.p2p-wait')?.remove(); });
    call.on('close', () => endCall(true));
    call.on('error', () => endCall(true));
  }
  function endCall(silent) {
    const had = !!S.call;
    try { S.call?.close(); } catch {}
    S.local?.getTracks().forEach(t => t.stop());
    S.call = S.local = S.remote = null;
    if (had) { if (S.conn) setState('chat'); if (!silent) say('sys', 'วางสายแล้ว'); }
  }
  function closeAll() {
    endCall(true);
    try { S.conn?.close(); } catch {}
    try { S.peer?.destroy(); } catch {}
    Object.assign(S, { peer: null, conn: null, code: '', state: 'idle', partner: '', log: [], err: '' });
  }

  const shareLink = () => location.href.split('#')[0] + '#p2p=' + S.code;

  M.Pages.p2p = {
    cls: 'fade',
    render(p) {
      const st = S.state;
      if (st === 'call') return `<div class="call video p2p-call">
          <div class="call-remote"><video data-remote autoplay playsinline></video><p class="p2p-wait">กำลังรอภาพจาก ${esc(S.partner || 'เพื่อน')}…</p></div>
          <div class="call-self on-cam"><video data-local autoplay playsinline muted></video></div>
          <div class="call-ctl">
            <button class="cbtn${S.mic ? '' : ' off'}" data-act="p2pMic" aria-label="${S.mic ? 'ปิดไมค์' : 'เปิดไมค์'}">${I(S.mic ? 'mic' : 'micOff')}</button>
            <button class="cbtn${S.video ? '' : ' off'}" data-act="p2pCam" aria-label="${S.video ? 'ปิดกล้อง' : 'เปิดกล้อง'}">${I(S.video ? 'video' : 'videoOff')}</button>
            <button class="cbtn end" data-act="p2pHang" aria-label="วางสาย">${I('phone')}</button></div>
          <p class="call-note">เชื่อมต่อตรงระหว่างสองเครื่อง (WebRTC)</p></div>`;
      const head = M.bar(S.partner && st === 'chat' ? `<span translate="no">${esc(S.partner)}</span>` : 'คุยข้ามเครื่อง', st === 'chat' ? `<button class="ibtn" data-act="p2pCall" aria-label="วิดีโอคอล">${I('video')}</button>` : '');
      if (st === 'chat') return head + `<div class="scroll p2p-log" data-p2plog>${S.log.map(bubble).join('')}</div>
        <form class="composer p2p-form" data-p2pform><input class="field" name="t" maxlength="2000" autocomplete="off" placeholder="พิมพ์ข้อความ" aria-label="ข้อความ"><button class="ibtn" aria-label="ส่ง">${I('send')}</button></form>`;
      const busy = st === 'starting' || st === 'connecting';
      return head + `<div class="scroll"><div class="col pad p2p-home">
        <div class="p2p-hero">${M.bud(st === 'error' ? 'sad' : 'happy', 72)}<h2>คุยและวิดีโอคอลกับเพื่อนที่อีกเครื่องได้จริง</h2>
          <p class="muted">ให้อีกเครื่องเปิดมะลิ แล้วใส่รหัสของคุณ หรือเปิดลิงก์ที่คุณส่งให้ ใช้ได้ฟรี ไม่ต้องสมัคร</p></div>
        ${S.err ? `<p class="p2p-err" role="alert">${esc(S.err)}</p>` : ''}
        ${st === 'error' ? `<button class="btn pri wide" data-act="p2pRetry">ลองใหม่</button>` : busy && !S.code ? `<p class="muted center">กำลังเตรียมรหัส…</p>` : `
        <section class="p2p-card"><h3 class="sec-t">รหัสของคุณ</h3>
          <div class="p2p-code" translate="no">${S.code ? fmt(S.code) : '······'}</div>
          <div class="p2p-row"><button class="btn sec" data-act="p2pCopy" ${S.code ? '' : 'disabled'}>${I('copy', 18)} คัดลอกลิงก์</button>${navigator.share ? `<button class="btn sec" data-act="p2pShare" ${S.code ? '' : 'disabled'}>${I('send', 18)} แชร์</button>` : ''}</div></section>
        <section class="p2p-card"><h3 class="sec-t">หรือใส่รหัสของเพื่อน</h3>
          <form class="p2p-row" data-p2pjoin><input class="field" name="c" inputmode="latin" autocapitalize="off" autocomplete="off" maxlength="7" placeholder="เช่น abc-234" aria-label="รหัสของเพื่อน" value="${esc(p.join ? fmt(clean(p.join)) : '')}" translate="no"><button class="btn pri" ${busy ? 'disabled' : ''}>${st === 'connecting' ? 'กำลังเชื่อมต่อ…' : 'เชื่อมต่อ'}</button></form></section>`}
        <p class="note">ภาพ เสียง และข้อความส่งตรงระหว่างสองเครื่องและเข้ารหัสตามมาตรฐาน WebRTC ใช้เซิร์ฟเวอร์สาธารณะฟรีของ PeerJS เพื่อจับคู่เท่านั้น เครือข่ายบางแห่งอาจเชื่อมต่อตรงไม่ได้ ข้อความไม่ถูกบันทึก</p>
      </div></div>`;
    },
    mount(el, p) {
      const join = p.join; p.join = '';
      if (S.state === 'idle') open().then(() => { if (join && S.state !== 'error') connectTo(join); });
      else if (join && S.state === 'ready') connectTo(join);
      const jf = el.querySelector('[data-p2pjoin]');
      if (jf) jf.onsubmit = e => { e.preventDefault(); connectTo(jf.c.value); };
      const f = el.querySelector('[data-p2pform]');
      if (f) {
        f.onsubmit = e => {
          e.preventDefault();
          const v = f.t.value.trim(); if (!v || !S.conn?.open) return;
          if (!M.sec.guard('p2pmsg', 20, 10000, 'ส่งข้อความ')) return;
          S.conn.send({ t: 'msg', text: v }); f.t.value = ''; say('me', v);
        };
        const box = el.querySelector('[data-p2plog]'); box.scrollTop = box.scrollHeight;
        setTimeout(() => f.t.focus(), 50);
      }
      const lv = el.querySelector('[data-local]'); if (lv && S.local) lv.srcObject = S.local;
      const rv = el.querySelector('[data-remote]'); if (rv && S.remote) { rv.srcObject = S.remote; el.querySelector('.p2p-wait')?.remove(); }
    },
    unmount() { closeAll(); M.refresh(); }
  };

  async function connectTo(raw) {
    const code = clean(raw);
    if (code.length !== 6) return M.toast('รหัสต้องมี 6 ตัว');
    if (code === S.code) return M.toast('นี่คือรหัสของคุณเอง ให้ใส่รหัสของอีกเครื่อง');
    if (!S.peer || S.peer.destroyed) await open();
    if (!S.peer?.open) await new Promise(r => { const t = setInterval(() => { if (S.peer?.open || S.state === 'error') { clearInterval(t); r(); } }, 200); setTimeout(() => { clearInterval(t); r(); }, 10000); });
    if (!S.peer?.open) return;
    attach(S.peer.connect(PREFIX + code, { reliable: true }));
  }

  A.p2pRetry = () => { closeAll(); open(); };
  A.p2pCopy = async () => { try { await navigator.clipboard.writeText(shareLink()); M.toast('คัดลอกลิงก์แล้ว ส่งให้เพื่อนเปิดได้เลย'); } catch { M.prompt('คัดลอกลิงก์นี้', shareLink()); } };
  A.p2pShare = () => navigator.share({ title: 'คุยกับฉันในมะลิ', text: `รหัส ${fmt(S.code)}`, url: shareLink() }).catch(() => {});
  A.p2pCall = async () => {
    if (!S.conn?.open || !S.peer) return;
    const stream = await media(); if (!stream) return;
    bindCall(S.peer.call(S.conn.peer, stream));
  };
  A.p2pHang = () => endCall(false);
  A.p2pMic = () => { S.mic = !S.mic; S.local?.getAudioTracks().forEach(t => t.enabled = S.mic); draw(); };
  A.p2pCam = () => { if (!S.local?.getVideoTracks().length) return M.toast('ไม่มีกล้องในสายนี้'); S.video = !S.video; S.local.getVideoTracks().forEach(t => t.enabled = S.video); draw(); };
  A.openP2P = () => M.push('p2p', {});

  // เปิดจากลิงก์ที่เพื่อนส่งมา: ...#p2p=abc234
  M.p2pFromHash = (hash = location.hash) => {
    const m = hash.match(/^#p2p=([a-z0-9-]{6,7})$/i);
    if (!m) return false;
    history.replaceState(history.state, '', '#home');
    M.push('p2p', { join: m[1] });
    return true;
  };
})(window.M);
