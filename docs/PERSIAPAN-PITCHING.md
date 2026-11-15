# Persiapan Pitching — Jadwal.an

Isi file ini:
1. Rundown presentasi (7 menit)
2. Persiapan sebelum merekam
3. Naskah video demo (adegan + voice-over)
4. Cara merekam & mengedit
5. Rencana cadangan demo live
6. Checklist hari-H

Pitch deck: https://claude.ai/artifact/2iVszF8d9GEMDuGKK6cFWu. Naskah bicara tiap slide ada di **speaker notes**. Deck bisa diunduh sebagai PPTX/PDF dari menu Share › Export.

---

## 1. Rundown presentasi

| Menit | Slide | Pembicara | Isi |
|---|---|---|---|
| 0:00–0:20 | 1 Cover | [A] | Perkenalan tim + hook chat typo |
| 0:20–0:50 | 2 Masalah | [A] | 3 masalah rental PS |
| 0:50–1:20 | 3 Solusi | [A] | 3 pilar Jadwal.an |
| 1:20–4:20 | 4 Demo | [B] | **Putar video demo** |
| 4:20–5:05 | 5 Arsitektur | [C] | Alur multi-agent |
| 5:05–5:45 | 6 Keunggulan | [C] | 4 pembeda AI |
| 5:45–6:20 | 7 AI untuk owner | [B] | Insight, tier, promo AI |
| 6:20–6:50 | 8 Dampak | [A] | 24/7 · 1 chat · 0 double booking · 5 model |
| 6:50–7:25 | 9 Model bisnis | [A] | SaaS + pasar berikutnya |
| 7:25–7:55 | 10–11 Teknologi & rencana | [C] | Singkat saja |
| 7:55–8:05 | 12 Penutup | [A] | Tagline + buka sesi tanya jawab |

> Jika waktu pitching hanya 5 menit: lewati slide 10 (Teknologi), ringkas slide 5–6 jadi 40 detik, dan potong video ke versi 2 menit.

---

## 2. Persiapan sebelum merekam

**Data & sistem**
- [ ] `npm run seed:demo` di folder `backend` supaya dashboard ramai dengan data demo
- [ ] Backend, dashboard (5173), dan client (5174) jalan
- [ ] WhatsApp terhubung (Dashboard → Pengaturan → WhatsApp, statusnya **Terhubung**)
- [ ] Cek `/api/health`: `database: ok`, `ai: configured`, `midtrans: configured`
- [ ] Coba satu kali chat ke WA bot untuk "memanaskan" AI sebelum merekam

**Akun & perangkat**
- [ ] HP **pelanggan** dengan nomor yang **belum pernah** chat ke bot, supaya pesan sambutan akun baru muncul. Kalau nomornya sudah terdaftar, hapus dulu pelanggan itu di dashboard.
- [ ] HP **bot** (nomor rental) tetap tersambung
- [ ] Browser: tab dashboard sudah login admin, tab simulator Midtrans terbuka

**Pembayaran (sandbox Midtrans)**
- Buka https://simulator.sandbox.midtrans.com → menu **QRIS**
- Tempel **URL gambar QR** (klik kanan gambar QR di halaman bayar web → *Copy image address*), lalu klik **Pay**
- Booking otomatis jadi *Terkonfirmasi* lewat webhook. Pastikan URL webhook Midtrans sudah diarahkan ke backend (bisa pakai ngrok saat lokal: `ngrok http 4000`, lalu isi `https://xxxx.ngrok-free.app/api/payments/midtrans/webhook` di dashboard Midtrans sandbox → Settings → Payment → Notification URL).
- Tanpa webhook: buka halaman bayar booking itu di web client (`/bayar/<id booking>`). Halaman itu mengecek status ke Midtrans tiap 4 detik dan menandai lunas begitu terbayar, lalu WA "Booking terkonfirmasi" ikut terkirim. Cara terakhir: konfirmasi pembayaran manual dari dashboard.

**Kebersihan layar**
- [ ] Tutup file `.env`, terminal yang menampilkan key, dan notifikasi pribadi
- [ ] Aktifkan mode *Do Not Disturb* di HP dan laptop
- [ ] Zoom browser 110–125% supaya teks terbaca di video

**Pilih jam booking yang kosong.** Slot malam hari dan akhir pekan sudah banyak terisi data demo. Untuk adegan utama, pakai **besok jam 13 atau 14** di hari kerja.

---

## 3. Naskah video demo (±3 menit)

Format: **[LAYAR]** apa yang terlihat · **VO** voice-over yang dibacakan.

### Adegan 1: Pembuka (0:00–0:12)
**[LAYAR]** Judul "Jadwal.an — Admin AI untuk Rental PlayStation", lalu potongan cepat dashboard.
**VO:** "Ini Jadwal.an. Kita lihat bagaimana seorang pelanggan booking rental PS hanya lewat WhatsApp, tanpa admin manusia."

### Adegan 2: Pelanggan baru chat (0:12–0:35)
**[LAYAR]** HP pelanggan. Ketik: `halo`
Bot membalas sapaan **plus pesan akun baru** (nomor WA + password untuk login web).
**VO:** "Pelanggan baru menyapa. Sistem langsung membuatkan akun dan mengirim info login website, jadi pelanggan tidak perlu daftar manual."

### Adegan 3: Chat typo (0:35–1:05)
**[LAYAR]** Ketik: `bsk bkg ps5 jm 1 siang 2j`
AI membalas ringkasan: unit, tanggal, jam, total, dan pertanyaan **"QRIS atau cash?"**
**VO:** "Pelanggan mengetik singkat dan typo: besok, booking, PS5, jam satu siang, dua jam. AI tetap paham, mengecek slot yang kosong, menghitung harga, lalu meminta konfirmasi metode bayar."

> Kalau AI menjawab slot penuh, biarkan saja. Itu bagus untuk diperlihatkan: "AI juga menawarkan jam alternatif."

### Adegan 4: Pilih QRIS → gambar QR (1:05–1:30)
**[LAYAR]** Ketik: `qr`
AI membalas booking berhasil, lalu **gambar QRIS** masuk dengan caption kode booking, total, dan batas waktu.
**VO:** "Cukup ketik 'qr'. Booking dibuat dan gambar QRIS langsung terkirim di chat, lengkap dengan total dan batas waktu bayar."

### Adegan 5: Bayar → otomatis lunas (1:30–1:55)
**[LAYAR]** Simulator Midtrans → Pay. Kembali ke HP: pesan **"Booking terkonfirmasi!"** masuk.
**VO:** "Pelanggan membayar dengan e-wallet apa pun. Begitu pembayaran masuk, booking otomatis terkonfirmasi dan pelanggan mendapat notifikasi."

### Adegan 6: Dashboard admin (1:55–2:30)
**[LAYAR]** Dashboard → **Kalender**: booking baru muncul. → **Live Chat**: percakapan tadi lengkap dengan kartu QRIS berstatus "Lunas". Tunjukkan tombol **Ambil alih** chat.
**VO:** "Di sisi admin, booking tadi langsung masuk kalender. Seluruh percakapan tercatat di live chat, dan admin bisa mengambil alih dari AI kapan saja."

### Adegan 7: AI untuk bisnis (2:30–2:55)
**[LAYAR]** Dashboard utama (grafik + **Insight AI**) → halaman **Pelanggan** (tier VIP/loyal) → **Promo**: klik buat pesan AI, lalu kirim.
**VO:** "Untuk owner, AI merangkum performa harian dan memberi rekomendasi, mengelompokkan pelanggan berdasarkan loyalitas, dan menulis promo personal yang bisa dikirim massal lewat WhatsApp."

### Adegan 8: Penutup (2:55–3:05)
**[LAYAR]** Logo + tagline.
**VO:** "Jadwal.an: biar admin AI yang menjaga chat 24 jam, owner fokus mengembangkan bisnis."

**Opsional (+15 detik): adegan "melatih AI"**
Dashboard → AI → Basis Pengetahuan → tambah kategori **kamus**: `mabar, mabarr` → `main bareng`. Lalu chat "mau mabarr bsk" dan AI paham.

---

## 4. Cara merekam & mengedit

| Kebutuhan | Alat |
|---|---|
| Rekam layar laptop | OBS Studio (gratis) atau Xbox Game Bar (`Win + G`) |
| Rekam layar HP | Perekam layar bawaan Android/iOS |
| Tampilkan HP di laptop (opsional) | scrcpy (Android) / AirPlay (iPhone) agar bisa direkam satu layar |
| Edit & gabung | CapCut Desktop |
| Voice-over | Rekam terpisah dengan mic HP di ruangan sepi |

**Tips edit**
- Rekam tiap adegan **terpisah**, dan ulangi adegan yang gagal tanpa mengulang semuanya.
- Saat menunggu balasan AI: **percepat 2–3x** atau potong, dan beri teks kecil "AI membalas ±5 detik". Jangan sembunyikan bahwa itu dipercepat.
- Tambahkan **teks keterangan** di tiap adegan ("Chat typo dipahami AI", "QRIS terkirim otomatis").
- Zoom-in (Ken Burns) ke bagian penting: gambar QR, kartu "Lunas", kalender.
- Musik latar pelan (dari library CapCut). VO harus tetap jelas.
- Ekspor 1080p, durasi **≤ 3 menit**. Simpan juga salinannya di laptop **dan** flashdisk/Google Drive.

---

## 5. Rencana cadangan demo live

Urutan prioritas saat presentasi:
1. **Putar video** (paling aman).
2. Jika juri minta live: jalankan adegan 3–4 di WA (chat typo → QRIS), lalu tunjukkan dashboard.
3. Jika AI lambat atau internet bermasalah: "Karena koneksi, kita lanjutkan dengan rekaman," lalu kembali ke video.

Siapkan **hotspot HP cadangan**, dan buka semua tab sebelum naik panggung.

---

## 6. Checklist hari-H

- [ ] Video demo (laptop + flashdisk + Drive)
- [ ] Deck terbuka (mode Present) + PDF cadangan
- [ ] Backend, dashboard, client jalan; WA terhubung
- [ ] Data demo segar (`npm run seed:demo`)
- [ ] Charger laptop, HP terisi penuh, hotspot cadangan
- [ ] Pembagian pembicara sudah latihan minimal **2 kali** dengan timer
- [ ] Jawaban Q&A dihafal (lihat speaker notes slide terakhir)
- [ ] Isi placeholder di deck: [Nama tim], [Nama anggota], [Rp__], [Link demo]
