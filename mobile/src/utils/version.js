/**
 * Tolerant dotted-numeric version comparison (not full semver).
 *
 * Handles ragged lengths ("1.0" vs "1.0.1") and non-numeric segments
 * (falls back to per-segment string compare) so malformed server config can
 * never make the update UI nag incorrectly or crash.
 */

/**
 * @returns {number} -1 if a < b, 0 if equal, 1 if a > b
 */
export const compareVersions = (a, b) => {
  const pa = String(a ?? '').split('.');
  const pb = String(b ?? '').split('.');
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const sa = pa[i] ?? '0';
    const sb = pb[i] ?? '0';
    const na = Number(sa);
    const nb = Number(sb);
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      if (na !== nb) {
        return na < nb ? -1 : 1;
      }
    } else if (sa !== sb) {
      return sa < sb ? -1 : 1;
    }
  }
  return 0;
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
