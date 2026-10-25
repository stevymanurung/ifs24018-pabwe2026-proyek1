import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isNotificationSupported,
  readNotificationPermission,
  requestNotificationPermission,
  showNotification,
} from './notifications.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('notification helpers', () => {
  it('reports unsupported browsers and avoids requesting permission or showing notifications', async () => {
    vi.stubGlobal('Notification', undefined);

    expect(isNotificationSupported()).toBe(false);
    expect(readNotificationPermission()).toBe('unsupported');
    expect(await requestNotificationPermission()).toBe('unsupported');
    expect(() => showNotification({ title: 'Alarm', text: 'Mulai belajar' })).not.toThrow();
  });

  it('reads and requests default permission', async () => {
    class BrowserNotification {
      static permission = 'default';
      static requestPermission = vi.fn().mockResolvedValue('granted');
    }
    vi.stubGlobal('Notification', BrowserNotification);

    expect(isNotificationSupported()).toBe(true);
    expect(readNotificationPermission()).toBe('default');
    await expect(requestNotificationPermission()).resolves.toBe('granted');
    expect(BrowserNotification.requestPermission).toHaveBeenCalledOnce();
  });

  it('keeps current permission when a request fails and only displays when granted', async () => {
    const notificationSpy = vi.fn();
    class BrowserNotification {
      static permission = 'denied';
      static requestPermission = vi.fn().mockRejectedValue(new Error('Permission unavailable'));

      constructor(title, options) {
        notificationSpy(title, options);
      }
    }
    vi.stubGlobal('Notification', BrowserNotification);

    await expect(requestNotificationPermission()).resolves.toBe('denied');
    expect(BrowserNotification.requestPermission).not.toHaveBeenCalled();
    showNotification({ title: 'Alarm', text: 'Mulai belajar' });
    expect(notificationSpy).not.toHaveBeenCalled();

    BrowserNotification.permission = 'granted';
    showNotification({ title: 'Alarm', text: 'Mulai belajar' });
    expect(notificationSpy).toHaveBeenCalledWith('Alarm', { body: 'Mulai belajar' });
  });

  it('does not let a rejected permission request interrupt the reminder flow', async () => {
    class BrowserNotification {
      static permission = 'default';
      static requestPermission = vi.fn().mockRejectedValue(new Error('Browser rejected the request'));
    }
    vi.stubGlobal('Notification', BrowserNotification);

    await expect(requestNotificationPermission()).resolves.toBe('default');
  });

  it('ignores notification constructor failures', () => {
    class BrowserNotification {
      static permission = 'granted';

      constructor() {
        throw new Error('Notifications are blocked');
      }
    }
    vi.stubGlobal('Notification', BrowserNotification);

    expect(() => showNotification({ title: 'Alarm', text: 'Mulai belajar' })).not.toThrow();
  });
});
