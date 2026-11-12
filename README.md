# Kartu Member IMPHNEN

Next.js 15 (App Router, TypeScript). UID Facebook dipakai untuk mengambil nama dan tanggal bergabung melalui scraper server. Firestore menyimpan pengaturan kartu.

## Jalankan

```bash
npm install
cp .env.example .env.local
npm run dev
```

Buka http://localhost:3000. Isi `COOKIE` pada `.env.local` dengan cookie sesi Facebook yang berwenang melihat grup. Nilainya hanya dipakai di server untuk route scraper, tidak dikirim ke browser. Facebook dapat mengubah halaman atau mengakhiri sesi cookie.

## Deploy ke Vercel

1. Push project ke GitHub, lalu impor di Vercel.
2. Isi environment variable Firebase dan `COOKIE` dari `.env.example`.
3. Deploy. `vercel.json` menetapkan region function `sin1`.

Untuk data, buat Firestore di `asia-southeast2` (Jakarta). Browser menghubungi Firestore langsung.

## Database member

Pencarian UID mengambil nama dan tanggal bergabung dari halaman Facebook grup. Jika ada dokumen kartu `members/{uid}` di Firestore, pengaturan kartu yang tersimpan ikut dimuat. Tanpa dokumen tersimpan, lengkapi kota, provinsi, dan username lalu simpan.

1. Buat project Firebase, aktifkan Firestore di `asia-southeast2`, tambahkan app Web.
2. Salin config ke variable `NEXT_PUBLIC_FIREBASE_*`.
3. Deploy aturan: `firebase deploy --only firestore:rules`.

Struktur data:

- `members/{uid}`: pengaturan kartu per UID Facebook.
- `memberProfiles/{uid}`: cache nama, status `Member`, dan tanggal bergabung hasil scraper Facebook.
- `usernames/{username huruf kecil}`: klaim username berisi UID pemilik.

Saat UID dicari, aplikasi memeriksa dokumen `members/{uid}` dan `memberProfiles/{uid}` terlebih dahulu. Scraping Facebook hanya dilakukan jika keduanya belum berisi data. Hasil scraping disimpan di `memberProfiles/{uid}` agar pencarian berikutnya membaca database.

Dokumen dapat dicari dengan UID, tetapi pembuatan dan perubahan profil/kartu hanya diizinkan untuk sesi Facebook terverifikasi dengan UID yang sama. Data kartu yang dibaca tetap dapat dilihat siapa pun yang mengetahui UID.

## Privasi dan penghapusan data

- Kebijakan Privasi URL untuk Meta: `https://DOMAIN-PUBLIK/privacy`
- User Data Deletion Instructions URL untuk Meta: `https://DOMAIN-PUBLIK/data-deletion`
- Ganti `DOMAIN-PUBLIK` dengan domain deployment Vercel yang sudah aktif dan dapat dibuka publik melalui HTTPS.
- Halaman penghapusan meminta pengguna login melalui Facebook Login Firebase. Setelah konfirmasi, aplikasi menghapus `members/{uid}`, `memberProfiles/{uid}`, dan klaim username di `usernames/{usernameLower}` dalam satu transaksi.
- UID yang boleh dihapus harus sama dengan ID Facebook terverifikasi dari token Firebase. Ini mencegah pengguna menghapus data UID lain yang hanya mereka ketahui.
- Aktifkan Facebook sebagai sign-in provider di Firebase Console → Authentication → Sign-in method, isi Facebook App ID dan App Secret. Karena aplikasi di-host di Vercel, set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` ke domain situs (misalnya `imphnen-card.rnpproject.com`). Rewrite `/__/auth/*` meneruskan request ke `https://PROJECT_ID.firebaseapp.com/__/auth/*`. Masukkan `https://imphnen-card.rnpproject.com/__/auth/handler` sebagai Valid OAuth Redirect URI di Meta App, dan tambahkan domain situs ke Authorized domains Firebase Authentication.
- Login yang sama diwajibkan untuk menyimpan kartu, mengunduh PNG, dan mint NFT. Firestore Rules juga mengikat penyimpanan profil dan kartu ke Facebook UID pada token login. Profil hasil scraping tetap dapat dilihat sebagai preview, tetapi cache database hanya dapat ditulis oleh akun Facebook yang UID-nya cocok.
- Deploy aturan terbaru dengan `firebase deploy --only firestore:rules`.
- NFT yang sudah mint berada di blockchain BNB Smart Chain dan IPFS, sehingga tidak dapat dihapus oleh aplikasi.

## Kartu 3D

Kartu berputar sekitar 26 derajat per detik. Seret untuk memutar manual. Kode ada di `components/Card3D.tsx`.

## Ikon

Ikon di `app/` dan `public/` dipakai untuk favicon, pratinjau tautan, dan kartu.

## Ekspor PNG

Unduhan depan dan belakang dibuat sebagai PNG 2640 px.

## NFT

Kontrak `IMPHNENMemberCard` adalah ERC-721 gratis tanpa harga mint dan tanpa batas suplai. Mint tidak mengambil BNB sebagai harga; pemilik wallet hanya membayar gas jaringan BSC. Gambar dan JSON disimpan di IPFS lewat Pinata. Metadata NFT tidak menyertakan UID Facebook. `animation_url` berisi viewer HTML 3D di IPFS yang memutar kartu depan dan belakang.

### Persiapan publish

1. Buat API key Pinata dengan izin upload file dan JSON, lalu isi `PINATA_JWT` di environment server Vercel. Jangan gunakan prefix `NEXT_PUBLIC_` untuk secret ini.
2. Siapkan BNB untuk gas deployment kontrak di wallet deployer. Ini biaya satu kali untuk pemilik koleksi; gas mint berikutnya dibayar tiap pengguna.
3. Simpan RPC URL, private key deployer, dan API key BscScan di Hardhat keystore. Perintah akan meminta nilainya; jangan taruh private key di Git atau environment browser.

   ```bash
   npx hardhat keystore set BSC_MAINNET_RPC_URL
   npx hardhat keystore set BSC_TESTNET_RPC_URL
   npx hardhat keystore set BSC_DEPLOYER_PRIVATE_KEY
   npx hardhat keystore set BSCSCAN_API_KEY
   ```

4. Compile dan deploy ke BSC Testnet terlebih dahulu:

   ```bash
   npm run contract:compile
   npm run contract:deploy:testnet
   ```

5. Uji mint dari UI dengan `NEXT_PUBLIC_NFT_CHAIN_ID=97` dan alamat kontrak testnet.
6. Untuk publish koleksi, deploy ke BSC Mainnet:

   ```bash
   npm run contract:deploy:mainnet
   ```

7. Verifikasi kontrak di BscScan dengan alamat hasil deployment:

   ```bash
   npm run contract:verify:mainnet -- 0xALAMAT_KONTRAK
   ```

8. Isi `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` dengan alamat mainnet dan `NEXT_PUBLIC_NFT_CHAIN_ID=56`, isi `PINATA_JWT` serta `NEXT_PUBLIC_SITE_URL` pada environment Vercel, lalu deploy ulang situs.

Minting mengunggah dua PNG, viewer 3D HTML, dan metadata JSON ke IPFS sebelum wallet mengonfirmasi transaksi. Jika wallet menolak transaksi setelah upload, berkas itu tetap terpin di akun Pinata situs. UID sengaja dihilangkan dari NFT; nama, username, kota, provinsi, tanggal bergabung, dan atribut kartu tetap publik di metadata NFT.
