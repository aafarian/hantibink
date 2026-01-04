import { useState, useEffect, useCallback } from 'react';
import * as Application from 'expo-application';
import ApiDataService from '../services/ApiDataService';
import Logger from '../utils/logger';

/**
 * Compare two semantic version strings
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
const compareVersions = (v1, v2) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
};

/**
 * Hook to check if app update is required
 */
const useForceUpdate = () => {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdateRequired, setIsUpdateRequired] = useState(false);
  const [versionConfig, setVersionConfig] = useState(null);
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [isChecking, setIsChecking] = useState(true);

  const checkVersion = useCallback(async () => {
    try {
      setIsChecking(true);

      // Get current app version
      const appVersion = Application.nativeApplicationVersion || '1.0.0';
      setCurrentVersion(appVersion);
      Logger.info(`📱 Current app version: ${appVersion}`);

      // Fetch version requirements from server
      const config = await ApiDataService.checkAppVersion();
      if (!config) {
        Logger.info('📱 No version config received, skipping update check');
        setIsChecking(false);
        return;
      }

      setVersionConfig(config);

      // Check if force update is enabled (kill switch)
      if (config.forceUpdate) {
        Logger.warn('📱 Force update enabled via server config');
        setIsUpdateRequired(true);
        setShowUpdateModal(true);
        setIsChecking(false);
        return;
      }

      // Compare versions
      const comparison = compareVersions(appVersion, config.minVersion);

      if (comparison < 0) {
        // Current version is below minimum required
        Logger.warn(`📱 App version ${appVersion} is below minimum ${config.minVersion}`);
        setIsUpdateRequired(true);
        setShowUpdateModal(true);
      } else if (config.latestVersion && compareVersions(appVersion, config.latestVersion) < 0) {
        // Optional update available
        Logger.info(`📱 Optional update available: ${appVersion} → ${config.latestVersion}`);
        // Don't show modal for optional updates automatically
        // Could be triggered by a "Check for updates" button
      } else {
        Logger.info('📱 App is up to date');
      }
    } catch (error) {
      Logger.error('📱 Error checking app version:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Check version on mount
  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  const dismissModal = useCallback(() => {
    // Only allow dismissing if not required
    if (!isUpdateRequired) {
      setShowUpdateModal(false);
    }
  }, [isUpdateRequired]);

  return {
    showUpdateModal,
    isUpdateRequired,
    versionConfig,
    currentVersion,
    isChecking,
    checkVersion, // Allow manual refresh
    dismissModal,
  };
};

export default useForceUpdate;
