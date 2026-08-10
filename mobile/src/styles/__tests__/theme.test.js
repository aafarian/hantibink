import { theme } from '../theme';
import { fontMap } from '../fonts';

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

  it('every fontFamily value is a font that App.js actually loads', () => {
    const loadedFonts = Object.keys(fontMap);
    const families = Object.entries(theme.typography.fontFamily);
    expect(families.length).toBeGreaterThan(0);
    families.forEach(([_role, family]) => {
      expect(loadedFonts).toContain(family);
    });
  });

  it('exposes the semantic typography roles', () => {
    const { fontFamily } = theme.typography;
    ['display', 'heading', 'headingLight', 'body', 'bodyMedium', 'label'].forEach(role => {
      expect(fontFamily[role]).toBeDefined();
    });
    // Display/heading are Outfit; body/label are DM Sans
    expect(fontFamily.display).toMatch(/^Outfit_/);
    expect(fontFamily.heading).toMatch(/^Outfit_/);
    expect(fontFamily.body).toMatch(/^DMSans_/);
    expect(fontFamily.label).toMatch(/^DMSans_/);
  });

  it('keeps the brand primary current (no stale #D32F2F)', () => {
    const serialized = JSON.stringify(theme);
    expect(serialized).not.toContain('#D32F2F');
    expect(serialized).not.toContain('211, 47, 47');
  });
});
