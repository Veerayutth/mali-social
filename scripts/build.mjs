// สร้างโฟลเดอร์ dist สำหรับ Netlify: เฉพาะไฟล์หน้าเว็บ (ไม่รวมเซิร์ฟเวอร์ ข้อมูล หรือกุญแจ)
import fs from 'node:fs';
const out = 'dist';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) fs.copyFileSync(f, `${out}/${f}`);
for (const d of ['css', 'js', 'icons']) fs.cpSync(d, `${out}/${d}`, { recursive: true });
console.log('built dist/');
