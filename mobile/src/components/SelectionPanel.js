import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

const { width: _width, height: _height } = Dimensions.get('window');

const SelectionPanel = ({
  visible,
  onClose,
  title,
  options,
  selectedValues,
  selectedOption, // For backward compatibility with single select
  onSelect,
  multiSelect = false,
  placeholder: _placeholder = 'Select an option',
  initialScrollIndex = 0,
}) => {
  const insets = useSafeAreaInsets();

  // Handle both selectedValues and selectedOption for backward compatibility
  const actualSelectedValues = multiSelect
    ? selectedValues || []
    : selectedOption
      ? [selectedOption]
      : [];
  const slideAnim = useRef(new Animated.Value(300)).current;
  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Scroll to initial position after a short delay
      if (initialScrollIndex > 0) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: initialScrollIndex * 50, // Assuming each option is ~50px high
            animated: true,
          });
        }, 100);
      }
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, initialScrollIndex]);
  const handleSelect = option => {
    if (multiSelect) {
      // For multi-select, toggle the selection
      const isSelected = actualSelectedValues.includes(option);
      const newValues = isSelected
        ? actualSelectedValues.filter(value => value !== option)
        : [...actualSelectedValues, option];
      onSelect(newValues);
    } else {
      // For single select, just select the option
      onSelect(option);
      onClose();
    }
  };

  const handleConfirm = () => {
    onClose();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[
            styles.panelContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.panel, { paddingBottom: Math.max(20, insets.bottom + 10) }]}
            activeOpacity={1}
            onPress={() => {}} // Prevent closing when tapping inside panel
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="chevron-left" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
              <Text style={styles.title}>{title}</Text>
              <View style={styles.placeholder} />
            </View>

            {/* Options */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.optionsContainer}
              showsVerticalScrollIndicator={false}
            >
              {options.map((option, index) => {
                // Handle both string options and object options {id, label}
                const optionKey = `option-${index}`; // Use index for stable, unique React keys
                const optionLabel = typeof option === 'object' ? option.label : option;
                const optionValue = typeof option === 'object' ? option.id : option;

                const isSelected = actualSelectedValues.includes(optionValue);

                return (
                  <TouchableOpacity
                    key={optionKey}
                    style={[
                      styles.option,
                      isSelected && styles.optionSelected,
                      index === options.length - 1 && styles.lastOption,
                    ]}
                    onPress={() => handleSelect(optionValue)}
                  >
                    {multiSelect && (
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && (
                          <MaterialIcons name="check" size={16} color={theme.colors.text.white} />
                        )}
                      </View>
                    )}
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {optionLabel}
                    </Text>
                    {!multiSelect && isSelected && (
                      <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Confirm Button for Multi-Select */}
            {multiSelect && (
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  panelContainer: {
    maxHeight: _height * 0.8,
  },
  panel: {
    backgroundColor: theme.colors.background.primary,
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    // paddingBottom is applied dynamically based on safe area insets
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[300],
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 34, // Same width as close button for centering
  },
  optionsContainer: {
    maxHeight: _height * 0.5,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  optionSelected: {
    backgroundColor: theme.colors.gray[100],
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
    flex: 1,
  },
  optionTextSelected: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 2,
    borderColor: theme.colors.gray[400],
    backgroundColor: theme.colors.background.primary,
    marginRight: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
    margin: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
  },
});

export default SelectionPanel;
