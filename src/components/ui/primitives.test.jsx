import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary.jsx';
import { NextClassCard } from '../layout/NextClassCard.jsx';
import { Topbar } from '../layout/Topbar.jsx';
import { Button } from './Button.jsx';
import { Card } from './Card.jsx';
import { EmptyState } from './EmptyState.jsx';
import { ErrorBanner } from './ErrorBanner.jsx';
import { FormError } from './FormError.jsx';
import { LoadingState } from './LoadingState.jsx';
import { SelectField } from './SelectField.jsx';
import { TextField } from './TextField.jsx';
import { BellIcon, CalendarIcon, DashboardIcon, MenuIcon, TaskIcon } from './icons.jsx';

describe('UI primitives', () => {
  it('renders button variants, sizes and forwards button props', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Default</Button>
        <Button size="sm" variant="ghost" type="submit">Small</Button>
        <Button variant="danger" aria-label="Remove">Remove</Button>
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Default' }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Small' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveClass('text-red-600');
  });

  it('renders optional card title, children and empty state', () => {
    const { rerender } = render(<Card title="Ringkasan"><span>Isi</span></Card>);

    expect(screen.getByRole('heading', { name: 'Ringkasan' })).toBeInTheDocument();
    expect(screen.getByText('Isi')).toBeInTheDocument();

    rerender(<Card><span>Kartu tanpa judul</span></Card>);

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Kartu tanpa judul')).toBeInTheDocument();

    render(<EmptyState>Belum ada data.</EmptyState>);
    expect(screen.getByText('Belum ada data.')).toBeInTheDocument();
  });

  it('connects field labels to their inputs and selects', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TextField label="Nama" placeholder="Nama pengguna" />
        <SelectField label="Hari" defaultValue="senin">
          <option value="senin">Senin</option>
          <option value="selasa">Selasa</option>
        </SelectField>
      </>,
    );

    await user.selectOptions(screen.getByLabelText('Hari'), 'selasa');

    expect(screen.getByLabelText('Nama')).toHaveAttribute('placeholder', 'Nama pengguna');
    expect(screen.getByLabelText('Hari')).toHaveValue('selasa');
  });

  it('shows error messages and invokes retry action', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <>
        <FormError message="Periksa input." />
        <ErrorBanner message="Server gagal." onRetry={onRetry} />
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));

    expect(screen.getByText('Server gagal.').closest('[role="alert"]')).toBeInTheDocument();
    expect(screen.getByText('Periksa input.')).toHaveClass('min-h-5');
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders loading status and a dated top bar', () => {
    render(
      <>
        <LoadingState label="Memuat jadwal..." />
        <Topbar title="Jadwal" onMenuClick={vi.fn()} />
      </>,
    );

    expect(screen.getByText('Memuat jadwal...').closest('output')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('heading', { name: 'Jadwal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buka menu' })).toBeInTheDocument();
  });

  it('renders decorative icons and next-class card for both schedule states', () => {
    const { rerender } = render(
      <>
        <DashboardIcon />
        <CalendarIcon />
        <TaskIcon />
        <BellIcon />
        <MenuIcon />
        <section aria-label="Kuliah berikutnya">
          <NextClassCard next={null} />
        </section>
      </>,
    );

    expect(screen.getByLabelText('Kuliah berikutnya')).toHaveTextContent('Belum ada jadwal');
    expect(document.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(5);

    rerender(
      <NextClassCard
        next={{
          daysAhead: 1,
          session: { course: 'Basis Data', day: 2, end: '10:00', room: 'A1', start: '08:00' },
        }}
      />,
    );

    expect(screen.getByText('Basis Data')).toBeInTheDocument();
    expect(screen.getByText('Besok, 08:00 - 10:00 (A1)')).toBeInTheDocument();
  });

  it('renders an error boundary fallback when a child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    function BrokenChild() {
      throw new Error('render failed');
    }

    try {
      render(<ErrorBoundary><BrokenChild /></ErrorBoundary>);
      expect(screen.getByRole('alert')).toHaveTextContent('Terjadi kesalahan saat menampilkan halaman ini.');
    } finally {
      consoleError.mockRestore();
    }
  });
});
