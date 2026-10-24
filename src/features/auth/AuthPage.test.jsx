import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthPage } from './AuthPage.jsx';

const { httpGet, httpPost } = vi.hoisted(() => ({ httpGet: vi.fn(), httpPost: vi.fn() }));

vi.mock('../../services/httpClient.js', () => ({
  http: { get: httpGet, post: httpPost },
}));

describe('AuthPage', () => {
  it('explains when the backend is reachable but does not report database status', async () => {
    httpGet.mockResolvedValueOnce({ status: 'ok' });
    render(<AuthPage onAuthenticated={vi.fn()} />);

    expect(await screen.findByRole('status')).toHaveTextContent('API backend aktif, tetapi belum melaporkan database');
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

  it('offers a separate local demo entry without submitting credentials to the backend', async () => {
    const onDemo = vi.fn();
    httpGet.mockResolvedValueOnce({ status: 'ok' });
    render(<AuthPage onAuthenticated={vi.fn()} onDemo={onDemo} />);

    await userEvent.click(screen.getByRole('button', { name: 'Masuk mode demo lokal' }));

    expect(onDemo).toHaveBeenCalledOnce();
    expect(httpPost).not.toHaveBeenCalled();
    expect(screen.getByText(/disimpan hanya di browser ini, bukan ke database/i)).toBeInTheDocument();
  });

  it('switches to login when registration reports an existing email', async () => {
    httpGet.mockResolvedValueOnce({ status: 'ok', database: 'connected', dialect: 'postgres' });
    httpPost.mockRejectedValueOnce(Object.assign(new Error('Email sudah terdaftar. Silakan login.'), {
      code: 'EMAIL_EXISTS',
    }));
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

  it('does not assume the database is missing when login fails and health omits database status', async () => {
    httpGet.mockResolvedValueOnce({ status: 'ok' });
    httpPost.mockRejectedValueOnce(Object.assign(new Error('Email atau password tidak tepat.'), {
      code: 'INVALID_CREDENTIALS',
    }));
    render(<AuthPage onAuthenticated={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Health API hanya menyatakan "ok" dan tidak melaporkan database');
    expect(screen.getByRole('alert')).toHaveTextContent('memakai database berbeda');
    expect(screen.getByRole('alert')).toHaveTextContent('DATABASE_URL atau POSTGRES_URL');
  });
});
