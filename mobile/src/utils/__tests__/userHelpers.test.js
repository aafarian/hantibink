import { isUserOnline } from '../userHelpers';

describe('isUserOnline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-09T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is false without a timestamp', () => {
    expect(isUserOnline(null)).toBe(false);
    expect(isUserOnline(undefined)).toBe(false);
  });

  it('is true within the 5-minute window', () => {
    expect(isUserOnline(new Date('2026-08-09T11:57:00Z'))).toBe(true);
    expect(isUserOnline('2026-08-09T11:56:01Z')).toBe(true);
  });

  it('is false at or beyond 5 minutes', () => {
    expect(isUserOnline(new Date('2026-08-09T11:55:00Z'))).toBe(false);
    expect(isUserOnline(new Date('2026-08-09T10:00:00Z'))).toBe(false);
  });
});
