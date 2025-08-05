import React from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * KeyboardAwareWrapper - Unified keyboard handling for all input scenarios
 *
 * @param {string} behavior - Keyboard behavior mode
 *   - 'static': No keyboard avoidance (for inputs that won't be covered)
 *   - 'form': Scrollable form behavior (registration, profile editing)
 *   - 'chat': Bottom-pinned input behavior (messaging interfaces)
 *
 * @param {boolean} avoidKeyboard - Enable/disable keyboard avoidance entirely
 * @param {object} style - Custom styles for the wrapper
 * @param {number} keyboardOffset - Additional offset for fine-tuning (iOS only)
 * @param {object} scrollProps - Additional props for ScrollView (form mode only)
 */
export const KeyboardAwareWrapper = ({
  behavior = 'static',
  avoidKeyboard = true,
  children,
  style = {},
  keyboardOffset = 0,
  scrollProps = {},
  ...props
}) => {
  const insets = useSafeAreaInsets();

  // If keyboard avoidance is disabled, just return a regular View
  if (!avoidKeyboard) {
    return (
      <View style={[{ flex: 1 }, style]} {...props}>
        {children}
      </View>
    );
  }

  // Mode 1: Static layout - no keyboard handling needed
  if (behavior === 'static') {
    return (
      <View style={[{ flex: 1 }, style]} {...props}>
        {children}
      </View>
    );
  }

  // Mode 2: Form behavior - scrollable content with multiple inputs
  if (behavior === 'form') {
    return (
      <KeyboardAwareScrollView
        style={[{ flex: 1 }, style]}
        contentContainerStyle={{ flexGrow: 1 }}
        enableOnAndroid={true}
        extraScrollHeight={20 + keyboardOffset}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
        {...props}
      >
        {children}
      </KeyboardAwareScrollView>
    );
  }
  // Mode 3: Chat behavior - input pinned to top of keyboard
  if (behavior === 'chat') {
    // Calculate proper offset: tab bar height + bottom safe area + any custom offset
    const tabBarHeight = Platform.OS === 'ios' ? 83 : 56; // Standard tab bar heights
    const dynamicOffset = tabBarHeight + insets.bottom + keyboardOffset;

    return (
      <KeyboardAvoidingView
        style={[{ flex: 1 }, style]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={dynamicOffset}
        {...props}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  // Fallback to static if unknown behavior
  return (
    <View style={[{ flex: 1 }, style]} {...props}>
      {children}
    </View>
  );
};

// Export individual behavior components for convenience
export const StaticKeyboardWrapper = ({ children, ...props }) => (
  <KeyboardAwareWrapper behavior="static" {...props}>
    {children}
  </KeyboardAwareWrapper>
);

export const FormKeyboardWrapper = ({ children, ...props }) => (
  <KeyboardAwareWrapper behavior="form" {...props}>
    {children}
  </KeyboardAwareWrapper>
);

export const ChatKeyboardWrapper = ({ children, ...props }) => (
  <KeyboardAwareWrapper behavior="chat" {...props}>
    {children}
  </KeyboardAwareWrapper>
);
