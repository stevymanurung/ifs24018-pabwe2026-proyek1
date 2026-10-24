import { useEffect, useState } from 'react';
import { http } from '../../services/httpClient.js';
import { loginLocalAccount, registerLocalAccount } from '../../services/localAuth.js';

function getDatabaseMessage(status) {
  if (status === 'checking') return 'Memeriksa koneksi database...';
  if (status === 'unavailable') return 'Status database tidak dapat diperiksa. Coba lagi atau hubungi pengelola aplikasi.';
  if (status?.database === 'connected' && status.dialect === 'postgres') return 'Database persisten terhubung.';
  if (status?.database === 'connected' && status.dialect === 'sqlite') {
    return 'Backend memakai SQLite. Akun mungkin tidak tersimpan konsisten di deployment; DATABASE_URL PostgreSQL perlu diatur.';
  }
  if (status?.status === 'ok' && !status.dialect) {
    return 'API aktif. Daftar dan login tetap bisa digunakan; sampai database backend terkonfirmasi, akun dan fitur disimpan di browser ini.';
  }
  return 'Status database belum dapat dipastikan. Periksa koneksi API dan konfigurasi backend.';
}

export function AuthPage({ onAuthenticated, onLocalAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState('checking');
  const register = mode === 'register';

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
      const localFirst = !(databaseStatus?.database === 'connected' && databaseStatus.dialect === 'postgres')
        && !(import.meta.env?.DEV && databaseStatus?.database === 'connected' && databaseStatus.dialect === 'sqlite');
      if (localFirst && onLocalAuthenticated) {
        if (register) {
          await onLocalAuthenticated(await registerLocalAccount(credentials));
          return;
        }
        try {
          await onLocalAuthenticated(await loginLocalAccount({ email, password }));
          return;
        } catch (localError) {
          if (localError.code !== 'INVALID_CREDENTIALS') throw localError;
          try {
            await onAuthenticated(await http.post('/auth/login', { email, password }));
            return;
          } catch (backendError) {
            if (backendError.status === 401) {
              setError('Akun tidak ditemukan di backend maupun browser ini. Pilih Daftar untuk membuat akun dan langsung menguji dashboard serta fitur.');
            } else {
              setError(localError.message || backendError.message || 'Tidak dapat memproses akun.');
            }
            return;
          }
        }
      }
      const result = await http.post(`/auth/${register ? 'register' : 'login'}`, credentials);
      await onAuthenticated(result);
    } catch (err) {
      const backendUnavailable = err.code === 'NETWORK_ERROR' || err.status === 404 || err.status >= 500;
      if (register && err.code === 'EMAIL_EXISTS') {
        try {
          const result = await http.post('/auth/login', { email, password });
          await onAuthenticated(result);
        } catch (loginError) {
          if (loginError.code !== 'INVALID_CREDENTIALS') {
            setMode('login');
            setError(loginError.message || 'Email ini sudah terdaftar. Silakan login.');
            return;
          }
          if (!onLocalAuthenticated) {
            setMode('login');
            setError('Email ini sudah terdaftar. Silakan login dengan akun yang sama.');
            return;
          }
          try {
            await onLocalAuthenticated(await registerLocalAccount(credentials));
          } catch (localError) {
            setError(localError.message || 'Tidak dapat membuat sesi lokal.');
          }
        }
      } else if (register && backendUnavailable && onLocalAuthenticated) {
        try {
          await onLocalAuthenticated(await registerLocalAccount(credentials));
        } catch (localError) {
          setError(localError.message || 'Tidak dapat membuat akun lokal.');
        }
      } else if (!register && (backendUnavailable || err.code === 'INVALID_CREDENTIALS') && onLocalAuthenticated) {
        try {
          await onLocalAuthenticated(await loginLocalAccount({ email, password }));
        } catch (localError) {
          if (localError.code === 'INVALID_CREDENTIALS' && err.code === 'INVALID_CREDENTIALS') {
            setError('Login backend ditolak. Jika akun hanya tersedia di backend yang belum tersambung, buat akun lewat Daftar agar bisa masuk dan menguji fitur pada browser ini.');
          } else {
            setError(localError.message || err.message || 'Tidak dapat memproses akun.');
          }
        }
      } else if (!register && err.code === 'INVALID_CREDENTIALS' && databaseStatus?.status === 'ok' && !databaseStatus.dialect) {
        setError('Login ditolak backend. Coba daftar untuk membuat akun dan langsung masuk; bila backend tidak tersedia, akun lokal browser akan digunakan.');
      } else {
        setError(err.message || 'Tidak dapat memproses akun.');
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
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{register ? 'Buat akun baru' : 'Selamat datang kembali'}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{register ? 'Daftar untuk menyimpan jadwal dan tugasmu sendiri.' : 'Login untuk melanjutkan rencana belajarmu.'}</p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            {register && <label className="block text-sm font-medium text-slate-700">Nama lengkap<input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" placeholder="Nama kamu" /></label>}
            <label className="block text-sm font-medium text-slate-700">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" placeholder="nama@email.com" /></label>
            <label className="block text-sm font-medium text-slate-700">Password<input required minLength={8} maxLength={128} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={register ? 'new-password' : 'current-password'} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" placeholder="Minimal 8 karakter" /></label>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="w-full rounded-xl bg-indigo-700 px-4 py-3.5 font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60">{busy ? 'Memproses...' : register ? 'Daftar akun' : 'Login'}</button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600">{register ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}<button type="button" onClick={() => { setMode(register ? 'login' : 'register'); setError(''); }} className="font-semibold text-indigo-700 hover:underline">{register ? 'Login di sini' : 'Daftar sekarang'}</button></p>
          <p role="status" className="mt-6 text-center text-xs leading-5 text-slate-500">{getDatabaseMessage(databaseStatus)}</p>
        </section>
      </div>
    </main>
  );
}
