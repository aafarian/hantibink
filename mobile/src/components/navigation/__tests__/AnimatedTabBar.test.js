import { TAB_ICONS } from '../AnimatedTabBar';

describe('AnimatedTabBar TAB_ICONS', () => {
  it('maps exactly the four real tab routes (regression: phantom API Test tab)', () => {
    expect(Object.keys(TAB_ICONS).sort()).toEqual(
      ['Liked You', 'Messages', 'People', 'Profile'].sort()
    );
  });

  it('every entry has active and inactive icon names', () => {
    Object.values(TAB_ICONS).forEach(entry => {
      expect(typeof entry.active).toBe('string');
      expect(typeof entry.inactive).toBe('string');
      expect(entry.inactive).toMatch(/-outline$/);
    });
  });
});
