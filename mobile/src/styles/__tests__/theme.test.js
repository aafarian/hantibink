import { theme } from '../theme';

describe('theme integrity', () => {
  it('exposes the token groups every component relies on', () => {
    expect(theme.colors).toBeDefined();
    expect(theme.colors.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(theme.colors.text.primary).toBeDefined();
    expect(theme.colors.background.primary).toBeDefined();
    expect(theme.typography.sizes).toBeDefined();
    expect(theme.spacing).toBeDefined();
    expect(theme.borderRadius).toBeDefined();
    expect(theme.animation.durations).toBeDefined();
  });

  it('has a complete fontFamily map of non-empty strings', () => {
    const families = Object.entries(theme.typography.fontFamily);
    expect(families.length).toBeGreaterThan(0);
    families.forEach(([_role, family]) => {
      expect(typeof family).toBe('string');
      expect(family.length).toBeGreaterThan(0);
    });
  });

  it('keeps the brand primary current (no stale #D32F2F)', () => {
    const serialized = JSON.stringify(theme);
    expect(serialized).not.toContain('#D32F2F');
    expect(serialized).not.toContain('211, 47, 47');
  });
});
