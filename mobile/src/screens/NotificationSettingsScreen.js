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
import { theme } from '../styles/theme';
import ScreenWrapper from '../components/shared/ScreenWrapper';

const NotificationSettingsScreen = ({ navigation }) => {
  const { showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    messages: true,
    matches: true,
    likes: true,
  });

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getNotificationSettings();
      if (response.success && response.data?.data) {
        setSettings(response.data.data);
      }
    } catch (error) {
      Logger.error('Failed to load notification settings:', error);
      showError('Failed to load settings');
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
    } catch (error) {
      Logger.error('Failed to update notification settings:', error);
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
        thumbColor={settings[key] ? '#fff' : '#f4f3f4'}
      />
    </View>
  );

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
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

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
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
          <Ionicons name="information-circle-outline" size={20} color="#999" />
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
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
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
    color: '#333',
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
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
    color: '#999',
    marginLeft: 8,
    flex: 1,
  },
});

export default NotificationSettingsScreen;
