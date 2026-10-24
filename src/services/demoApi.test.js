import { beforeEach, describe, expect, it } from 'vitest';
import { requestDemoApi } from './demoApi.js';

describe('local demo API', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('loads sample data and persists task changes locally', () => {
    const before = requestDemoApi('/tasks');
    expect(before).toHaveLength(3);
    const created = requestDemoApi('/tasks', {
      method: 'POST',
      body: { title: 'Tugas demo baru', course: '', dueDate: '', remindAt: '' },
    });
    requestDemoApi(`/tasks/${created.id}`, { method: 'PATCH', body: { done: true } });

    expect(requestDemoApi('/tasks?status=done')).toContainEqual(expect.objectContaining({
      id: created.id,
      title: 'Tugas demo baru',
      done: true,
    }));
    expect(globalThis.localStorage.getItem('study-planner-demo-data')).toContain('Tugas demo baru');
  });

  it('supports schedule, alarm, and reminder-setting changes', () => {
    const session = requestDemoApi('/sessions', {
      method: 'POST',
      body: { course: 'Kegiatan demo', day: 5, start: '09:00', end: '10:00', room: '' },
    });
    const alarm = requestDemoApi('/alarms', {
      method: 'POST',
      body: { label: 'Alarm demo', time: '08:00', days: [0, 2] },
    });
    requestDemoApi(`/alarms/${alarm.id}`, { method: 'PATCH', body: { enabled: false } });
    requestDemoApi('/settings', { method: 'PUT', body: { reminderLead: 15 } });

    expect(requestDemoApi('/sessions')).toContainEqual(expect.objectContaining({ id: session.id }));
    expect(requestDemoApi('/alarms')).toContainEqual(expect.objectContaining({ id: alarm.id, enabled: false }));
    expect(requestDemoApi('/settings')).toEqual({ reminderLead: 15 });
  });

  it('builds dashboard summaries and rejects conflicting schedules', () => {
    const dashboard = requestDemoApi('/dashboard?now=2026-10-25T08%3A00');

    expect(dashboard.totals.weeklyHours).toBeGreaterThan(0);
    expect(dashboard.today.dayName).toBe('Minggu');
    expect(dashboard.tasksPerCourse[0]).toHaveProperty('pending');
    expect(() => requestDemoApi('/sessions', {
      method: 'POST',
      body: { course: 'Bentrok', day: 0, start: '09:30', end: '10:00', room: '' },
    })).toThrowError(/Bentrok dengan/);
  });
});
