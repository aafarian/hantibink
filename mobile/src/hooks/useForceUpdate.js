import { useState, useEffect, useCallback } from 'react';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiDataService from '../services/ApiDataService';
import Logger from '../utils/logger';
import { updateState } from '../utils/version';

// Dismissals are stored per-version so a NEWER release re-nags once
const DISMISSED_UPDATE_KEY = '@hantibink/dismissedUpdateVersion';

/**
 * Hook to check the server's version config.
 *
 * Two independent outcomes:
 * - required  -> non-dismissible ForceUpdateModal (minVersion / kill switch)
 * - available -> dismissible soft-update banner, dismissal persisted per
 *                latestVersion in AsyncStorage
 */
const useForceUpdate = () => {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdateRequired, setIsUpdateRequired] = useState(false);
  const [showSoftUpdateBanner, setShowSoftUpdateBanner] = useState(false);
  const [versionConfig, setVersionConfig] = useState(null);
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [isChecking, setIsChecking] = useState(true);

  const checkVersion = useCallback(async () => {
    try {
      setIsChecking(true);

      const appVersion = Application.nativeApplicationVersion || '1.0.0';
      setCurrentVersion(appVersion);
      Logger.info(`📱 Current app version: ${appVersion}`);

      const config = await ApiDataService.checkAppVersion();
      if (!config) {
        Logger.info('📱 No version config received, skipping update check');
        return;
      }

      setVersionConfig(config);

      const state = updateState(appVersion, config);

      if (state === 'required') {
        Logger.warn(`📱 Update required: ${appVersion} < ${config.minVersion}`);
        setIsUpdateRequired(true);
        setShowUpdateModal(true);
        setShowSoftUpdateBanner(false);
        return;
      }

      if (state === 'available') {
        const dismissedVersion = await AsyncStorage.getItem(DISMISSED_UPDATE_KEY);
        if (dismissedVersion === config.latestVersion) {
          Logger.info(`📱 Update ${config.latestVersion} available but dismissed`);
        } else {
          Logger.info(`📱 Optional update available: ${appVersion} → ${config.latestVersion}`);
          setShowSoftUpdateBanner(true);
        }
        return;
      }

      Logger.info('📱 App is up to date');
    } catch (error) {
      Logger.error('📱 Error checking app version:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  const dismissModal = useCallback(() => {
    // Only allow dismissing if not required
    if (!isUpdateRequired) {
      setShowUpdateModal(false);
    }
  }, [isUpdateRequired]);

  const dismissSoftUpdate = useCallback(async () => {
    setShowSoftUpdateBanner(false);
    try {
      if (versionConfig?.latestVersion) {
        await AsyncStorage.setItem(DISMISSED_UPDATE_KEY, versionConfig.latestVersion);
      }
    } catch (error) {
      Logger.warn('📱 Could not persist update dismissal:', error);
    }
  }, [versionConfig?.latestVersion]);

  return {
    showUpdateModal,
    isUpdateRequired,
    showSoftUpdateBanner,
    versionConfig,
    currentVersion,
    isChecking,
    checkVersion, // Allow manual refresh
    dismissModal,
    dismissSoftUpdate,
  };
};

export default useForceUpdate;
