/**
 * Tolerant dotted-numeric version comparison (not full semver).
 *
 * Ordering is defined ONLY for well-formed dotted-numeric versions.
 * Anything malformed anywhere ("2.x", "abc", "1.0.0-beta") compares as
 * equal — a per-segment fallback would let "2.x" order above "1.0.0" on
 * the leading digit alone and raise a false soft-update banner or a
 * non-dismissible force-update modal. Fail open, never nag.
 */

const VERSION_SHAPE = /^\d+(\.\d+)*$/;

/**
 * @returns {number} -1 if a < b, 0 if equal or incomparable, 1 if a > b
 */
export const compareVersions = (a, b) => {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (!VERSION_SHAPE.test(sa) || !VERSION_SHAPE.test(sb)) {
    return 0;
  }
  const pa = sa.split('.');
  const pb = sb.split('.');
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = Number(pa[i] ?? '0');
    const nb = Number(pb[i] ?? '0');
    if (na !== nb) {
      return na < nb ? -1 : 1;
    }
  }
  return 0;
};

/**
 * Overlay a platform's override block onto the flat version config.
 *
 * The server may carry `platforms: { ios: {...}, android: {...} }` where
 * each block overrides the global fields for that platform only — so an
 * Android-only release never raises the update banner on iOS. Configs
 * without a block for this platform pass through unchanged (old servers,
 * platform not overridden).
 *
 * @param {object|null} config - Raw config from /health/app-version
 * @param {string} platform - Platform.OS ('ios' | 'android')
 * @returns {object|null} Flat config with platform overrides applied
 */
export const mergePlatformConfig = (config, platform) => {
  if (!config || typeof config !== 'object') {
    return null;
  }
  const override = config.platforms?.[platform];
  if (!override || typeof override !== 'object') {
    return config;
  }
  return { ...config, ...override };
};

/**
 * Derive the update state from the installed version and server config.
 * Missing/malformed config fails open to 'none' — never nags.
 *
 * @param {string} installed - The running app's version
 * @param {{minVersion?: string, latestVersion?: string, forceUpdate?: boolean}|null} config
 * @returns {'none'|'available'|'required'}
 */
export const updateState = (installed, config) => {
  if (!config) {
    return 'none';
  }
  if (config.forceUpdate) {
    return 'required';
  }
  if (config.minVersion && compareVersions(installed, config.minVersion) < 0) {
    return 'required';
  }
  if (config.latestVersion && compareVersions(installed, config.latestVersion) < 0) {
    return 'available';
  }
  return 'none';
};
