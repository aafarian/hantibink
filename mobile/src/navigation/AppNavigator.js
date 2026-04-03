import React, { useRef, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useUnread } from '../contexts/UnreadContext';
import { LocationProvider } from '../contexts/LocationContext';
import { ToastProvider } from '../contexts/ToastContext';
import LocationPromptModal from '../components/LocationPromptModal';
import Logger from '../utils/logger';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { theme } from '../styles/theme';
import { screenOptions } from './transitions';

// Import components
import AnimatedTabBar from '../components/navigation/AnimatedTabBar';

// Import screens
import ProfileScreen from '../screens/ProfileScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import PeopleScreenOptimized from '../screens/PeopleScreenOptimized';
import FilterScreen from '../screens/FilterScreen';
import LikedYouScreen from '../screens/LikedYouScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ChatScreen from '../screens/ChatScreen';
import PreferencesScreen from '../screens/PreferencesScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import AccountSettingsScreen from '../screens/AccountSettingsScreen';

// Import components
import ProfileSetupModal from '../components/modals/ProfileSetupModal';
import ForceUpdateModal from '../components/ForceUpdateModal';
import UpdateBanner from '../components/shared/UpdateBanner';
import LegalScreen from '../screens/LegalScreen';

// Import hooks
import useForceUpdate from '../hooks/useForceUpdate';

// Import auth navigator
import AuthNavigator from './AuthNavigator';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const PeopleStack = () => {
  return (
    <Stack.Navigator screenOptions={screenOptions.horizontalIOS}>
      <Stack.Screen
        name="PeopleMain"
        component={PeopleScreenOptimized}
        options={{
          title: 'Discover',
          headerStyle: {
            backgroundColor: theme.colors.background.primary,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border.light,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: theme.colors.text.primary,
          headerTitleStyle: {
            fontWeight: 'bold',
            fontFamily: theme.typography.fontFamily.bold,
            color: theme.colors.text.primary,
          },
        }}
      />
      <Stack.Screen
        name="Filter"
        component={FilterScreen}
        options={{
          headerShown: false, // FilterScreen has its own header
        }}
      />
    </Stack.Navigator>
  );
};

const ProfileStack = () => {
  return (
    <Stack.Navigator screenOptions={screenOptions.horizontalIOS}>
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{
          title: 'My Profile',
          headerStyle: {
            backgroundColor: theme.colors.background.primary,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border.light,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: theme.colors.text.primary,
          headerTitleStyle: {
            fontWeight: 'bold',
            fontFamily: theme.typography.fontFamily.bold,
            color: theme.colors.text.primary,
          },
        }}
      />
      <Stack.Screen
        name="ProfileEdit"
        component={ProfileEditScreen}
        options={{
          headerShown: false, // ProfileEditScreen has its own header
        }}
      />
      <Stack.Screen
        name="Preferences"
        component={PreferencesScreen}
        options={{
          headerShown: false, // PreferencesScreen has its own header
        }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          headerShown: false, // NotificationSettingsScreen has its own header
        }}
      />
      <Stack.Screen
        name="AccountSettings"
        component={AccountSettingsScreen}
        options={{
          headerShown: false, // AccountSettingsScreen has its own header
        }}
      />
      <Stack.Screen
        name="Legal"
        component={LegalScreen}
        options={{
          headerShown: false, // LegalScreen has its own header
        }}
      />
    </Stack.Navigator>
  );
};

const MessagesStack = () => {
  return (
    <Stack.Navigator screenOptions={screenOptions.horizontalIOS}>
      <Stack.Screen
        name="MessagesList"
        component={MessagesScreen}
        options={{
          headerShown: true,
          title: 'Messages',
          headerStyle: {
            backgroundColor: theme.colors.background.primary,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border.light,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: theme.colors.text.primary,
          headerTitleStyle: {
            fontWeight: 'bold',
            fontFamily: theme.typography.fontFamily.bold,
            color: theme.colors.text.primary,
          },
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: false, // ChatScreen has its own header
        }}
      />
    </Stack.Navigator>
  );
};

const MainNavigator = () => {
  const { loading, userProfile, refreshUserProfile, user } = useAuth();
  const { unreadConversationCount } = useUnread();
  const [showSetupModal, setShowSetupModal] = React.useState(false);

  // Enable automatic location tracking only when user is authenticated
  useLocationTracking(!!user && !!userProfile, 5); // Update every 5 minutes

  // Auto-modal disabled - users now see guidance on ProfileScreen and can tap to open modal
  // Clear any stale registration flag on mount
  React.useEffect(() => {
    const clearStaleFlags = async () => {
      await AsyncStorage.removeItem('@HantibinkShowOnboarding');
    };
    clearStaleFlags();
  }, []);

  // Memoize tab bar render function to prevent re-renders
  const renderTabBar = useCallback(
    props => <AnimatedTabBar {...props} unreadCount={unreadConversationCount} />,
    [unreadConversationCount]
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <UpdateBanner />
      <Tab.Navigator tabBar={renderTabBar} screenOptions={{ freezeOnBlur: true }}>
        <Tab.Screen
          name="Profile"
          component={ProfileStack}
          options={{ headerShown: false, title: 'My Profile' }}
        />
        <Tab.Screen name="People" component={PeopleStack} options={{ headerShown: false }} />
        <Tab.Screen
          name="Liked You"
          component={LikedYouScreen}
          options={{
            headerShown: true,
            title: 'Liked You',
            headerStyle: {
              backgroundColor: theme.colors.background.primary,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border.light,
              elevation: 0,
              shadowOpacity: 0,
            },
            headerTintColor: theme.colors.text.primary,
            headerTitleStyle: {
              fontWeight: 'bold',
              fontFamily: theme.typography.fontFamily.bold,
              color: theme.colors.text.primary,
            },
          }}
        />
        <Tab.Screen name="Messages" component={MessagesStack} options={{ headerShown: false }} />
      </Tab.Navigator>

      {/* Profile Setup Modal - Shows on app open if profile incomplete */}
      {showSetupModal && (
        <ProfileSetupModal
          visible={showSetupModal}
          onClose={() => {
            // User can dismiss, but it will show again next time they open the app
            setShowSetupModal(false);
          }}
          onComplete={async _data => {
            setShowSetupModal(false);
            // Trigger a single refresh after modal completes
            if (refreshUserProfile) {
              setTimeout(() => {
                refreshUserProfile();
              }, 500);
            }
          }}
          userProfile={userProfile}
        />
      )}
    </>
  );
};

/**
 * Minimum interval between haptic feedback triggers (ms).
 * Prevents double-fires on rapid navigation.
 */
const HAPTIC_DEBOUNCE_MS = 150;

const AppNavigator = () => {
  const { user, userProfile, loading } = useAuth();
  const navigationRef = useRef();
  const notificationResponseListener = useRef();
  const pendingNavigationRef = useRef(null);
  const [isNavigationReady, setIsNavigationReady] = React.useState(false);

  // Refs for navigation transition haptics
  const lastNavigationKeyRef = useRef(null);
  const lastHapticTimeRef = useRef(0);

  // Force update check
  const { showUpdateModal, isUpdateRequired, versionConfig, currentVersion, dismissModal } =
    useForceUpdate();

  // Handle pending navigation when navigation becomes ready
  const handleNavigationReady = React.useCallback(() => {
    setIsNavigationReady(true);
    // Execute any pending navigation
    if (pendingNavigationRef.current && navigationRef.current) {
      const data = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      navigationRef.current.navigate('Messages', {
        screen: 'Chat',
        params: {
          match: {
            matchId: data.matchId,
            otherUser: data.otherUser,
          },
        },
      });
    }
  }, []);

  // Track navigation ready state in a ref so the effect doesn't need to re-run
  const isNavigationReadyRef = useRef(false);
  useEffect(() => {
    isNavigationReadyRef.current = isNavigationReady;
  }, [isNavigationReady]);

  // Handle notification tap to navigate to the correct screen
  useEffect(() => {
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(
      response => {
        const data = response.notification.request.content.data;
        Logger.info('Notification tapped:', data);

        if (data?.type === 'message' && data?.matchId && data?.otherUser) {
          if (isNavigationReadyRef.current && navigationRef.current) {
            // Navigate immediately if ready
            navigationRef.current.navigate('Messages', {
              screen: 'Chat',
              params: {
                match: {
                  matchId: data.matchId,
                  otherUser: data.otherUser,
                },
              },
            });
          } else {
            // Store for later navigation when ready
            pendingNavigationRef.current = data;
          }
        }
      }
    );

    return () => {
      if (notificationResponseListener.current) {
        // Use the remove method on the subscription object
        notificationResponseListener.current.remove();
      }
    };
  }, []);

  // Don't check onboarding flag here - let MainNavigator handle it
  // This was causing a race condition where the flag was being cleared
  // before MainNavigator could check it

  /**
   * Handle navigation state changes and trigger subtle haptic feedback.
   * Uses debouncing to prevent double-fires on rapid navigation.
   * Only fires when navigation actually completes (not on back gesture cancel).
   */
  const handleNavigationStateChange = useCallback(state => {
    if (!state) return;

    // Get the current active route key
    const currentKey = state.routes[state.index]?.key;

    // Skip if this is the same route (back gesture cancel returns to same route)
    if (currentKey === lastNavigationKeyRef.current) {
      return;
    }

    // Debounce rapid navigation
    const now = Date.now();
    if (now - lastHapticTimeRef.current < HAPTIC_DEBOUNCE_MS) {
      return;
    }

    // Update tracking refs
    lastNavigationKeyRef.current = currentKey;
    lastHapticTimeRef.current = now;

    // Trigger light haptic feedback (respects system haptic settings)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // Silently ignore haptic errors (e.g., device doesn't support haptics)
    });
  }, []);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.background.primary,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        onReady={handleNavigationReady}
        onStateChange={handleNavigationStateChange}
      >
        <ToastProvider>
          <LocationProvider>
            {(() => {
              if (user && userProfile) {
                return (
                  <>
                    <MainNavigator />
                    <LocationPromptModal />
                  </>
                );
              } else {
                return <AuthNavigator />;
              }
            })()}
          </LocationProvider>
        </ToastProvider>
      </NavigationContainer>

      {/* Force Update Modal - Shows when app version is below minimum */}
      <ForceUpdateModal
        visible={showUpdateModal}
        latestVersion={versionConfig?.latestVersion}
        currentVersion={currentVersion}
        updateMessage={versionConfig?.updateMessage}
        storeUrls={versionConfig?.storeUrls}
        isRequired={isUpdateRequired}
        onDismiss={dismissModal}
      />
    </>
  );
};

export default AppNavigator;
