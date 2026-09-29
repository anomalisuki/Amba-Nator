# Akinator Web — Vercel

Website Akinator dengan UI modern yang mengikuti alur script CLI: pilih tema → jawab pertanyaan → tampilkan tebakan → konfirmasi.

## Struktur

- `public/index.html` — halaman utama
- `public/styles.css` — tampilan responsive
- `public/app.js` — state game & interaksi UI
- `api/akinator.js` — serverless proxy untuk endpoint Akinator
- `vercel.json` — konfigurasi Vercel

## Deploy ke Vercel

### Cara 1 — lewat GitHub
1. Upload seluruh isi folder ini ke repository baru.
2. Import repository tersebut di Vercel.
3. Framework preset: **Other**.
4. Build Command: kosongkan.
5. Output Directory: kosongkan.
6. Deploy.

### Cara 2 — Vercel CLI

```bash
npm i -g vercel
vercel login
cd akinator-vercel
vercel
```

Untuk production:

```bash
vercel --prod
```

## Catatan penting

Backend dijalankan sebagai Vercel Serverless Function supaya browser tidak langsung melakukan request lintas-origin ke `id.akinator.com`. Cookie/session game dikembalikan ke browser dan dikirim lagi pada request berikutnya.

Layanan pihak ketiga dapat berubah sewaktu-waktu. Jika Akinator mengubah endpoint, format HTML, atau format JSON, parser pada `api/akinator.js` perlu disesuaikan.
