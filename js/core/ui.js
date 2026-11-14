'use strict';
/* ระบบ UI: แท็บ, สแตกหน้า, ชีตด้านล่าง, กล่องโต้ตอบ, toast, event delegation */
(function (M) {
  const $ = (s, r = document) => r.querySelector(s);
  M.$ = $;
  M.A = {};        // actions: data-act="name" → M.A.name(el, ev)
  M.Tabs = {};     // name → { render(), mount?(el) }
  M.Pages = {};    // name → { render(p), mount?(el,p), unmount?(el,p), cls?, static? }
  const stack = [];
  M.stack = stack;

  /* ---------- แท็บ ---------- */
  M.cur = 'home';
  M.renderTab = (name, keepScroll = true) => {
    const el = $(`.tab[data-tab="${name}"]`);
    if (!el || !M.Tabs[name]) return;
    const top = el.scrollTop;
    el.innerHTML = M.Tabs[name].render();
    el.dataset.rendered = '1';
    M.Tabs[name].mount?.(el);
    if (keepScroll) el.scrollTop = top;
  };
  M.go = name => {
    if (!M.Tabs[name]) return;
    while (stack.length) popPage(true);
    M.cur = name;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
    document.body.dataset.tab = name;
    const el = $(`.tab[data-tab="${name}"]`);
    if (!el.dataset.rendered) M.renderTab(name, false);
    M.Tabs[name].show?.(el);
    M.renderNav();
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  };

  /* ---------- หน้า (stack) ---------- */
  M.push = (name, params = {}) => {
    const def = M.Pages[name];
    if (!def) { console.warn('no page', name); return; }
    const el = document.createElement('div');
    el.className = 'page ' + (def.cls || '');
    el.dataset.page = name;
    el._params = params;
    el.innerHTML = def.render(params);
    $('#pages').appendChild(el);
    stack.push(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    def.mount?.(el, params);
    if (!def.locked) history.pushState({ page: stack.length }, '');
    return el;
  };
  function popPage(silent) {
    const el = stack.pop();
    if (!el) return;
    M.Pages[el.dataset.page]?.unmount?.(el, el._params);
    el.classList.remove('in');
    el.classList.add('out');
    setTimeout(() => el.remove(), silent ? 0 : 300);
  }
  M.back = () => {
    if (M.closeSheet()) return;
    const top = stack[stack.length - 1];
    if (!top || M.Pages[top.dataset.page]?.locked) return;
    history.back(); // popstate จะเรียก popPage
  };
  window.addEventListener('popstate', () => {
    if (M.closeSheet()) { history.pushState({}, ''); return; }
    const top = stack[stack.length - 1];
    if (top && M.Pages[top.dataset.page]?.locked) { history.pushState({}, ''); return; }
    popPage();
    M.refresh();
  });
  M.topPage = () => stack[stack.length - 1];
  M.replaceTop = (name, params) => { popPage(true); history.back(); setTimeout(() => M.push(name, params), 30); };

  M.renderPage = el => {
    if (!el) return;
    const def = M.Pages[el.dataset.page];
    const sc = el.querySelector('.scroll');
    const top = sc ? sc.scrollTop : 0;
    el.innerHTML = def.render(el._params);
    def.mount?.(el, el._params);
    const sc2 = el.querySelector('.scroll');
    if (sc2) sc2.scrollTop = top;
  };

  /* หลังข้อมูลเปลี่ยน: วาดแท็บปัจจุบัน + หน้าบนสุดใหม่ (ยกเว้นหน้าที่เป็น static) */
  M.refresh = () => {
    M.save();
    M.renderNav();
    const top = M.topPage();
    if (top) { if (!M.Pages[top.dataset.page].static) M.renderPage(top); }
    // แท็บที่วาดไว้แล้วจะถูกวาดใหม่เมื่อเปลี่ยนแท็บครั้งถัดไป
    document.querySelectorAll('.tab[data-rendered]').forEach(t => { if (t.dataset.tab !== M.cur) delete t.dataset.rendered; });
    if (!M.Tabs[M.cur]?.static) M.renderTab(M.cur);
  };

  /* ---------- แถบนำทาง ---------- */
  const NAV = [
    ['home', 'home', 'หน้าหลัก'], ['chat', 'chat', 'แชต'], ['create', 'plus', 'สร้าง'],
    ['reels', 'reels', 'Reels'], ['profile', 'user', 'โปรไฟล์']
  ];
  M.renderNav = () => {
    const unread = M.st.chats.reduce((n, c) => n + (c.request ? 0 : (c.unread || 0)), 0);
    $('#nav').innerHTML = `<div class="nav-brand">${M.logo(26)}<span>มะลิ</span></div>` + NAV.map(([k, ic, lbl]) => {
      if (k === 'create') return `<button class="nav-it nav-create" data-act="openCreate" aria-label="สร้าง"><span class="nav-plus">${M.icon('plus', 22)}</span><span class="lbl">สร้าง</span></button>`;
      const on = M.cur === k && !M.stack.length;
      const ico = k === 'profile' ? M.avatar(M.st.me, 26, on ? 'on' : '') : M.icon(ic, 26);
      const badge = k === 'chat' && unread ? `<span class="badge">${unread > 99 ? '99+' : unread}</span>` : '';
      return `<button class="nav-it${on ? ' on' : ''}" data-act="tab" data-tab="${k}" aria-label="${lbl}" ${on ? 'aria-current="page"' : ''}><span class="nav-ic">${ico}${badge}</span><span class="lbl">${lbl}</span></button>`;
    }).join('');
  };
  M.A.tab = el => M.go(el.dataset.tab);

  /* ---------- ส่วนหัวหน้า ---------- */
  M.bar = (title, right = '', opts = {}) =>
    `<header class="bar glass ${opts.cls || ''}">
      ${opts.noBack ? '' : `<button class="ibtn" data-act="back" aria-label="ย้อนกลับ">${M.icon(opts.close ? 'x' : 'back')}</button>`}
      <h1 class="bar-t">${title}</h1><div class="bar-r">${right}</div></header>`;
  M.A.back = () => M.back();

  /* ---------- toast ---------- */
  M.toast = (msg, opts = {}) => {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span>${M.esc(msg)}</span>${opts.action ? `<button class="toast-a">${M.esc(opts.action)}</button>` : ''}`;
    if (opts.action) t.querySelector('button').onclick = () => { opts.onAction?.(); t.remove(); };
    $('#layer').appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, opts.ms || 2600);
  };

  /* ---------- ชีตด้านล่าง ---------- */
  let sheetEl = null, sheetClose = null;
  M.sheet = (html, opts = {}) => {
    M.closeSheet(true);
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet-bd" data-act="closeSheet"></div><div class="sheet ${opts.cls || ''}" role="dialog" aria-modal="true">
      <div class="sheet-grip"></div>${opts.title ? `<div class="sheet-h"><h2>${opts.title}</h2><button class="ibtn sm" data-act="closeSheet" aria-label="ปิด">${M.icon('x', 20)}</button></div>` : ''}
      <div class="sheet-b">${html}</div></div>`;
    $('#layer').appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
    sheetEl = wrap; sheetClose = opts.onClose;
    opts.mount?.(wrap.querySelector('.sheet'));
    return wrap.querySelector('.sheet');
  };
  M.closeSheet = (instant) => {
    if (!sheetEl) return false;
    const el = sheetEl, cb = sheetClose;
    sheetEl = null; sheetClose = null;
    el.classList.remove('in');
    setTimeout(() => el.remove(), instant ? 0 : 250);
    cb?.();
    return true;
  };
  M.A.closeSheet = () => M.closeSheet();
  M.sheetBody = () => sheetEl?.querySelector('.sheet-b');

  /* เมนูตัวเลือก */
  M.menu = (items, title) => {
    const html = `<div class="menu">${items.filter(Boolean).map((it, i) =>
      `<button class="menu-it${it.danger ? ' danger' : ''}" data-mi="${i}">${it.icon ? M.icon(it.icon, 22) : ''}<span>${M.esc(it.label)}${it.sub ? `<small>${M.esc(it.sub)}</small>` : ''}</span></button>`).join('')}</div>`;
    const list = items.filter(Boolean);
    const sh = M.sheet(html, { title });
    sh.querySelectorAll('[data-mi]').forEach(b => b.onclick = e => { e.stopPropagation(); M.closeSheet(); list[+b.dataset.mi].act?.(); });
  };

  M.confirm = (title, body, ok = 'ยืนยัน', danger = false) => new Promise(res => {
    const sh = M.sheet(`<div class="dlg"><h2>${M.esc(title)}</h2>${body ? `<p class="muted">${M.esc(body)}</p>` : ''}
      <div class="dlg-a"><button class="btn sec" data-r="0">ยกเลิก</button><button class="btn ${danger ? 'danger' : 'pri'}" data-r="1">${M.esc(ok)}</button></div></div>`, { onClose: () => res(false) });
    sh.querySelectorAll('[data-r]').forEach(b => b.onclick = e => { e.stopPropagation(); const v = b.dataset.r === '1'; sheetClose = null; M.closeSheet(); res(v); });
  });
  M.prompt = (title, value = '', placeholder = '', opts = {}) => new Promise(res => {
    const sh = M.sheet(`<form class="dlg"><h2>${M.esc(title)}</h2>${opts.note ? `<p class="muted small">${M.esc(opts.note)}</p>` : ''}
      ${opts.multiline ? `<textarea class="field" rows="4" maxlength="${opts.max || 500}" placeholder="${M.esc(placeholder)}">${M.esc(value)}</textarea>` : `<input class="field" maxlength="${opts.max || 120}" value="${M.esc(value)}" placeholder="${M.esc(placeholder)}" ${opts.type ? `type="${opts.type}"` : ''}>`}
      <div class="dlg-a"><button type="button" class="btn sec" data-r="0">ยกเลิก</button><button class="btn pri" type="submit">${M.esc(opts.ok || 'บันทึก')}</button></div></form>`, { onClose: () => res(null) });
    const f = sh.querySelector('form'), inp = sh.querySelector('.field');
    setTimeout(() => inp.focus(), 60);
    sh.querySelector('[data-r]').onclick = e => { e.stopPropagation(); M.closeSheet(); };
    f.onsubmit = e => { e.preventDefault(); const v = inp.value.trim(); sheetClose = null; M.closeSheet(); res(v); };
  });

  /* ---------- คำแนะนำจาก "น้องตูม" ---------- */
  M.tip = (key, text) => {
    if (M.st.tips[key]) return '';
    return `<div class="tip">${M.bud('happy', 44)}<div><b>น้องตูมแนะนำ</b><p>${text}</p></div><button class="btn sm sec" data-act="dismissTip" data-k="${key}">เข้าใจแล้ว</button></div>`;
  };
  M.A.dismissTip = el => { M.st.tips[el.dataset.k] = 1; el.closest('.tip').remove(); M.save(); };

  /* ---------- แถวตั้งค่าแบบใช้ซ้ำได้ ---------- */
  // rows: {t:'toggle', k:'path.to.key', label, sub, disabled} | {t:'choice', k, label, options:[[v,label]]} | {t:'nav', label, sub, page, params, icon, act} | {t:'head', label} | {t:'note', text}
  const getPath = (k) => k.split('.').reduce((o, p) => o?.[p], M.st);
  const setPath = (k, v) => { const ps = k.split('.'); const last = ps.pop(); ps.reduce((o, p) => o[p] ??= {}, M.st)[last] = v; };
  M.getPath = getPath; M.setPath = setPath;
  M.rows = rows => `<div class="rows">${rows.filter(Boolean).map(r => {
    if (r.t === 'head') return `<h3 class="sec-t">${r.label}</h3>`;
    if (r.t === 'note') return `<p class="note">${r.text}</p>`;
    const ic = r.icon ? `<span class="row-ic">${M.icon(r.icon, 22)}</span>` : '';
    const txt = `<span class="row-tx"><span>${r.label}</span>${r.sub ? `<small>${r.sub}</small>` : ''}</span>`;
    if (r.t === 'toggle') {
      const on = !!getPath(r.k);
      return `<label class="row${r.disabled ? ' dis' : ''}">${ic}${txt}<input type="checkbox" class="switch" data-toggle="${r.k}" ${on ? 'checked' : ''} ${r.disabled ? 'disabled' : ''}></label>`;
    }
    if (r.t === 'choice') {
      const v = getPath(r.k), lbl = (r.options.find(o => o[0] === v) || r.options[0])[1];
      return `<button class="row" data-act="choice" data-k="${r.k}" data-opts='${M.esc(JSON.stringify(r.options))}' data-label="${M.esc(r.label)}">${ic}${txt}<span class="row-v">${M.esc(lbl)}</span>${M.icon('chev', 18, 'muted')}</button>`;
    }
    return `<button class="row" ${r.page ? `data-act="page" data-page="${r.page}" data-params='${M.esc(JSON.stringify(r.params || {}))}'` : `data-act="${r.act}" ${r.data || ''}`}>${ic}${txt}${r.value ? `<span class="row-v">${r.value}</span>` : ''}${M.icon('chev', 18, 'muted')}</button>`;
  }).join('')}</div>`;
  M.onToggle = {}; // key → fn(value, input) เพื่อตรวจเงื่อนไขก่อนเปลี่ยนค่า
  document.addEventListener('change', e => {
    const k = e.target.dataset?.toggle;
    if (!k) return;
    const v = e.target.checked;
    const hook = M.onToggle[k];
    if (hook && hook(v, e.target) === false) { e.target.checked = !v; return; }
    setPath(k, v);
    M.save();
    if (hook) M.refresh();
  });
  M.onChoice = {};
  M.A.choice = el => {
    const k = el.dataset.k, opts = JSON.parse(el.dataset.opts);
    M.menu(opts.map(([v, lbl]) => ({ label: lbl, icon: getPath(k) === v ? 'check' : null, act: () => { if (M.onChoice[k]?.(v) === false) return; setPath(k, v); M.refresh(); } })), el.dataset.label);
  };
  M.A.page = el => M.push(el.dataset.page, JSON.parse(el.dataset.params || '{}'));

  /* ---------- delegation ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const fn = M.A[t.dataset.act];
    if (fn) { e.preventDefault(); fn(t, e); }
    else console.warn('missing action', t.dataset.act);
  });
  // แตะสองครั้งเพื่อถูกใจ (รองรับทั้งเมาส์และทัชสกรีน)
  let lastTap = { el: null, t: 0 };
  document.addEventListener('pointerup', e => {
    const t = e.target.closest('[data-dbl]');
    if (!t) return;
    const now = Date.now();
    if (lastTap.el === t && now - lastTap.t < 320) { M.A[t.dataset.dbl]?.(t, e, true); lastTap = { el: null, t: 0 }; }
    else lastTap = { el: t, t: now };
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') M.back(); });

  M.heartBurst = (container, x, y) => {
    const h = document.createElement('span');
    h.className = 'burst';
    h.innerHTML = M.icon('heart', 88);
    const r = container.getBoundingClientRect();
    h.style.left = ((x ?? r.left + r.width / 2) - r.left) + 'px';
    h.style.top = ((y ?? r.top + r.height / 2) - r.top) + 'px';
    container.appendChild(h);
    setTimeout(() => h.remove(), 800);
  };

  /* ไฟล์ input ชั่วคราว */
  M.pickFiles = (accept, multiple) => new Promise(res => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept; i.multiple = !!multiple;
    i.onchange = () => res([...i.files]);
    i.click();
  });
})(window.M);
