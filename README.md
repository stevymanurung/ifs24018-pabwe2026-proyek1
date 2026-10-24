# ifs24018-pabwe2026-proyek1 — Frontend

Frontend Study Planner (React + Vite). Frontend dan backend dipisah.

## Jalankan lokal

```bash
bun install
# jika API berjalan di domain lain, atur VITE_API_BASE pada .env.production
bun run dev
```

## Build produksi

```bash
bun run build
```

Hasil build ada di `dist/`. Deploy folder hasil build ke hosting frontend. Jika API berada pada domain berbeda, isi `VITE_API_BASE` dengan URL API dan konfigurasi CORS pada backend.
