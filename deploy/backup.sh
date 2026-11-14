#!/bin/bash
# สำรองข้อมูลทุกวัน เก็บย้อนหลัง 14 วัน
# ฐานข้อมูลสำรองแบบปลอดภัยขณะเซิร์ฟเวอร์ทำงาน (VACUUM INTO) ไฟล์สื่อสำรองตามที่เข้ารหัสไว้
# หมายเหตุ: ไฟล์สำรองไม่มีกุญแจ ถ้าจะกู้คืนต้องมี /etc/mali/keys/keyring.json ด้วย ให้เก็บกุญแจไว้คนละที่กับไฟล์สำรอง
set -euo pipefail
D=/var/backups/mali; TS=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$D"
sqlite3 /var/lib/mali/mali.db "VACUUM INTO '$D/mali-$TS.db'"
tar -C /var/lib/mali -czf "$D/media-$TS.tgz" media
chmod 600 "$D"/*-"$TS".*
find "$D" -type f -mtime +14 -delete
echo "สำรองแล้ว $TS"
