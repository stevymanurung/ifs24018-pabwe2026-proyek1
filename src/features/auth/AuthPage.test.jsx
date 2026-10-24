import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from './AuthPage.jsx';

const { httpGet, httpPost, loginLocal, registerLocal } = vi.hoisted(() => ({
  httpGet: vi.fn(),
  httpPost: vi.fn(),
  loginLocal: vi.fn(),
  registerLocal: vi.fn(),
}));

vi.mock('../../services/httpClient.js', () => ({
  http: { get: httpGet, post: httpPost },
}));

vi.mock('../../services/localAuth.js', () => ({
  loginLocalAccount: loginLocal,
  registerLocalAccount: registerLocal,
}));

describe('AuthPage', () => {
  beforeEach(() => {
    httpGet.mockReset();
    httpPost.mockReset();
    loginLocal.mockReset();
    registerLocal.mockReset();
  });

  it('explains when the backend is reachable but does not report database status', async () => {
    httpGet.mockResolvedValueOnce({ status: 'ok' });
    render(<AuthPage onAuthenticated={vi.fn()} />);

    expect(await screen.findByRole('status')).toHaveTextContent('API aktif. Daftar dan login tetap bisa digunakan');
    expect(screen.getByRole('status')).not.toHaveTextContent('Status database belum dapat dipastikan');
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

  it('registers and signs in through the normal form when production has no persistent database status', async () => {
    const onLocalAuthenticated = vi.fn();
    const account = {
      token: 'local-study-planner:account-id',
      user: { id: 'account-id', name: 'Test User', email: 'test@example.com' },
      local: true,
    };
    httpGet.mockResolvedValueOnce({ status: 'ok' });
    registerLocal.mockResolvedValueOnce(account);
    render(<AuthPage onAuthenticated={vi.fn()} onLocalAuthenticated={onLocalAuthenticated} />);
    await userEvent.click(screen.getByRole('button', { name: 'Daftar sekarang' }));
    await userEvent.type(screen.getByLabelText('Nama lengkap'), account.user.name);
    await userEvent.type(screen.getByLabelText('Email'), account.user.email);
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Daftar akun' }));

    expect(httpPost).not.toHaveBeenCalled();
    expect(registerLocal).toHaveBeenCalledWith({
      name: account.user.name,
      email: account.user.email,
      password: 'password123',
    });
    expect(onLocalAuthenticated).toHaveBeenCalledWith(account);
  });

  it('uses the local account from the normal login form if the backend rejects the remote account', async () => {
    const onLocalAuthenticated = vi.fn();
    const account = {
      token: 'local-study-planner:account-id',
      user: { id: 'account-id', name: 'Test User', email: 'test@example.com' },
      local: true,
    };
    httpGet.mockResolvedValueOnce({ status: 'ok' });
    loginLocal.mockResolvedValueOnce(account);
    render(<AuthPage onAuthenticated={vi.fn()} onLocalAuthenticated={onLocalAuthenticated} />);
    await userEvent.type(screen.getByLabelText('Email'), account.user.email);
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(loginLocal).toHaveBeenCalledWith({ email: account.user.email, password: 'password123' });
    expect(httpPost).not.toHaveBeenCalled();
    expect(onLocalAuthenticated).toHaveBeenCalledWith(account);
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

  it('offers registration after neither backend nor local browser has the account', async () => {
    httpGet.mockResolvedValueOnce({ status: 'ok' });
    httpPost.mockRejectedValueOnce(Object.assign(new Error('Email atau password tidak tepat.'), {
      code: 'INVALID_CREDENTIALS',
      status: 401,
    }));
    loginLocal.mockRejectedValueOnce(Object.assign(new Error('Akun lokal tidak ditemukan.'), {
      code: 'INVALID_CREDENTIALS',
    }));
    render(<AuthPage onAuthenticated={vi.fn()} onLocalAuthenticated={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Pilih Daftar');
  });
});
