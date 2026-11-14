#!/bin/bash
# เปิดเซิร์ฟเวอร์มะลิพร้อมลิงก์ HTTPS สาธารณะฟรี (Cloudflare Quick Tunnel ไม่ต้องสมัครบัญชี)
# ใช้:  bash server/public.sh      หยุด: กด Ctrl+C
# ต้องมี Node.js 22.5+ และ cloudflared (brew install cloudflared)
# ลิงก์ trycloudflare.com จะเปลี่ยนทุกครั้งที่รันใหม่
cd "$(dirname "$0")/.."
command -v cloudflared >/dev/null || { echo "ยังไม่มี cloudflared: รัน  brew install cloudflared"; exit 1; }
PORT=${PORT:-8787}
node --no-warnings server/server.js & SERVER=$!
trap 'kill $SERVER $TUNNEL 2>/dev/null' EXIT INT TERM
sleep 1
LOG=$(mktemp)
cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" >"$LOG" 2>&1 & TUNNEL=$!
for i in $(seq 1 30); do URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1); [ -n "$URL" ] && break; sleep 1; done
if [ -z "$URL" ]; then echo "เปิดอุโมงค์ไม่สำเร็จ ดูรายละเอียดที่ $LOG"; exit 1; fi
echo ""
echo "  ลิงก์สาธารณะ (HTTPS): $URL"
echo "  ส่งลิงก์นี้ให้เพื่อนเปิดได้จากทุกที่ ใช้ได้ตราบที่หน้าต่างนี้ยังเปิดอยู่"
echo ""
wait $SERVER
