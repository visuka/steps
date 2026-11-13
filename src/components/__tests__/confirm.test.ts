import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { confirm, confirmDelete, type ConfirmRequest, setConfirmPresenter } from '@/components/confirm';

// Hoisted above the imports by babel-jest; the alert is only called later, inside the tests.
const mockAlert = jest.fn();
jest.mock('react-native', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) }, Platform: { OS: 'android' } }));

afterEach(() => {
  setConfirmPresenter(null);
  mockAlert.mockReset();
});

describe('confirm', () => {
  it("goes to the app's own dialog once the host is mounted", () => {
    const shown: ConfirmRequest[] = [];
    setConfirmPresenter((r) => shown.push(r));
    const yes = jest.fn();
    confirm('Sign out?', 'Your data stays on this phone.', yes, 'Sign out');
    expect(mockAlert).not.toHaveBeenCalled();
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ title: 'Sign out?', message: 'Your data stays on this phone.', action: 'Sign out' });
    expect(yes).not.toHaveBeenCalled();
    shown[0].onYes();
    expect(yes).toHaveBeenCalledTimes(1);
  });

  it('names the confirming button Delete by default', () => {
    const shown: ConfirmRequest[] = [];
    setConfirmPresenter((r) => shown.push(r));
    confirm('Delete all app data?', 'Data in your health app stays.', () => undefined);
    expect(shown[0].action).toBe('Delete');
  });

  it("falls back to the system alert before the host is mounted, and after it's gone", () => {
    const yes = jest.fn();
    confirm('Delete this walk?', 'Its route goes too.', yes);
    expect(mockAlert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = mockAlert.mock.calls[0] as unknown as [string, string, { text: string; onPress?: () => void }[]];
    expect([title, message]).toEqual(['Delete this walk?', 'Its route goes too.']);
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Delete']);
    buttons[1].onPress?.();
    expect(yes).toHaveBeenCalledTimes(1);
  });

  it('asks the same short question for every journal entry', () => {
    const shown: ConfirmRequest[] = [];
    setConfirmPresenter((r) => shown.push(r));
    confirmDelete('night', () => undefined);
    confirmDelete('reading', () => undefined);
    expect(shown.map((r) => r.title)).toEqual(['Delete this night?', 'Delete this reading?']);
    expect(shown.every((r) => r.message === "This can't be undone.")).toBe(true);
  });
});
