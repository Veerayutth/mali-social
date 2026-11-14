#!/bin/bash
# ส่งโค้ดจากเครื่องนี้ไปเซิร์ฟเวอร์แล้วติดตั้ง/อัปเดต
# ใช้:  bash deploy/push.sh ubuntu@<IP ของเซิร์ฟเวอร์> [โดเมน] [อีเมล]  (ต้องตั้ง SSH key ไว้แล้ว)
#   ครั้งแรกเพิ่ม --with-data เพื่อย้ายบัญชี โพสต์ แชต และกุญแจเข้ารหัสจากเครื่องนี้ไปด้วย
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET="${1:?ใส่ ubuntu@IP}"; shift
DATA=0; ARGS=()
for a in "$@"; do [ "$a" = "--with-data" ] && DATA=1 || ARGS+=("$a"); done
EXC=(--exclude .git --exclude mali-qr.png --exclude .DS_Store)
[ $DATA = 1 ] || EXC+=(--exclude server/data --exclude server/keys)
rsync -az --delete "${EXC[@]}" ./ "$TARGET:/tmp/mali-src/"
ssh "$TARGET" "sudo rm -rf /opt/mali-src && sudo mv /tmp/mali-src /opt/mali-src && sudo bash /opt/mali-src/deploy/setup.sh ${ARGS[*]:-} && sudo rm -rf /opt/mali-src/server/data /opt/mali-src/server/keys"
