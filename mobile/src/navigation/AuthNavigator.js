import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/auth/LoginScreen';
import SimpleRegisterScreen from '../screens/auth/SimpleRegisterScreen';
import PhotoSelectionScreen from '../screens/auth/PhotoSelectionScreen';
import ProfileDetailsScreen from '../screens/auth/ProfileDetailsScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import OAuthCompleteScreen from '../screens/auth/OAuthCompleteScreen';

const Stack = createStackNavigator();

const AuthNavigator = () => {
  // Always start with Login - let user choose to login or signup
  // Persisted sessions should not automatically resume registration
  const initialRouteName = 'Login';

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={SimpleRegisterScreen} />
      <Stack.Screen name="PhotoSelection" component={PhotoSelectionScreen} />
      <Stack.Screen name="ProfileDetails" component={ProfileDetailsScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="OAuthComplete" component={OAuthCompleteScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
