import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  dueRemindersMock,
  makeSnoozeMock,
  pruneFiredMock,
  splitSnoozesMock,
  loadStateMock,
  saveStateMock,
  readPermissionMock,
  requestPermissionMock,
  showNotificationMock,
  createAlarmSoundMock,
  soundMock,
} = vi.hoisted(() => ({
  dueRemindersMock: vi.fn(),
  makeSnoozeMock: vi.fn(),
  pruneFiredMock: vi.fn(),
  splitSnoozesMock: vi.fn(),
  loadStateMock: vi.fn(),
  saveStateMock: vi.fn(),
  readPermissionMock: vi.fn(),
  requestPermissionMock: vi.fn(),
  showNotificationMock: vi.fn(),
  createAlarmSoundMock: vi.fn(),
  soundMock: {
    unlock: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('./engine.js', () => ({
  dueReminders: dueRemindersMock,
  makeSnooze: makeSnoozeMock,
  pruneFired: pruneFiredMock,
  splitSnoozes: splitSnoozesMock,
}));

vi.mock('./firedStore.js', () => ({
  loadReminderState: loadStateMock,
  saveReminderState: saveStateMock,
}));

vi.mock('./notifications.js', () => ({
  readNotificationPermission: readPermissionMock,
  requestNotificationPermission: requestPermissionMock,
  showNotification: showNotificationMock,
}));

vi.mock('./sound.js', () => ({
  createAlarmSound: createAlarmSoundMock,
}));

import { useReminderEngine } from './useReminderEngine.js';

const reminder = { key: 'task:1', title: 'Tugas', text: 'Waktunya mengerjakan tugas' };
const wakeUp = { key: 'snooze:1', title: 'Tunda', text: 'Pengingat yang ditunda' };
const initialData = { alarms: [], sessions: [], tasks: [], lead: 10 };

describe('useReminderEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T10:00:00'));
    vi.clearAllMocks();
    dueRemindersMock.mockReturnValue([]);
    makeSnoozeMock.mockReturnValue({ at: Date.now() + 300_000, key: reminder.key, text: reminder.text });
    pruneFiredMock.mockImplementation((fired) => fired);
    splitSnoozesMock.mockReturnValue({ due: [], pending: [] });
    loadStateMock.mockReturnValue({ fired: {}, snoozes: [] });
    readPermissionMock.mockReturnValue('default');
    requestPermissionMock.mockResolvedValue('granted');
    createAlarmSoundMock.mockReturnValue(soundMock);
    soundMock.unlock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires due reminders, persists state, snoozes them, and dismisses the dialog', () => {
    dueRemindersMock.mockReturnValue([reminder]);
    const { result } = renderHook(() => useReminderEngine(initialData));

    expect(showNotificationMock).toHaveBeenCalledWith(reminder, 0, [reminder]);
    expect(saveStateMock).toHaveBeenCalledWith({
      fired: { [reminder.key]: Date.now() },
      snoozes: [],
    });
    expect(soundMock.start).toHaveBeenCalledOnce();
    expect(result.current.ringing).toEqual([reminder]);

    act(() => result.current.snooze());
    expect(makeSnoozeMock).toHaveBeenCalledWith(reminder, expect.any(Date), 5);
    expect(saveStateMock).toHaveBeenLastCalledWith(expect.objectContaining({
      snoozes: [{ at: Date.now() + 300_000, key: reminder.key, text: reminder.text }],
    }));
    expect(result.current.ringing).toEqual([]);
    expect(soundMock.stop).toHaveBeenCalledOnce();

    act(() => result.current.dismiss());
    expect(result.current.ringing).toEqual([]);
  });

  it('fires snoozed reminders, prunes the stored state, and avoids duplicate ringing items', () => {
    splitSnoozesMock.mockReturnValue({ due: [wakeUp], pending: [] });
    pruneFiredMock.mockReturnValue({ [reminder.key]: Date.now() });
    const { result } = renderHook(() => useReminderEngine(initialData));

    expect(showNotificationMock).toHaveBeenCalledWith(wakeUp, 0, [wakeUp]);
    expect(pruneFiredMock).toHaveBeenCalledWith({}, Date.now());
    expect(result.current.ringing).toEqual([wakeUp]);

    dueRemindersMock.mockReturnValue([wakeUp]);
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(result.current.ringing).toEqual([wakeUp]);
  });

  it('refreshes with current data and unlocks sound on pointer or keyboard interaction', async () => {
    const { result, rerender } = renderHook((data) => useReminderEngine(data), { initialProps: initialData });
    const nextData = { ...initialData, lead: 15, tasks: [{ id: 2 }] };
    rerender(nextData);

    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(dueRemindersMock).toHaveBeenLastCalledWith(nextData, expect.any(Date), {});

    act(() => globalThis.dispatchEvent(new Event('pointerdown')));
    expect(result.current.controls.soundReady).toBe(true);
    act(() => globalThis.dispatchEvent(new Event('keydown')));
    expect(soundMock.unlock).toHaveBeenCalled();

    await act(async () => result.current.controls.enable());
    expect(result.current.controls.permission).toBe('granted');
    expect(requestPermissionMock).toHaveBeenCalledOnce();
  });

  it('checks reminders after becoming visible and skips the check while hidden', () => {
    const { unmount } = renderHook(() => useReminderEngine(initialData));
    dueRemindersMock.mockClear();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });

    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(dueRemindersMock).not.toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(dueRemindersMock).toHaveBeenCalledOnce();

    unmount();
    delete document.hidden;
  });

  it('creates a test ring without snoozing it and cleans up browser listeners and timers', () => {
    const removeListener = vi.spyOn(globalThis, 'removeEventListener');
    const { result, unmount } = renderHook(() => useReminderEngine(initialData));

    act(() => result.current.controls.testRing());
    expect(result.current.ringing).toEqual([{
      key: `test:${Date.now()}`,
      title: 'Tes pengingat',
      text: 'Jika Anda mendengar bunyi, alarm siap dipakai.',
    }]);

    act(() => result.current.snooze());
    expect(makeSnoozeMock).not.toHaveBeenCalled();

    unmount();
    expect(removeListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });
});
