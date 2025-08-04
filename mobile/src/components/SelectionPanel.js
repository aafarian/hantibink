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
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const SelectionPanel = ({
  visible,
  onClose,
  title,
  options,
  selectedValues,
  onSelect,
  multiSelect = false,
  placeholder = 'Select an option',
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);
  const handleSelect = option => {
    if (multiSelect) {
      // For multi-select, toggle the selection
      const isSelected = selectedValues.includes(option);
      const newValues = isSelected
        ? selectedValues.filter(value => value !== option)
        : [...selectedValues, option];
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

  const getDisplayText = () => {
    if (!selectedValues || selectedValues.length === 0) {
      return '';
    }

    if (multiSelect) {
      if (selectedValues.length === 1) {
        return selectedValues[0];
      }
      return `${selectedValues.length} selected`;
    }

    // For single select, return the first value
    return selectedValues[0];
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
            style={styles.panel}
            activeOpacity={1}
            onPress={() => {}} // Prevent closing when tapping inside panel
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="chevron-left" size={24} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.title}>{title}</Text>
              <View style={styles.placeholder} />
            </View>

            {/* Options */}
            <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
              {options.map((option, index) => {
                // Handle both string options and object options {id, label}
                const optionKey = typeof option === 'object' ? option.id : option;
                const optionLabel = typeof option === 'object' ? option.label : option;
                const optionValue = typeof option === 'object' ? option.id : option;

                const isSelected = multiSelect
                  ? selectedValues.includes(optionValue)
                  : selectedValues === optionValue;

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
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {optionLabel}
                    </Text>
                    {isSelected && <MaterialIcons name="check" size={20} color="#007AFF" />}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  panelContainer: {
    maxHeight: height * 0.8,
  },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 34, // Same width as close button for centering
  },
  optionsContainer: {
    maxHeight: height * 0.5,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionSelected: {
    backgroundColor: '#F8F9FA',
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SelectionPanel;
