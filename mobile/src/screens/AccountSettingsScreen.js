import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ApiDataService from '../services/ApiDataService';
import Logger from '../utils/logger';
import { theme } from '../styles/theme';
import ScreenWrapper from '../components/shared/ScreenWrapper';

const AccountSettingsScreen = ({ navigation }) => {
  const { logout, userProfile } = useAuth();
  const { showSuccess, showError } = useToast();

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
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
        </View>

        <View style={styles.settingsContainer}>
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
          <Ionicons name="information-circle-outline" size={20} color="#999" />
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
    backgroundColor: theme.colors.primary,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#666',
  },
  dangerSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  dangerSectionTitle: {
    color: '#FF3B30',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
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
    color: '#666',
  },
  accountInfoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
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
    borderBottomColor: '#f0f0f0',
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
    color: '#333',
  },
  destructiveLabel: {
    color: '#FF3B30',
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
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
    color: '#999',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
});

export default AccountSettingsScreen;
