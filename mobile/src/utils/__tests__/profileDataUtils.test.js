import {
  parseRelationshipType,
  formatRelationshipType,
  capitalizeFirst,
  formatRelationshipTypes,
} from '../profileDataUtils';

describe('parseRelationshipType', () => {
  it('handles empty values', () => {
    expect(parseRelationshipType(null)).toEqual([]);
    expect(parseRelationshipType('')).toEqual([]);
    expect(parseRelationshipType(undefined)).toEqual([]);
  });

  it('passes arrays through', () => {
    expect(parseRelationshipType(['casual', 'serious'])).toEqual(['casual', 'serious']);
  });

  it('splits comma-separated strings and trims', () => {
    expect(parseRelationshipType('casual, serious , friends')).toEqual([
      'casual',
      'serious',
      'friends',
    ]);
  });

  it('wraps single strings', () => {
    expect(parseRelationshipType('serious')).toEqual(['serious']);
  });

  it('rejects non-string non-array values', () => {
    expect(parseRelationshipType(42)).toEqual([]);
  });
});

describe('formatRelationshipType', () => {
  it('joins arrays and tolerates bad input', () => {
    expect(formatRelationshipType(['a', 'b'])).toBe('a, b');
    expect(formatRelationshipType(null)).toBe('');
    expect(formatRelationshipType('not-array')).toBe('');
  });
});

describe('capitalizeFirst', () => {
  it('capitalizes and lowercases the rest', () => {
    expect(capitalizeFirst('hello')).toBe('Hello');
    expect(capitalizeFirst('HELLO')).toBe('Hello');
  });

  it('passes through falsy/non-string values', () => {
    expect(capitalizeFirst('')).toBe('');
    expect(capitalizeFirst(null)).toBeNull();
  });
});

describe('formatRelationshipTypes', () => {
  it('formats snake_case values for display', () => {
    expect(formatRelationshipTypes('long_term, something_casual')).toEqual([
      'Long Term',
      'Something Casual',
    ]);
  });

  it('handles empty input', () => {
    expect(formatRelationshipTypes(null)).toEqual([]);
  });
});
