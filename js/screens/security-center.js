'use strict';
/* ศูนย์ความปลอดภัย: ตรวจสอบความปลอดภัย, รหัสผ่าน, 2FA (TOTP/SMS), อุปกรณ์, อีเมลจริงจากแอป, กู้คืนบัญชี,
   แอปที่เชื่อมต่อ (OAuth), การปกป้องขั้นสูง, หน้าเข้าสู่ระบบพร้อมจำกัดการลองรหัส */
(function (M) {
  const A = M.A, esc = M.esc, I = M.icon;
  const sec = () => M.st.security;
  const deviceName = () => {
    const ua = navigator.userAgent;
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Linux';
    const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'เบราว์เซอร์';
    return `${os} · ${br}`;
  };

  const checkup = () => {
    const s = sec();
    const items = [
      { ok: s.totp.enabled || s.sms.enabled, label: 'การยืนยันตัวตนสองชั้น', fix: 'twofa', why: 'ป้องกันแม้คนอื่นรู้รหัสผ่าน' },
      { ok: !!s.password && s.password.score >= 3, label: 'รหัสผ่านแข็งแรง', fix: 'password', why: s.password ? `ความแข็งแรง: ${M.sec.STRENGTH_TH[s.password.score]}` : 'ยังไม่ได้ตั้งรหัสผ่านในต้นแบบ' },
      { ok: s.recoveryEmail && s.recoveryPhone, label: 'อีเมลและเบอร์โทรสำหรับกู้คืน', fix: 'recoveryInfo', why: 'ใช้ยืนยันตัวตนเมื่อเข้าบัญชีไม่ได้' },
      { ok: !s.sessions.some(x => x.unknown), label: 'ไม่มีอุปกรณ์ที่ไม่รู้จัก', fix: 'sessions', why: s.sessions.some(x => x.unknown) ? 'พบการเข้าสู่ระบบที่ไม่คุ้นเคย' : '' },
      { ok: s.loginAlerts, label: 'แจ้งเตือนการเข้าสู่ระบบ', fix: 'loginAlerts', why: 'รู้ทันทีเมื่อมีอุปกรณ์ใหม่' }
    ];
    return { items, score: items.filter(i => i.ok).length };
  };

  M.Pages.security = {
    render() {
      const s = sec(), c = checkup();
      const pct = Math.round(c.score / c.items.length * 100);
      return M.bar('ศูนย์ความปลอดภัย') + `<div class="scroll"><div class="col pad">
        <section class="check-card"><div class="sec-row"><div><b>ตรวจสอบความปลอดภัย</b><p class="muted small">ผ่าน ${c.score} จาก ${c.items.length} ข้อ</p></div><span class="score ${pct === 100 ? 'pos' : pct >= 60 ? '' : 'neg'}">${pct}%</span></div>
          <div class="meter"><i style="width:${pct}%"></i></div>
          <div class="rows">${c.items.map(i => `<button class="row tight" data-act="fixSec" data-k="${i.fix}"><span class="row-ic ${i.ok ? 'pos' : 'warn'}">${I(i.ok ? 'check' : 'alert', 20)}</span><span class="row-tx"><span>${i.label}</span>${i.why ? `<small>${esc(i.why)}</small>` : ''}</span>${i.ok ? '' : '<span class="row-v acc">แก้ไข</span>'}</button>`).join('')}</div></section>
        ${M.rows([
          { t: 'head', label: 'การเข้าสู่ระบบและการกู้คืน' },
          { t: 'nav', label: 'เปลี่ยนรหัสผ่าน', icon: 'key', page: 'password', value: s.password ? M.sec.STRENGTH_TH[s.password.score] : 'ยังไม่ตั้ง' },
          { t: 'nav', label: 'การยืนยันตัวตนสองชั้น', icon: 'shieldCheck', page: 'twofa', value: s.totp.enabled ? 'แอปยืนยันตัวตน' : s.sms.enabled ? 'SMS' : 'ปิด' },
          { t: 'nav', label: 'ตำแหน่งที่คุณเข้าสู่ระบบ', icon: 'device', page: 'sessions', value: s.sessions.length },
          { t: 'toggle', k: 'security.loginAlerts', label: 'แจ้งเตือนการเข้าสู่ระบบที่ไม่รู้จัก', icon: 'alert' },
          { t: 'toggle', k: 'security.advanced', label: 'การปกป้องขั้นสูง', sub: 'สำหรับบัญชีเสี่ยงสูงหรือครีเอเตอร์ ต้องเปิด 2FA ก่อน', icon: 'fingerprint' },
          { t: 'nav', label: 'อีเมลจากมะลิ', sub: 'อีเมลจริงที่ส่งถึงคุณใน 14 วัน ใช้ตรวจจับอีเมลปลอม', icon: 'mail', page: 'emails' },
          { t: 'nav', label: 'บัญชีถูกแฮ็กหรือเข้าไม่ได้', icon: 'hand', page: 'recover' },
          { t: 'head', label: 'ข้อความและสื่อ' },
          { t: 'nav', label: 'เริ่มแชตลับ (เข้ารหัสต้นทางถึงปลายทาง)', icon: 'lock', act: 'newChat' },
          { t: 'nav', label: 'ทดสอบตัวตรวจลิงก์', icon: 'link', act: 'testLink' },
          { t: 'nav', label: 'ทดสอบการลบข้อมูลตำแหน่งในรูป', sub: 'เลือกรูปจากมือถือเพื่อดูว่ามี EXIF/GPS หรือไม่', icon: 'pin', act: 'testExif' },
          { t: 'toggle', k: 'settings.nudityProtect', label: 'ป้องกันภาพไม่เหมาะสมในแชต', icon: 'eyeOff' },
          { t: 'choice', k: 'settings.adultFilter', label: 'ตัวกรองภาพ 18+', sub: 'ตรวจรูปโปรไฟล์ แบนเนอร์ โพสต์ และรูปในแชตก่อนอัปโหลด', icon: 'shieldCheck', options: [['standard', 'มาตรฐาน'], ['strict', 'เข้มงวด']] },
          { t: 'nav', label: 'ทดสอบตัวกรองภาพ 18+', sub: 'เลือกรูปเพื่อดูผลตรวจ รูปไม่ถูกส่งออกจากเครื่อง', icon: 'image', act: 'testAdult' },
          { t: 'head', label: 'การเข้าถึงข้อมูล' },
          { t: 'nav', label: 'แอปและเว็บไซต์ที่เชื่อมต่อ', sub: 'จัดการสิทธิ์ (โทเค็น) ที่ให้แอปภายนอก', icon: 'link', page: 'apps' },
          { t: 'nav', label: 'ระบบหลังบ้านที่ต้องมีในบริการจริง', icon: 'server', page: 'backend' }
        ])}</div></div>`;
    }
  };
  A.fixSec = el => {
    const k = el.dataset.k;
    if (k === 'loginAlerts') { sec().loginAlerts = true; M.toast('เปิดการแจ้งเตือนแล้ว'); return M.refresh(); }
    if (k === 'recoveryInfo') return A.recoveryInfo();
    M.push(k);
  };
  M.onToggle['security.advanced'] = v => {
    if (v && !(sec().totp.enabled || sec().sms.enabled)) { M.toast('เปิดการยืนยันตัวตนสองชั้นก่อน'); setTimeout(() => M.push('twofa'), 400); return false; }
    if (v) setTimeout(() => M.sheet(`<ul class="prose"><li>เข้าสู่ระบบจากอุปกรณ์ใหม่ต้องใช้รหัส 2FA ทุกครั้ง</li><li>ระงับการเปลี่ยนอีเมลและเบอร์กู้คืน 48 ชั่วโมงหลังเข้าสู่ระบบจากอุปกรณ์ใหม่</li><li>ยืนยันทุกครั้งก่อนเปิดลิงก์ภายนอกในแชต</li><li>เฝ้าระวังพฤติกรรมผิดปกติแบบเข้มขึ้น (บริการจริงทำที่เซิร์ฟเวอร์)</li></ul>`, { title: 'เปิดการปกป้องขั้นสูงแล้ว' }), 100);
  };
  A.recoveryInfo = () => {
    const s = sec();
    M.sheet(M.rows([
      { t: 'toggle', k: 'security.recoveryEmail', label: 'อีเมลกู้คืน', sub: M.st.me.email, icon: 'mail' },
      { t: 'toggle', k: 'security.recoveryPhone', label: 'เบอร์โทรกู้คืน', sub: M.st.me.phone, icon: 'device' }
    ]) + '<p class="note">ข้อมูลติดต่อถูกปิดบังบางส่วนเพื่อความเป็นส่วนตัว (ข้อมูลตัวอย่าง)</p>', { title: 'ข้อมูลกู้คืนบัญชี', onClose: () => M.refresh() });
    void s;
  };
  A.testLink = async () => {
    const url = await M.prompt('ใส่ลิงก์ที่ต้องการตรวจ', 'https://mali-login-verify.com/reset', 'https://', { ok: 'ตรวจ' });
    if (!url) return;
    const r = M.sec.scanUrl(url);
    M.sheet(`<div class="warn-card ${r.level === 'safe' ? 'ok' : r.level}">${I(r.level === 'safe' ? 'shieldCheck' : 'alert', 24)}<div><b>${{ safe: 'ไม่พบความเสี่ยงที่ทราบ', warn: 'ควรระวัง', danger: 'อันตราย' }[r.level]}</b>${r.reasons.length ? `<ul>${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<p class="muted small">${esc(url)}</p></div></div>
      <p class="note">ต้นแบบตรวจด้วยรายการเว็บหลอกลวงตัวอย่างและฮิวริสติก บริการจริงต้องตรวจกับฐานข้อมูลภัยคุกคามที่เซิร์ฟเวอร์แบบเรียลไทม์ ลองตัวอย่าง: http://192.168.1.10/login, https://xn--mli-lla.com</p>`, { title: 'ผลตรวจลิงก์' });
  };
  A.testExif = async () => {
    const [f] = await M.pickFiles('image/*'); if (!f) return;
    const r = await M.sec.processImage(f, 600);
    M.sheet(`<div class="img-full small">${`<img src="${r.dataUrl}" alt="">`}</div>
      <div class="rows"><div class="row"><span class="row-tx"><span>ไฟล์ต้นฉบับมี EXIF</span></span><span class="row-v">${r.exif ? 'มี' : 'ไม่มี'}</span></div>
      <div class="row"><span class="row-tx"><span>ไฟล์ต้นฉบับมีพิกัด GPS</span></span><span class="row-v ${r.gps ? 'neg' : ''}">${r.gps ? 'มี' : 'ไม่มี'}</span></div>
      <div class="row"><span class="row-tx"><span>ไฟล์ที่จะอัปโหลด</span></span><span class="row-v pos">ลบข้อมูลแล้ว · ${r.w}×${r.h}</span></div></div>`, { title: 'ผลตรวจรูปภาพ' });
  };

  /* รหัสผ่าน (เก็บเฉพาะแฮช PBKDF2) */
  M.Pages.password = {
    render: () => M.bar('เปลี่ยนรหัสผ่าน') + `<div class="scroll"><form class="col pad form" data-pw>
      ${sec().password ? '<label>รหัสผ่านปัจจุบัน<input class="field" type="password" name="cur" autocomplete="current-password" required></label>' : '<p class="note">ยังไม่ได้ตั้งรหัสผ่านในต้นแบบนี้ ตั้งเพื่อทดลองหน้าเข้าสู่ระบบ</p>'}
      <label>รหัสผ่านใหม่<input class="field" type="password" name="pw" minlength="8" autocomplete="new-password" required></label>
      <div class="meter"><i data-sm style="width:0"></i></div><small class="muted" data-st>อย่างน้อย 8 ตัว ผสมตัวพิมพ์เล็กใหญ่ ตัวเลข และสัญลักษณ์</small>
      <label>ยืนยันรหัสผ่านใหม่<input class="field" type="password" name="pw2" autocomplete="new-password" required></label>
      <label class="row"><span class="row-tx"><span>ออกจากระบบอุปกรณ์อื่นทั้งหมด</span></span><input type="checkbox" class="switch" name="others" checked></label>
      <button class="btn pri block">บันทึกรหัสผ่าน</button>
      <p class="note">${I('lock', 14)} รหัสผ่านถูกแปลงเป็นแฮชด้วย PBKDF2-SHA256 210,000 รอบพร้อม salt สุ่ม ระบบไม่เก็บรหัสผ่านตัวจริง</p></form></div>`,
    mount(el) {
      const f = el.querySelector('[data-pw]');
      f.pw.oninput = () => { const s = M.sec.strength(f.pw.value); el.querySelector('[data-sm]').style.width = (s / 4 * 100) + '%'; el.querySelector('[data-sm]').dataset.s = s; el.querySelector('[data-st]').textContent = 'ความแข็งแรง: ' + M.sec.STRENGTH_TH[s]; };
      f.onsubmit = async e => {
        e.preventDefault();
        if (!M.sec.available) return M.toast('ต้องเปิดผ่าน localhost หรือ https เพื่อใช้ Web Crypto');
        const s = sec();
        if (s.password && !await M.sec.checkPassword(f.cur.value, s.password)) return M.toast('รหัสผ่านปัจจุบันไม่ถูกต้อง');
        if (f.pw.value !== f.pw2.value) return M.toast('รหัสผ่านใหม่ไม่ตรงกัน');
        const score = M.sec.strength(f.pw.value);
        if (score < 2) return M.toast('รหัสผ่านอ่อนเกินไป');
        s.password = { ...(await M.sec.hashPassword(f.pw.value)), score, changed: Date.now() };
        if (f.others.checked) s.sessions = s.sessions.filter(x => x.current);
        M.st.security.emails.unshift({ id: M.uid('e'), subject: 'รหัสผ่านของคุณถูกเปลี่ยน', type: 'ความปลอดภัย', ts: Date.now(), body: 'หากคุณไม่ได้เปลี่ยนรหัสผ่าน ให้ไปที่ "บัญชีถูกแฮ็กหรือเข้าไม่ได้" ทันที' });
        M.toast('เปลี่ยนรหัสผ่านแล้ว'); M.back(); M.refresh();
      };
    }
  };

  /* 2FA */
  M.Pages.twofa = {
    static: true,
    render() {
      const s = sec();
      return M.bar('การยืนยันตัวตนสองชั้น') + `<div class="scroll"><div class="col pad" data-2fa>
        <div class="info-card">${I('shieldCheck', 24)}<div><b>ป้องกันบัญชีอีกชั้น</b><p class="muted small">เมื่อเข้าสู่ระบบจากอุปกรณ์ที่ไม่รู้จัก ระบบจะขอรหัส 6 หลักเพิ่มจากรหัสผ่าน</p></div></div>
        ${M.rows([])}
        <div class="rows">
          <div class="row"><span class="row-ic">${I('key', 22)}</span><span class="row-tx"><span>แอปยืนยันตัวตน (แนะนำ)</span><small>${s.totp.enabled ? 'เปิดใช้อยู่' : 'ใช้แอปอย่าง Google Authenticator หรือแอปยืนยันตัวตนอื่น'}</small></span>
            <button class="btn sm ${s.totp.enabled ? 'sec' : 'pri'}" data-2="${s.totp.enabled ? 'totpOff' : 'totpOn'}">${s.totp.enabled ? 'ปิด' : 'ตั้งค่า'}</button></div>
          <div class="row"><span class="row-ic">${I('device', 22)}</span><span class="row-tx"><span>SMS หรือ WhatsApp</span><small>${s.sms.enabled ? 'ส่งไปที่ ' + esc(s.sms.phone) : 'รับรหัสทางข้อความ (จำลอง)'}</small></span>
            <button class="btn sm ${s.sms.enabled ? 'sec' : 'pri'}" data-2="${s.sms.enabled ? 'smsOff' : 'smsOn'}">${s.sms.enabled ? 'ปิด' : 'ตั้งค่า'}</button></div>
          ${s.totp.backup?.length ? `<div class="row"><span class="row-ic">${I('list', 22)}</span><span class="row-tx"><span>รหัสสำรอง</span><small>เหลือ ${s.totp.backup.length} รหัส ใช้เมื่อไม่มีมือถือ</small></span><button class="btn sm sec" data-2="backup">ดู</button></div>` : ''}
        </div><div data-flow></div></div></div>`;
    },
    mount(el) {
      const box = el.querySelector('[data-2fa]'), flow = el.querySelector('[data-flow]');
      let tmr;
      const redraw = () => { clearInterval(tmr); M.renderPage(el); };
      box.onclick = async e => {
        const b = e.target.closest('[data-2]'); if (!b) return;
        const s = sec(), k = b.dataset['2'];
        if (!M.sec.available) return M.toast('ต้องเปิดผ่าน localhost หรือ https เพื่อใช้ Web Crypto');
        if (k === 'totpOn') {
          const secret = M.sec.newTotpSecret();
          const uri = M.sec.otpauth(secret, M.st.me.handle);
          flow.innerHTML = `<section class="check-card"><b>ขั้นที่ 1: เพิ่มคีย์ในแอปยืนยันตัวตน</b><p class="muted small">เลือก "ใส่คีย์ตั้งค่า" ในแอป แล้วกรอกคีย์นี้ (ประเภท: ตามเวลา)</p>
            <p class="safety mono">${secret.match(/.{4}/g).join(' ')}</p>
            <div class="dlg-a"><button class="btn sec sm" data-cp="${secret}">คัดลอกคีย์</button><button class="btn sec sm" data-cp="${esc(uri)}">คัดลอกลิงก์ otpauth</button></div>
            <p class="muted small">สำหรับทดลองโดยไม่มีแอป: รหัสปัจจุบันคือ <b data-cur>······</b> <span data-left></span></p>
            <b>ขั้นที่ 2: กรอกรหัส 6 หลักจากแอป</b>
            <form class="composer" data-v><input class="field mono" name="c" inputmode="numeric" maxlength="7" placeholder="000 000" autocomplete="one-time-code"><button class="btn pri sm">ยืนยัน</button></form></section>`;
          const upd = async () => { flow.querySelector('[data-cur]') && (flow.querySelector('[data-cur]').textContent = await M.sec.totp(secret)); const l = flow.querySelector('[data-left]'); if (l) l.textContent = `(เปลี่ยนใน ${30 - Math.floor(Date.now() / 1000) % 30} วินาที)`; };
          upd(); tmr = setInterval(upd, 1000); el._tmr = tmr;
          flow.querySelectorAll('[data-cp]').forEach(x => x.onclick = () => { navigator.clipboard?.writeText(x.dataset.cp).catch(() => {}); M.toast('คัดลอกแล้ว'); });
          flow.querySelector('[data-v]').onsubmit = async ev => {
            ev.preventDefault();
            if (!M.sec.guard('totp', 5, 60000, 'ลองรหัส')) return;
            if (!await M.sec.verifyTotp(secret, ev.target.c.value)) return M.toast('รหัสไม่ถูกต้อง ตรวจว่าเวลาในมือถือตรงกับเวลาจริง');
            s.totp = { enabled: true, secret, backup: M.sec.backupCodes() };
            M.save(); M.toast('เปิดการยืนยันตัวตนสองชั้นแล้ว');
            redraw(); showBackup();
          };
        }
        if (k === 'totpOff' || k === 'smsOff') {
          const code = await M.prompt('ยืนยันด้วยรหัส 6 หลักก่อนปิด', '', '000000', { ok: 'ปิด 2FA', note: k === 'totpOff' ? 'กรอกรหัสจากแอปยืนยันตัวตน หรือรหัสสำรอง' : 'กรอกรหัสที่ส่งทาง SMS (จำลอง)' });
          if (code == null) return;
          const okTotp = k === 'totpOff' && (await M.sec.verifyTotp(s.totp.secret, code) || s.totp.backup.includes(code.toUpperCase()));
          const okSms = k === 'smsOff' && code === s.sms.last;
          if (!okTotp && !okSms) return M.toast('รหัสไม่ถูกต้อง');
          if (k === 'totpOff') s.totp = { enabled: false, secret: null, backup: [] }; else s.sms = { enabled: false, phone: '' };
          if (!s.totp.enabled && !s.sms.enabled) s.advanced = false;
          M.save(); M.toast('ปิดแล้ว'); redraw();
        }
        if (k === 'smsOn') {
          const phone = await M.prompt('เบอร์โทรศัพท์', '', '08x-xxx-xxxx', { type: 'tel', ok: 'ส่งรหัส' });
          if (!phone || phone.replace(/\D/g, '').length < 9) return phone && M.toast('เบอร์ไม่ถูกต้อง');
          s.sms.last = String(Math.floor(1e5 + Math.random() * 9e5));
          M.toast(`SMS จำลอง: รหัสยืนยันของคุณคือ ${s.sms.last}`, { ms: 8000 });
          const code = await M.prompt('กรอกรหัสจาก SMS', '', '000000', { ok: 'ยืนยัน' });
          if (code !== s.sms.last) return code != null && M.toast('รหัสไม่ถูกต้อง');
          s.sms = { enabled: true, phone: phone.replace(/\d(?=\d{2})/g, '•'), last: s.sms.last };
          M.save(); M.toast('เปิด 2FA ผ่าน SMS แล้ว'); redraw();
        }
        if (k === 'backup') showBackup();
      };
      const showBackup = () => {
        const codes = sec().totp.backup;
        M.sheet(`<p class="muted">เก็บรหัสเหล่านี้ไว้ในที่ปลอดภัย แต่ละรหัสใช้ได้ครั้งเดียว</p><div class="codes mono">${codes.map(c => `<span>${c}</span>`).join('')}</div><button class="btn sec block" data-cpall>คัดลอกทั้งหมด</button>`, { title: 'รหัสสำรอง', mount: sh => sh.querySelector('[data-cpall]').onclick = () => { navigator.clipboard?.writeText(codes.join('\n')).catch(() => {}); M.toast('คัดลอกแล้ว'); } });
      };
    },
    unmount(el) { clearInterval(el._tmr); M.refresh(); }
  };

  /* อุปกรณ์ที่เข้าสู่ระบบ */
  M.Pages.sessions = {
    render(p) {
      const s = sec(), sel = p.select;
      return M.bar('ตำแหน่งที่คุณเข้าสู่ระบบ', s.sessions.length > 1 ? `<button class="link acc" data-act="sessSelect">${sel ? 'ยกเลิก' : 'เลือก'}</button>` : '') + `<div class="scroll"><div class="col pad">
        <p class="muted small">บัญชี ${esc(M.st.me.handle)} เข้าสู่ระบบอยู่บนอุปกรณ์เหล่านี้ ถ้าไม่รู้จักอุปกรณ์ใด ให้ออกจากระบบแล้วเปลี่ยนรหัสผ่าน</p>
        <div class="rows">${s.sessions.map(x => `<label class="row${x.unknown ? ' warn-row' : ''}"><span class="row-ic${x.unknown ? ' warn' : ''}">${I(x.current ? 'device' : x.icon || 'laptop', 22)}</span>
          <span class="row-tx"><span>${esc(x.device === 'this' ? deviceName() : x.device)}${x.current ? ' <span class="pill pos">อุปกรณ์นี้</span>' : ''}${x.unknown ? ' <span class="pill neg">ไม่คุ้นเคย</span>' : ''}</span><small>${esc(x.place)} · ${x.current ? 'ใช้งานอยู่ตอนนี้' : M.ago(x.ts) + 'ที่แล้ว'}</small></span>
          ${sel && !x.current ? `<input type="checkbox" class="check" data-sid="${x.id}" ${x.unknown ? 'checked' : ''}>` : ''}</label>`).join('')}</div>
        ${sel ? '<button class="btn danger block" data-act="sessLogout">ออกจากระบบอุปกรณ์ที่เลือก</button>' : s.sessions.length > 1 ? '<button class="btn sec block" data-act="sessSelect">เลือกอุปกรณ์ที่จะออกจากระบบ</button>' : ''}
        <p class="note">ระบบจริงจะบันทึกลักษณะอุปกรณ์ เบราว์เซอร์ และ IP ทุกครั้งที่เข้าสู่ระบบ หากพบประเทศหรืออุปกรณ์ใหม่จะแจ้งเตือนและระงับการเปลี่ยนรหัสผ่านชั่วคราว รายการในต้นแบบเป็นข้อมูลจำลอง ยกเว้นชื่ออุปกรณ์นี้ที่อ่านจากเบราว์เซอร์</p></div></div>`;
    }
  };
  A.sessSelect = () => { const t = M.topPage(); t._params.select = !t._params.select; M.renderPage(t); };
  A.sessLogout = async () => {
    const ids = [...document.querySelectorAll('[data-sid]:checked')].map(i => i.dataset.sid);
    if (!ids.length) return M.toast('เลือกอย่างน้อยหนึ่งอุปกรณ์');
    if (!await M.confirm(`ออกจากระบบ ${ids.length} อุปกรณ์ไหม`, 'อุปกรณ์เหล่านั้นต้องเข้าสู่ระบบใหม่ด้วยรหัสผ่าน', 'ออกจากระบบ', true)) return;
    const s = sec(); s.sessions = s.sessions.filter(x => !ids.includes(x.id));
    M.st.notifications = M.st.notifications.filter(n => n.type !== 'security');
    M.topPage()._params.select = false; M.refresh();
    M.sheet(`<p>ออกจากระบบแล้ว แนะนำให้ทำต่อทันที:</p>${M.rows([
      { t: 'nav', label: 'เปลี่ยนรหัสผ่าน', sub: 'ตัดสิทธิ์ไม่ให้เข้าสู่ระบบกลับมาได้', icon: 'key', page: 'password' },
      { t: 'nav', label: 'เปิดการยืนยันตัวตนสองชั้น', sub: 'แม้รู้รหัสผ่านก็เข้าไม่ได้', icon: 'shieldCheck', page: 'twofa' }
    ])}`, { title: 'ขั้นต่อไป' });
  };

  /* อีเมลจากแอป */
  M.Pages.emails = {
    render: () => {
      const list = sec().emails.filter(e => Date.now() - e.ts < 14 * M.T.DAY);
      return M.bar('อีเมลจากมะลิ') + `<div class="scroll"><div class="col pad">
        <div class="info-card">${I('mail', 22)}<div><b>ตรวจอีเมลปลอม</b><p class="muted small">นี่คืออีเมลทั้งหมดที่มะลิส่งถึงคุณใน 14 วันที่ผ่านมา ถ้าได้รับอีเมลที่อ้างว่ามาจากมะลิแต่ไม่อยู่ในรายการนี้ อาจเป็นฟิชชิง อย่ากดลิงก์หรือกรอกรหัสผ่าน</p></div></div>
        <div class="rows">${list.map(e => `<button class="row" data-act="readEmail" data-id="${e.id}"><span class="row-ic">${I(e.type === 'ความปลอดภัย' ? 'shield' : 'mail', 22)}</span><span class="row-tx"><span>${esc(e.subject)}</span><small>${e.type} · ${M.ago(e.ts)}</small></span></button>`).join('')}</div></div></div>`;
    }
  };
  A.readEmail = el => { const e = sec().emails.find(x => x.id === el.dataset.id); M.sheet(`<p class="muted small">จาก security@mali.example · ${M.ago(e.ts)}</p><p>${esc(e.body)}</p>`, { title: esc(e.subject) }); };

  /* กู้คืนบัญชี: ใช้เฉพาะวิธีที่ตรวจได้จริงในต้นแบบ (รหัสจากแอปยืนยันตัวตน หรือรหัสสำรอง) */
  M.Pages.recover = {
    static: true,
    render: () => M.bar('กู้คืนบัญชี') + `<div class="scroll"><div class="col pad" data-rc></div></div>`,
    mount(el) {
      const box = el.querySelector('[data-rc]');
      let step = 1, reason = '';
      const draw = () => {
        const s = sec();
        if (step === 1) box.innerHTML = `<p class="muted">เกิดอะไรขึ้นกับบัญชีของคุณ</p>${['บัญชีถูกแฮ็ก', 'ลืมรหัสผ่าน', 'อีเมลหรือเบอร์โทรถูกเปลี่ยนโดยไม่ได้ทำเอง', 'มีคนแอบอ้างเป็นฉัน'].map(r => `<button class="row card-row" data-r="${r}"><span class="row-tx"><span>${r}</span></span>${I('chev', 18)}</button>`).join('')}`;
        if (step === 2 && s.totp.enabled) box.innerHTML = `<p><b>${esc(reason)}</b></p>
          <div class="info-card">${I('key', 22)}<div><b>ยืนยันตัวตนด้วยรหัส 2FA</b><p class="muted small">กรอกรหัส 6 หลักจากแอปยืนยันตัวตน หรือรหัสสำรอง 8 ตัวที่บันทึกไว้ตอนเปิด 2FA</p></div></div>
          <form class="composer" data-code style="padding:0"><input class="field mono" name="c" autocomplete="one-time-code" placeholder="000000 หรือรหัสสำรอง"><button class="btn pri sm">ยืนยัน</button></form>`;
        if (step === 2 && !s.totp.enabled) box.innerHTML = `<p><b>${esc(reason)}</b></p>
          <div class="warn-card warn">${I('alert', 22)}<div><b>ยังไม่ได้เปิดการยืนยันตัวตนสองชั้น</b><p class="muted small">ต้นแบบนี้กู้คืนบัญชีได้เฉพาะเมื่อมีรหัส 2FA หรือรหัสสำรอง ในบริการจริงต้องมีระบบหลังบ้านส่งลิงก์ไปยังอีเมลหรือเบอร์กู้คืน และทีมช่วยเหลือตรวจสอบตัวตน</p></div></div>
          <button class="btn pri block" data-act="page" data-page="twofa" data-params="{}">เปิด 2FA ตอนนี้เพื่อป้องกันครั้งหน้า</button>`;
        if (step === 3) box.innerHTML = `<div class="center">${M.bud('thanks', 72)}<h2>ยืนยันตัวตนสำเร็จ</h2><p class="muted">ตั้งรหัสผ่านใหม่และออกจากระบบทุกอุปกรณ์อื่นเพื่อความปลอดภัย</p></div><button class="btn pri block" data-done>ตั้งรหัสผ่านใหม่</button>`;
        const f = box.querySelector('[data-code]');
        if (f) f.onsubmit = async e => {
          e.preventDefault();
          if (!M.sec.guard('recover', 5, 60000, 'ลองรหัส')) return;
          const s2 = sec(), code = f.c.value.trim().toUpperCase();
          const ok = await M.sec.verifyTotp(s2.totp.secret, code) || s2.totp.backup.includes(code);
          if (!ok) return M.toast('รหัสไม่ถูกต้อง');
          if (s2.totp.backup.includes(code)) s2.totp.backup = s2.totp.backup.filter(x => x !== code);
          M.save(); step = 3; draw();
        };
      };
      box.onclick = e => {
        const r = e.target.closest('[data-r]');
        if (r) { reason = r.dataset.r; step = 2; draw(); }
        if (e.target.closest('[data-done]')) { sec().sessions = sec().sessions.filter(x => x.current); M.save(); M.back(); setTimeout(() => M.push('password'), 330); }
      };
      draw();
    }
  };

  /* แอปที่เชื่อมต่อ */
  M.Pages.apps = {
    render: () => M.bar('แอปและเว็บไซต์') + `<div class="scroll"><div class="col pad">
      <p class="muted small">แอปเหล่านี้ไม่ได้รับรหัสผ่านของคุณ แต่ได้รับโทเค็นที่จำกัดสิทธิ์เฉพาะส่วนที่ระบุ ยกเลิกได้ทุกเมื่อ</p>
      ${sec().apps.map(a => `<section class="check-card"><div class="sec-row"><b>${esc(a.name)}</b><button class="btn sm danger" data-act="revokeApp" data-id="${a.id}">ยกเลิกสิทธิ์</button></div><small class="muted">เชื่อมต่อเมื่อ ${M.ago(a.ts)}ที่แล้ว</small><ul>${a.scopes.map(s => `<li>${esc(s)}</li>`).join('')}</ul></section>`).join('') || `<div class="empty">${I('link', 32)}<p>ไม่มีแอปที่เชื่อมต่อ</p></div>`}</div></div>`
  };
  A.revokeApp = async el => {
    const a = sec().apps.find(x => x.id === el.dataset.id);
    if (!await M.confirm(`ยกเลิกสิทธิ์ ${a.name} ไหม`, 'โทเค็นจะใช้ไม่ได้ทันที แอปนี้จะเข้าถึงข้อมูลของคุณไม่ได้อีก', 'ยกเลิกสิทธิ์', true)) return;
    sec().apps = sec().apps.filter(x => x !== a); M.toast('ยกเลิกสิทธิ์แล้ว'); M.refresh();
  };

  /* ระบบหลังบ้าน */
  const BACKEND = [
    ['ทำงานจริงในต้นแบบ', 'pos', [
      ['TOTP 2FA (RFC 6238)', 'ใช้กับแอปยืนยันตัวตนจริงได้ ตรวจรหัสด้วย HMAC-SHA1 ผ่าน Web Crypto'],
      ['แฮชรหัสผ่าน', 'PBKDF2-SHA256 210,000 รอบ + salt สุ่ม ไม่เก็บรหัสผ่านตัวจริง'],
      ['แชตลับ E2EE', 'ECDH P-256 สร้างกุญแจร่วม + AES-GCM 256 บิต พร้อมรหัสความปลอดภัย'],
      ['ลบ EXIF/GPS', 'วาดรูปใหม่ลง canvas ก่อนบันทึก และตรวจว่ามีพิกัดในไฟล์ต้นฉบับหรือไม่'],
      ['ตรวจลิงก์', 'รายการเว็บหลอกลวง + ฮิวริสติก (IP, punycode, @, โดเมนเลียนแบบ)'],
      ['จำกัดอัตรา', 'ข้อความ คอมเมนต์ การติดตาม การโพสต์ และการลองรหัส'],
      ['คำที่ซ่อน', 'กรองความคิดเห็นและคำขอข้อความตามคำที่กำหนด'],
      ['ตัวกรองภาพ 18+', 'โมเดล NSFWJS ทำงานในเครื่อง ตรวจรูปโปรไฟล์ แบนเนอร์ โพสต์ และรูปในแชตก่อนอัปโหลด ถ้าโหลดโมเดลไม่ได้จะใช้ฮิวริสติกสีผิวซึ่งแม่นยำน้อยกว่า'],
      ['กู้คืนบัญชีด้วยรหัส 2FA หรือรหัสสำรอง', 'ตรวจรหัสในเครื่องจริง แล้วบังคับตั้งรหัสผ่านใหม่และออกจากอุปกรณ์อื่น']
    ]],
    ['จำลองในต้นแบบ', '', [
      ['AI ประเมินอายุ / บัญชีวัยรุ่น', 'ต้องใช้สัญญาณหลายแหล่งและการอุทธรณ์โดยมนุษย์'],
      ['SMS OTP', 'ต้องเชื่อมผู้ให้บริการ SMS ที่เซิร์ฟเวอร์'],
      ['สรุปแชตด้วย AI', 'ต้นแบบใช้การดึงประโยคสำคัญแบบกฎ ไม่ได้เรียกโมเดลภาษา']
    ]],
    ['ต้องทำที่เซิร์ฟเวอร์ในบริการจริง', 'neg', [
      ['TLS/HTTPS ทุกการเชื่อมต่อ', 'HSTS, certificate pinning ในแอปมือถือ'],
      ['เข้ารหัสข้อมูลที่จัดเก็บ', 'Encryption at rest + การจัดการกุญแจ (KMS) แยกสิทธิ์'],
      ['Session และ device fingerprint', 'โทเค็นอายุสั้น หมุนเวียน ผูกกับอุปกรณ์ ตรวจ IP/ประเทศผิดปกติ'],
      ['Rate limiting ฝั่งเซิร์ฟเวอร์', 'ต่อ IP ต่อบัญชี ต่อ endpoint กันบอทดูดข้อมูลและสแปม'],
      ['ตรวจจับพฤติกรรมผิดปกติ', 'ML จับ brute-force การติดตามจำนวนมาก และบัญชีปลอม'],
      ['OAuth 2.0 + PKCE', 'โทเค็นจำกัด scope ยกเลิกได้ และบันทึกการใช้งาน'],
      ['Audit log และสิทธิ์พนักงาน', 'least privilege บันทึกทุกการเข้าถึงข้อมูลผู้ใช้'],
      ['ศูนย์เฝ้าระวัง 24 ชม. และ Bug Bounty', 'รับมือ DDoS และเปิดให้นักวิจัยรายงานช่องโหว่']
    ]]
  ];
  M.Pages.backend = {
    render: () => M.bar('ระบบความปลอดภัย') + `<div class="scroll"><div class="col pad">${BACKEND.map(([h, cls, items]) => `<h3 class="sec-t">${h}</h3><div class="rows">${items.map(([t, d]) => `<div class="row"><span class="row-ic ${cls}">${I(cls === 'pos' ? 'check' : cls === 'neg' ? 'server' : 'info', 20)}</span><span class="row-tx"><span>${t}</span><small>${d}</small></span></div>`).join('')}</div>`).join('')}
      <p class="note">ดูรายละเอียดสถาปัตยกรรมที่แนะนำได้ใน README.md ของโปรเจกต์</p></div></div>`
  };

  /* ออกจากระบบ / เข้าสู่ระบบ */
  A.logout = async () => {
    if (!await M.confirm('ออกจากระบบไหม', sec().password ? 'ต้องใช้รหัสผ่าน' + (sec().totp.enabled ? 'และรหัส 2FA' : '') + 'เพื่อเข้าสู่ระบบอีกครั้ง' : 'ยังไม่ได้ตั้งรหัสผ่าน จะเข้าสู่ระบบได้ทันที', 'ออกจากระบบ')) return;
    M.st.session.loggedOut = true; M.save();
    while (M.stack.length) M.back();
    setTimeout(() => M.push('login'), 350);
  };
  M.Pages.login = {
    cls: 'fade', static: true, locked: true,
    render: () => `<div class="login"><div class="center">${M.logo(56)}<h1 class="wordmark big">มะลิ</h1></div>
      <form class="form" data-login>
        <label>ชื่อผู้ใช้<input class="field" name="u" value="${esc(M.st.me.handle)}" autocomplete="username"></label>
        ${sec().password ? '<label>รหัสผ่าน<input class="field" type="password" name="p" autocomplete="current-password"></label>' : '<p class="note">ยังไม่ได้ตั้งรหัสผ่านในต้นแบบ กดเข้าสู่ระบบได้เลย</p>'}
        <div data-otp hidden><label>รหัส 6 หลักจากแอปยืนยันตัวตน หรือรหัสสำรอง<input class="field mono" name="o" inputmode="numeric" autocomplete="one-time-code"></label></div>
        <button class="btn pri block">เข้าสู่ระบบ</button>
        <p class="muted small center" data-msg></p>
      </form>
      <button class="link center" data-act="page" data-page="recover" data-params="{}">ลืมรหัสผ่านหรือบัญชีถูกแฮ็ก</button></div>`,
    mount(el) {
      const f = el.querySelector('[data-login]'), msg = el.querySelector('[data-msg]');
      let needOtp = false;
      f.onsubmit = async e => {
        e.preventDefault();
        const s = sec();
        if (Date.now() < s.lockUntil) return msg.textContent = `ลองผิดหลายครั้ง รออีก ${Math.ceil((s.lockUntil - Date.now()) / 1000)} วินาที`;
        const fail = t => { s.loginFails++; if (s.loginFails >= 5) { s.lockUntil = Date.now() + 30000 * 2 ** (s.loginFails - 5); msg.textContent = 'ลองผิดเกิน 5 ครั้ง ระบบระงับการเข้าสู่ระบบชั่วคราว'; } else msg.textContent = `${t} (เหลือ ${5 - s.loginFails} ครั้ง)`; M.save(); };
        if (s.password && !await M.sec.checkPassword(f.p.value, s.password)) return fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        if (s.totp.enabled) {
          if (!needOtp) { needOtp = true; el.querySelector('[data-otp]').hidden = false; f.o.focus(); msg.textContent = 'กรอกรหัสยืนยันตัวตนสองชั้น'; return; }
          const code = f.o.value.trim().toUpperCase();
          const ok = await M.sec.verifyTotp(s.totp.secret, code) || s.totp.backup.includes(code);
          if (!ok) return fail('รหัส 2FA ไม่ถูกต้อง');
          if (s.totp.backup.includes(code)) { s.totp.backup = s.totp.backup.filter(x => x !== code); M.toast('ใช้รหัสสำรองไปหนึ่งรหัส'); }
        }
        s.loginFails = 0; s.lockUntil = 0; M.st.session.loggedOut = false; M.save();
        M.stack.pop()?.remove(); M.go('home'); M.toast('เข้าสู่ระบบแล้ว');
      };
    }
  };
})(window.M);
