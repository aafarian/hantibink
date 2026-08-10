import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import Logger from '../utils/logger';

const UpdateContext = createContext(null);

export const useUpdate = () => {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useUpdate must be used within an UpdateProvider');
  }
  return context;
};

export const UpdateProvider = ({ children }) => {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isReadyToInstall, setIsReadyToInstall] = useState(false);

  const checkForUpdate = useCallback(async () => {
    // Skip in development mode - expo-updates only works in production builds
    if (__DEV__) {
      Logger.debug('Skipping update check in development mode');
      return;
    }

    try {
      Logger.info('Checking for updates...');
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        Logger.info('Update available, downloading in background...');
        setIsUpdateAvailable(true);
        setIsDownloading(true);

        // Download the update in background
        const fetchResult = await Updates.fetchUpdateAsync();
        setIsDownloading(false);

        if (fetchResult.isNew) {
          Logger.success('Update downloaded and ready to install');
          setIsReadyToInstall(true);
        }
      } else {
        Logger.info('App is up to date');
      }
    } catch (error) {
      Logger.error('Error checking for updates:', error);
      setIsDownloading(false);
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (!isReadyToInstall) {
      Logger.warn('No update ready to install');
      return;
    }

    try {
      Logger.info('Applying update and restarting...');
      await Updates.reloadAsync();
    } catch (error) {
      Logger.error('Error applying update:', error);
    }
  }, [isReadyToInstall]);

  const dismissUpdate = useCallback(() => {
    setIsUpdateAvailable(false);
    setIsReadyToInstall(false);
  }, []);

  // Check for updates on mount AND whenever the app returns to the
  // foreground (mount-only meant long-lived sessions never saw new OTAs)
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    checkForUpdate();

    const subscription = AppState.addEventListener('change', nextState => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        checkForUpdate();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [checkForUpdate]);

  const value = useMemo(
    () => ({
      isUpdateAvailable,
      isDownloading,
      isReadyToInstall,
      checkForUpdate,
      applyUpdate,
      dismissUpdate,
    }),
    [isUpdateAvailable, isDownloading, isReadyToInstall, checkForUpdate, applyUpdate, dismissUpdate]
  );

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
};

export default UpdateContext;
