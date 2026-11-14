#!/bin/bash
# ติดตั้งมะลิบนเซิร์ฟเวอร์ Ubuntu 22.04/24.04 (เช่น Oracle Cloud Always Free) ให้ทำงาน 24 ชม.
# รันบนเซิร์ฟเวอร์ด้วย:  sudo bash /opt/mali-src/deploy/setup.sh [โดเมน] [อีเมลผู้ดูแล]
#   ถ้าไม่ใส่โดเมน จะใช้ <IP>.sslip.io (ชื่อโดเมนฟรีที่ชี้มาที่ IP นี้) และขอใบรับรอง HTTPS อัตโนมัติ
# ทำซ้ำได้ (idempotent) ใช้ตอนอัปเดตเวอร์ชันด้วย
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "ต้องรันด้วย sudo"; exit 1; }
SRC="$(cd "$(dirname "$0")/.." && pwd)"
IP=$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
DOMAIN="${1:-${IP//./-}.sslip.io}"
EMAIL="${2:-}"
echo "==> ติดตั้งมะลิที่ https://$DOMAIN"

# 1) แพ็กเกจ: Node.js 22, Caddy (เว็บเซิร์ฟเวอร์ที่ทำ HTTPS อัตโนมัติ), sqlite3, unattended-upgrades
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https sqlite3 unattended-upgrades rsync
if ! node -v 2>/dev/null | grep -qE '^v(2[2-9]|[3-9][0-9])'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi
dpkg-reconfigure -f noninteractive unattended-upgrades || true   # อัปเดตแพตช์ความปลอดภัยของระบบอัตโนมัติ

# 2) ผู้ใช้และโฟลเดอร์ แยกโค้ด / ข้อมูล / กุญแจ (least privilege)
id mali >/dev/null 2>&1 || useradd --system --home /var/lib/mali --shell /usr/sbin/nologin mali
install -d -o root -g root -m 755 /opt/mali
install -d -o mali -g mali -m 700 /var/lib/mali /var/lib/mali/media /var/backups/mali
install -d -o mali -g mali -m 700 /etc/mali/keys
rsync -a --delete --exclude '.git' --exclude 'server/data' --exclude 'server/keys' --exclude 'mali-qr.png' "$SRC/" /opt/mali/
chown -R root:root /opt/mali && chmod -R go-w /opt/mali
# ย้ายข้อมูลและกุญแจเดิม (ถ้าส่งมาด้วย push.sh) — ทำครั้งแรกครั้งเดียว
if [ -d "$SRC/server/data" ] && [ ! -f /var/lib/mali/mali.db ]; then rsync -a "$SRC/server/data/" /var/lib/mali/; chown -R mali:mali /var/lib/mali; fi
if [ -f "$SRC/server/keys/keyring.json" ] && [ ! -f /etc/mali/keys/keyring.json ]; then install -o mali -g mali -m 600 "$SRC/server/keys/keyring.json" /etc/mali/keys/keyring.json; fi

# 3) ค่าตั้งของบริการ
cat > /etc/mali/mali.env <<ENV
NODE_ENV=production
HOST=127.0.0.1
PORT=8787
PROXY=caddy
HTTPS=1
MALI_DATA=/var/lib/mali
MALI_KEYS=/etc/mali/keys
PUBLIC_URL=https://$DOMAIN
SECURITY_CONTACT=${EMAIL:+mailto:$EMAIL}
ENV
if [ -f /etc/mali/alert.env ]; then cat /etc/mali/alert.env >> /etc/mali/mali.env; fi   # ALERT_WEBHOOK=https://... (ไม่บังคับ)
chmod 640 /etc/mali/mali.env && chown root:mali /etc/mali/mali.env

install -m 644 /opt/mali/deploy/mali.service /etc/systemd/system/mali.service
install -m 644 /opt/mali/deploy/mali-backup.service /etc/systemd/system/mali-backup.service
install -m 644 /opt/mali/deploy/mali-backup.timer /etc/systemd/system/mali-backup.timer
install -m 644 /opt/mali/deploy/mali-health.service /etc/systemd/system/mali-health.service
install -m 644 /opt/mali/deploy/mali-health.timer /etc/systemd/system/mali-health.timer

# 4) Caddy: HTTPS อัตโนมัติ (Let's Encrypt), เปลี่ยน http เป็น https, ลบเฮดเดอร์ IP ปลอมจากภายนอก
sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__EMAIL__/${EMAIL:-}/g" /opt/mali/deploy/Caddyfile > /etc/caddy/Caddyfile
[ -n "$EMAIL" ] || sed -i '/^\s*email\s*$/d' /etc/caddy/Caddyfile

# 5) ไฟร์วอลล์ของเครื่อง: Oracle Ubuntu ปิดพอร์ตไว้ด้วย iptables ต้องเปิด 80/443
if command -v iptables >/dev/null; then
  for p in 80 443; do iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport $p -j ACCEPT; done
  command -v netfilter-persistent >/dev/null && netfilter-persistent save || true
fi

# สร้างกุญแจเข้ารหัสครั้งแรก (บริการจริงมองโฟลเดอร์กุญแจแบบอ่านอย่างเดียว)
sudo -u mali MALI_KEYS=/etc/mali/keys node -e "require('/opt/mali/server/kms')" && chmod 600 /etc/mali/keys/keyring.json
systemctl daemon-reload
systemctl enable --now mali mali-backup.timer mali-health.timer
systemctl restart mali
systemctl reload caddy || systemctl restart caddy
sleep 3
# เข้ารหัสข้อมูลเดิมที่ยังไม่เข้ารหัส (ถ้ามี)
sudo -u mali env $(grep -v '^#' /etc/mali/mali.env | xargs) node --no-warnings /opt/mali/server/admin.js encrypt-existing || true
curl -fsS http://127.0.0.1:8787/api/health && echo
echo ""
echo "เสร็จแล้ว เปิดมะลิได้ที่: https://$DOMAIN"
echo "ถ้ายังเข้าไม่ได้ ตรวจว่าเปิดพอร์ต 80 และ 443 ใน Security List ของ Oracle Cloud แล้ว (ดู deploy/README.md)"
