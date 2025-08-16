import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, ActivityIndicator, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useUnread } from '../contexts/UnreadContext';
import { LocationProvider } from '../contexts/LocationContext';
import { ToastProvider } from '../contexts/ToastContext';
import LocationPromptModal from '../components/LocationPromptModal';

// Import screens
import ProfileScreen from '../screens/ProfileScreen';
import PeopleScreen from '../screens/PeopleScreen';
import FilterScreen from '../screens/FilterScreen';
import LikedYouScreen from '../screens/LikedYouScreen';
import MessagesScreen from '../screens/MessagesScreen';

// Import auth navigator
import AuthNavigator from './AuthNavigator';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Extract badge component to avoid creating components during render
const TabBadge = ({ iconName, size, color, count }) => (
  <View style={{ position: 'relative' }}>
    <Ionicons name={iconName} size={size} color={color} />
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  </View>
);

// Extract tab icon renderer to avoid creating components during render
const renderTabIcon = (route, focused, color, size, unreadCount) => {
  let iconName;

  if (route.name === 'Profile') {
    iconName = focused ? 'person' : 'person-outline';
  } else if (route.name === 'People') {
    iconName = focused ? 'people' : 'people-outline';
  } else if (route.name === 'Liked You') {
    iconName = focused ? 'heart' : 'heart-outline';
  } else if (route.name === 'Messages') {
    iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
  } else if (route.name === 'API Test') {
    iconName = focused ? 'flask' : 'flask-outline';
  }

  // Add badge for Messages tab if there are unread conversations
  if (route.name === 'Messages' && unreadCount > 0) {
    return <TabBadge iconName={iconName} size={size} color={color} count={unreadCount} />;
  }

  return <Ionicons name={iconName} size={size} color={color} />;
};

const styles = {
  badge: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
};

const PeopleStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="PeopleMain"
        component={PeopleScreen}
        options={{
          title: 'Discover',
          headerStyle: {
            backgroundColor: '#FF6B6B',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Stack.Screen
        name="Filter"
        component={FilterScreen}
        options={{
          title: 'Filters',
          headerStyle: {
            backgroundColor: '#FF6B6B',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
    </Stack.Navigator>
  );
};

const MainNavigator = () => {
  const insets = useSafeAreaInsets();
  const { loading } = useAuth();
  const { unreadConversationCount } = useUnread();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) =>
          renderTabIcon(route, focused, color, size, unreadConversationCount),
        tabBarActiveTintColor: '#FF6B6B',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          paddingBottom: Platform.OS === 'android' ? insets.bottom : 5,
          paddingTop: 5,
          height: Platform.OS === 'android' ? 60 + insets.bottom : 60,
        },
        headerStyle: {
          backgroundColor: '#FF6B6B',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Tab.Screen name="People" component={PeopleStack} options={{ headerShown: false }} />
      <Tab.Screen name="Liked You" component={LikedYouScreen} options={{ title: 'Liked You' }} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { user, userProfile, loading } = useAuth();

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}
      >
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <ToastProvider>
        <LocationProvider>
          {(() => {
            if (user && userProfile) {
              // console.log('🎯 User logged in - showing main app');
              return (
                <>
                  <MainNavigator />
                  <LocationPromptModal />
                </>
              );
            } else {
              // console.log('🚪 No user - showing auth flow');
              return <AuthNavigator />;
            }
          })()}
        </LocationProvider>
      </ToastProvider>
    </NavigationContainer>
  );
};

export default AppNavigator;
