import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useToast } from '../contexts/ToastContext';
import apiClient from '../services/ApiClient';
import Logger from '../utils/logger';
import { ErrorScreen } from '../components/ErrorScreen';
import { theme } from '../styles/theme';
import ScreenWrapper from '../components/shared/ScreenWrapper';

const NotificationSettingsScreen = ({ navigation }) => {
  const { showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [settings, setSettings] = useState({
    messages: true,
    matches: true,
    likes: true,
  });

  const loadSettings = useCallback(async () => {
    try {
      setError(false);
      setLoading(true);
      const response = await apiClient.getNotificationSettings();
      if (response.success && response.data) {
        setSettings(response.data);
      }
    } catch (err) {
      Logger.error('Failed to load notification settings:', err);
      showError('Failed to load settings');
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSetting = async (key, value) => {
    const previousSettings = { ...settings };

    // Optimistic update - switch provides visual feedback, no toast needed
    setSettings(prev => ({ ...prev, [key]: value }));

    try {
      const response = await apiClient.updateNotificationSettings({ [key]: value });
      if (!response.success) {
        // Revert on failure
        setSettings(previousSettings);
        showError(response.message || 'Failed to update settings');
      }
      // Silent success - the switch position is the feedback
    } catch (err) {
      Logger.error('Failed to update notification settings:', err);
      setSettings(previousSettings);
      showError('Failed to update settings');
    }
  };

  const renderToggle = (icon, label, description, key) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={24} color={theme.colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={settings[key]}
        onValueChange={value => updateSetting(key, value)}
        trackColor={{ false: '#E5E5EA', true: theme.colors.primary }}
        thumbColor={settings[key] ? theme.colors.text.white : '#f4f3f4'}
      />
    </View>
  );

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (error) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
        <ErrorScreen message="Failed to load notification settings" onRetry={loadSettings} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>
          <Text style={styles.sectionDescription}>
            Choose which notifications you want to receive
          </Text>
        </View>

        <View style={styles.settingsContainer}>
          {renderToggle(
            'chatbubble',
            'Messages',
            'Get notified when you receive a new message',
            'messages'
          )}

          {renderToggle('heart', 'Matches', 'Get notified when you match with someone', 'matches')}

          {renderToggle('star', 'Likes', 'Get notified when someone likes your profile', 'likes')}
        </View>

        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.text.muted} />
          <Text style={styles.infoText}>
            You can also manage notifications in your device settings
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.tertiary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  settingDescription: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 20,
  },
  infoText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    marginLeft: 8,
    flex: 1,
  },
});

export default NotificationSettingsScreen;
