'use strict';
/* ข้อมูลตัวอย่างภาษาไทย — บุคคลและบัญชีทั้งหมดเป็นตัวละครสมมติ
   เวลาของข้อมูลตัวอย่างเก็บเป็น "ago" (นาที) แล้วแปลงเป็นเวลาจริงตอนเปิดแอป เพื่อให้สตอรี่ 24 ชม. ไม่หมดอายุ */
(function (M) {
  const { MIN, HOUR, DAY } = M.T;

  M.TOPICS = { travel: 'ท่องเที่ยว', food: 'อาหาร', cafe: 'คาเฟ่', city: 'เมืองและสถาปัตย์', nature: 'ธรรมชาติ', art: 'ศิลปะ', tech: 'เทคโนโลยี', craft: 'งานคราฟต์' };
  M.TRACKS = [
    { id: 't1', name: 'ฝนแรก', artist: 'วงลมเหนือ', len: '3:12' },
    { id: 't2', name: 'เช้าวันเสาร์', artist: 'ปลายฟ้า', len: '2:48' },
    { id: 't3', name: 'ทางกลับบ้าน', artist: 'ทิวสน', len: '4:05' },
    { id: 't4', name: 'ไฟถนน', artist: 'นครไลต์', len: '3:30' },
    { id: 't5', name: 'ตลาดเก่า', artist: 'บรรเลงกลางเมือง', len: '2:20' }
  ];

  M.seed = () => {
    const users = {};
    const U = (id, name, handle, hue, bio, o = {}) => users[id] = { id, name, handle, hue, bio, followers: o.followers ?? Math.round(200 + M.rng(M.hash(id))() * 4000), followingCount: o.fc ?? 300, type: o.type || 'personal', friend: !!o.friend, verified: !!o.verified, official: o.official, private: !!o.private, online: !!o.online, lastSeen: o.lastSeen ?? 20, category: o.category };
    U('ploy', 'พลอย ชนิดา', 'ploy.chanida', 18, 'ถ่ายรูปกาแฟกับแสงเช้า · กรุงเทพฯ', { friend: 1, type: 'creator', followers: 12840, online: 1, category: 'ช่างภาพ' });
    U('ton', 'ต้น ธนกร', 'ton.cafe', 30, 'บาริสต้าวันธรรมดา นักปั่นจักรยานวันหยุด', { friend: 1, online: 1 });
    U('mint', 'มิ้นต์ ครัวบ้าน', 'mint.bake', 340, 'สูตรขนมไทยง่ายๆ ทำได้ในเตาเล็ก · ช่องสูตรลับอยู่ในแชต', { friend: 1, type: 'creator', followers: 48200, category: 'ครีเอเตอร์อาหาร' });
    U('nok', 'นก ปรียา', 'nok.preeya', 150, 'ครูภาษาไทย ชอบเดินป่าและทะเล', { friend: 1, lastSeen: 45 });
    U('bank', 'แบงก์ ณัฐวุฒิ', 'bank.walks', 210, 'เดินเมืองเก่า เล่าเรื่องตึก', { friend: 1 });
    U('fah', 'ฟ้า ศศิ', 'fah.sasi', 200, 'นักวาดภาพประกอบ รับงานวาดหน้าปกหนังสือ', { friend: 1, type: 'creator', followers: 9310, category: 'ศิลปิน' });
    U('jirat', 'จิรัฐ ภักดี', 'jirat.dev', 120, 'เขียนโค้ด กินข้าวมันไก่ วิ่งเช้าวันอาทิตย์', { friend: 1, online: 1 });
    U('may', 'เมย์ สุดา', 'may.weave', 320, 'ผ้าทอมือย้อมคราม ส่งทั่วประเทศ', { type: 'business', followers: 21500, category: 'ร้านค้า' });
    U('kao', 'ข้าว ภูมิ', 'kao.phum', 90, 'ช่างภาพสตรีท เชียงใหม่', { type: 'creator', followers: 30200, category: 'ช่างภาพ' });
    U('pim', 'พิมพ์ ลดา', 'pim.lada', 10, 'นักศึกษาสถาปัตย์ ปี 4', { friend: 1, private: 1 });
    U('mali', 'มะลิ ทีม', 'mali.team', 18, 'บัญชีทางการของแอปมะลิ ข่าวฟีเจอร์และความปลอดภัย', { verified: 1, official: 'mali', type: 'business', followers: 1200000 });
    U('news', 'ข่าวเช้า 7 โมง', 'morning7.news', 215, 'สรุปข่าวสั้นทุกเช้า (บัญชีสมมติ)', { verified: 1, official: 'news', type: 'business', followers: 310000 });
    U('weather', 'อากาศวันนี้', 'today.weather', 195, 'พยากรณ์อากาศรายวัน (ข้อมูลตัวอย่าง)', { verified: 1, official: 'weather', type: 'business', followers: 87000 });
    U('stranger', 'ผู้ใช้ 9921', 'user_9921', 0, '', { followers: 3, fc: 2100 });

    const me = {
      id: 'me', name: 'กัญญา พรหมมา', handle: 'kanya.p', hue: 25, bio: 'ชอบทะเล กาแฟ และสมุดสเก็ตช์\nเรียนออกแบบที่เชียงใหม่', link: 'https://mali.example/kanya',
      followers: 1287, type: 'personal', category: 'บล็อกเกอร์', pronoun: '', note: null, gridOrder: [], email: 'k•••@example.com', phone: '08•-•••-••12'
    };

    const C = ['สวยมาก', 'ไปมาแล้ว ชอบมาก', 'อยากไปบ้าง', 'แสงดีมากเลย', 'ขอพิกัดหน่อย', 'น่ากินมาก', 'เก็บไว้ก่อน', 'ภาพนี้ใช้กล้องอะไร', 'ใจฟูเลย', 'รอบหน้าชวนด้วย'];
    let cseq = 0;
    const comments = (seed, n) => { const r = M.rng(seed); const ids = Object.keys(users).filter(k => !users[k].official && k !== 'stranger'); return Array.from({ length: n }, () => ({ id: 'c' + (++cseq), userId: M.pick(ids, r), text: M.pick(C, r), ago: 5 + Math.floor(r() * 300), likes: Math.floor(r() * 20) })); };
    const slide = (kind, seed, cap, video) => ({ art: { kind, seed }, caption: cap || '', video: !!video });

    const posts = [
      { id: 'p1', userId: 'ploy', collab: ['ton'], ago: 45, location: 'อารีย์ กรุงเทพฯ', tags: ['cafe', 'city'], likes: 1284, slides: [slide('cafe', 3, 'แก้วแรกของวัน'), slide('cafe', 8, 'มุมโปรดริมหน้าต่าง'), slide('city', 4, 'เดินต่อไปตลาดเช้า')], caption: 'เช้าวันเสาร์ที่ร้านเล็กๆ ในซอย แสงเข้าหน้าต่างพอดีตอนแปดโมง ถ่ายร่วมกับ @ton.cafe #คาเฟ่อารีย์', tagged: ['me'] },
      { id: 'p2', userId: 'mint', ago: 80, location: 'ครัวที่บ้าน', tags: ['food', 'craft'], likes: 5320, slides: [slide('food', 11, '', true)], caption: 'ขนมชั้นใบเตย 9 ชั้น ใช้เวลาจริงประมาณสองชั่วโมง สูตรละเอียดอยู่ในช่องบรอดแคสต์ #ขนมไทย' },
      { id: 'p3', userId: 'bank', ago: 190, location: 'ตลาดน้อย', tags: ['city', 'travel'], likes: 842, slides: [slide('city', 21, 'ตึกแถวหัวมุม'), slide('city', 22, 'บันไดเหล็กด้านหลัง')], caption: 'ตึกแถวเก่าย่านตลาดน้อย อายุเกือบร้อยปี ยังมีคนอยู่อาศัยจริง #เดินเมืองเก่า' },
      { id: 'p4', userId: 'nok', ago: 300, location: 'เชียงดาว เชียงใหม่', tags: ['nature', 'travel'], likes: 2110, slides: [slide('mountain', 5, '5:40 น. ก่อนพระอาทิตย์ขึ้น'), slide('mountain', 9, 'ทะเลหมอกมาตามนัด')], caption: 'ตื่นตีสี่ครึ่งคุ้มมาก ทะเลหมอกเต็มหุบ #ทะเลหมอก' },
      { id: 'p5', userId: 'fah', ago: 420, tags: ['art'], likes: 3040, slides: [slide('flower', 2)], caption: 'สเก็ตช์ดอกมะลิจากระเบียงบ้าน ลงสีน้ำแล้วสแกน รับงานภาพประกอบเดือนหน้า' },
      { id: 'p6', userId: 'kao', ago: 540, location: 'ถนนคนเดินวัวลาย', tags: ['travel', 'city'], likes: 6900, slides: [slide('market', 7, 'โคมสีส้มทั้งซอย'), slide('market', 12, 'ร้านลุงขายถั่วต้ม')], caption: 'ถนนคนเดินคืนวันเสาร์ เชียงใหม่ #ถนนคนเดิน' },
      { id: 'p7', userId: 'ton', ago: 720, location: 'ร้านต้นกาแฟ', tags: ['cafe'], likes: 410, slides: [slide('cafe', 31)], caption: 'ลองเมล็ดใหม่จากน่าน กลิ่นถั่ว คาราเมล เปรี้ยวน้อย ใครแวะมาบอกได้' },
      { id: 'p8', userId: 'may', ago: 1200, tags: ['craft'], likes: 1520, slides: [slide('flower', 17, 'ลายดอกพิกุล'), slide('forest', 3, 'ย้อมครามธรรมชาติ')], caption: 'ผ้าทอลายดอกพิกุลล็อตใหม่ ย้อมครามธรรมชาติ สั่งผ่านแชตได้เลย' },
      { id: 'p9', userId: 'jirat', ago: 1500, tags: ['tech', 'city'], likes: 260, slides: [slide('city', 41)], caption: 'เลิกงานสี่ทุ่ม รถไฟฟ้าขบวนเกือบสุดท้าย พรุ่งนี้เดโมงานลูกค้า' },
      { id: 'p10', userId: 'pim', ago: 2100, location: 'ริมแม่น้ำเจ้าพระยา', tags: ['travel', 'art'], likes: 380, slides: [slide('temple', 6)], caption: 'ส่งงานโมเดลเสร็จ แวะนั่งดูพระอาทิตย์ตกริมน้ำ' },
      { id: 'p11', userId: 'nok', ago: 2900, location: 'เกาะกูด ตราด', tags: ['travel', 'nature'], likes: 1730, slides: [slide('sea', 4, 'น้ำใสจนเห็นปลา'), slide('sea', 14, 'บ้านพักริมหาด')], caption: 'สามวันที่เกาะกูด ไม่เปิดคอมเลย #ทะเลไทย' },
      { id: 'p12', userId: 'ploy', ago: 3600, location: 'นิมมานฯ เชียงใหม่', tags: ['food', 'travel'], likes: 990, slides: [slide('food', 27)], caption: 'ข้าวซอยร้านประจำ น้ำแกงเข้มกำลังดี' },
      // โพสต์ของฉัน
      { id: 'm1', userId: 'me', ago: 900, location: 'บางแสน', tags: ['travel'], likes: 214, slides: [slide('sea', 31)], caption: 'ทะเลวันธรรมดา คนน้อยมาก' },
      { id: 'm2', userId: 'me', ago: 4300, tags: ['travel'], likes: 188, slides: [slide('temple', 13)], caption: 'เย็นวันศุกร์ริมน้ำ' },
      { id: 'm3', userId: 'me', ago: 7300, tags: ['cafe'], likes: 132, slides: [slide('cafe', 51), slide('cafe', 52)], caption: 'คาเฟ่ใหม่แถวบ้าน' },
      { id: 'm4', userId: 'me', ago: 10300, tags: ['art'], likes: 301, slides: [slide('flower', 41)], caption: 'ลองวาดมะลิแบบเพื่อน @fah.sasi' },
      { id: 'm5', userId: 'me', ago: 15000, tags: ['nature'], likes: 245, slides: [slide('mountain', 61)], caption: 'ภูชี้ฟ้าปีที่แล้ว' },
      { id: 'm6', userId: 'me', ago: 20000, tags: ['city'], likes: 97, slides: [slide('city', 71)], caption: 'ไฟถนนหลังฝนตก' }
    ].map((p, i) => ({ liked: false, saved: false, reposted: false, collab: [], comments: comments(i * 7 + 1, 2 + (i % 4)), commentsOff: false, hideLikes: false, ...p }));
    me.gridOrder = posts.filter(p => p.userId === 'me').map(p => p.id);

    const story = (userId, items, ago, o = {}) => ({ id: 's_' + userId, userId, items: items.map((it, i) => ({ id: `${userId}_${i}`, ago: ago - i * 20, ...it })), seen: false, ...o });
    const stories = [
      story('ploy', [{ art: { kind: 'cafe', seed: 61 }, sticker: { type: 'addyours', prompt: 'แก้วแรกของวันนี้', count: 1280 } }, { art: { kind: 'city', seed: 62 }, overlays: [{ type: 'text', text: 'อารีย์ 8:10', x: 30, y: 20 }] }], 140),
      story('ton', [{ art: { kind: 'cafe', seed: 71 }, overlays: [{ type: 'text', text: 'เมล็ดใหม่มาแล้ว', x: 25, y: 70 }] }], 200, { closeFriends: true }),
      story('mint', [{ art: { kind: 'food', seed: 81 }, video: true }, { art: { kind: 'food', seed: 82 } }], 300),
      story('fah', [{ art: { kind: 'flower', seed: 91 }, hidden: true }], 400),
      story('nok', [{ art: { kind: 'mountain', seed: 33 } }], 600),
      story('bank', [{ art: { kind: 'city', seed: 93 }, overlays: [{ type: 'loc', text: 'ตลาดน้อย', x: 30, y: 75 }] }], 700),
      story('jirat', [{ art: { kind: 'city', seed: 94 } }], 900)
    ];

    const reels = [
      { id: 'r1', userId: 'mint', art: { kind: 'food', seed: 101 }, caption: 'ตีแป้งขนมชั้นให้เนียน ต้องกรองสองรอบ #ขนมไทย', audio: 'เสียงต้นฉบับ · mint.bake', likes: 18400, comments: comments(91, 4), shares: 920, ago: 300, tags: ['food'], sub: { th: 'กรองแป้งสองรอบ เนื้อจะเนียนไม่มีฟอง', en: 'Strain the batter twice for a smooth, bubble-free texture' }, long: { title: 'ขนมชั้น 9 ชั้น ฉบับเต็ม', min: 42 } },
      { id: 'r2', userId: 'kao', art: { kind: 'market', seed: 102 }, caption: 'หนึ่งนาทีในถนนคนเดิน', audio: 'ตลาดเก่า · บรรเลงกลางเมือง', likes: 32100, comments: comments(92, 3), shares: 2100, ago: 800, tags: ['travel', 'city'], sub: { th: 'ร้านนี้ขายมาสามสิบปีแล้ว', en: 'This stall has been here for thirty years' } },
      { id: 'r3', userId: 'nok', art: { kind: 'mountain', seed: 103 }, caption: 'ทะเลหมอกไหลข้ามสันดอย', audio: 'ฝนแรก · วงลมเหนือ', likes: 9020, comments: comments(93, 2), shares: 340, ago: 1500, tags: ['nature'], sub: { th: 'ดูหมอกตรงนั้นสิ ไหลเหมือนน้ำเลย', en: 'Look at the fog there, it flows like water' } },
      { id: 'r4', userId: 'ploy', art: { kind: 'cafe', seed: 104 }, caption: 'วิธีถ่ายแก้วกาแฟให้แสงสวยด้วยมือถือ', audio: 'เช้าวันเสาร์ · ปลายฟ้า', likes: 15200, comments: comments(94, 5), shares: 1800, ago: 2000, tags: ['cafe', 'art'], trial: false, sub: { th: 'หันแก้วเข้าหาหน้าต่าง แล้วลดแสงลงนิดหนึ่ง', en: 'Turn the cup toward the window and lower the exposure a little' } },
      { id: 'r5', userId: 'bank', art: { kind: 'temple', seed: 105 }, caption: 'ทำไมหลังคาโบสถ์ถึงซ้อนกันหลายชั้น', audio: 'เสียงต้นฉบับ · bank.walks', likes: 4400, comments: comments(95, 2), shares: 610, ago: 2600, tags: ['city', 'travel'], sub: { th: 'หลังคาซ้อนชั้นช่วยระบายความร้อน', en: 'Layered roofs help release heat' }, long: { title: 'เดินเมืองเก่า ตอนที่ 3', min: 27 } },
      { id: 'r6', userId: 'jirat', art: { kind: 'city', seed: 106 }, caption: 'ทำแอปจดรายจ่ายในหนึ่งชั่วโมง', audio: 'ไฟถนน · นครไลต์', likes: 2100, comments: comments(96, 2), shares: 150, ago: 3000, tags: ['tech'], sub: { th: 'เริ่มจากหน้าจอเดียวก่อน', en: 'Start with a single screen' } }
    ].map(r => ({ liked: false, saved: false, reposted: false, ...r }));

    // แชต
    const msg = (from, text, ago, o = {}) => ({ id: 'x' + (++cseq), from, type: 'text', text, ago, status: 'read', ...o });
    const tripLines = [
      ['nok', 'สรุปทริปเชียงใหม่ปลายเดือนนะ ใครไปได้บ้าง'], ['bank', 'ไปได้ ลาแล้ว'], ['jirat', 'ไปด้วย ขอกลับวันอาทิตย์เย็น'],
      ['ploy', '555 รอบนี้ห้ามตื่นสาย'], ['nok', 'จองที่พักแถวนิมมานแล้ว 2 คืน คืนละ 1,200 บาท หารกัน'], ['bank', 'โอเค'],
      ['jirat', 'ไฟลต์ศุกร์ 7:10 จากดอนเมือง ใครจะไปไฟลต์เดียวกันบอกนะ'], ['ploy', 'เอาด้วย'], ['nok', 'จริง ราคากำลังดี'],
      ['bank', 'วันเสาร์ขึ้นดอยตีสี่ครึ่ง อย่าลืมเสื้อกันหนาว'], ['ploy', 'หนาวแค่ไหน'], ['nok', 'ประมาณ 12 องศา'],
      ['jirat', 'ใครมีเต็นท์บ้าง'], ['bank', 'มีหนึ่งหลัง นอนได้สอง'], ['ploy', 'ฮ่าๆ ไม่เอาเต็นท์นะ'], ['nok', 'ไม่ต้องเต็นท์ ที่พักมีแล้ว'],
      ['jirat', 'งบรวมต่อคนประมาณเท่าไหร่'], ['nok', 'งบรวมคนละประมาณ 4,500 บาท ไม่รวมของฝาก'], ['bank', 'ได้'], ['ploy', 'จริงดิ ถูกกว่าที่คิด'],
      ['jirat', 'คืนวันเสาร์ไปถนนคนเดินไหม'], ['ploy', 'ไป ต้องไปกินข้าวซอยด้วย'], ['bank', 'ใช่'], ['nok', 'ตกลงคืนวันเสาร์ถนนคนเดิน วันอาทิตย์เช้าคาเฟ่'],
      ['ploy', 'ขอเลือกคาเฟ่เอง'], ['bank', '555'], ['jirat', 'ต้องโอนค่าที่พักให้นกภายในวันพุธนะ'], ['nok', 'ใช่ โอนภายในวันพุธ เดี๋ยวส่งเลขบัญชีในแชตส่วนตัว'],
      ['bank', 'รับทราบ'], ['ploy', 'ขอแผนเดินทางเป็นภาพด้วยได้ไหม'], ['nok', 'เดี๋ยวทำให้'], ['jirat', 'ขอบคุณครับ'], ['bank', 'ตื่นเต้น'],
      ['ploy', 'อย่าลืมพาวเวอร์แบงก์'], ['nok', 'อย่าลืมบัตรประชาชนด้วย'], ['jirat', 'จริง'], ['bank', 'ใครจองรถจากสนามบิน'], ['nok', 'ต้นจะจองรถตู้ให้ นัดเจอ 9:00 ที่ประตู 3']
    ];
    const chats = [
      { id: 'c_ploy', type: 'dm', members: ['ploy'], unread: 2, messages: [
        msg('ploy', 'เสาร์นี้ว่างไหม ไปคาเฟ่ใหม่แถวอารีย์กัน', 1500), msg('me', 'ว่าง ไปกี่โมง', 1490),
        msg('ploy', 'แปดโมงครึ่ง แสงสวยตอนนั้น', 1480), msg('me', 'ได้ เจอกันหน้าร้านเลย', 1470),
        { id: 'xi1', from: 'ploy', type: 'instant', art: { kind: 'cafe', seed: 77 }, ago: 30, status: 'read', viewOnce: true, opened: false },
        msg('ploy', 'ดูร้านนี้สิ https://mali.example/p/arii-cafe', 12, { status: 'delivered' })
      ], replies: ['ได้เลย', 'แล้วเจอกันนะ', 'ฮ่าๆ จริง', 'เดี๋ยวส่งรูปให้', 'ไม่ไหวแล้ว 555'] },
      { id: 'c_ton', type: 'dm', members: ['ton'], unread: 0, messages: [
        msg('ton', 'เห็นโพสต์ขนมชั้นยัง', 2900), { id: 'xp1', from: 'ton', type: 'post', postId: 'p2', ago: 2899, status: 'read' },
        msg('me', 'เห็นแล้ว อยากลองทำ', 2800), msg('ton', 'มีเมล็ดกาแฟใหม่ด้วย แวะมาชิมนะ', 300)
      ], replies: ['มาเลย', 'วันนี้ร้านปิดสองทุ่ม', 'จะเก็บไว้ให้หนึ่งถุง'] },
      { id: 'g_trip', type: 'group', name: 'แก๊งเที่ยวเชียงใหม่', members: ['nok', 'bank', 'jirat', 'ploy'], unread: tripLines.length,
        messages: tripLines.map(([f, t], i) => msg(f, t, 400 - i * 9)), replies: ['เห็นด้วย', 'โอเค', 'รับทราบ', '555'] },
      { id: 'g_fam', type: 'group', name: 'บ้านพรหมมา', members: ['nok', 'bank'], unread: 0, muted: true, messages: [msg('bank', 'อาทิตย์นี้กินข้าวบ้านยายนะ', 3000), msg('me', 'ไปค่ะ', 2950)], replies: ['ดีเลย'] },
      { id: 'b_mint', type: 'broadcast', name: 'ครัวมิ้นต์ · ช่องสูตรลับ', owner: 'mint', members: ['mint'], memberCount: 8420, unread: 1, messages: [
        msg('mint', 'สูตรขนมชั้นใบเตย: แป้งท้าวยายม่อม 150 กรัม แป้งมัน 50 กรัม กะทิ 400 มล. น้ำตาล 180 กรัม', 100, { reacts: 412 }),
        msg('mint', 'เคล็ดลับ: นึ่งชั้นละ 5 นาที ชั้นสุดท้าย 15 นาที', 90, { reacts: 288 }),
        msg('mint', 'คืนนี้สามทุ่มจะไลฟ์ทำขนมเปียกปูน มาดูกันนะ', 20, { reacts: 120 })
      ] },
      { id: 'o_mali', type: 'official', members: ['mali'], unread: 1, messages: [
        msg('mali', 'ยินดีต้อนรับสู่มะลิ แตะโปรไฟล์ แล้วแตะ ≡ เพื่อดูการตั้งค่าความเป็นส่วนตัวและความปลอดภัย', 9000),
        msg('mali', 'แนะนำ: เปิดการยืนยันตัวตนสองชั้นเพื่อป้องกันบัญชีถูกแฮ็ก ไปที่ ≡ > ศูนย์ความปลอดภัย', 60)
      ] },
      { id: 'o_news', type: 'official', members: ['news'], unread: 0, messages: [msg('news', 'สรุปเช้านี้ (ข้อมูลตัวอย่าง): ฝนตกบางพื้นที่ในภาคกลาง รถไฟฟ้าสายใหม่เปิดทดลองฟรีสุดสัปดาห์นี้', 600)] },
      { id: 'c_req', type: 'dm', members: ['stranger'], request: true, unread: 1, messages: [
        msg('stranger', 'สวัสดี ยินดีด้วยคุณได้รับรางวัล กดยืนยันที่นี่ https://free-gift-mali.xyz/claim', 50),
        { id: 'xs1', from: 'stranger', type: 'image', art: { kind: 'abstract', seed: 9 }, sensitive: true, ago: 49, status: 'delivered' }
      ] }
    ];

    const notifications = [
      { type: 'security', text: 'มีการเข้าสู่ระบบจาก Windows · Chrome ที่ไม่คุ้นเคย ตรวจสอบได้ที่ตำแหน่งที่คุณเข้าสู่ระบบ', ago: 120 },
      { type: 'follow_req', userId: 'kao', ago: 30 },
      { type: 'follow_req', userId: 'may', ago: 300 },
      { type: 'like', userId: 'ploy', postId: 'm1', ago: 15 },
      { type: 'comment', userId: 'nok', postId: 'm1', text: 'ไปเมื่อไหร่ ชวนด้วย', ago: 40 },
      { type: 'tag', userId: 'ploy', postId: 'p1', ago: 46 },
      { type: 'mention', userId: 'fah', postId: 'm4', text: 'น่ารักมาก ส่งไฟล์มาให้ดูหน่อย', ago: 200 },
      { type: 'like', userId: 'jirat', postId: 'm4', ago: 600 },
      { type: 'follow', userId: 'pim', ago: 1500 },
      { type: 'like', userId: 'bank', postId: 'm2', ago: 3000 }
    ].map((n, i) => ({ id: 'n' + i, read: i > 5, ...n }));

    return {
      v: 2, me, users, posts, stories, reels, chats, notifications,
      following: ['ploy', 'ton', 'mint', 'nok', 'bank', 'fah', 'jirat', 'pim', 'kao', 'mali', 'news'],
      requested: [], closeFriends: ['ploy', 'ton', 'pim'], blocked: [], restricted: [], muted: [], notInterested: [],
      interests: { travel: 1, food: 1, cafe: 1, city: 1, nature: 1, art: 1, tech: 1, craft: 1 },
      saved: [], myStory: { items: [] }, archive: [
        { id: 'a1', art: { kind: 'sea', seed: 201 }, ts: Date.now() - 20 * DAY }, { id: 'a2', art: { kind: 'cafe', seed: 202 }, ts: Date.now() - 34 * DAY },
        { id: 'a3', art: { kind: 'market', seed: 203 }, ts: Date.now() - 50 * DAY }, { id: 'a4', art: { kind: 'flower', seed: 204 }, ts: Date.now() - 70 * DAY }
      ],
      highlights: [
        { id: 'h1', title: 'ทะเล', items: [{ art: { kind: 'sea', seed: 211 } }, { art: { kind: 'sea', seed: 212 } }] },
        { id: 'h2', title: 'คาเฟ่', items: [{ art: { kind: 'cafe', seed: 213 } }] },
        { id: 'h3', title: 'เชียงใหม่', items: [{ art: { kind: 'market', seed: 214 } }, { art: { kind: 'mountain', seed: 215 } }] },
        { id: 'h4', title: 'งานวาด', items: [{ art: { kind: 'flower', seed: 216 } }] }
      ],
      notes: { ploy: { text: 'หาร้านกาแฟเปิดก่อน 7 โมง', ago: 90 }, ton: { text: 'กำลังฟัง', music: 't1', ago: 200 }, mint: { text: 'คืนนี้ไลฟ์ทำขนม', ago: 400 }, jirat: { text: 'เดโมพรุ่งนี้ ขอให้รอด', ago: 700 } },
      calls: [
        { id: 'k1', userId: 'ploy', video: true, dir: 'out', dur: 312, ago: 1440 },
        { id: 'k2', userId: 'ton', video: false, dir: 'in', dur: 0, ago: 3000, missed: true },
        { id: 'k3', userId: 'nok', video: false, dir: 'in', dur: 95, ago: 6000 }
      ],
      recent: ['ทะเลหมอก', 'mint.bake'],
      tips: {},
      lives: [{ userId: 'kao', title: 'เดินถนนคนเดินสด', viewers: 1240, art: { kind: 'market', seed: 301 } }],
      settings: {
        theme: 'light', feedOrder: 'smart', private: false, activityStatus: true, readReceipts: true,
        storyReplies: 'everyone', messagesFrom: 'everyone', tagsFrom: 'everyone', tagApproval: false, mentionsFrom: 'everyone',
        commentsFrom: 'everyone', hiddenDefault: true, hiddenWords: ['ขายตรง'], hideLikesOthers: false, hideLikesMine: false,
        sensitive: 'standard', nudityProtect: true, linkScan: true, locationShare: 'off', teen: false, sleepMode: false, dailyLimit: 0,
        notifPause: false, subscriptions: false, gifts: true, autoDub: false
      },
      security: {
        password: null, totp: { enabled: false, secret: null, backup: [] }, sms: { enabled: false, phone: '' },
        loginAlerts: true, advanced: false, recoveryEmail: true, recoveryPhone: false,
        sessions: [
          { id: 'd0', device: 'this', place: 'กรุงเทพฯ ประเทศไทย', current: true, ago: 0 },
          { id: 'd1', device: 'iPad · แอปมะลิ', place: 'กรุงเทพฯ ประเทศไทย', ago: 4300, icon: 'device' },
          { id: 'd2', device: 'Windows · Chrome', place: 'ไม่ทราบตำแหน่ง · IP 185.220.x.x', ago: 120, icon: 'laptop', unknown: true }
        ],
        emails: [
          { id: 'e1', subject: 'มีการเข้าสู่ระบบใหม่จาก Windows · Chrome', type: 'ความปลอดภัย', ago: 118, body: 'หากไม่ใช่คุณ ให้เปลี่ยนรหัสผ่านและออกจากระบบอุปกรณ์นั้นทันทีจากแอป ทางเราจะไม่ขอรหัสผ่านทางอีเมล' },
          { id: 'e2', subject: 'สรุปกิจกรรมประจำสัปดาห์ของคุณ', type: 'ทั่วไป', ago: 4320, body: 'สัปดาห์นี้โพสต์ของคุณเข้าถึง 1,240 บัญชี' },
          { id: 'e3', subject: 'ยืนยันอีเมลสำหรับกู้คืนบัญชี', type: 'ความปลอดภัย', ago: 12000, body: 'คุณเพิ่มอีเมลนี้เป็นอีเมลกู้คืนบัญชีเรียบร้อยแล้ว' }
        ],
        apps: [
          { id: 'ap1', name: 'แอปพิมพ์รูปโพลารอยด์ (สมมติ)', scopes: ['อ่านข้อมูลโปรไฟล์', 'อ่านรูปที่โพสต์'], ago: 40000 },
          { id: 'ap2', name: 'ตัวช่วยตั้งเวลาโพสต์ (สมมติ)', scopes: ['อ่านข้อมูลโปรไฟล์', 'โพสต์แทนคุณ', 'อ่านสถิติ'], ago: 90000 }
        ],
        loginFails: 0, lockUntil: 0
      },
      session: { loggedOut: false },
      channel: null
    };
  };

  /* แปลง ago → ts (เฉพาะครั้งแรก) และให้สตอรี่ตัวอย่างอยู่ในช่วง 24 ชม. ทุกครั้งที่เปิด */
  M.normalizeTimes = (st, fresh) => {
    const now = Date.now();
    const fix = o => { if (o && o.ago != null && (fresh || o.ts == null)) { o.ts = now - o.ago * MIN; } };
    if (fresh) {
      st.posts.forEach(p => { fix(p); p.comments.forEach(fix); });
      st.reels.forEach(r => { fix(r); r.comments.forEach(fix); });
      st.chats.forEach(c => c.messages.forEach(fix));
      st.notifications.forEach(fix); st.calls.forEach(fix);
      st.security.sessions.forEach(fix); st.security.emails.forEach(fix); st.security.apps.forEach(fix);
      Object.values(st.notes).forEach(fix);
    }
    // สตอรี่ตัวอย่าง: รีเฟรชเวลาเสมอ (ข้อมูลสาธิต) / สตอรี่ของผู้ใช้: ใช้เวลาจริงและหมดอายุจริง
    st.stories.forEach(s => s.items.forEach(it => { if (it.ago != null) it.ts = now - it.ago * MIN; }));
    Object.values(st.notes).forEach(n => { if (n.ago != null) n.ts = now - n.ago * MIN; });
    // ย้ายสตอรี่ของฉันที่หมดอายุเข้าคลัง
    const alive = [];
    st.myStory.items.forEach(it => (now - it.ts > DAY ? st.archive.unshift({ id: it.id, art: it.art, img: it.img, ts: it.ts }) : alive.push(it)));
    st.myStory.items = alive;
    if (st.me.note && now - st.me.note.ts > DAY) st.me.note = null;
  };
})(window.M);
