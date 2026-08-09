import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ApiDataService from '../services/ApiDataService';
import ApiClient from '../services/ApiClient';
import Logger from '../utils/logger';
import useAdminCheck from '../hooks/useAdminCheck';
import GamesApiService from '../services/GamesApiService';
import { theme } from '../styles/theme';
import ScreenWrapper from '../components/shared/ScreenWrapper';

const AccountSettingsScreen = ({ navigation }) => {
  const isAdmin = useAdminCheck();
  const { logout, userProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [isProfilePaused, setIsProfilePaused] = useState(false);
  const [isPauseLoading, setIsPauseLoading] = useState(false);
  const [gamesEnabled, setGamesEnabled] = useState(true);
  const [isGamesLoading, setIsGamesLoading] = useState(false);

  // In-chat games opt-in — chats show the games icon only when BOTH
  // people have this on
  useEffect(() => {
    GamesApiService.getSettings()
      .then(settings => {
        if (settings) {
          setGamesEnabled(!!settings.gamesEnabled);
        }
      })
      .catch(error => Logger.error('Failed to load games setting:', error));
  }, []);

  const applyGamesToggle = useCallback(
    async enabled => {
      setIsGamesLoading(true);
      const previous = gamesEnabled;
      setGamesEnabled(enabled);
      try {
        await GamesApiService.setGamesEnabled(enabled);
        showSuccess(enabled ? 'In-chat games enabled' : 'In-chat games turned off');
      } catch (error) {
        Logger.error('Failed to update games setting:', error);
        setGamesEnabled(previous);
        showError('Could not update the games setting');
      } finally {
        setIsGamesLoading(false);
      }
    },
    [gamesEnabled, showSuccess, showError]
  );

  const handleGamesToggle = useCallback(
    enabled => {
      if (enabled) {
        applyGamesToggle(true);
        return;
      }
      // Turning games off ends every game they're in — worth a heads-up
      Alert.alert(
        'Turn off games?',
        'Any games you have going will end for both players. Your past games stay in your chats.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Turn off', style: 'destructive', onPress: () => applyGamesToggle(false) },
        ]
      );
    },
    [applyGamesToggle]
  );

  // Load pause status on mount
  const loadPauseStatus = useCallback(async () => {
    try {
      const response = await ApiClient.get('/users/profile/pause-status');
      if (response.success) {
        setIsProfilePaused(response.data.isProfilePaused);
      }
    } catch (error) {
      Logger.error('Failed to load pause status:', error);
    }
  }, []);

  useEffect(() => {
    loadPauseStatus();
  }, [loadPauseStatus]);

  const handlePauseToggle = async value => {
    setIsPauseLoading(true);
    try {
      const endpoint = value ? '/users/profile/pause' : '/users/profile/resume';
      const response = await ApiClient.put(endpoint);

      if (response.success) {
        setIsProfilePaused(value);
        showSuccess(
          value
            ? "Profile paused - you won't appear in discovery"
            : "Profile resumed - you're visible again"
        );
      } else {
        showError('Failed to update profile status');
      }
    } catch (error) {
      Logger.error('Failed to toggle pause:', error);
      showError('Failed to update profile status');
    } finally {
      setIsPauseLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: performLogout,
      },
    ]);
  };

  const performLogout = async () => {
    try {
      await logout();
      showSuccess('Logged out successfully');
    } catch (error) {
      Logger.error('Logout error:', error);
      showError(error.message || 'Failed to logout');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This will remove all your data including photos, matches, and messages. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Final Confirmation',
      'This is your last chance. Your account and all data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete Everything',
          style: 'destructive',
          onPress: performDeleteAccount,
        },
      ]
    );
  };

  const performDeleteAccount = async () => {
    try {
      Logger.info('User confirmed account deletion...');

      const result = await ApiDataService.deleteAccount();

      if (result.success) {
        showSuccess('Account deleted successfully');
        Logger.success('Account deleted successfully');
        await logout();
      } else {
        Logger.error('Account deletion failed:', result.error);
        showError(result.error || 'Failed to delete account');
      }
    } catch (error) {
      Logger.error('Account deletion error:', error);
      showError(error.message || 'Failed to delete account');
    }
  };

  const renderSettingItem = (icon, label, description, onPress, destructive = false) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={[styles.settingIcon, destructive && styles.destructiveIcon]}>
        <Ionicons name={icon} size={24} color={destructive ? '#FF3B30' : theme.colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, destructive && styles.destructiveLabel]}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.border.medium} />
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Account Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountInfo}>
            <View style={styles.accountInfoIcon}>
              <Ionicons name="mail" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.accountInfoContent}>
              <Text style={styles.accountInfoLabel}>Email</Text>
              <Text style={styles.accountInfoValue}>{userProfile?.email || 'Not available'}</Text>
            </View>
          </View>
        </View>

        {/* Visibility Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visibility</Text>
        </View>

        <View style={styles.settingsContainer}>
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="eye-off-outline" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Pause Profile</Text>
              <Text style={styles.settingDescription}>
                {isProfilePaused
                  ? "You're hidden from discovery"
                  : 'Hide from discovery temporarily'}
              </Text>
            </View>
            <Switch
              value={isProfilePaused}
              onValueChange={handlePauseToggle}
              disabled={isPauseLoading}
              trackColor={{ false: theme.colors.border.light, true: `${theme.colors.primary}80` }}
              thumbColor={isProfilePaused ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="game-controller-outline" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>In-Chat Games</Text>
              <Text style={styles.settingDescription}>
                {gamesEnabled
                  ? 'Games show in chats when both people allow them'
                  : 'Games are hidden in all your chats'}
              </Text>
            </View>
            <Switch
              value={gamesEnabled}
              onValueChange={handleGamesToggle}
              disabled={isGamesLoading}
              trackColor={{ false: theme.colors.border.light, true: `${theme.colors.primary}80` }}
              thumbColor={gamesEnabled ? theme.colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
        </View>

        <View style={styles.settingsContainer}>
          {renderSettingItem(
            'document-text-outline',
            'Terms of Service',
            'Read our terms of service',
            () => navigation.navigate('Legal', { type: 'terms' })
          )}
          {renderSettingItem(
            'shield-checkmark-outline',
            'Privacy Policy',
            'Read our privacy policy',
            () => navigation.navigate('Legal', { type: 'privacy' })
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
        </View>

        <View style={styles.settingsContainer}>
          {isAdmin &&
            renderSettingItem('shield-outline', 'Admin', 'App administration', () =>
              navigation.navigate('Admin')
            )}
          {renderSettingItem('log-out-outline', 'Logout', 'Sign out of your account', handleLogout)}
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, styles.dangerSection]}>
          <Text style={[styles.sectionTitle, styles.dangerSectionTitle]}>Danger Zone</Text>
          <Text style={styles.sectionDescription}>
            These actions are permanent and cannot be undone
          </Text>
        </View>

        <View style={styles.settingsContainer}>
          {renderSettingItem(
            'trash-outline',
            'Delete Account',
            'Permanently delete your account and all data',
            handleDeleteAccount,
            true
          )}
        </View>

        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.text.muted} />
          <Text style={styles.infoText}>
            Deleting your account will remove all your photos, matches, messages, and profile data.
            This action cannot be reversed.
          </Text>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: theme.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
  },
  dangerSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.background.tertiary,
  },
  dangerSectionTitle: {
    color: '#FF3B30',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  accountInfoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${theme.colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountInfoContent: {
    flex: 1,
  },
  accountInfoLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
  },
  accountInfoValue: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.primary,
    marginTop: 2,
  },
  settingsContainer: {
    paddingHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.tertiary,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${theme.colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  destructiveIcon: {
    backgroundColor: '#FF3B3015',
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.primary,
  },
  destructiveLabel: {
    color: '#FF3B30',
  },
  settingDescription: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 10,
  },
  infoText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
});

export default AccountSettingsScreen;
