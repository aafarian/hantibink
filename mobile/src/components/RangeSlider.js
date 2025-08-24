import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const RangeSlider = ({
  min = 0,
  max = 100,
  minValue: initialMin,
  maxValue: initialMax,
  onValuesChange,
  step = 1,
  label,
  unit = '',
}) => {
  const [minValue, setMinValue] = useState(initialMin);
  const [maxValue, setMaxValue] = useState(initialMax);
  const [containerWidth, setContainerWidth] = useState(screenWidth - 60);
  const containerRef = useRef(null);

  const valueToPosition = useCallback(
    value => {
      return ((value - min) / (max - min)) * containerWidth;
    },
    [min, max, containerWidth]
  );

  const positionToValue = useCallback(
    position => {
      const ratio = Math.max(0, Math.min(1, position / containerWidth));
      const value = min + ratio * (max - min);
      return Math.round(value / step) * step;
    },
    [min, max, containerWidth, step]
  );

  const createPanResponder = useCallback(
    isMin => {
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          // Haptic feedback could go here
        },
        onPanResponderMove: (evt, gestureState) => {
          const currentValue = isMin ? minValue : maxValue;
          const startPosition = valueToPosition(currentValue);
          const newPosition = startPosition + gestureState.dx;
          const newValue = positionToValue(newPosition);

          if (isMin) {
            const constrainedValue = Math.min(newValue, maxValue - step);
            if (constrainedValue >= min && constrainedValue !== minValue) {
              setMinValue(constrainedValue);
              onValuesChange(constrainedValue, maxValue);
            }
          } else {
            const constrainedValue = Math.max(newValue, minValue + step);
            if (constrainedValue <= max && constrainedValue !== maxValue) {
              setMaxValue(constrainedValue);
              onValuesChange(minValue, constrainedValue);
            }
          }
        },
      });
    },
    [minValue, maxValue, min, max, step, valueToPosition, positionToValue, onValuesChange]
  );

  const minPanResponder = useRef(createPanResponder(true)).current;
  const maxPanResponder = useRef(createPanResponder(false)).current;

  // Update pan responders when values change
  React.useEffect(() => {
    minPanResponder.panHandlers = createPanResponder(true).panHandlers;
    maxPanResponder.panHandlers = createPanResponder(false).panHandlers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minValue, maxValue, createPanResponder]);

  const onLayout = useCallback(event => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width - 40); // Account for thumb width
  }, []);

  const minPosition = valueToPosition(minValue);
  const maxPosition = valueToPosition(maxValue);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.valueContainer}>
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>Min</Text>
          <Text style={styles.value}>
            {minValue}
            {unit}
          </Text>
        </View>
        <View style={styles.rangeDash} />
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>Max</Text>
          <Text style={styles.value}>
            {maxValue}
            {unit}
          </Text>
        </View>
      </View>

      <View ref={containerRef} style={styles.sliderContainer} onLayout={onLayout}>
        {/* Track */}
        <View style={styles.track} />

        {/* Selected range */}
        <View
          style={[
            styles.selectedTrack,
            {
              left: minPosition + 20,
              width: maxPosition - minPosition,
            },
          ]}
        />

        {/* Min thumb */}
        <View
          style={[styles.thumbContainer, { left: minPosition }]}
          {...minPanResponder.panHandlers}
        >
          <View style={styles.thumb}>
            <View style={styles.thumbInner} />
          </View>
        </View>

        {/* Max thumb */}
        <View
          style={[styles.thumbContainer, { left: maxPosition }]}
          {...maxPanResponder.panHandlers}
        >
          <View style={styles.thumb}>
            <View style={styles.thumbInner} />
          </View>
        </View>
      </View>

      {/* Min/Max labels */}
      <View style={styles.limitLabels}>
        <Text style={styles.limitLabel}>
          {min}
          {unit}
        </Text>
        <Text style={styles.limitLabel}>
          {max}
          {unit}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  valueBox: {
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 90,
  },
  valueLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  rangeDash: {
    width: 20,
    height: 2,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 12,
  },
  sliderContainer: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  track: {
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    position: 'absolute',
    left: 20,
    right: 20,
  },
  selectedTrack: {
    height: 4,
    backgroundColor: '#FF6B6B',
    borderRadius: 2,
    position: 'absolute',
  },
  thumbContainer: {
    position: 'absolute',
    width: 40,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF6B6B',
  },
  limitLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: -4,
  },
  limitLabel: {
    fontSize: 11,
    color: '#999',
  },
});

export default RangeSlider;
