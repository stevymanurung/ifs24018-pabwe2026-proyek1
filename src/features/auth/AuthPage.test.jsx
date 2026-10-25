import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from './AuthPage.jsx';

const { httpGet, httpPost } = vi.hoisted(() => ({
  httpGet: vi.fn(),
  httpPost: vi.fn(),
}));

vi.mock('../../services/httpClient.js', () => ({
  http: { get: httpGet, post: httpPost },
}));

describe('AuthPage', () => {
  beforeEach(() => {
    httpGet.mockReset();
    httpPost.mockReset();
  });

  it('explains when the backend is reachable but does not report database status', async () => {
    httpGet.mockResolvedValueOnce({ status: 'ok' });
    render(<AuthPage onAuthenticated={vi.fn()} />);

    expect(document.querySelector('#username')).toBe(screen.getByLabelText('Email'));
    expect(document.querySelector('#password')).toBe(screen.getByLabelText('Password'));
    expect(document.querySelector('#btn-submit')).toBe(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Backend aktif, tetapi versi ini belum melaporkan status database');
    expect(screen.getByRole('status')).not.toHaveTextContent('Status database belum dapat dipastikan');
  });

  it('reports an unknown database status and a failed health check', async () => {
    httpGet.mockResolvedValueOnce({ status: 'starting' });
    const { unmount } = render(<AuthPage onAuthenticated={vi.fn()} />);
    expect(await screen.findByRole('status')).toHaveTextContent('Status database belum dapat dipastikan.');

    unmount();
    httpGet.mockRejectedValueOnce(new Error('Health check gagal'));
    render(<AuthPage onAuthenticated={vi.fn()} />);
    expect(await screen.findByRole('status')).toHaveTextContent('Status database tidak dapat diperiksa.');
  });

  it('warns when the backend uses non-persistent SQLite storage', async () => {
    httpGet.mockResolvedValueOnce({ status: 'ok', database: 'connected', dialect: 'sqlite' });
    render(<AuthPage onAuthenticated={vi.fn()} />);

    expect(await screen.findByRole('status')).toHaveTextContent('Backend memakai SQLite.');
    expect(screen.getByRole('status')).toHaveTextContent('DATABASE_URL PostgreSQL perlu diatur.');
  });

  it('authenticates immediately with the account returned by successful registration', async () => {
    const onAuthenticated = vi.fn();
    const registration = {
      token: 'registered-token',
      user: { id: 7, name: 'Test User', email: 'test@example.com' },
    };
    httpGet.mockResolvedValueOnce({ status: 'ok', database: 'connected', dialect: 'postgres' });
    httpPost.mockResolvedValueOnce(registration);
    render(<AuthPage onAuthenticated={onAuthenticated} />);
    await userEvent.click(screen.getByRole('button', { name: 'Daftar sekarang' }));
    await userEvent.type(screen.getByLabelText('Nama lengkap'), registration.user.name);
    await userEvent.type(screen.getByLabelText('Email'), registration.user.email);
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Daftar akun' }));

    expect(httpPost).toHaveBeenCalledWith('/auth/register', {
      name: registration.user.name,
      email: registration.user.email,
      password: 'password123',
    });
    expect(onAuthenticated).toHaveBeenCalledWith(registration);
    expect(await screen.findByRole('status')).toHaveTextContent('Database persisten terhubung.');
  });

  it('switches to login when registration reports an existing email', async () => {
    httpGet.mockResolvedValueOnce({ status: 'ok', database: 'connected', dialect: 'postgres' });
    httpPost.mockRejectedValueOnce(Object.assign(new Error('Email sudah terdaftar. Silakan login.'), {
      code: 'EMAIL_EXISTS',
    })).mockRejectedValueOnce(Object.assign(new Error('Password salah.'), { code: 'INVALID_CREDENTIALS', status: 401 }));
    render(<AuthPage onAuthenticated={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Daftar sekarang' }));
    await userEvent.type(screen.getByLabelText('Nama lengkap'), 'Test User');
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Daftar akun' }));

    expect(await screen.findByRole('heading', { name: 'Selamat datang kembali' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ini sudah terdaftar. Silakan login dengan akun yang sama.');
    expect(screen.getByLabelText('Email')).toHaveValue('test@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('password123');
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Database persisten terhubung.');
  });

  it('explains when the old backend rejects login without database health details', async () => {
    httpGet.mockResolvedValueOnce({ status: 'ok' });
    httpPost.mockRejectedValueOnce(Object.assign(new Error('Email atau password tidak tepat.'), {
      code: 'INVALID_CREDENTIALS',
      status: 401,
    }));
    render(<AuthPage onAuthenticated={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('health check belum melaporkan database');
  });

  it('shows actionable errors for unavailable backend and other login failures', async () => {
    httpGet.mockResolvedValue({ status: 'ok', database: 'connected', dialect: 'postgres' });
    httpPost
      .mockRejectedValueOnce(Object.assign(new Error('Jaringan terputus'), { code: 'NETWORK_ERROR' }))
      .mockRejectedValueOnce(new Error('Akun tidak dapat digunakan'));
    render(<AuthPage onAuthenticated={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Backend tidak dapat memproses akun.');

    await userEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Akun tidak dapat digunakan');
  });

  it('uses the fallback error message when a login error has no message', async () => {
    httpGet.mockResolvedValueOnce({ status: 'ok', database: 'connected', dialect: 'postgres' });
    httpPost.mockRejectedValueOnce({ code: 'UNEXPECTED_ERROR' });
    render(<AuthPage onAuthenticated={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Tidak dapat memproses akun.');
  });
});
