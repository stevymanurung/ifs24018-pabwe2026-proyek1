import { vi, describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import App from './App.jsx';

const { httpGet } = vi.hoisted(() => ({ httpGet: vi.fn() }));

vi.mock('./services/httpClient.js', () => ({
  AUTH_REQUIRED_EVENT: 'study-planner:auth-required',
  http: { get: httpGet, post: vi.fn() },
}));

vi.mock('./services/localAuth.js', () => ({
  isLocalToken: (token) => token === 'local-token',
  getLocalUser: (token) => token === 'local-token'
    ? { id: 'account-id', name: 'Test Local', email: 'local@example.com' }
    : null,
}));

vi.mock('./app/routes.js', () => ({
  ROUTES: [{ path: '/', Page: () => <p>Dashboard berhasil dibuka</p> }],
}));

vi.mock('./components/layout/AppLayout.jsx', () => ({
  AppLayout: () => <Outlet />,
}));

vi.mock('./context/PlannerProvider.jsx', () => ({
  PlannerProvider: ({ children }) => children,
}));

vi.mock('./features/reminders/ReminderProvider.jsx', () => ({
  ReminderProvider: ({ children }) => children,
}));

vi.mock('./features/auth/AuthPage.jsx', () => ({
  AuthPage: ({ onAuthenticated, onLocalAuthenticated }) => (
    <>
      <button type="button" onClick={() => onAuthenticated({
        token: 'new-token',
        user: { id: 1, name: 'Test', email: 'test@example.com' },
      })}>Login test</button>
      <button type="button" onClick={() => onLocalAuthenticated({
        token: 'local-token',
        user: { id: 'account-id', name: 'Test Local', email: 'local@example.com' },
        local: true,
      })}>Daftar akun lokal test</button>
    </>
  ),
}));

function renderApp() {
  return render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></MemoryRouter>);
}

const apiError = (status, code, message) => Object.assign(new Error(message), { status, code });

describe('App authentication flow', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    httpGet.mockReset();
  });

  it('retains the saved token during temporary API errors and retries the existing session', async () => {
    globalThis.localStorage.setItem('study-planner-token', 'saved-token');
    httpGet
      .mockRejectedValueOnce(apiError(503, 'HTTP_ERROR', 'Database sementara tidak tersedia'))
      .mockResolvedValueOnce({ user: { id: 1, name: 'Test', email: 'test@example.com' } });

    renderApp();

    expect(await screen.findByRole('alert')).toHaveTextContent('Database sementara tidak tersedia');
    expect(globalThis.localStorage.getItem('study-planner-token')).toBe('saved-token');
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));

    expect(await screen.findByText('Dashboard berhasil dibuka')).toBeInTheDocument();
    expect(globalThis.localStorage.getItem('study-planner-token')).toBe('saved-token');
  });

  it('clears the token only when the backend explicitly rejects the session', async () => {
    globalThis.localStorage.setItem('study-planner-token', 'expired-token');
    httpGet.mockRejectedValue(apiError(401, 'UNAUTHENTICATED', 'Silakan login kembali.'));

    renderApp();

    await waitFor(() => expect(globalThis.localStorage.getItem('study-planner-token')).toBeNull());
    expect(await screen.findByRole('button', { name: 'Login test' })).toBeInTheDocument();
  });

  it('opens the dashboard from a successful login response without a redundant session request', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Login test' }));

    expect(await screen.findByText('Dashboard berhasil dibuka')).toBeInTheDocument();
    expect(globalThis.localStorage.getItem('study-planner-token')).toBe('new-token');
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('opens the dashboard after a local account is registered through the normal auth flow', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Daftar akun lokal test' }));

    expect(await screen.findByText('Dashboard berhasil dibuka')).toBeInTheDocument();
    expect(globalThis.localStorage.getItem('study-planner-token')).toBe('local-token');
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('restores a local account session after a page reload without contacting the backend', async () => {
    globalThis.localStorage.setItem('study-planner-token', 'local-token');
    renderApp();

    expect(await screen.findByText('Dashboard berhasil dibuka')).toBeInTheDocument();
    expect(httpGet).not.toHaveBeenCalled();
  });
});
