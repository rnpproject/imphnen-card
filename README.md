# Kartu Member IMPHNEN

Aplikasi Next.js mandiri untuk mencari data anggota grup Facebook dengan UID, membuat kartu member, menyimpan kartu ke Firestore, dan mengunduh kartu depan atau belakang sebagai PNG. Halaman kartu publik tersedia di `/username/{username}`.

## Menjalankan aplikasi

```bash
npm install
cp .env.example .env
npm run dev
```

Buka `http://localhost:3000`. Untuk production, jalankan `npm run build` lalu `npm run start`.

## Konfigurasi environment

Isi environment server berikut. Jangan commit `.env`, private key, token bot, atau cookie Facebook.

| Variabel | Kegunaan |
| --- | --- |
| `FIREBASE_PROJECT_ID` | ID project Firebase yang menyimpan Firestore. |
| `FIREBASE_SERVICE_ACCOUNT_EMAIL` | Email service account untuk akses Firestore dari server. |
| `FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY` | Private key service account; newline dapat ditulis sebagai `\n`. Beri service account izin Firestore yang diperlukan, misalnya role `Cloud Datastore User`. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key widget Cloudflare Turnstile di form pencarian. |
| `TURNSTILE_SECRET_KEY` | Secret key server untuk memvalidasi Turnstile. Juga dipakai menandatangani bukti pencarian sementara. |
| `NEXT_PUBLIC_SITE_URL` | URL situs, misalnya `https://kartu.example.com` atau `localhost:3000`. |
| `COOKIE` | Sesi Facebook utama untuk membaca profil/keanggotaan grup. |
| `COOKIE1` | Sesi Facebook cadangan. Dicoba jika `COOKIE` gagal. |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram dari `@BotFather`. |
| `TELEGRAM_OWNER_CHAT_ID` | Chat ID owner yang akan menerima notifikasi scraper. Mulai chat dengan bot terlebih dahulu. |

Untuk Turnstile, buat widget Cloudflare dan daftarkan hostname yang digunakan, termasuk `localhost` untuk pengembangan lokal. Cookie Facebook harus berasal dari akun yang berwenang melihat grup IMPHNEN. Jika kedua cookie kosong atau gagal, pencarian scraper gagal dan owner menerima satu pesan berisi detail tiap percobaan. Setelah scraping berhasil, owner menerima UID, nama, status grup, tanggal bergabung, dan sesi yang berhasil.

## Alur pencarian dan penyimpanan

1. Pengguna mengisi UID profil Facebook dan menyelesaikan Turnstile.
2. Server memeriksa `members/{uid}` di Firestore terlebih dahulu. Jika data yang tersimpan cocok dengan sertifikat, data tersebut dikembalikan.
3. Jika kartu belum tersedia atau tidak lolos validasi, server mencoba scraping Facebook menggunakan `COOKIE`, lalu `COOKIE1` sebagai cadangan.
4. Hasil scraping memuat nama, status grup seperti Member/Admin, dan tanggal bergabung. Bukti hasil pencarian ditandatangani server dan berlaku 15 menit.
5. Sebelum menyimpan, server mencocokkan nama dan username dengan sertifikat di `https://imphnen.dev/sertifikat/{username}`. Pencarian UID dan bukti Turnstile harus masih berlaku.
6. Kartu disimpan secara transaksional. UID hanya dapat memiliki satu kartu dan username sertifikat tidak dapat diklaim kartu lain.

Username yang belum memiliki sertifikat harus didaftarkan terlebih dahulu di [imphnen.dev](https://imphnen.dev/gabung). Nama dan username pada kartu tersimpan mengikuti sertifikat resmi. Tanggal bergabung berasal dari data profil yang ditemukan melalui UID.

## Kartu dan unduhan

Pengguna dapat mengunduh kartu depan atau belakang sebagai PNG tanpa login. Unduhan memeriksa kecocokan nama serta username dengan sertifikat, tanpa challenge Turnstile tambahan. Turnstile hanya dipakai pada form pencarian UID. Status kartu menambahkan `Verified` pada role, misalnya `Member Verified` atau `Admin Verified`.

Kartu yang sudah disimpan dapat dilihat melalui `/username/{username}`. Halaman tersebut dapat dibagikan secara publik dan mengambil data dari Firestore.

## Firestore

- `members/{uid}` menyimpan kartu berdasarkan UID profil Facebook.
- `memberOwners/{uid}` mencatat username sertifikat yang terkait dengan UID.
- `usernames/{username}` mencegah username sertifikat dipakai oleh UID lain.
- `firestore.rules` menolak seluruh akses langsung dari browser. API server menggunakan service account dan tidak bergantung pada Firebase Authentication.

Deploy rules dengan Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

## Pemeriksaan kode

```bash
npm run typecheck
```
