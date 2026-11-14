'use strict';
/* รูปลักษณ์: ฟอนต์, ขนาดตัวอักษร, สีวงสตอรี่ */
(function (M) {
  // ฟอนต์จาก Google Fonts ที่รองรับภาษาไทย [ชื่อฟอนต์, ป้ายภาษาไทย, น้ำหนักที่มี]
  M.FONTS = [
    ['Anuphan', 'อนุพันธ์ (ค่าเริ่มต้น)', '400;500;600'],
    ['Noto Sans Thai', 'โนโต้ ซานส์ ไทย', '400;500;600'],
    ['IBM Plex Sans Thai', 'ไอบีเอ็ม เพล็กซ์', '400;500;600'],
    ['Sarabun', 'สารบรรณ', '400;500;600'],
    ['Prompt', 'พร้อมท์', '400;500;600'],
    ['Kanit', 'คณิต', '400;500;600'],
    ['Mitr', 'มิตร', '400;500;600'],
    ['Bai Jamjuree', 'ใบจามจุรี', '400;500;600'],
    ['Chakra Petch', 'จักรเพชร', '400;500;600'],
    ['K2D', 'เคทูดี', '400;500;600'],
    ['Niramit', 'นิรมิต', '400;500;600'],
    ['Noto Serif Thai', 'โนโต้ เซอริฟ (มีหัว)', '400;500;600'],
    ['Trirong', 'ตรีรงค์ (มีหัว)', '400;500;600'],
    ['Pridi', 'ปรีดี (มีหัว)', '400;500;600'],
    ['Mali', 'มะลิ (ลายมือ)', '400;500;600'],
    ['Itim', 'อิ่ม (ลายมือ)', ''],
    ['Sriracha', 'ศรีราชา (ลายมือ)', ''],
    ['system', 'ฟอนต์ของระบบ', '']
  ];
  M.FONT_SIZES = [[.9, 'เล็ก'], [1, 'ปกติ'], [1.1, 'ใหญ่'], [1.22, 'ใหญ่มาก']];
  // ฟอนต์สำรองตามภาษา (ฟอนต์ไทยส่วนใหญ่ไม่มีอักษรจีน ญี่ปุ่น อาหรับ ฯลฯ)
  const SCRIPT_FONT = {
    ja: 'Noto Sans JP', zh: 'Noto Sans SC', 'zh-Hant': 'Noto Sans TC', ko: 'Noto Sans KR', ar: 'Noto Sans Arabic', fa: 'Noto Sans Arabic', ur: 'Noto Sans Arabic',
    he: 'Noto Sans Hebrew', hi: 'Noto Sans Devanagari', mr: 'Noto Sans Devanagari', ne: 'Noto Sans Devanagari', bn: 'Noto Sans Bengali', ta: 'Noto Sans Tamil', te: 'Noto Sans Telugu',
    km: 'Noto Sans Khmer', lo: 'Noto Sans Lao', my: 'Noto Sans Myanmar', ka: 'Noto Sans Georgian', am: 'Noto Sans Ethiopic', si: 'Noto Sans Sinhala',
    ru: 'Noto Sans', uk: 'Noto Sans', bg: 'Noto Sans', el: 'Noto Sans', sr: 'Noto Sans', kk: 'Noto Sans', mn: 'Noto Sans'
  };
  const loaded = new Set();
  M.loadFont = (family, weights = '400;500;600', text) => {
    if (!family || family === 'system') return;
    const key = family + (text ? '|' + text : '');
    if (loaded.has(key) || loaded.has(family)) return;
    loaded.add(key);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}${weights ? ':wght@' + weights : ''}&display=swap${text ? '&text=' + encodeURIComponent(text) : ''}`;
    document.head.appendChild(l);
  };
  const q = f => `'${f}'`;
  M.applyAppearance = () => {
    const s = M.st.settings, root = document.documentElement;
    const f = M.FONTS.find(x => x[0] === s.font) || M.FONTS[0];
    M.loadFont(f[0], f[2]);
    const extra = SCRIPT_FONT[s.lang];
    if (extra) M.loadFont(extra, '400;500;600');
    const stack = [f[0] !== 'system' && q(f[0]), extra && q(extra), "'Noto Sans Thai'", 'system-ui', '-apple-system', "'Segoe UI'", 'sans-serif'].filter(Boolean).join(', ');
    root.style.setProperty('--font', stack);
    root.style.setProperty('--zoom', s.fontScale || 1);
    root.style.setProperty('--ring-all', s.ringAll && M.st.me.ringColor ? M.st.me.ringColor : '');
    root.classList.toggle('ring-all', !!s.ringAll);
  };

  /* สีวงสตอรี่ */
  M.RING_COLORS = [
    ['#c4411a', 'อิฐ'], ['#e8590c', 'ส้ม'], ['#f59f00', 'ทอง'], ['#d6336c', 'ชมพู'], ['#ae3ec9', 'ม่วง'], ['#1c7ed6', 'ฟ้า'],
    ['#0c8599', 'น้ำทะเล'], ['#2b8a3e', 'เขียวใบไม้'], ['#1f1b16', 'ดำ'],
    ['conic-gradient(from 200deg, #f59f00, #d6336c, #ae3ec9, #f59f00)', 'พระอาทิตย์ตก'],
    ['conic-gradient(from 90deg, #0c8599, #1c7ed6, #74c0fc, #0c8599)', 'ทะเล'],
    ['conic-gradient(from 0deg, #c4411a, #f6d365, #c4411a)', 'มะลิ'],
    ['conic-gradient(#e03131, #f59f00, #fcc419, #2b8a3e, #1c7ed6, #ae3ec9, #e03131)', 'สายรุ้ง']
  ];
  // style สำหรับวงสตอรี่ของผู้ใช้คนหนึ่ง
  M.ringStyle = u => u?.ringColor ? ` style="--ring:${M.esc(u.ringColor)}"` : '';

  M.ringPicker = (cur) => `<div class="ring-pick">${M.RING_COLORS.map(([c, l]) =>
      `<button class="rp${cur === c ? ' on' : ''}" data-ring="${M.esc(c)}" title="${l}" aria-label="${l}"><i style="background:${c}"></i></button>`).join('')}
      <label class="rp custom" title="เลือกสีเอง"><input type="color" data-ringcustom value="${/^#/.test(cur || '') ? cur : '#c4411a'}" aria-label="เลือกสีเอง"><i style="background:${/^#/.test(cur || '') && !M.RING_COLORS.some(x => x[0] === cur) ? cur : 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)'}"></i></label></div>`;
  // ผูกเหตุการณ์ของตัวเลือกสีใน container หนึ่ง
  M.wireRingPicker = (box, onPick) => {
    box.querySelectorAll('[data-ring]').forEach(b => b.onclick = e => { e.preventDefault(); onPick(b.dataset.ring); });
    const c = box.querySelector('[data-ringcustom]');
    if (c) c.oninput = () => onPick(c.value);
  };
})(window.M);
