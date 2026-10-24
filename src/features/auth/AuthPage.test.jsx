import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthPage } from './AuthPage.jsx';

const { httpPost } = vi.hoisted(() => ({ httpPost: vi.fn() }));

vi.mock('../../services/httpClient.js', () => ({
  http: { post: httpPost },
}));

describe('AuthPage', () => {
  it('switches to login when registration reports an existing email', async () => {
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
  });
});
