import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions } from 'react-native';
import { theme } from '../styles/theme';

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
      // Guard against division by zero
      if (max === min) return 0;
      return ((value - min) / (max - min)) * containerWidth;
    },
    [min, max, containerWidth]
  );

  const positionToValue = useCallback(
    position => {
      // Guard against division by zero and invalid containerWidth
      if (!containerWidth || max === min) return min;
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

  // Memoize pan responders to prevent memory leaks
  const minPanResponder = React.useMemo(() => createPanResponder(true), [createPanResponder]);
  const maxPanResponder = React.useMemo(() => createPanResponder(false), [createPanResponder]);

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
    marginVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xxl,
  },
  valueBox: {
    alignItems: 'center',
    backgroundColor: theme.colors.gray[100],
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    minWidth: 90,
  },
  valueLabel: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[500],
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary,
  },
  rangeDash: {
    width: 20,
    height: 2,
    backgroundColor: theme.colors.gray[300],
    marginHorizontal: theme.spacing.md,
  },
  sliderContainer: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  track: {
    height: 4,
    backgroundColor: theme.colors.gray[300],
    borderRadius: theme.borderRadius.xs,
    position: 'absolute',
    left: 20,
    right: 20,
  },
  selectedTrack: {
    height: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xs,
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
    backgroundColor: theme.colors.background.primary,
    shadowColor: theme.colors.gray[900],
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
    backgroundColor: theme.colors.primary,
  },
  limitLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    marginTop: -4,
  },
  limitLabel: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[500],
  },
});

export default RangeSlider;
