'use strict';
/* ภาพประกอบทั้งหมดวาดด้วย SVG แบบ seed — ไม่ต้องโหลดรูปจากภายนอก
   kind: sea | mountain | city | temple | food | cafe | market | forest | flower | abstract */
(function (M) {
  let gid = 0;
  const K = ['sea', 'mountain', 'city', 'temple', 'food', 'cafe', 'market', 'forest', 'flower'];
  M.SCENES = K;
  M.SCENE_TH = { sea: 'ทะเล', mountain: 'ภูเขา', city: 'เมือง', temple: 'วัด', food: 'อาหาร', cafe: 'คาเฟ่', market: 'ตลาดกลางคืน', forest: 'ป่า', flower: 'ดอกมะลิ', abstract: 'นามธรรม' };

  const lg = (id, a, b, vertical = true) => `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const ridge = (r, base, amp, step = 30) => {
    let d = `M0 400 L0 ${base}`;
    for (let x = 0; x <= 300; x += step) d += ` L${x} ${(base - r() * amp).toFixed(1)}`;
    return d + ' L300 400 Z';
  };

  const draw = {
    sea(r, id) {
      const p = M.pick([
        { sky: ['#f7d2a7', '#ec8d68'], sun: '#fff1d6', sea: ['#3d7c96', '#1d4e65'], sand: '#e8c89a' },
        { sky: ['#cde6f1', '#f3eee3'], sun: '#ffffff', sea: ['#3c9bb8', '#1a6483'], sand: '#efdcb8' },
        { sky: ['#2e3654', '#d9775d'], sun: '#ffd49c', sea: ['#2e4b6b', '#13263b'], sand: '#c4a17a' }
      ], r);
      const hz = 205 + r() * 40, sx = 60 + r() * 180, sy = hz - 40 - r() * 60;
      let w = '';
      for (let i = 0; i < 7; i++) { const y = hz + 14 + i * 20; w += `<path d="M0 ${y} Q37 ${y - 4} 75 ${y} T150 ${y} T225 ${y} T300 ${y}" stroke="#fff" stroke-opacity=".16" fill="none" stroke-width="2"/>`; }
      const palm = r() > .45 ? `<path d="M250 400 C246 350 240 320 228 290" stroke="#2b2a24" stroke-width="7" fill="none"/>${[0, 50, 110, 170, 230].map(a => `<ellipse cx="228" cy="268" rx="34" ry="8" fill="#2b2a24" transform="rotate(${a - 20} 228 290)"/>`).join('')}` : '';
      return `<defs>${lg(id + 'a', ...p.sky)}${lg(id + 'b', ...p.sea)}</defs><rect width="300" height="400" fill="url(#${id}a)"/>
        <circle cx="${sx}" cy="${sy}" r="${24 + r() * 14}" fill="${p.sun}" opacity=".95"/>
        <rect y="${hz}" width="300" height="200" fill="url(#${id}b)"/>
        <rect x="${sx - 16}" y="${hz + 4}" width="32" height="90" fill="${p.sun}" opacity=".18"/>${w}
        <path d="M0 400 L0 ${352 + r() * 12} Q150 ${325 + r() * 15} 300 ${345 + r() * 10} L300 400Z" fill="${p.sand}"/>${palm}`;
    },
    mountain(r, id) {
      const p = M.pick([
        { sky: ['#f4dcc0', '#c9d8e2'], l: ['#9fb3c2', '#6f8797', '#3f5565'], sun: '#fff4dd' },
        { sky: ['#e8c5a7', '#9fb6c9'], l: ['#a39cb3', '#6e6886', '#3b3651'], sun: '#ffe7c4' },
        { sky: ['#dfe9e2', '#b7cfc4'], l: ['#8fb2a1', '#5e8775', '#2f5345'], sun: '#ffffff' }
      ], r);
      return `<defs>${lg(id + 'a', ...p.sky)}${lg(id + 'f', 'rgba(255,255,255,0)', 'rgba(255,255,255,.55)')}</defs>
        <rect width="300" height="400" fill="url(#${id}a)"/>
        <circle cx="${80 + r() * 140}" cy="${90 + r() * 50}" r="${20 + r() * 12}" fill="${p.sun}"/>
        <path d="${ridge(r, 220, 80, 50)}" fill="${p.l[0]}"/>
        <rect y="220" width="300" height="80" fill="url(#${id}f)"/>
        <path d="${ridge(r, 280, 70, 40)}" fill="${p.l[1]}"/>
        <path d="${ridge(r, 340, 50, 30)}" fill="${p.l[2]}"/>`;
    },
    city(r, id) {
      const night = r() > .35;
      let b = '', stars = '';
      if (night) for (let i = 0; i < 30; i++) stars += `<circle cx="${r() * 300}" cy="${r() * 180}" r="${r() * 1.2 + .3}" fill="#fff" opacity="${.3 + r() * .6}"/>`;
      let x = -10;
      while (x < 300) {
        const w = 26 + r() * 34, h = 110 + r() * 200, y = 400 - h;
        const col = night ? M.pick(['#1c2333', '#232a3d', '#2a2f42'], r) : M.pick(['#c9bba8', '#b6a894', '#d8cdbd', '#a8998a'], r);
        b += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h}" fill="${col}"/>`;
        for (let wy = y + 10; wy < 390; wy += 14) for (let wx = x + 5; wx < x + w - 6; wx += 9)
          if (r() > (night ? .55 : .8)) b += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="4" height="6" fill="${night ? '#ffd27a' : '#f5efe6'}" opacity="${night ? .55 + r() * .4 : .6}"/>`;
        x += w + 2;
      }
      const sky = night ? ['#141a2c', '#3b3550'] : ['#f2e6d6', '#e0c7a8'];
      return `<defs>${lg(id + 'a', ...sky)}</defs><rect width="300" height="400" fill="url(#${id}a)"/>${stars}
        ${night ? `<circle cx="${60 + r() * 180}" cy="70" r="14" fill="#f4ecd8"/>` : ''}${b}`;
    },
    temple(r, id) {
      const sky = M.pick([['#f6c48f', '#d76d4f'], ['#f3d9b5', '#e2a07c'], ['#e9b98f', '#8e5a6f']], r);
      const sil = '#2a1f1d';
      const cx = 150;
      let trees = '';
      for (let i = 0; i < 9; i++) { const tx = r() < .5 ? r() * 70 : 230 + r() * 70; trees += `<circle cx="${tx}" cy="${330 + r() * 30}" r="${18 + r() * 18}" fill="${sil}"/>`; }
      return `<defs>${lg(id + 'a', ...sky)}</defs><rect width="300" height="400" fill="url(#${id}a)"/>
        <circle cx="${cx + 50}" cy="250" r="46" fill="#ffe9c7" opacity=".85"/>
        <path d="M${cx} 70 L${cx + 4} 150 Q${cx + 34} 175 ${cx + 40} 230 L${cx + 52} 230 L${cx + 52} 250 L${cx + 70} 250 L${cx + 70} 280 L${cx - 70} 280 L${cx - 70} 250 L${cx - 52} 250 L${cx - 52} 230 L${cx - 40} 230 Q${cx - 34} 175 ${cx - 4} 150 Z" fill="${sil}"/>
        <rect x="0" y="278" width="300" height="122" fill="${sil}"/>
        <rect x="0" y="300" width="300" height="100" fill="#3d2b28" opacity=".6"/>${trees}`;
    },
    food(r, id) {
      const t = M.pick(['#d7b48e', '#e7e0d3', '#c79a74', '#dfd6c4'], r);
      const broth = M.pick(['#e39a52', '#f0cf8c', '#c9542f', '#e8b866'], r);
      let n = '';
      for (let i = 0; i < 14; i++) { const a = r() * 6.28, rr = 20 + r() * 45; const x1 = 150 + Math.cos(a) * rr, y1 = 200 + Math.sin(a) * rr; n += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} q${(r() * 40 - 20).toFixed(1)} ${(r() * 40 - 20).toFixed(1)} ${(r() * 50 - 25).toFixed(1)} ${(r() * 30 - 15).toFixed(1)}" stroke="#f7e6bd" stroke-width="3.5" fill="none" stroke-linecap="round"/>`; }
      let g = '';
      for (let i = 0; i < 9; i++) { const a = r() * 6.28, rr = r() * 60; g += `<ellipse cx="${(150 + Math.cos(a) * rr).toFixed(1)}" cy="${(200 + Math.sin(a) * rr).toFixed(1)}" rx="6" ry="3" fill="${r() > .3 ? '#5e9b55' : '#d64532'}" transform="rotate(${r() * 180} ${(150 + Math.cos(a) * rr).toFixed(1)} ${(200 + Math.sin(a) * rr).toFixed(1)})"/>`; }
      return `<rect width="300" height="400" fill="${t}"/>
        ${[0, 1, 2, 3, 4, 5].map(i => `<rect y="${i * 70}" width="300" height="1.5" fill="#000" opacity=".05"/>`).join('')}
        <circle cx="152" cy="206" r="112" fill="#000" opacity=".08"/>
        <circle cx="150" cy="200" r="110" fill="#fbf8f2"/><circle cx="150" cy="200" r="86" fill="${broth}"/>${n}${g}
        <circle cx="${200 + r() * 20}" cy="${160}" r="14" fill="#cfe3a1"/><circle cx="${200 + r() * 20}" cy="160" r="10" fill="#e9f3c8"/>
        <rect x="236" y="40" width="7" height="230" rx="3" fill="#7b5235" transform="rotate(18 240 150)"/>
        <rect x="252" y="40" width="7" height="230" rx="3" fill="#7b5235" transform="rotate(22 255 150)"/>`;
    },
    cafe(r, id) {
      const t = M.pick(['#c9a27c', '#e5ddd0', '#8d6a52', '#d9cbb6'], r);
      const art = r() > .5
        ? `<path d="M150 172 C130 150 112 178 150 205 C188 178 170 150 150 172Z" fill="#f2e2cc"/>`
        : `<ellipse cx="150" cy="200" rx="22" ry="16" fill="#f2e2cc"/><ellipse cx="150" cy="178" rx="16" ry="10" fill="#f2e2cc"/><ellipse cx="150" cy="162" rx="10" ry="6" fill="#f2e2cc"/><path d="M150 216 V150" stroke="#9b6a4b" stroke-width="2"/>`;
      return `<rect width="300" height="400" fill="${t}"/>
        <rect x="0" y="0" width="300" height="400" fill="#fff" opacity=".04"/>
        <path d="M0 ${60 + r() * 40} L300 ${120 + r() * 60} L300 0 L0 0Z" fill="#fff" opacity=".12"/>
        <circle cx="153" cy="195" r="88" fill="#000" opacity=".08"/>
        <circle cx="150" cy="190" r="86" fill="#f7f2ea"/><circle cx="150" cy="190" r="60" fill="#ffffff"/>
        <circle cx="150" cy="190" r="50" fill="#8a5a3c"/>${art}
        <rect x="205" y="178" width="38" height="14" rx="7" fill="#ffffff"/>
        <rect x="60" y="300" width="80" height="8" rx="4" fill="#b8b2a8" transform="rotate(-25 100 304)"/>`;
    },
    market(r, id) {
      let l = '', strings = '';
      for (let row = 0; row < 3; row++) {
        const y0 = 70 + row * 90;
        strings += `<path d="M0 ${y0} Q150 ${y0 + 30} 300 ${y0}" stroke="#6b4a3a" stroke-width="1.5" fill="none"/>`;
        for (let i = 0; i < 7; i++) {
          const x = 20 + i * 43 + r() * 6, y = y0 + 15 * Math.sin(Math.PI * x / 300) + 14;
          const c = M.pick(['#e4572e', '#f2a541', '#f6d365', '#e9785a'], r);
          l += `<circle cx="${x}" cy="${y + 4}" r="24" fill="url(#${id}g)"/><ellipse cx="${x}" cy="${y}" rx="11" ry="13" fill="${c}"/><ellipse cx="${x - 3}" cy="${y - 3}" rx="4" ry="5" fill="#fff" opacity=".35"/>`;
        }
      }
      let ppl = '';
      for (let i = 0; i < 9; i++) { const x = r() * 300, h = 50 + r() * 30; ppl += `<circle cx="${x}" cy="${400 - h - 10}" r="9" fill="#120b0a"/><rect x="${x - 11}" y="${400 - h}" width="22" height="${h}" rx="9" fill="#120b0a"/>`; }
      return `<defs>${lg(id + 'a', '#2b1d1a', '#5a3526')}<radialGradient id="${id}g"><stop offset="0" stop-color="#ffb66b" stop-opacity=".45"/><stop offset="1" stop-color="#ffb66b" stop-opacity="0"/></radialGradient></defs>
        <rect width="300" height="400" fill="url(#${id}a)"/>${strings}${l}${ppl}`;
    },
    forest(r, id) {
      const g = M.pick([['#e2ebdf', '#a9c2a7', ['#8fae8c', '#5d8a63', '#2f5a3d']], ['#efe6d5', '#c2b99a', ['#a7a979', '#6f7a4c', '#3b4628']]], r);
      let layers = '';
      g[2].forEach((c, li) => {
        for (let i = 0; i < 9; i++) {
          const x = i * 38 + r() * 20 - 10, base = 260 + li * 55, h = 100 + r() * 60;
          layers += `<path d="M${x} ${base - h} L${x + 26} ${base} L${x - 26} ${base}Z" fill="${c}"/><path d="M${x} ${base - h + 30} L${x + 32} ${base + 26} L${x - 32} ${base + 26}Z" fill="${c}"/>`;
        }
        layers += `<rect y="${260 + li * 55 + 20}" width="300" height="200" fill="${c}"/>`;
        if (li === 0) layers += `<rect y="180" width="300" height="140" fill="#fff" opacity=".22"/>`;
      });
      return `<defs>${lg(id + 'a', g[0], g[1])}</defs><rect width="300" height="400" fill="url(#${id}a)"/>${layers}`;
    },
    flower(r, id) {
      let leaves = '', fl = '';
      for (let i = 0; i < 14; i++) { const x = r() * 300, y = r() * 400; leaves += `<ellipse cx="${x}" cy="${y}" rx="${30 + r() * 20}" ry="${12 + r() * 6}" fill="${M.pick(['#3f6b45', '#4f7d4f', '#2f5636', '#5f8f5a'], r)}" transform="rotate(${r() * 180} ${x} ${y})"/>`; }
      for (let i = 0; i < 7; i++) {
        const x = 40 + r() * 220, y = 40 + r() * 320, s = .8 + r() * .7;
        fl += `<g transform="translate(${x} ${y}) scale(${s.toFixed(2)})">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-11" rx="7.5" ry="12" fill="#fffdf6" transform="rotate(${a})"/>`).join('')}<circle r="4" fill="#efe1a8"/></g>`;
      }
      return `<rect width="300" height="400" fill="#284a31"/>${leaves}${fl}`;
    },
    abstract(r, id) {
      const c = M.pick([['#e9d8c4', '#c88b6a', '#6d7f8c'], ['#d9e1dc', '#93ab9c', '#c96d4b']], r);
      return `<rect width="300" height="400" fill="${c[0]}"/><circle cx="${80 + r() * 140}" cy="${120 + r() * 100}" r="${70 + r() * 40}" fill="${c[1]}"/><rect x="${r() * 120}" y="${220 + r() * 60}" width="200" height="120" rx="60" fill="${c[2]}" opacity=".8"/>`;
    }
  };

  M.scene = (kind = 'sea', seed = 1) => {
    const fn = draw[kind] || draw.abstract;
    const id = 's' + (++gid);
    return `<svg class="scene" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${fn(M.rng(seed * 9973 + M.hash(kind)), id)}</svg>`;
  };

  /* ภาพสื่อของสไลด์: รูปที่อัปโหลด / วิดีโอในหน่วยความจำ / ภาพวาด */
  M.media = (s, opts = {}) => {
    if (!s) return M.scene('abstract', 1);
    const filt = s.filter ? ` style="filter:${M.FILTERS[s.filter] || 'none'}"` : '';
    let inner;
    if (s.vid && M.mem.videos[s.vid]) inner = `<video src="${M.mem.videos[s.vid]}" muted loop playsinline autoplay${filt}></video>`;
    else if (s.img) inner = `<img src="${s.img}" alt=""${filt}>`;
    else inner = `<div class="art${s.video || opts.motion ? ' kb' : ''}"${filt}>${M.scene(s.art?.kind, s.art?.seed)}</div>`;
    const ov = (s.overlays || []).map(o => o.type === 'text'
      ? `<span class="ov ov-text" style="left:${o.x}%;top:${o.y}%;color:${o.color || '#fff'}">${M.esc(o.text)}</span>`
      : o.type === 'sticker' ? `<span class="ov ov-stk" style="left:${o.x}%;top:${o.y}%">${M.sticker(o.i, 64, o.a)}</span>`
      : o.type === 'gif' ? `<span class="ov ov-stk" style="left:${o.x}%;top:${o.y}%">${M.gifHTML ? M.gifHTML(o.src, 72) : ''}</span>`
      : o.type === 'music' ? `<span class="ov ov-chip" style="left:${o.x}%;top:${o.y}%">${M.icon('music', 14)} ${M.esc(o.text)}</span>`
      : o.type === 'loc' ? `<span class="ov ov-chip" style="left:${o.x}%;top:${o.y}%">${M.icon('pin', 14)} ${M.esc(o.text)}</span>` : '').join('');
    return inner + ov;
  };

  M.FILTERS = {
    none: 'none', warm: 'sepia(.25) saturate(1.2)', cool: 'hue-rotate(-12deg) saturate(.9) brightness(1.05)',
    fade: 'contrast(.88) brightness(1.08) saturate(.75)', mono: 'grayscale(1) contrast(1.05)',
    film: 'contrast(1.1) sepia(.15) saturate(1.05)', vivid: 'saturate(1.45) contrast(1.05)'
  };
  M.FILTER_TH = { none: 'ปกติ', warm: 'อุ่น', cool: 'เย็น', fade: 'ซีด', mono: 'ขาวดำ', film: 'ฟิล์ม', vivid: 'สด' };

  /* อวาตาร์ */
  const firstChar = name => [...String(name || '?')].find(c => !/[เแโใไ\s]/.test(c)) || '?';
  M.avatar = (u, s = 40, cls = '') => {
    if (!u) u = { name: '?', hue: 30 };
    if (u.official === 'mali') return `<span class="av av-logo ${cls}" style="--s:${s}px">${M.logo(s * .62)}</span>`;
    if (u.photo) return `<img class="av ${cls}" style="--s:${s}px" src="${u.photo}" alt="">`;
    return `<span class="av ${cls}" style="--s:${s}px;--h:${u.hue ?? 30}" aria-hidden="true">${M.esc(firstChar(u.name))}</span>`;
  };

  /* โลโก้: ดอกไม้ 5 กลีบสีเดียว */
  M.logo = (size = 28, color = 'var(--accent)') =>
    `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><g fill="${color}">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="12" cy="6.4" rx="3.5" ry="5.1" transform="rotate(${a} 12 12)"/>`).join('')}</g><circle cx="12" cy="12" r="2.4" fill="var(--bg)"/></svg>`;

  /* คาแรกเตอร์ผู้ช่วย "น้องตูม" — ดอกมะลิตูม ออกแบบใหม่สำหรับแอปนี้ */
  const EYES = {
    happy: '<circle cx="40" cy="60" r="3.4" fill="#2a241d"/><circle cx="60" cy="60" r="3.4" fill="#2a241d"/>',
    love: '<path d="M36 58c0-3 4-3 4 0 0-3 4-3 4 0 0 3-4 5-4 5s-4-2-4-5zM56 58c0-3 4-3 4 0 0-3 4-3 4 0 0 3-4 5-4 5s-4-2-4-5z" fill="#c4411a"/>',
    wow: '<circle cx="40" cy="59" r="4.6" fill="#2a241d"/><circle cx="60" cy="59" r="4.6" fill="#2a241d"/><circle cx="41.5" cy="57.5" r="1.4" fill="#fff"/><circle cx="61.5" cy="57.5" r="1.4" fill="#fff"/>',
    sleepy: '<path d="M35 60h10M55 60h10" stroke="#2a241d" stroke-width="3" stroke-linecap="round"/><text x="70" y="40" font-size="12" fill="#7b7266" font-family="sans-serif">z</text><text x="78" y="30" font-size="9" fill="#7b7266" font-family="sans-serif">z</text>',
    sad: '<circle cx="40" cy="60" r="3.4" fill="#2a241d"/><circle cx="60" cy="60" r="3.4" fill="#2a241d"/><path d="M63 66q2 6 0 8-2-2 0-8z" fill="#7fb6d6"/>',
    wink: '<circle cx="40" cy="60" r="3.4" fill="#2a241d"/><path d="M55 61q5-5 10 0" stroke="#2a241d" stroke-width="3" fill="none" stroke-linecap="round"/>',
    thanks: '<path d="M35 61q5-5 10 0M55 61q5-5 10 0" stroke="#2a241d" stroke-width="3" fill="none" stroke-linecap="round"/>'
  };
  const MOUTH = {
    happy: '<path d="M44 70q6 6 12 0" stroke="#2a241d" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    love: '<path d="M44 70q6 6 12 0" stroke="#2a241d" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    wow: '<ellipse cx="50" cy="73" rx="4" ry="5" fill="#2a241d"/>',
    sleepy: '<path d="M46 72h8" stroke="#2a241d" stroke-width="2.6" stroke-linecap="round"/>',
    sad: '<path d="M44 74q6-5 12 0" stroke="#2a241d" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    wink: '<path d="M43 69q7 8 14 0z" fill="#2a241d"/>',
    thanks: '<path d="M44 70q6 6 12 0" stroke="#2a241d" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
  };
  M.bud = (expr = 'happy', size = 72) =>
    `<svg class="bud" width="${size}" height="${size * 1.1}" viewBox="0 0 100 110" aria-hidden="true">
      <path d="M50 92 C38 100 24 100 18 94 C26 88 38 88 50 92Z" fill="#5c8f4e"/><path d="M50 92 C62 100 76 100 82 94 C74 88 62 88 50 92Z" fill="#4c7d40"/>
      <path d="M50 10 C72 28 86 52 81 71 C77 87 63 94 50 94 C37 94 23 87 19 71 C14 52 28 28 50 10Z" fill="#fffaf0" stroke="#2a241d" stroke-width="3"/>
      <path d="M50 12 C44 28 42 40 47 50" stroke="#2a241d" stroke-opacity=".25" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <ellipse cx="31" cy="70" rx="6" ry="3.6" fill="#f2a8a0" opacity=".75"/><ellipse cx="69" cy="70" rx="6" ry="3.6" fill="#f2a8a0" opacity=".75"/>
      ${EYES[expr] || EYES.happy}${MOUTH[expr] || MOUTH.happy}</svg>`;

  M.STICKERS = [
    { e: 'happy', t: 'สวัสดี' }, { e: 'love', t: 'รักเลย' }, { e: 'wow', t: 'ว้าว' }, { e: 'thanks', t: 'ขอบคุณนะ' },
    { e: 'sleepy', t: 'ง่วงแล้ว' }, { e: 'sad', t: 'เศร้าจัง' }, { e: 'wink', t: 'โอเคเลย' }, { e: 'happy', t: 'สู้ๆ นะ' }
  ];
  M.sticker = (i, size = 96) => {
    const s = M.STICKERS[i] || M.STICKERS[0];
    return `<span class="stk" style="--s:${size}px">${M.bud(s.e, size * .78)}<b>${M.esc(s.t)}</b></span>`;
  };
})(window.M);
