import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { usePlannerMock, useReminderMock, plannerState } = vi.hoisted(() => ({
  usePlannerMock: vi.fn(),
  useReminderMock: vi.fn(),
  plannerState: { current: null },
}));

vi.mock('../hooks/usePlanner.js', () => ({
  usePlanner: usePlannerMock,
}));

vi.mock('./reminders/useReminder.js', () => ({
  useReminder: useReminderMock,
}));

import { AppLayout } from '../components/layout/AppLayout.jsx';
import DashboardPage from './dashboard/DashboardPage.jsx';
import { CourseChart } from './dashboard/components/CourseChart.jsx';
import { HoursChart } from './dashboard/components/HoursChart.jsx';
import { StatCards } from './dashboard/components/StatCards.jsx';
import { StatusChart } from './dashboard/components/StatusChart.jsx';
import { TodayPanel } from './dashboard/components/TodayPanel.jsx';
import NotFoundPage from '../app/NotFoundPage.jsx';
import RemindersPage from './reminders/RemindersPage.jsx';
import SchedulePage from './schedule/SchedulePage.jsx';
import TasksPage from './tasks/TasksPage.jsx';

const createPlannerState = () => ({
  dashboard: {
    data: {
      hoursPerDay: [{ name: 'Senin', hours: 2 }],
      taskStatus: [{ key: 'pending', label: 'Aktif', value: 1 }],
      tasksPerCourse: [{ course: 'Basis Data', done: 1, pending: 1 }],
      today: {
        dayName: 'Senin',
        sessions: [{ id: 1, course: 'Basis Data', start: '08:00', end: '10:00' }],
      },
      upcomingTasks: [{ id: 2, title: 'Laporan', dueDate: '2026-10-30' }],
      totals: { done: 1, overdue: 0, pending: 1, weeklyHours: 2 },
    },
    status: 'ready',
    error: null,
  },
  sessions: {
    items: [{ id: 1, course: 'Basis Data', day: 0, start: '08:00', end: '10:00', room: 'A1' }],
    status: 'ready',
    error: null,
    create: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(null),
    reload: vi.fn(),
  },
  tasks: {
    items: [
      { id: 1, title: 'Laporan', course: 'Basis Data', dueDate: '2099-10-30', done: false },
      { id: 2, title: 'Quiz', course: 'Basis Data', dueDate: '2099-10-31', done: true },
    ],
    status: 'ready',
    error: null,
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(null),
    reload: vi.fn(),
  },
  alarms: {
    items: [{ id: 3, label: 'Belajar', time: '20:00', days: [0, 2], enabled: true }],
    status: 'ready',
    error: null,
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(null),
    reload: vi.fn(),
  },
  settings: {
    reminderLead: 10,
    updateReminderLead: vi.fn().mockResolvedValue({ reminderLead: 15 }),
  },
});

const reminderControls = {
  soundReady: true,
  permission: 'granted',
  enable: vi.fn(),
  testRing: vi.fn(),
};

function renderPage(page, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {page}
    </MemoryRouter>,
  );
}

describe('feature pages and uncovered branches', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    plannerState.current = createPlannerState();
    usePlannerMock.mockImplementation(() => plannerState.current);
    useReminderMock.mockReturnValue(reminderControls);
    Object.values(reminderControls).forEach((value) => {
      if (typeof value === 'function') value.mockClear();
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('renders dashboard data, charts and the app layout', () => {
    renderPage(<DashboardPage />);

    expect(screen.getByText('Tugas belum selesai')).toBeInTheDocument();
    expect(screen.getByText('Basis Data')).toBeInTheDocument();
    expect(screen.getByText('2026-10-30')).toBeInTheDocument();
  });

  it('shows dashboard loading, error, and stale-data error states', () => {
    plannerState.current.dashboard = { data: null, status: 'loading', error: null };
    const { rerender } = renderPage(<DashboardPage />);
    expect(screen.getByText('Memuat data...')).toBeInTheDocument();

    plannerState.current.dashboard = { data: null, status: 'error', error: new Error('API gagal') };
    rerender(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('API gagal');

    plannerState.current.dashboard = {
      ...createPlannerState().dashboard,
      status: 'error',
      error: new Error('Pembaruan gagal'),
    };
    rerender(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Gagal memperbarui data: Pembaruan gagal');
  });

  it('covers empty chart states and all dashboard detail panels', () => {
    const { rerender } = render(<CourseChart data={[]} />);
    expect(screen.getByText('Belum ada tugas.')).toBeInTheDocument();

    rerender(<HoursChart data={[{ name: 'Senin', hours: 0 }]} />);
    expect(screen.getByText('Belum ada jadwal. Tambahkan di menu Jadwal.')).toBeInTheDocument();

    rerender(<StatusChart data={[{ key: 'pending', label: 'Aktif', value: 0 }]} />);
    expect(screen.getByText('Belum ada tugas.')).toBeInTheDocument();

    rerender(<StatCards totals={{ done: 0, overdue: 0, pending: 0, weeklyHours: 0 }} />);
    expect(screen.getByText('Jam belajar per pekan')).toBeInTheDocument();

    rerender(<TodayPanel today={{ dayName: 'Senin', sessions: [] }} upcomingTasks={[]} />);
    expect(screen.getByText('Tidak ada jadwal hari ini.')).toBeInTheDocument();
    expect(screen.getByText('Tidak ada tugas dalam 7 hari ke depan.')).toBeInTheDocument();
  });

  it('shows schedule loading, error, and ready states; creates and removes sessions', async () => {
    plannerState.current.sessions.status = 'loading';
    const { rerender } = renderPage(<SchedulePage />, '/jadwal');
    expect(screen.getByText('Memuat data...')).toBeInTheDocument();

    plannerState.current.sessions.status = 'error';
    plannerState.current.sessions.error = new Error('Jadwal gagal');
    rerender(<MemoryRouter initialEntries={['/jadwal']}><SchedulePage /></MemoryRouter>);
    expect(screen.getByText('Jadwal gagal')).toBeInTheDocument();

    plannerState.current.sessions.status = 'ready';
    rerender(<MemoryRouter initialEntries={['/jadwal']}><SchedulePage /></MemoryRouter>);
    expect(screen.getByText('Basis Data')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Mata kuliah / kegiatan'), 'Pemrograman');
    await user.click(screen.getByRole('button', { name: 'Tambah Jadwal' }));
    await waitFor(() => expect(plannerState.current.sessions.create).toHaveBeenCalledWith({
      course: 'Pemrograman',
      day: 0,
      start: '',
      end: '',
      room: '',
    }));

    await user.click(screen.getByRole('button', { name: 'Hapus sesi Basis Data' }));
    await waitFor(() => expect(plannerState.current.sessions.remove).toHaveBeenCalledWith(1));
  });

  it('filters tasks and executes create, toggle, and delete actions', async () => {
    const user = userEvent.setup();
    renderPage(<TasksPage />, '/tugas');

    expect(screen.getByText('1 tugas belum selesai dari 2')).toBeInTheDocument();
    expect(screen.getByText('Quiz')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aktif' }));
    expect(screen.getByText('Laporan')).toBeInTheDocument();
    expect(screen.queryByText('Quiz')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Judul tugas'), 'Presentasi');
    await user.type(screen.getByLabelText('Mata kuliah (opsional)'), 'Basis Data');
    await user.click(screen.getByRole('button', { name: 'Tambah Tugas' }));
    await waitFor(() => expect(plannerState.current.tasks.create).toHaveBeenCalledWith({
      title: 'Presentasi',
      course: 'Basis Data',
      dueDate: '',
      remindAt: '',
    }));

    await user.click(screen.getByRole('checkbox', { name: 'Tandai selesai: Laporan' }));
    await waitFor(() => expect(plannerState.current.tasks.update).toHaveBeenCalledWith(1, { done: true }));
    await user.click(screen.getByRole('button', { name: 'Hapus tugas Laporan' }));
    await waitFor(() => expect(plannerState.current.tasks.remove).toHaveBeenCalledWith(1));
  });

  it('shows task loading and error states with retry', async () => {
    plannerState.current.tasks.status = 'loading';
    const { rerender } = renderPage(<TasksPage />, '/tugas');
    expect(screen.getByText('Memuat data...')).toBeInTheDocument();

    plannerState.current.tasks.status = 'error';
    plannerState.current.tasks.error = new Error('Tugas gagal');
    rerender(<MemoryRouter initialEntries={['/tugas']}><TasksPage /></MemoryRouter>);
    expect(screen.getByText('Tugas gagal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(plannerState.current.tasks.reload).toHaveBeenCalledOnce();
  });

  it('covers reminder settings and alarm actions', async () => {
    const user = userEvent.setup();
    renderPage(<RemindersPage />, '/pengingat');

    expect(screen.getByText(/Bunyi alarm: aktif/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aktifkan pengingat' }));
    await user.click(screen.getByRole('button', { name: 'Tes bunyi' }));
    expect(reminderControls.enable).toHaveBeenCalledOnce();
    expect(reminderControls.testRing).toHaveBeenCalledOnce();

    await user.selectOptions(screen.getByLabelText('Ingatkan kuliah sebelum mulai'), '15');
    await waitFor(() => expect(plannerState.current.settings.updateReminderLead).toHaveBeenCalledWith(15));

    await user.type(screen.getByLabelText('Nama alarm'), 'Belajar malam');
    await user.type(screen.getByLabelText('Jam alarm'), '21:30');
    await user.click(screen.getByLabelText('Sen'));
    await user.click(screen.getByRole('button', { name: 'Tambah Alarm' }));
    await waitFor(() => expect(plannerState.current.alarms.create).toHaveBeenCalledWith({
      label: 'Belajar malam',
      time: '21:30',
      days: [0],
    }));

    await user.click(screen.getByRole('checkbox', { name: 'Aktifkan alarm Belajar' }));
    await waitFor(() => expect(plannerState.current.alarms.update).toHaveBeenCalledWith(3, { enabled: false }));
    await user.click(screen.getByRole('button', { name: 'Hapus alarm Belajar' }));
    await waitFor(() => expect(plannerState.current.alarms.remove).toHaveBeenCalledWith(3));
  });

  it('shows reminder loading and error states with retry', async () => {
    plannerState.current.alarms.status = 'loading';
    const { rerender } = renderPage(<RemindersPage />, '/pengingat');
    expect(screen.getByText('Memuat data...')).toBeInTheDocument();

    plannerState.current.alarms.status = 'error';
    plannerState.current.alarms.error = new Error('Alarm gagal');
    rerender(<MemoryRouter initialEntries={['/pengingat']}><RemindersPage /></MemoryRouter>);
    expect(screen.getByText('Alarm gagal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(plannerState.current.alarms.reload).toHaveBeenCalledOnce();
  });

  it('updates the title when navigating to a missing page and provides a dashboard link', () => {
    render(
      <MemoryRouter initialEntries={['/missing']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(document.title).toBe('Halaman tidak ditemukan - Study Planner');
    expect(screen.getByRole('heading', { name: 'Halaman tidak ditemukan', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali ke Dashboard' })).toHaveAttribute('href', '/');
  });
});
