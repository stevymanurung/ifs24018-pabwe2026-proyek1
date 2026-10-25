import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock, putMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('../services/httpClient.js', () => ({
  http: {
    get: getMock,
    post: postMock,
    put: putMock,
    patch: patchMock,
    delete: deleteMock,
  },
}));

import { PlannerProvider } from './PlannerProvider.jsx';
import { usePlanner } from '../hooks/usePlanner.js';

const session = { id: 1, course: 'Basis Data', day: 0, start: '08:00', end: '10:00', room: 'A1' };
const task = { id: 2, title: 'Laporan', done: false };
const alarm = { id: 3, label: 'Belajar', time: '20:00', days: [0], enabled: true };
const dashboard = { totals: { done: 0, overdue: 0, pending: 1, weeklyHours: 2 } };

function wrapper({ children }) {
  return <PlannerProvider>{children}</PlannerProvider>;
}

function responseFor(path) {
  if (path === '/sessions') return [session];
  if (path === '/tasks') return [task];
  if (path === '/alarms') return [alarm];
  if (path === '/settings') return { reminderLead: 15 };
  if (path.startsWith('/dashboard?')) return dashboard;
  throw new Error(`Unexpected GET path: ${path}`);
}

describe('PlannerProvider data hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation((path) => Promise.resolve(responseFor(path)));
    postMock.mockResolvedValue({ id: 4 });
    putMock.mockResolvedValue({ reminderLead: 30 });
    patchMock.mockResolvedValue({ ...task, done: true });
    deleteMock.mockResolvedValue(null);
  });

  it('loads collection, settings, and dashboard data through the provider', async () => {
    const { result } = renderHook(() => usePlanner(), { wrapper });

    await waitFor(() => expect(result.current.dashboard.status).toBe('ready'));
    expect(result.current.sessions.items).toEqual([session]);
    expect(result.current.tasks.items).toEqual([task]);
    expect(result.current.alarms.items).toEqual([alarm]);
    expect(result.current.settings.reminderLead).toBe(15);
    expect(result.current.dashboard.data).toEqual(dashboard);
    const signalOption = { signal: expect.any(AbortSignal) };
    expect(getMock).toHaveBeenCalledWith('/sessions', signalOption);
    expect(getMock).toHaveBeenCalledWith('/tasks', signalOption);
    expect(getMock).toHaveBeenCalledWith('/alarms', signalOption);
    expect(getMock).toHaveBeenCalledWith('/settings', signalOption);
    expect(getMock).toHaveBeenCalledWith(expect.stringMatching(/^\/dashboard\?now=/), signalOption);
  });

  it('submits collection mutations and reloads the server-backed list', async () => {
    const { result } = renderHook(() => usePlanner(), { wrapper });
    await waitFor(() => expect(result.current.sessions.status).toBe('ready'));

    await act(async () => {
      await result.current.sessions.create({ course: 'Pemrograman' });
      await result.current.tasks.update(2, { done: true });
      await result.current.alarms.remove(3);
      await result.current.settings.updateReminderLead(30);
    });

    expect(postMock).toHaveBeenCalledWith('/sessions', { course: 'Pemrograman' });
    expect(patchMock).toHaveBeenCalledWith('/tasks/2', { done: true });
    expect(deleteMock).toHaveBeenCalledWith('/alarms/3');
    expect(putMock).toHaveBeenCalledWith('/settings', { reminderLead: 30 });
    expect(getMock.mock.calls.filter(([path]) => path === '/sessions')).toHaveLength(2);
    expect(getMock.mock.calls.filter(([path]) => path === '/tasks')).toHaveLength(2);
    expect(getMock.mock.calls.filter(([path]) => path === '/alarms')).toHaveLength(2);
  });

  it('exposes collection and dashboard errors and reloads on request', async () => {
    getMock.mockImplementation((path) => {
      if (path === '/sessions' || path.startsWith('/dashboard?')) return Promise.reject(new Error('Server tidak tersedia'));
      return Promise.resolve(responseFor(path));
    });
    const { result } = renderHook(() => usePlanner(), { wrapper });

    await waitFor(() => expect(result.current.sessions.status).toBe('error'));
    expect(result.current.sessions.error.message).toBe('Server tidak tersedia');
    expect(result.current.dashboard.status).toBe('error');
    expect(result.current.dashboard.error.message).toBe('Server tidak tersedia');

    await act(async () => result.current.sessions.reload());
    expect(getMock.mock.calls.filter(([path]) => path === '/sessions')).toHaveLength(2);
  });
});
