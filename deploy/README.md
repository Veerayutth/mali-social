# เอามะลิขึ้นเซิร์ฟเวอร์ฟรี 24 ชั่วโมง (Oracle Cloud Always Free)

ปิดคอมเครื่องนี้ได้ แอปยังทำงานอยู่ ใช้เวลาประมาณ 30–45 นาที

## 1. สมัคร Oracle Cloud (คุณต้องทำเอง)
1. ไปที่ https://signup.cloud.oracle.com แล้วสมัครบัญชี เลือก Home Region เป็น **Singapore** (ใกล้ไทยที่สุด เปลี่ยนภายหลังไม่ได้)
2. ระบบจะขอบัตรเครดิต/เดบิตเพื่อยืนยันตัวตน ทรัพยากรแบบ Always Free ไม่ถูกเรียกเก็บเงิน
   อย่าอัปเกรดเป็น Pay As You Go ถ้าไม่ต้องการจ่ายเงิน

## 2. สร้างเครื่องเซิร์ฟเวอร์
1. เมนู Compute > Instances > **Create instance**
2. Image: **Ubuntu 24.04** · Shape: **VM.Standard.A1.Flex** (Ampere, Always Free) 1–2 OCPU, RAM 6–12 GB
   (ถ้าขึ้นว่าเต็ม ให้ลองใหม่ภายหลัง หรือใช้ VM.Standard.E2.1.Micro ซึ่งก็ฟรีแต่เล็กกว่า)
3. ช่อง SSH keys: เลือก Upload public key แล้วใช้ไฟล์ `~/.ssh/id_ed25519.pub` ของเครื่องนี้
   (ถ้ายังไม่มี รัน `ssh-keygen -t ed25519` ใน Terminal ก่อน)
4. กด Create แล้วจด **Public IP address**

## 3. เปิดพอร์ต 80 และ 443
Networking > Virtual Cloud Networks > (VCN ของเครื่อง) > Security Lists > Default Security List > **Add Ingress Rules**
- Source CIDR `0.0.0.0/0`, IP Protocol TCP, Destination Port Range `80,443`

## 4. ส่งแอปขึ้นเซิร์ฟเวอร์ (รันบนเครื่องนี้)
```bash
bash deploy/push.sh ubuntu@<Public IP> --with-data
```
- `--with-data` ย้ายบัญชี โพสต์ แชต และกุญแจเข้ารหัสจากเครื่องนี้ไปด้วย (ใช้ครั้งแรกครั้งเดียว)
- ได้ลิงก์ถาวรแบบ `https://<ip-คั่นด้วยขีด>.sslip.io` พร้อม HTTPS อัตโนมัติ
- ถ้ามีโดเมนของตัวเอง: ชี้ DNS (A record) มาที่ IP แล้วรัน `bash deploy/push.sh ubuntu@<IP> mali.example.com you@example.com`

อัปเดตเวอร์ชันครั้งต่อไป: `bash deploy/push.sh ubuntu@<IP>` (ข้อมูลบนเซิร์ฟเวอร์ไม่ถูกแตะ)

## สิ่งที่ติดตั้งให้อัตโนมัติ
| ส่วน | รายละเอียด |
|---|---|
| HTTPS | Caddy ขอใบรับรอง Let's Encrypt และต่ออายุเอง, http → https, HSTS 1 ปี |
| แยกสิทธิ์ | ผู้ใช้ระบบ `mali` ไม่มีสิทธิ์ root, โค้ดอ่านอย่างเดียว (/opt/mali), ข้อมูล /var/lib/mali, กุญแจ /etc/mali/keys (0600) แยกจากข้อมูล, systemd sandbox |
| เข้ารหัสข้อมูล | ข้อความแชตและไฟล์สื่อเข้ารหัส AES-256-GCM บนดิสก์ ดิสก์ของ Oracle ก็เข้ารหัสอีกชั้นโดยค่าเริ่มต้น |
| ดูแลอัตโนมัติ | รีสตาร์ตเองเมื่อล่ม, ตรวจสุขภาพทุก 1 นาที, สำรองข้อมูลทุกวันเก็บ 14 วัน, อัปเดตแพตช์ความปลอดภัยของ Ubuntu อัตโนมัติ |

## งานผู้ดูแล (SSH เข้าเซิร์ฟเวอร์แล้วรัน)
```bash
# ตั้งตัวเองเป็นผู้ดูแล (ใช้ชื่อผู้ใช้ในมะลิ)
sudo -u mali env $(sudo cat /etc/mali/mali.env | xargs) node /opt/mali/server/admin.js grant <ชื่อผู้ใช้> admin
# ดูเหตุการณ์ความปลอดภัย / ตรวจ audit log / หมุนกุญแจ
sudo -u mali env $(sudo cat /etc/mali/mali.env | xargs) node /opt/mali/server/admin.js events 50
sudo -u mali env $(sudo cat /etc/mali/mali.env | xargs) node /opt/mali/server/admin.js verify-audit
sudo -u mali env $(sudo cat /etc/mali/mali.env | xargs) node /opt/mali/server/admin.js rotate-key && sudo systemctl restart mali
# ดู log
journalctl -u mali -f
```

## แจ้งเตือนเหตุการณ์ร้ายแรงเข้ามือถือ (ไม่บังคับ ฟรี)
สร้าง Webhook ในห้อง Discord ของคุณ แล้วบนเซิร์ฟเวอร์รัน
`echo 'ALERT_WEBHOOK=https://discord.com/api/webhooks/...' | sudo tee /etc/mali/alert.env` และ `bash deploy/push.sh ubuntu@<IP>` อีกครั้ง

## เฝ้าระวังจากภายนอก (ไม่บังคับ ฟรี)
สมัคร UptimeRobot หรือ Better Stack แล้วเพิ่มการตรวจ `https://<โดเมน>/api/health` ทุก 5 นาที จะได้อีเมลเมื่อแอปล่ม

## กัน DDoS ระดับเครือข่าย (แนะนำเมื่อมีโดเมนของตัวเอง)
ย้าย DNS ของโดเมนไปที่ Cloudflare (แผนฟรี) แล้วเปิด Proxy (เมฆสีส้ม) จากนั้นแก้ `/etc/mali/mali.env` เป็น `PROXY=cloudflare`
และจำกัดให้พอร์ต 443 รับเฉพาะ IP ของ Cloudflare — sslip.io ใช้ Cloudflare proxy ไม่ได้

## สำรองกุญแจ
ไฟล์สำรองใน /var/backups/mali **ไม่มีกุญแจ** ให้คัดลอก `/etc/mali/keys/keyring.json` ไปเก็บที่ปลอดภัยแยกต่างหาก (เช่น ตัวจัดการรหัสผ่าน)
ถ้ากุญแจหาย ข้อความแชตและไฟล์สื่อจะกู้คืนไม่ได้
