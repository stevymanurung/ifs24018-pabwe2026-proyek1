import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { usePlannerMock, useReminderEngineMock } = vi.hoisted(() => ({
  usePlannerMock: vi.fn(),
  useReminderEngineMock: vi.fn(),
}));

vi.mock('../../hooks/usePlanner.js', () => ({
  usePlanner: usePlannerMock,
}));

vi.mock('./useReminderEngine.js', () => ({
  useReminderEngine: useReminderEngineMock,
}));

import { ReminderProvider } from './ReminderProvider.jsx';
import { useReminder } from './useReminder.js';

const controls = {
  soundReady: true,
  permission: 'granted',
  enable: vi.fn(),
  testRing: vi.fn(),
};

function ReminderConsumer() {
  const reminder = useReminder();
  return <output>{`${reminder.permission}:${reminder.soundReady}`}</output>;
}

describe('ReminderProvider', () => {
  it('provides engine controls to its children and mounts the reminder dialog', () => {
    usePlannerMock.mockReturnValue({
      alarms: { items: [] },
      sessions: { items: [] },
      tasks: { items: [] },
      settings: { reminderLead: 10 },
    });
    useReminderEngineMock.mockReturnValue({
      controls,
      ringing: [],
      dismiss: vi.fn(),
      snooze: vi.fn(),
    });

    render(
      <ReminderProvider>
        <ReminderConsumer />
      </ReminderProvider>,
    );

    expect(screen.getByText('granted:true')).toBeInTheDocument();
    expect(screen.getByText('Pengingat')).toBeInTheDocument();
    expect(useReminderEngineMock).toHaveBeenCalledWith({
      alarms: [],
      sessions: [],
      tasks: [],
      lead: 10,
    });
  });
});
