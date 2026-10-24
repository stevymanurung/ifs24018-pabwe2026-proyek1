# ifs24018-pabwe2026-proyek1 — Frontend

Frontend Study Planner (React + Vite). Frontend dan backend dipisah.

## Jalankan lokal

```bash
npm ci
npm run dev
```

## Build produksi

```bash
npm run build
```

Frontend meneruskan permintaan `/api` ke `http://localhost:3001` saat development.
Pastikan backend Express berjalan pada alamat tersebut sebelum mencoba login. Jika backend
menggunakan alamat atau port berbeda, atur `VITE_API_PROXY` di `.env` frontend.

Hasil build ada di `dist/`. Deploy folder hasil build ke Vercel. `vercel.json` meneruskan
`/api/*` ke backend produksi dan mengarahkan route SPA seperti `/login` ke aplikasi frontend,
jadi `VITE_API_BASE` tidak perlu diatur untuk deployment ini. Jika alamat backend berubah,
perbarui tujuan rewrite `/api/(.*)` di `vercel.json`, lalu deploy ulang frontend.

Jika frontend dan backend diakses langsung dari domain berbeda tanpa proxy Vercel, set
`VITE_API_BASE` ke URL backend sampai path `/api` dan `CORS_ORIGIN` backend ke origin frontend.
