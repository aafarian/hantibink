import { compareVersions, mergePlatformConfig, updateState } from '../version';

describe('compareVersions', () => {
  it('orders plain versions', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });

  it('tolerates ragged lengths', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.1', '1.0.9')).toBe(1);
  });

  it('handles double-digit segments numerically', () => {
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
  });

  it('survives junk input without throwing', () => {
    expect(() => compareVersions(null, '1.0.0')).not.toThrow();
    expect(() => compareVersions('abc', '1.0.0')).not.toThrow();
    expect(compareVersions('1.0.0', '1.0.0-beta')).not.toBeNaN();
  });

  it('treats malformed versions as incomparable (fail open)', () => {
    expect(compareVersions('1.0.0', 'not-a-version')).toBe(0);
    expect(compareVersions('abc', 'xyz')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.x')).toBe(0);
    // A malformed SUFFIX must not order on the leading digits — "2.x"
    // treated as newer than 1.0.0 would open the force-update modal
    expect(compareVersions('1.0.0', '2.x')).toBe(0);
    expect(compareVersions('1.beta.2', '1.beta.3')).toBe(0);
  });

  it('malformed server config never produces an update state', () => {
    expect(updateState('1.0.0', { minVersion: '2.x' })).toBe('none');
    expect(updateState('1.0.0', { latestVersion: 'not-a-version' })).toBe('none');
  });
});

describe('mergePlatformConfig', () => {
  const config = {
    minVersion: '1.0.0',
    latestVersion: '1.0.0',
    storeUrls: { ios: 'apple', android: 'play' },
    platforms: { android: { latestVersion: '1.0.1' } },
  };

  it('applies only the matching platform override', () => {
    // Android-only release: android sees the bump, iOS keeps the global
    expect(mergePlatformConfig(config, 'android').latestVersion).toBe('1.0.1');
    expect(mergePlatformConfig(config, 'ios').latestVersion).toBe('1.0.0');
  });

  it('keeps non-overridden fields from the global config', () => {
    const merged = mergePlatformConfig(config, 'android');
    expect(merged.minVersion).toBe('1.0.0');
    expect(merged.storeUrls).toEqual({ ios: 'apple', android: 'play' });
  });

  it('passes configs without platform blocks through unchanged', () => {
    const flat = { latestVersion: '1.2.0' };
    expect(mergePlatformConfig(flat, 'ios')).toBe(flat);
  });

  it('fails open on missing or malformed config', () => {
    expect(mergePlatformConfig(null, 'ios')).toBeNull();
    expect(mergePlatformConfig(undefined, 'ios')).toBeNull();
    expect(
      mergePlatformConfig({ platforms: { ios: 'junk' } }, 'ios').latestVersion
    ).toBeUndefined();
  });

  it('platform override drives the update state', () => {
    const merged = mergePlatformConfig(config, 'android');
    expect(updateState('1.0.0', merged)).toBe('available');
    expect(updateState('1.0.0', mergePlatformConfig(config, 'ios'))).toBe('none');
  });
});

describe('updateState', () => {
  it('is none with missing config (fail open)', () => {
    expect(updateState('1.0.0', null)).toBe('none');
    expect(updateState('1.0.0', {})).toBe('none');
  });

  it('is required below minVersion or with the kill switch', () => {
    expect(updateState('1.0.0', { minVersion: '1.1.0' })).toBe('required');
    expect(updateState('9.9.9', { forceUpdate: true })).toBe('required');
  });

  it('is available between min and latest', () => {
    expect(updateState('1.1.0', { minVersion: '1.0.0', latestVersion: '1.2.0' })).toBe('available');
  });

  it('is none when up to date', () => {
    expect(updateState('1.2.0', { minVersion: '1.0.0', latestVersion: '1.2.0' })).toBe('none');
  });
});
