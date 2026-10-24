import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import NotFoundPage from './app/NotFoundPage.jsx';
import { ROUTES } from './app/routes.js';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { PlannerProvider } from './context/PlannerProvider.jsx';
import { ReminderProvider } from './features/reminders/ReminderProvider.jsx';
import { AuthPage } from './features/auth/AuthPage.jsx';
import { AUTH_REQUIRED_EVENT, http } from './services/httpClient.js';

export default function App() {
  const [auth, setAuth] = useState({ status: 'checking', user: null });
  const checkSession = useCallback(async () => {
    setAuth({ status: 'checking', user: null });
    const token = globalThis.localStorage?.getItem('study-planner-token');
    if (!token) {
      setAuth({ status: 'signed-out', user: null });
      return;
    }
    if (token.startsWith('local-study-planner:')) {
      globalThis.localStorage?.removeItem('study-planner-token');
      setAuth({ status: 'signed-out', user: null });
      return;
    }
    try {
      const { user } = await http.get('/auth/me');
      setAuth({ status: 'signed-in', user });
    } catch (error) {
      if (error.status === 401) {
        globalThis.localStorage?.removeItem('study-planner-token');
        setAuth({ status: 'signed-out', user: null });
        return;
      }
      setAuth({ status: 'unavailable', user: null, error: error.message });
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    const handleAuthRequired = () => {
      globalThis.localStorage?.removeItem('study-planner-token');
      setAuth({ status: 'signed-out', user: null });
    };
    globalThis.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => globalThis.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, []);

  const signIn = (result) => {
    if (!result?.token || !result?.user) {
      throw new Error('Respons login dari server tidak lengkap. Coba lagi.');
    }
    globalThis.localStorage?.setItem('study-planner-token', result.token);
    setAuth({ status: 'signed-in', user: result.user });
  };
  const signOut = async () => {
    try { await http.post('/auth/logout', {}); } catch { /* Token lokal tetap dihapus saat server tidak tersedia. */ }
    globalThis.localStorage?.removeItem('study-planner-token');
    setAuth({ status: 'signed-out', user: null });
  };

  if (auth.status === 'checking') return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">Memeriksa sesi login...</div>;
  if (auth.status === 'unavailable') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Belum dapat terhubung ke akun</h1>
          <p role="alert" className="mt-2 text-sm leading-6 text-slate-600">
            {auth.error || 'Server sedang bermasalah. Sesi login tetap disimpan; coba lagi sebentar.'}
          </p>
          <button type="button" onClick={checkSession} className="mt-5 rounded-xl bg-indigo-700 px-4 py-2.5 font-semibold text-white hover:bg-indigo-800">
            Coba lagi
          </button>
        </section>
      </main>
    );
  }
  if (auth.status === 'signed-out') return <AuthPage onAuthenticated={signIn} />;
  return (
    <PlannerProvider>
      <ReminderProvider>
        <div className="relative">
          <div className="fixed right-4 top-3 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
            <span className="hidden text-slate-600 sm:inline">Halo, <strong className="text-slate-900">{auth.user.name}</strong></span>
            <button type="button" onClick={signOut} className="font-semibold text-indigo-700 hover:text-indigo-900">Keluar</button>
          </div>
          <Routes>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route element={<AppLayout />}>
              {ROUTES.map(({ path, Page }) => <Route key={path} path={path} element={<Page />} />)}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </div>
      </ReminderProvider>
    </PlannerProvider>
  );
}
