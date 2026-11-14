'use strict';
/* ตัวกรองภาพ 18+ (ทำงานในเครื่อง ไม่ส่งรูปออกไปที่ใด)
   ชั้นที่ 1: โมเดล NSFWJS (MobileNetV2, TensorFlow.js) โหลดครั้งแรกที่ต้องตรวจ จาก jsDelivr แบบระบุเวอร์ชัน + SRI
   ชั้นที่ 2: ถ้าโหลดโมเดลไม่ได้ (ออฟไลน์/ถูกบล็อก) ใช้ฮิวริสติกสัดส่วนสีผิว ซึ่งหยาบกว่ามาก จึงทำได้แค่ "ทำเครื่องหมายว่าอ่อนไหว"
   ผลลัพธ์: ok | sensitive (เบลอ + เตือนก่อนดู) | blocked (ห้ามอัปโหลด) */
(function (M) {
  const LIB = 'https://cdn.jsdelivr.net/npm/nsfwjs@4.2.1/dist/browser/nsfwjs.min.js';
  const LIB_SRI = 'sha384-X0bAq0XJRwVKAYLtjgRmKfk0w1/l9A1KDqj5PkR5UUk60UzcUv05usH2uyL5oaJq';
  const MODEL = 'https://cdn.jsdelivr.net/gh/infinitered/nsfwjs@v4.2.1/models/mobilenet_v2/';

  const loadScript = () => new Promise((res, rej) => {
    if (window.nsfwjs) return res();
    const s = document.createElement('script');
    s.src = LIB; s.integrity = LIB_SRI; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
    s.onload = res; s.onerror = () => rej(new Error('script'));
    document.head.appendChild(s);
  });

  const toImage = src => new Promise((res, rej) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img); img.onerror = () => rej(new Error('image'));
    img.src = url; // GIF: เบราว์เซอร์ใช้เฟรมแรก
  });

  // ฮิวริสติกสีผิว (กฎ YCbCr) บนภาพย่อ 64x64
  const skinRatio = img => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const cb = 128 - .168736 * r - .331264 * g + .5 * b, cr = 128 + .5 * r - .418688 * g - .081312 * b;
      if (cb > 77 && cb < 127 && cr > 133 && cr < 173 && r > 60) n++;
    }
    return n / (64 * 64);
  };

  const A = M.adult = {
    engine: null, status: 'idle', _p: null,
    load() {
      if (this._p) return this._p;
      this.status = 'loading';
      this._p = (async () => {
        try {
          await loadScript();
          this.model = await window.nsfwjs.load(MODEL);
          this.engine = 'nsfwjs'; this.status = 'ready';
        } catch (e) {
          console.warn('NSFW model unavailable, using heuristic', e);
          this.engine = 'heuristic'; this.status = 'fallback';
        }
      })();
      return this._p;
    },
    thresholds() {
      const strict = M.st.settings.adultFilter === 'strict' || M.st.settings.teen;
      return strict ? { block: .4, sensitive: .2, sexy: .45 } : { block: .6, sensitive: .3, sexy: .6 };
    },
    /** ตรวจภาพหนึ่งภาพ: src = File | Blob | dataURL */
    async check(src) {
      const img = await toImage(src);
      await this.load();
      const t = this.thresholds();
      let scores, verdict = 'ok';
      if (this.engine === 'nsfwjs') {
        const pred = await this.model.classify(img);
        scores = Object.fromEntries(pred.map(p => [p.className, p.probability]));
        const explicit = (scores.Porn || 0) + (scores.Hentai || 0);
        if (explicit >= t.block) verdict = 'blocked';
        else if (explicit >= t.sensitive || (scores.Sexy || 0) >= t.sexy) verdict = 'sensitive';
      } else {
        const skin = skinRatio(img);
        scores = { skin };
        if (skin >= (t.block === .4 ? .35 : .5)) verdict = 'sensitive';
      }
      return { verdict, scores, engine: this.engine };
    },
    /** ตรวจแล้วแจ้งผลด้วยภาษาของแอป คืน null ถ้าห้ามใช้ */
    async guard(src, where = 'post') {
      M.toast('กำลังตรวจภาพด้วยตัวกรอง 18+ ในเครื่อง…', { ms: 1500 });
      let r;
      try { r = await this.check(src); } catch { return { verdict: 'ok', engine: 'none' }; }
      const publicSurface = where === 'banner' || where === 'avatar';
      if (r.verdict === 'blocked') { M.toast('ใช้ภาพนี้ไม่ได้: ตัวกรองพบเนื้อหา 18+', { ms: 4000 }); return null; }
      if (r.verdict === 'sensitive' && (publicSurface || M.st.settings.teen)) { M.toast(publicSurface ? 'ภาพนี้อาจไม่เหมาะสม ใช้เป็นรูปโปรไฟล์หรือแบนเนอร์ไม่ได้' : 'บัญชีวัยรุ่นอัปโหลดภาพที่อาจไม่เหมาะสมไม่ได้', { ms: 4000 }); return null; }
      if (r.verdict === 'sensitive') M.toast('ภาพนี้จะถูกเบลอพร้อมคำเตือนสำหรับผู้ชม', { ms: 3000 });
      return r;
    }
  };
})(window.M);
