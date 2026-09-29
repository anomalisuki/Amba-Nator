# Akinator Vercel

Versi ini tidak menggunakan CORS proxy publik. Browser memanggil endpoint `/api/*` pada domain Vercel sendiri, lalu Vercel meneruskan request ke `https://id.akinator.com`.

## Deploy

1. Upload/import folder atau ZIP ini ke Vercel.
2. Framework Preset: Other.
3. Build Command: kosong.
4. Output Directory: `public`.
5. Deploy.

Atau dengan CLI:

```bash
npm i -g vercel
vercel
```

Setelah deploy, buka URL Vercel.

## Struktur

- `public/index.html` — website
- `api/[...path].js` — proxy serverless ke Akinator
- `vercel.json` — konfigurasi runtime

Tidak membutuhkan npm package.

## Catatan

Serverless proxy meneruskan cookie `Set-Cookie` dari Akinator agar session game dapat dipertahankan oleh browser. Jika Akinator memblokir IP/data center Vercel atau mengubah API internalnya, proxy tidak dapat menjamin game tetap bekerja.
