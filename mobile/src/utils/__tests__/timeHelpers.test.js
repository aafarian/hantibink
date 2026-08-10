import { formatRelativeTime, formatLastSeen } from '../timeHelpers';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-09T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null for missing timestamps', () => {
    expect(formatRelativeTime(null)).toBeNull();
    expect(formatRelativeTime(undefined)).toBeNull();
  });

  it('formats sub-minute as "Just now"', () => {
    expect(formatRelativeTime(new Date('2026-08-09T11:59:30Z'))).toBe('Just now');
  });

  it('formats minutes, hours, and days', () => {
    expect(formatRelativeTime(new Date('2026-08-09T11:15:00Z'))).toBe('45m ago');
    expect(formatRelativeTime(new Date('2026-08-09T07:00:00Z'))).toBe('5h ago');
    expect(formatRelativeTime(new Date('2026-08-06T12:00:00Z'))).toBe('3d ago');
  });

  it('falls back to a month/day date beyond a week', () => {
    const result = formatRelativeTime(new Date('2026-07-01T12:00:00Z'));
    expect(result).toMatch(/Jul/);
  });
});

describe('formatLastSeen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-09T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null for missing dates', () => {
    expect(formatLastSeen(null)).toBeNull();
  });

  it('covers the full ladder of units', () => {
    expect(formatLastSeen(new Date('2026-08-09T11:59:45Z'))).toBe('Last seen just now');
    expect(formatLastSeen(new Date('2026-08-09T11:30:00Z'))).toBe('Last seen 30m ago');
    expect(formatLastSeen(new Date('2026-08-09T06:00:00Z'))).toBe('Last seen 6h ago');
    expect(formatLastSeen(new Date('2026-08-05T12:00:00Z'))).toBe('Last seen 4d ago');
    expect(formatLastSeen(new Date('2026-07-20T12:00:00Z'))).toBe('Last seen 2w ago');
    expect(formatLastSeen(new Date('2026-05-09T12:00:00Z'))).toBe('Last seen 3mo ago');
    expect(formatLastSeen(new Date('2024-08-09T12:00:00Z'))).toBe('Last seen 2y ago');
  });
});
