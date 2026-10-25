import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { http } from '../../services/httpClient.js';

function getDatabaseMessage(status) {
  if (status === 'checking') return 'Memeriksa koneksi database...';
  if (status === 'unavailable') return 'Status database tidak dapat diperiksa. Coba lagi atau hubungi pengelola aplikasi.';
  if (status?.database === 'connected' && status.dialect === 'postgres') return 'Database persisten terhubung.';
  if (status?.database === 'connected' && status.dialect === 'sqlite') {
    return 'Backend memakai SQLite. Akun mungkin tidak tersimpan konsisten di deployment; DATABASE_URL PostgreSQL perlu diatur.';
  }
  if (status?.status === 'ok' && !status.dialect) {
    return 'Backend aktif, tetapi versi ini belum melaporkan status database. Pendaftaran/login perlu menggunakan backend dengan PostgreSQL terhubung.';
  }
  return 'Status database belum dapat dipastikan. Periksa koneksi API dan konfigurasi backend.';
}

export function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState('checking');
  const register = mode === 'register';
  let submitLabel = register ? 'Daftar akun' : 'Login';
  let heading = 'Selamat datang kembali';
  let description = 'Login untuk melanjutkan rencana belajarmu.';
  let modePrompt = 'Belum punya akun?';
  let modeAction = 'Daftar sekarang';
  if (busy) submitLabel = 'Memproses...';
  if (register) {
    heading = 'Buat akun baru';
    description = 'Daftar untuk menyimpan jadwal dan tugasmu sendiri.';
    modePrompt = 'Sudah punya akun?';
    modeAction = 'Login di sini';
  }

  useEffect(() => {
    let active = true;
    http.get('/health').then((health) => {
      if (active) setDatabaseStatus(health);
    }).catch(() => {
      if (active) setDatabaseStatus('unavailable');
    });
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const credentials = { ...(register ? { name } : {}), email, password };
    try {
      const result = await http.post(`/auth/${register ? 'register' : 'login'}`, credentials);
      await onAuthenticated(result);
    } catch (error_) {
      if (register && error_.code === 'EMAIL_EXISTS') {
        setMode('login');
        setError('Email ini sudah terdaftar. Silakan login dengan akun yang sama.');
      } else if (!register && error_.code === 'INVALID_CREDENTIALS' && databaseStatus?.status === 'ok' && !databaseStatus.dialect) {
        setError('Backend menolak login dan health check belum melaporkan database. Pastikan backend production terbaru terhubung ke database PostgreSQL yang menyimpan akun.');
      } else if (error_.code === 'NETWORK_ERROR' || error_.status === 404 || error_.status >= 500) {
        setError('Backend tidak dapat memproses akun. Pastikan backend production sudah diperbarui dan database PostgreSQL tersedia; akun tidak disimpan di browser.');
      } else {
        setError(error_.message || 'Tidak dapat memproses akun.');
      }
    }
    finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-indigo-700 p-10 text-white md:flex">
          <div><div className="mb-8 grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-2xl">✦</div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200">Study Planner</p><h1 className="mt-4 text-4xl font-bold leading-tight">Atur waktu.<br/>Capai tujuan.</h1><p className="mt-5 leading-7 text-indigo-100">Simpan jadwal kuliah, pantau tugas, dan kelola pengingat belajar dalam satu tempat.</p></div>
          <p className="text-sm text-indigo-200">Rencana yang jelas membuat belajar lebih terarah.</p>
        </section>
        <section className="p-7 sm:p-10">
          <div className="mb-8 md:hidden"><p className="text-sm font-bold uppercase tracking-widest text-indigo-700">Study Planner</p></div>
          <p className="text-sm font-semibold text-indigo-700">AKUN PENGGUNA</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{heading}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            {register && <label className="block text-sm font-medium text-slate-700">Nama lengkap<input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" placeholder="Nama kamu" /></label>}
            <label className="block text-sm font-medium text-slate-700">Email<input id="username" name="username" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" placeholder="nama@email.com" /></label>
            <label className="block text-sm font-medium text-slate-700">Password<input id="password" name="password" required minLength={8} maxLength={128} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={register ? 'new-password' : 'current-password'} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" placeholder="Minimal 8 karakter" /></label>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button id="btn-submit" type="submit" disabled={busy} className="w-full rounded-xl bg-indigo-700 px-4 py-3.5 font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60">{submitLabel}</button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600">{modePrompt}{' '}<button type="button" onClick={() => { setMode(register ? 'login' : 'register'); setError(''); }} className="font-semibold text-indigo-700 hover:underline">{modeAction}</button></p>
          <output aria-live="polite" className="mt-6 block text-center text-xs leading-5 text-slate-500">{getDatabaseMessage(databaseStatus)}</output>
        </section>
      </div>
    </main>
  );
}

AuthPage.propTypes = {
  onAuthenticated: PropTypes.func.isRequired,
};
