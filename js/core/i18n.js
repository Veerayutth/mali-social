'use strict';
/* ระบบภาษา
   - ภาษาไทยเป็นภาษาต้นฉบับของ UI
   - อังกฤษ: พจนานุกรมในตัว (js/data/i18n-en.js) ครอบคลุมข้อความ UI ทั้งหมดที่ดึงจากซอร์ส
   - ภาษาอื่น: แปลจากพจนานุกรมอังกฤษด้วย Translator API ของเบราว์เซอร์ (แปลในเครื่อง ไม่ส่งข้อความออก)
     แล้วเก็บแคชไว้ ถ้าเบราว์เซอร์ไม่รองรับจะแสดงเป็นภาษาอังกฤษแทน
   - แปลที่ระดับ DOM ด้วย MutationObserver จึงไม่ต้องแก้โค้ดทุกหน้า
   - ข้อความของผู้ใช้ (โพสต์ แชต ความคิดเห็น ชื่อ) อยู่ใต้ translate="no" จะไม่ถูกแปลง */
(function (M) {
  M.LANGS = [
    ['th', 'ไทย', 'Thai'], ['en', 'English', 'English'], ['zh', '中文（简体）', 'Chinese (Simplified)'], ['zh-Hant', '中文（繁體）', 'Chinese (Traditional)'],
    ['ja', '日本語', 'Japanese'], ['ko', '한국어', 'Korean'], ['vi', 'Tiếng Việt', 'Vietnamese'], ['id', 'Bahasa Indonesia', 'Indonesian'],
    ['ms', 'Bahasa Melayu', 'Malay'], ['fil', 'Filipino', 'Filipino'], ['lo', 'ລາວ', 'Lao'], ['km', 'ខ្មែរ', 'Khmer'], ['my', 'မြန်မာ', 'Burmese'],
    ['hi', 'हिन्दी', 'Hindi'], ['bn', 'বাংলা', 'Bengali'], ['ta', 'தமிழ்', 'Tamil'], ['te', 'తెలుగు', 'Telugu'], ['mr', 'मराठी', 'Marathi'], ['ne', 'नेपाली', 'Nepali'], ['si', 'සිංහල', 'Sinhala'],
    ['ar', 'العربية', 'Arabic', 1], ['fa', 'فارسی', 'Persian', 1], ['ur', 'اردو', 'Urdu', 1], ['he', 'עברית', 'Hebrew', 1],
    ['tr', 'Türkçe', 'Turkish'], ['ru', 'Русский', 'Russian'], ['uk', 'Українська', 'Ukrainian'], ['kk', 'Қазақ', 'Kazakh'], ['mn', 'Монгол', 'Mongolian'],
    ['pl', 'Polski', 'Polish'], ['cs', 'Čeština', 'Czech'], ['sk', 'Slovenčina', 'Slovak'], ['hu', 'Magyar', 'Hungarian'], ['ro', 'Română', 'Romanian'],
    ['bg', 'Български', 'Bulgarian'], ['sr', 'Српски', 'Serbian'], ['hr', 'Hrvatski', 'Croatian'], ['sl', 'Slovenščina', 'Slovenian'], ['el', 'Ελληνικά', 'Greek'],
    ['de', 'Deutsch', 'German'], ['fr', 'Français', 'French'], ['es', 'Español', 'Spanish'], ['pt', 'Português', 'Portuguese'], ['it', 'Italiano', 'Italian'],
    ['nl', 'Nederlands', 'Dutch'], ['sv', 'Svenska', 'Swedish'], ['da', 'Dansk', 'Danish'], ['no', 'Norsk', 'Norwegian'], ['fi', 'Suomi', 'Finnish'],
    ['et', 'Eesti', 'Estonian'], ['lv', 'Latviešu', 'Latvian'], ['lt', 'Lietuvių', 'Lithuanian'], ['ka', 'ქართული', 'Georgian'], ['hy', 'Հայերեն', 'Armenian'],
    ['sw', 'Kiswahili', 'Swahili'], ['am', 'አማርኛ', 'Amharic'], ['zu', 'isiZulu', 'Zulu'], ['af', 'Afrikaans', 'Afrikaans'], ['ca', 'Català', 'Catalan']
  ];
  const THAI = /[฀-๿]/;
  const THAI_G = /[฀-๿]/g;
  const orig = new WeakMap();   // node → ข้อความต้นฉบับ (ไทย)
  const mine = new WeakMap();   // node → ข้อความที่เราเพิ่งใส่ (กันวนซ้ำ)
  const attrOrig = new WeakMap(); // element → {attr: original}
  const ATTRS = ['placeholder', 'aria-label', 'title'];

  const I = M.i18n = { lang: 'th', dict: null, re: null, patterns: [], ready: true, missing: new Set(), collect: false };

  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const build = (dict, patterns) => {
    I.dict = dict;
    const keys = [...dict.keys()].sort((a, b) => b.length - a.length);
    I.re = keys.length ? new RegExp(keys.map(escRe).join('|'), 'g') : null;
    I.patterns = patterns || [];
  };

  // แปลข้อความหนึ่งชิ้น (คืนค่าเดิมถ้าแปลไม่ได้)
  I.tr = text => {
    if (I.lang === 'th' || !I.dict || !THAI.test(text)) return text;
    const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0], core = text.trim();
    let out = I.dict.get(core);
    if (out == null) for (const [re, tpl] of I.patterns) { const m = core.match(re); if (m) { out = tpl.replace(/\{(\d)\}/g, (_, i) => I.tr(m[+i + 1] || '')); break; } }
    if (out == null && I.re) {
      const total = (core.match(THAI_G) || []).length;
      const res = core.replace(I.re, k => ' ' + I.dict.get(k) + ' ')
        .replace(/\s{2,}/g, ' ').replace(/\s+([,.:;!?)\]…%])/g, '$1').replace(/([(\[])\s+/g, '$1').replace(/"\s+([^"]*?)\s+"/g, '"$1"').trim();
      const left = (res.match(THAI_G) || []).length;
      // ยอมรับเมื่อแปลได้อย่างน้อย 60% ส่วนที่เหลือมักเป็นชื่อคน
      if (left === 0 || (total - left) / total >= .6) out = res;
    }
    if (out == null) { if (I.collect) I.missing.add(core); return text; }
    return lead + out + trail;
  };

  const skip = el => !el || el.closest?.('[translate="no"], script, style, svg, code, textarea');
  const doText = (n, force) => {
    if (!force && mine.get(n) === n.data) return;
    if (!orig.has(n) || mine.get(n) !== n.data) orig.set(n, n.data);
    const src = orig.get(n);
    const out = I.lang === 'th' ? src : I.tr(src);
    if (out !== n.data) { mine.set(n, out); n.data = out; } else mine.set(n, n.data);
  };
  const doAttrs = el => {
    let o = attrOrig.get(el);
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a);
      if (!o) attrOrig.set(el, o = {});
      if (o[a] == null || (o['_' + a] !== v)) o[a] = v;
      const out = I.lang === 'th' ? o[a] : I.tr(o[a]);
      o['_' + a] = out;
      if (out !== v) el.setAttribute(a, out);
    }
  };
  I.apply = (root = document.body) => {
    if (!root) return;
    if (root.nodeType === 3) { if (!skip(root.parentElement)) doText(root, true); return; }
    if (root.nodeType !== 1 || skip(root)) return;
    doAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => n.nodeType === 1 ? (n.matches('[translate="no"], script, style, svg, code, textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT
    });
    root.querySelectorAll(ATTRS.map(a => `[${a}]`).join(',')).forEach(el => { if (!skip(el.parentElement) || el === root) doAttrs(el); });
    let n; while ((n = w.nextNode())) doText(n, true);
  };
  const mo = new MutationObserver(list => {
    if (I.lang === 'th') return;
    for (const m of list) {
      if (m.type === 'characterData') { if (!skip(m.target.parentElement)) doText(m.target); }
      else if (m.type === 'attributes') { if (!skip(m.target.parentElement)) doAttrs(m.target); }
      else m.addedNodes.forEach(n => I.apply(n));
    }
  });

  /* ---------- โหลดภาษา ---------- */
  const enDict = () => new Map(Object.entries(M.I18N_EN || {}));
  const enPatterns = () => (M.I18N_EN_PATTERNS || []).map(([re, t]) => [new RegExp(re), t]);
  const cacheKey = l => 'mali.i18n.' + l;

  // กันไม่ให้ API ที่ค้างทำให้แอปค้างตาม
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  async function translatedDict(lang, onProgress) {
    try { const c = JSON.parse(localStorage.getItem(cacheKey(lang)) || 'null'); if (c && c.v === M.I18N_VERSION) return c; } catch {}
    if (!('Translator' in self)) return null;
    const pair = { sourceLanguage: 'en', targetLanguage: lang };
    const avail = await withTimeout(self.Translator.availability(pair), 8000).catch(() => 'unavailable');
    if (avail === 'unavailable') return null;
    const tr = await withTimeout(self.Translator.create({ ...pair, monitor(m) { m.addEventListener('downloadprogress', e => onProgress?.(e.loaded * .3)); } }), 120000).catch(() => null);
    if (!tr) return null;
    const src = Object.entries(M.I18N_EN), out = {};
    const uniq = [...new Set(src.map(([, v]) => v))];
    const map = new Map();
    for (let i = 0; i < uniq.length; i++) {
      try { map.set(uniq[i], await withTimeout(tr.translate(uniq[i]), 10000)); }
      catch { if (i === 0) return null; map.set(uniq[i], uniq[i]); } // ถ้าคำแรกแปลไม่ได้ ถือว่าใช้ไม่ได้
      if (i % 20 === 0) onProgress?.(.3 + .7 * i / uniq.length);
    }
    for (const [k, v] of src) out[k] = map.get(v);
    const pats = [];
    for (const [re, t] of M.I18N_EN_PATTERNS || []) { let tt = t; try { tt = await tr.translate(t); if (!/\{0\}/.test(tt) && /\{0\}/.test(t)) tt = t; } catch {} pats.push([re, tt]); }
    const data = { v: M.I18N_VERSION, dict: out, patterns: pats };
    try { localStorage.setItem(cacheKey(lang), JSON.stringify(data)); } catch {}
    return data;
  }

  /** เปลี่ยนภาษา (เรียกจากหน้าตั้งค่า) */
  I.set = async (lang, opts = {}) => {
    const meta = M.LANGS.find(l => l[0] === lang) || M.LANGS[0];
    let effective = lang, note = '';
    if (lang === 'th') build(new Map(), []);
    else if (lang === 'en') build(enDict(), enPatterns());
    else {
      const data = await translatedDict(lang, opts.onProgress);
      if (data) build(new Map(Object.entries(data.dict)), data.patterns.map(([re, t]) => [new RegExp(re), t]));
      else { build(enDict(), enPatterns()); effective = 'en'; note = 'nofallback'; }
    }
    I.lang = lang === 'th' ? 'th' : 'x';
    document.documentElement.lang = effective === 'en' && lang !== 'en' ? 'en' : lang;
    document.documentElement.dir = meta[3] && effective === lang ? 'rtl' : 'ltr';
    // แปลใหม่ทั้งหน้าจากต้นฉบับ
    const all = document.body;
    I.apply(all);
    document.title = lang === 'th' ? 'มะลิ · ต้นแบบแอปโซเชียล' : 'Mali · Social app prototype';
    return note;
  };
  I.start = () => mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  I.clearCache = () => M.LANGS.forEach(l => { try { localStorage.removeItem(cacheKey(l[0])); } catch {} });
  I.supportsDevice = () => 'Translator' in self;
})(window.M);
