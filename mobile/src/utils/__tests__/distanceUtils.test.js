import { kmToMiles, milesToKm, formatDistance, formatDistanceAway } from '../distanceUtils';

describe('kmToMiles / milesToKm', () => {
  it('converts and rounds', () => {
    expect(kmToMiles(10)).toBe(6);
    expect(milesToKm(10)).toBe(16);
  });

  it('returns 0 for invalid input', () => {
    expect(kmToMiles('ten')).toBe(0);
    expect(kmToMiles(NaN)).toBe(0);
    expect(milesToKm(undefined)).toBe(0);
  });
});

describe('formatDistance', () => {
  it('handles null/undefined/negative as unknown', () => {
    expect(formatDistance(null)).toBe('Unknown distance');
    expect(formatDistance(undefined)).toBe('Unknown distance');
    expect(formatDistance(-3)).toBe('Unknown distance');
  });

  it('handles very small distances per preference', () => {
    expect(formatDistance(0.4, 'miles')).toBe('Less than 1 mile');
    expect(formatDistance(0.4, 'km')).toBe('Less than 1 km');
    expect(formatDistance(0.9, 'km')).toBe('1 km'); // rounds up, stays "1 km"
    expect(formatDistance(0.4)).toBe('Less than 1 mile');
  });

  it('formats by preference with pluralization', () => {
    expect(formatDistance(10, 'miles')).toBe('6 miles');
    expect(formatDistance(1.7, 'miles')).toBe('1 mile');
    expect(formatDistance(10, 'km')).toBe('10 km');
    expect(formatDistance(10, 'both')).toBe('6 miles (10 km)');
  });
});

describe('formatDistanceAway', () => {
  it('appends away only for known distances', () => {
    expect(formatDistanceAway(10, 'km')).toBe('10 km away');
    expect(formatDistanceAway(null)).toBe('Unknown distance');
  });
});
