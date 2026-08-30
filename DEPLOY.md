# Deploy — Guess Music

Deploy ลง VPS Ubuntu ที่มี Node + PM2 + Nginx + Certbot อยู่แล้ว โครงเดียวกับ wavelength

> ไฟล์นี้ไม่มี credential ใด ๆ host / user / รหัสผ่าน / token อยู่ในโน้ตส่วนตัวนอก repo
> **ห้ามเอา credential มาใส่ไฟล์นี้**

---

## ทำไม Vercel ใช้ไม่ได้

Socket.io ต้องมี process ที่อยู่ยาว serverless ไม่มีให้ ต้องเป็น VPS / Railway / Fly.io / Render
ดู [ADR 0002](docs/adr/0002-nextjs-with-a-custom-server.md)

---

## 4 อย่างที่ต่างจาก deploy Next ปกติ

| เรื่อง | ปกติ | Guess Music |
|---|---|---|
| Install | `npm install --production` | **`npm ci`** เต็ม — `next build` ต้องใช้ typescript + tailwind ที่อยู่ใน devDependencies |
| Start | `next start` | `tsx server.ts` (custom server) |
| PM2 | cluster ได้ | **fork 1 instance เท่านั้น** — ห้องอยู่ใน memory ([ADR 0004](docs/adr/0004-rooms-live-in-process-memory.md)) |
| Nginx | proxy ธรรมดา | ต้องมี WebSocket upgrade + read timeout ยาว |

`tsx` อยู่ใน `dependencies` (ไม่ใช่ dev) เพราะ production รันจริงผ่านมัน

---

## สภาพเครื่องปลายทาง (เช็กเมื่อ 2026-08-30)

| อะไร | ค่า |
|---|---|
| OS | Ubuntu 24.04 |
| Node | v20.20.2 ผ่าน **nvm** (ไม่มี node ใน `/usr/bin`) |
| PM2 / Nginx | 7.0.3 / 1.24.0 |
| PM2 apps ที่รันอยู่ | `newportfolio` (:3000), `nptsx-backend` (:3001), `wavelength` (:3002), `editshare-frontend` (:3003), `editshare-backend` (:8080) |
| **Guess Music ใช้** | **:3004** |
| `/var/www` | เจ้าของคือ user `tide` — clone ได้โดยไม่ต้อง sudo |
| sudo | **ต้องใส่รหัสผ่าน** (ไม่ใช่ NOPASSWD) |

### ⚠️ IPv6 บนเครื่องนี้เสีย — ต้องบังคับ IPv4 ทุกครั้งที่ npm

`npm ci` จะพังด้วย `ETIMEDOUT` แล้วจบด้วย `Exit handler never called!`
ตั้ง env นี้ก่อน npm ทุกครั้ง:

```bash
export NODE_OPTIONS=--dns-result-order=ipv4first
```

---

## ต้องมีก่อน

- DNS `guess-music.madebytide.xyz` ชี้มาที่ IP ของเครื่องนี้
- ถ้าใช้ Cloudflare: ปิด proxy เป็น **DNS only** ก่อนออก cert แล้วค่อยเปิดใหม่ และตั้ง SSL mode เป็น **Full (strict)**

---

## Deploy ครั้งแรก

### 1. Clone

```bash
cd /var/www && git clone <repo-url> guess-music
```

### 2. Install + build

```bash
cd /var/www/guess-music && export NODE_OPTIONS=--dns-result-order=ipv4first && npm ci && npm run build
```

`next build` ต้องต่อเน็ตได้ เพราะ `next/font/google` โหลดฟอนต์ IBM Plex มาฝังตอน build

### 3. ทดสอบก่อนต่อ PM2

```bash
cd /var/www/guess-music && NODE_ENV=production PORT=3004 HOST=127.0.0.1 npx tsx server.ts
```

อีกหน้าต่างหนึ่ง: `curl http://127.0.0.1:3004/healthz` ต้องได้ `{"ok":true,...}` แล้วค่อย Ctrl-C

### 4. PM2

```bash
cd /var/www/guess-music && pm2 start ecosystem.config.cjs && pm2 save
```

### 5. Nginx

```bash
sudo cp /var/www/guess-music/deploy/nginx/guess-music.conf /etc/nginx/sites-available/guess-music
```

```bash
sudo ln -s /etc/nginx/sites-available/guess-music /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
```

### 6. SSL

```bash
sudo certbot --nginx -d guess-music.madebytide.xyz
```

---

## เช็กว่าขึ้นจริง

```bash
curl -s https://guess-music.madebytide.xyz/healthz && pm2 status guess-music
```

แล้วเปิดเว็บสองแท็บ สร้างห้องจากแท็บหนึ่ง เอารหัสไปเข้าอีกแท็บ ถ้าทั้งสองเห็นกันแปลว่า WebSocket ผ่าน Nginx แล้ว

---

## Update โค้ดใหม่

```bash
cd /var/www/guess-music && export NODE_OPTIONS=--dns-result-order=ipv4first && git pull && npm ci && npm run build && pm2 restart guess-music
```

**restart จะทำให้ห้องที่กำลังเล่นอยู่หายทั้งหมด** — ถ้ามีคนเล่นอยู่ให้รอ

---

## ปัญหาที่น่าจะเจอ

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| `npm ci` ค้างแล้วจบด้วย `Exit handler never called!` | IPv6 เสีย ไม่ใช่ npm bug | `export NODE_OPTIONS=--dns-result-order=ipv4first` |
| `node: command not found` ตอน ssh สั่งคำสั่งเดียว | node อยู่ใน nvm ไม่อยู่ใน PATH ของ non-interactive shell | `. ~/.nvm/nvm.sh` ก่อน |
| `next: not found` / `tsx: not found` | ลงด้วย `--production` | `rm -rf node_modules && npm ci` |
| build fail ที่ `next/font/google` | เครื่อง build ต่อเน็ตไม่ได้ | ต้องมีเน็ตตอน build ฟอนต์ถูกฝังลง bundle |
| 502 Bad Gateway | process ตาย | `pm2 logs guess-music --lines 50` |
| หน้าเว็บขึ้นแต่มุมขวาบนเป็นจุดแดงค้าง | WebSocket ไม่ผ่าน Nginx | เช็ก `Upgrade` / `Connection` header ใน config |
| เข้าห้องแล้วเด้งออกเรื่อย ๆ | รันหลาย instance ห้องอยู่คนละ process | `pm2 status` ต้องเห็น instance เดียว, `exec_mode: fork` |
| ผู้เล่นหลุดทุก 1 นาที | `proxy_read_timeout` สั้นไป | ต้องเป็น `3600s` |
| `nginx -t` ฟ้อง duplicate map | มี site อื่นประกาศ map ชื่อซ้ำ | เปลี่ยนชื่อ `$guess_music_connection_upgrade` |
| กดเริ่มเกมแล้วขึ้น "หาเพลงไม่ได้" | ต่อ iTunes ไม่ได้ หรือโดน rate limit | `curl -s "https://itunes.apple.com/search?term=test&limit=1"` ต้องได้ 200 |
| เสียงไม่ดังบน iPhone | ไม่ได้กด "แตะเพื่อเปิดเสียง" | ปุ่มอยู่ในหน้า lobby ต้องกดหนึ่งครั้งต่อการเข้าเว็บ |

---

## Rollback

```bash
cd /var/www/guess-music && git log --oneline -5
```

```bash
cd /var/www/guess-music && git checkout <commit> && npm ci && npm run build && pm2 restart guess-music
```

---

## ยังไม่ได้ทำ

- ไม่มี DB ห้องหายเมื่อ restart ([ADR 0004](docs/adr/0004-rooms-live-in-process-memory.md))
- ไม่มี leaderboard ข้ามห้อง
- ยังมี Game Mode เดียว (Quiz) โครงรองรับ Heardle ไว้แล้วที่ `src/shared/modes/`
