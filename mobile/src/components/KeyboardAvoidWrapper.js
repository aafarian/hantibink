import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * KeyboardAvoidWrapper - Simplified keyboard handling using KeyboardAvoidingView
 *
 * All text input screens should use this wrapper to ensure consistent keyboard behavior.
 * Always uses KeyboardAvoidingView - there's no scenario where we don't want this.
 *
 * @param {boolean} scrollable - Whether content should be scrollable (default: true for forms)
 * @param {number} keyboardOffset - Additional offset for custom layouts
 * @param {object} scrollProps - Props to pass to ScrollView (when scrollable=true)
 */
export const KeyboardAvoidWrapper = ({
  scrollable = true,
  keyboardOffset = 0,
  scrollProps = {},
  style,
  children,
  ...props
}) => {
  if (scrollable) {
    return (
      <KeyboardAvoidingView
        style={[styles.flex, style]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : keyboardOffset}
        {...props}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Non-scrollable version (for single inputs, chat, etc.)
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : keyboardOffset}
      {...props}
    >
      {children}
    </KeyboardAvoidingView>
  );
};

// Convenience exports for common patterns
export const FormKeyboardWrapper = props => <KeyboardAvoidWrapper scrollable={true} {...props} />;

export const StaticKeyboardWrapper = props => (
  <KeyboardAvoidWrapper scrollable={false} {...props} />
);

export const ChatKeyboardWrapper = ({ keyboardOffset = 0, ...props }) => {
  const insets = useSafeAreaInsets();
  // Calculate proper offset: tab bar height + bottom safe area + any custom offset
  const tabBarHeight = Platform.OS === 'ios' ? 83 : 56;
  const dynamicOffset = tabBarHeight + insets.bottom + keyboardOffset;

  return <KeyboardAvoidWrapper scrollable={false} keyboardOffset={dynamicOffset} {...props} />;
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
