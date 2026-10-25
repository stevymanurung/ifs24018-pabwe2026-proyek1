import { vi, describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import App from './App.jsx';

const { httpGet, httpPost } = vi.hoisted(() => ({
  httpGet: vi.fn(),
  httpPost: vi.fn(),
}));

vi.mock('./services/httpClient.js', () => ({
  AUTH_REQUIRED_EVENT: 'study-planner:auth-required',
  http: { get: httpGet, post: httpPost },
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
  AuthPage: ({ onAuthenticated }) => (
    <>
      <button type="button" onClick={() => onAuthenticated({
        token: 'new-token',
        user: { id: 1, name: 'Test', email: 'test@example.com' },
      })}>
        Login test
      </button>
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
    httpPost.mockReset();
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

  it('clears tokens from the removed browser-local account mode', async () => {
    globalThis.localStorage.setItem('study-planner-token', 'local-study-planner:old-account');
    renderApp();

    await waitFor(() => expect(globalThis.localStorage.getItem('study-planner-token')).toBeNull());
    expect(await screen.findByRole('button', { name: 'Login test' })).toBeInTheDocument();
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('opens the dashboard from a successful login response without a redundant session request', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Login test' }));

    expect(await screen.findByText('Dashboard berhasil dibuka')).toBeInTheDocument();
    expect(globalThis.localStorage.getItem('study-planner-token')).toBe('new-token');
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('logs out after a successful backend request and handles auth-required events', async () => {
    httpPost.mockResolvedValueOnce({});
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Login test' }));
    expect(await screen.findByRole('button', { name: 'Keluar' })).toBeInTheDocument();
    expect(globalThis.localStorage.getItem('study-planner-token')).toBe('new-token');

    fireEvent.click(screen.getByRole('button', { name: 'Keluar' }));
    await waitFor(() => expect(globalThis.localStorage.getItem('study-planner-token')).toBeNull());
    expect(httpPost).toHaveBeenCalledWith('/auth/logout', {});
    expect(await screen.findByRole('button', { name: 'Login test' })).toBeInTheDocument();

    globalThis.localStorage.setItem('study-planner-token', 'new-token');
    fireEvent.click(await screen.findByRole('button', { name: 'Login test' }));
    globalThis.dispatchEvent(new Event('study-planner:auth-required'));
    await waitFor(() => expect(globalThis.localStorage.getItem('study-planner-token')).toBeNull());
  });

  it('clears the local session when the backend logout request fails', async () => {
    httpPost.mockRejectedValueOnce(new Error('Backend tidak tersedia'));
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Login test' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Keluar' }));

    await waitFor(() => expect(globalThis.localStorage.getItem('study-planner-token')).toBeNull());
    expect(await screen.findByRole('button', { name: 'Login test' })).toBeInTheDocument();
  });

});
