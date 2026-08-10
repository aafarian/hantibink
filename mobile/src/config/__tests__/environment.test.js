/**
 * Regression tests for environment resolution.
 *
 * The old implementation read Constants.expoConfig.releaseChannel (a
 * classic-updates field that is always undefined under EAS Update) and fell
 * through to DEV config — meaning production builds could point at
 * localhost. The contract now: non-dev builds default to PROD.
 */

const loadEnvironment = ({ dev, channel }) => {
  let env;
  jest.isolateModules(() => {
    jest.doMock('expo-updates', () => ({ channel }));
    global.__DEV__ = dev;
    env = require('../environment').getEnvVars();
  });
  return env;
};

describe('environment resolution', () => {
  const originalDev = global.__DEV__;

  afterEach(() => {
    global.__DEV__ = originalDev;
    jest.dontMock('expo-updates');
  });

  it('uses dev config (port 4242) in development', () => {
    const env = loadEnvironment({ dev: true, channel: undefined });
    expect(env.apiUrl).toContain('4242');
    expect(env.apiUrl).toContain('localhost');
  });

  it('uses prod config on the production channel', () => {
    const env = loadEnvironment({ dev: false, channel: 'production' });
    expect(env.apiUrl).not.toContain('localhost');
    expect(env.apiUrl).toContain('https://');
  });

  it('uses staging config on the staging channel', () => {
    const env = loadEnvironment({ dev: false, channel: 'staging' });
    expect(env.apiUrl).toContain('staging');
  });

  it('FAIL-SAFE: non-dev build with no channel resolves to prod, never localhost', () => {
    const env = loadEnvironment({ dev: false, channel: undefined });
    expect(env.apiUrl).not.toContain('localhost');
    expect(env.apiUrl).toContain('https://');
  });
});
