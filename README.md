# Web Dashboard Live Scoring Perbakin 🎯

Dashboard Web Statis Live Scoring untuk kejuaraan menembak **Persatuan Menembak Indonesia (PERBAKIN)** nomor tanding **Air Pistol & Air Rifle** (ISSF 10M). Sistem ini menarik data klasemen secara langsung (*real-time*) dari Google Sheets tanpa memerlukan server backend atau otentikasi login.

---

## 🌟 Fitur Utama

1. **Sinkronisasi Real-Time (Auto-Refresh Polling)**:
   - Memperbarui data dari Google Sheets secara transparan di latar belakang (*soft-refresh*) setiap 15–30 detik (default: 20 detik, dapat diatur).
   - Tanpa *screen flicker* dan tanpa lonjakan posisi gulir (*no scroll jumping*).
   - Bilah progres hitung mundur (*countdown progress bar*) visual di bagian atas layar.

2. **Logika Klasemen & Tie-Breaker Resmi**:
   - **Prioritas 1 (Skor Total)**: Diurutkan otomatis dari nilai tertinggi ke terendah.
   - **Prioritas 2 (Total X / Inner 10)**: Jika Skor Total sama/seri, posisi lebih tinggi diberikan kepada atlet dengan jumlah Inner 10 (X) terbanyak (ditandai dengan badge khusus `X-Lead`).
   - Penandaan podium medali resmi: **Emas (Rank 1)**, **Perak (Rank 2)**, dan **Perunggu (Rank 3)**.

3. **Multi-Tab Dinamis**:
   - Membaca dan merender tombol navigasi kelas (*Air Pistol*, *Air Rifle*, dll.) secara dinamis.
   - Admin dapat menambah atau mengubah nama tab kelas langsung melalui panel **Konfigurasi**.

4. **Desain Visual Ramah Luar Ruangan (Outdoor-Friendly)**:
   - Tema *Light-mode* putih bersih dengan kontras sangat tinggi (sesuai standar WCAG AAA) agar teks dan angka skor tetap terbaca tajam dan tidak silau di bawah terik matahari lapangan tembak terbuka.
   - Aksen resmi Perbakin: *Navy Blue* (`#0B1F3A`), *Royal Blue* (`#1E3A8A`), dan *Gold Yellow* (`#F59E0B`).
   - Dilengkapi aset logo vektor resmi Perbakin beresolusi tinggi (`assets/perbakin-logo.svg`).

5. **Filter Cepat & Mode Tampilan**:
   - **Pencarian Instan**: Cari berdasarkan nama atlet atau kontingen/daerah.
   - **Filter Chip Kategori**: *Semua*, *Senior*, atau *Junior*.
   - **Filter Chip Gender**: *Semua*, *Putra*, atau *Putri*.
   - **Toggle Tampilan**: Mode Tabel Lengkap (Desktop/Tablet) dan Mode Kartu Padat (*Dense Mobile View*) untuk layar ponsel atlet dan penonton.
   - **Mode Layar Penuh / TV Venue**: Mengaktifkan mode fullscreen proyektor/TV untuk papan informasi di lapangan tembak.

---

## 🚀 Cara Menjalankan

### Cara 1: Buka Langsung di Peramban Web (Paling Praktis)
Cukup buka berkas `index.html` langsung di browser Anda (Google Chrome, Safari, Edge, Firefox):
```bash
open index.html
```

### Cara 2: Menggunakan HTTP Server Lokal
Jika ingin menjalankan lewat server lokal:
```bash
# Menggunakan Python
python3 -m http.server 8080

# Lalu buka di browser:
# http://localhost:8080
```

### Cara 3: Menggunakan Docker / Docker Compose
Jika ingin di-deploy ke server atau container:
```bash
docker compose up -d

# Akses via browser:
# http://localhost:8080
```

---

## ⚙️ Konfigurasi Google Sheets

Secara default, dashboard telah terhubung ke spreadsheet template:
* **Spreadsheet ID**: `1vnby6effCDoFOzVA5PpZROz8MNY23o0_K7Skcbh8Li0`
* **Tab Default**: `Air Pistol`, `Air Rifle`

### Mengganti Spreadsheet ID Sendiri:
1. **Lewat Kode JavaScript**:
   Buka berkas `js/app.js`, ubah konstanta di baris paling atas:
   ```javascript
   const SPREADSHEET_ID = 'ID_SPREADSHEET_BARU_ANDA';
   ```
2. **Lewat Antarmuka (Tanpa Edit Kode)**:
   - Klik tombol **Konfigurasi** (ikon roda gigi) di pojok kanan atas dashboard.
   - Masukkan *Spreadsheet ID* baru Anda.
   - Masukkan daftar nama tab kelas yang dipisahkan tanda koma (contoh: `Air Pistol, Air Rifle, 25M Benchrest`).
   - Atur durasi interval refresh (10s – 60s).
   - Klik **Simpan & Terapkan** (pengaturan disimpan otomatis di *localStorage* browser).

> **PENTING**: Pastikan setelan berbagi (*sharing permission*) di Google Sheets Anda telah diatur ke **"Anyone with the link can view"** (*Siapa saja yang memiliki link dapat melihat*) agar dashboard dapat menarik data tanpa memerlukan login akun.

---

## 📊 Struktur Kolom Google Sheets

Setiap tab sheet pertandingan harus memiliki 8 kolom standar berikut di baris pertama (*header*):

| No | Nama Kolom | Contoh Nilai | Keterangan |
| :---: | :--- | :--- | :--- |
| A | `ID` | `PBK-001` | ID unik atlet / nomor registrasi |
| B | `Waktu Input` | `2025-05-18 09:30:00` | Waktu pencatatan skor |
| C | `Kategori` | `Senior` / `Junior` | Kategori usia atlet |
| D | `Jenis Kelamin` | `Putra` / `Putri` | Gender atlet |
| E | `Nama Peserta` | `Edy Santoso` | Nama lengkap atlet |
| F | `Kontingen/Daerah` | `DKI Jakarta` | Asal Pengprov / Pengcab / Klub |
| G | `Skor Total` | `558` | Akumulasi total skor tembakan |
| H | `Total X (Inner 10)` | `12` | Jumlah tembakan mengenai titik tengah X (Inner 10) |

---

## 📁 Struktur Berkas

```text
scoring-perbakin/
├── assets/
│   ├── perbakin-logo.svg        # Vektor logo resmi Perbakin (tajam & transparan)
│   └── perbakin-logo-1.png      # Logo raster resolusi tinggi (1242x1750 px)
├── css/
│   └── styles.css               # Gaya CSS kustom, outdoor high-contrast, animasi
├── js/
│   └── app.js                   # Logika pengambilan data, tie-breaker, filter, polling
├── Dockerfile                   # Konfigurasi container Nginx Alpine
├── docker-compose.yml           # Konfigurasi orkestrasi Docker
├── index.html                   # Halaman antarmuka utama SPA
└── README.md                    # Dokumentasi lengkap sistem
```

