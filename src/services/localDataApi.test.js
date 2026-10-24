import { beforeEach, describe, expect, it } from 'vitest';
import { registerLocalAccount } from './localAuth.js';
import { requestLocalApi, LOCAL_DATA_KEY } from './localDataApi.js';

describe('local account data API', () => {
  beforeEach(async () => {
    globalThis.localStorage.clear();
    const account = await registerLocalAccount({
      name: 'Test User',
      email: 'local@example.com',
      password: 'password123',
    });
    globalThis.localStorage.setItem('study-planner-token', account.token);
  });

  it('starts empty and persists each account task changes locally', () => {
    const before = requestLocalApi('/tasks');
    expect(before).toHaveLength(0);
    const created = requestLocalApi('/tasks', {
      method: 'POST',
      body: { title: 'Tugas baru', course: '', dueDate: '', remindAt: '' },
    });
    requestLocalApi(`/tasks/${created.id}`, { method: 'PATCH', body: { done: true } });

    expect(requestLocalApi('/tasks?status=done')).toContainEqual(expect.objectContaining({
      id: created.id,
      title: 'Tugas baru',
      done: true,
    }));
    expect(globalThis.localStorage.getItem(`${LOCAL_DATA_KEY}:${accountId()}`)).toContain('Tugas baru');
  });

  it('supports schedule, alarm, and reminder-setting changes', () => {
    const session = requestLocalApi('/sessions', {
      method: 'POST',
      body: { course: 'Kegiatan', day: 5, start: '09:00', end: '10:00', room: '' },
    });
    const alarm = requestLocalApi('/alarms', {
      method: 'POST',
      body: { label: 'Alarm belajar', time: '08:00', days: [0, 2] },
    });
    requestLocalApi(`/alarms/${alarm.id}`, { method: 'PATCH', body: { enabled: false } });
    requestLocalApi('/settings', { method: 'PUT', body: { reminderLead: 15 } });

    expect(requestLocalApi('/sessions')).toContainEqual(expect.objectContaining({ id: session.id }));
    expect(requestLocalApi('/alarms')).toContainEqual(expect.objectContaining({ id: alarm.id, enabled: false }));
    expect(requestLocalApi('/settings')).toEqual({ reminderLead: 15 });
  });

  it('builds dashboard summaries and rejects conflicting schedules', () => {
    requestLocalApi('/sessions', {
      method: 'POST',
      body: { course: 'Pemrograman Web', day: 0, start: '09:00', end: '10:00', room: '' },
    });
    const dashboard = requestLocalApi('/dashboard?now=2026-10-25T08%3A00');

    expect(dashboard.totals.weeklyHours).toBe(1);
    expect(dashboard.today.dayName).toBe('Minggu');
    expect(dashboard.tasksPerCourse).toEqual([]);
    expect(() => requestLocalApi('/sessions', {
      method: 'POST',
      body: { course: 'Bentrok', day: 0, start: '09:30', end: '10:00', room: '' },
    })).toThrowError(/Bentrok dengan/);
  });
});

function accountId() {
  return globalThis.localStorage.getItem('study-planner-token').split(':').slice(1).join(':');
}
