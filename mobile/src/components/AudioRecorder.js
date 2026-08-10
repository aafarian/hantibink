import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, TouchableOpacity } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Logger from '../utils/logger';
import { theme } from '../styles/theme';

const CANCEL_THRESHOLD = -80; // Slide left this far to cancel
const MIN_RECORDING_DURATION = 500; // Minimum 500ms recording
const MAX_RECORDING_DURATION = 60000; // Maximum 60 seconds
const WAVE_BAR_COUNT = 40; // Number of wave bars for live display
const WAVEFORM_BAR_COUNT = 40; // Number of bars for saved waveform (matches AudioMessage)
const METERING_INTERVAL = 50; // Update every 50ms for smooth animation

// Resample waveform data to a fixed number of bars. The time axis must be
// preserved in BOTH directions: with fewer samples than bars, each sample
// is stretched across its share of the display — appending copies of the
// last value (the old behavior) squeezed the real audio into the left of
// the waveform and drew a false flatline over the rest of the message.
export const downsampleWaveform = (data, targetBars) => {
  if (data.length === 0) return Array(targetBars).fill(0.1);
  if (data.length <= targetBars) {
    return Array.from({ length: targetBars }, (_, i) => {
      const index = Math.min(data.length - 1, Math.floor((i * data.length) / targetBars));
      return data[index];
    });
  }

  const result = [];
  const chunkSize = data.length / targetBars;

  for (let i = 0; i < targetBars; i++) {
    const start = Math.floor(i * chunkSize);
    const end = Math.floor((i + 1) * chunkSize);
    const chunk = data.slice(start, end);
    // Use max value in chunk for more dramatic visualization
    const maxVal = Math.max(...chunk);
    result.push(maxVal);
  }

  return result;
};

const AudioRecorder = ({
  onRecordingComplete,
  onRecordingStart,
  onRecordingCancel,
  onError,
  disabled,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [audioLevels, setAudioLevels] = useState(Array(WAVE_BAR_COUNT).fill(0.02));

  const recordingRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const slideXRef = useRef(0);
  const isBusyRef = useRef(false);
  // The finger can lift while the recorder is still being prepared — the
  // release handler sees isRecording=false and does nothing, which used to
  // orphan a live recorder (stuck recording UI, and the next prepare died
  // with "Only one Recording object can be prepared at a given time")
  const releasedDuringStartRef = useRef(false);
  const audioLevelsRef = useRef(Array(WAVE_BAR_COUNT).fill(0.02));
  const waveformDataRef = useRef([]); // Store all levels for the final waveform

  // Refs for panResponder (to avoid stale closures)
  const disabledRef = useRef(disabled);
  const isRecordingRef = useRef(isRecording);
  const isCancellingRef = useRef(isCancelling);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  const onRecordingCancelRef = useRef(onRecordingCancel);
  const onRecordingStartRef = useRef(onRecordingStart);
  const onErrorRef = useRef(onError);

  // Refs for functions called by panResponder (to avoid stale closures)
  const stopRecordingRef = useRef(null);
  const startRecordingRef = useRef(null);
  const handleSlideRef = useRef(null);

  // Update refs on every render
  disabledRef.current = disabled;
  isRecordingRef.current = isRecording;
  isCancellingRef.current = isCancelling;
  onRecordingCompleteRef.current = onRecordingComplete;
  onRecordingCancelRef.current = onRecordingCancel;
  onRecordingStartRef.current = onRecordingStart;
  onErrorRef.current = onError;

  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Wave bar animations
  const waveAnims = useRef(
    Array(WAVE_BAR_COUNT)
      .fill(0)
      .map(() => new Animated.Value(0.1))
  ).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Pulse animation while recording
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  // Update wave animations when audio levels change
  useEffect(() => {
    audioLevels.forEach((level, index) => {
      Animated.timing(waveAnims[index], {
        toValue: level,
        duration: 100,
        useNativeDriver: false,
      }).start();
    });
  }, [audioLevels, waveAnims]);

  const updateAudioLevel = useCallback(status => {
    if (status.isRecording && status.metering !== undefined) {
      // Convert dB to 0-1 scale (metering is typically -160 to 0 dB)
      // Use a more sensitive range: -50dB to 0dB for better responsiveness
      const normalizedLevel = Math.max(0, (status.metering + 50) / 50);
      // More dramatic range: 0.02 (nearly invisible) to 1.0 (full height)
      const clampedLevel = Math.min(1, Math.max(0.02, normalizedLevel));

      // Store for final waveform
      waveformDataRef.current.push(clampedLevel);

      // Shift levels left and add new level at the end (for live display)
      const newLevels = [...audioLevelsRef.current.slice(1), clampedLevel];
      audioLevelsRef.current = newLevels;
      setAudioLevels(newLevels);
    }
  }, []);

  const startRecording = async () => {
    if (isBusyRef.current || isRecordingRef.current) {
      Logger.debug('Recording already in progress or busy, ignoring');
      return false;
    }

    isBusyRef.current = true;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Logger.warn('Audio recording permission denied');
        onErrorRef.current?.(new Error('Microphone permission denied'));
        isBusyRef.current = false;
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // A stale recorder from a failed stop would block the new prepare
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }

      // Reset buffers BEFORE the recording exists — the status callback is
      // live from creation and must not race the reset
      waveformDataRef.current = [];
      setAudioLevels(Array(WAVE_BAR_COUNT).fill(0.02));
      audioLevelsRef.current = Array(WAVE_BAR_COUNT).fill(0.02);
      // Reset wave animations to prevent visual artifacts from previous recording
      waveAnims.forEach(anim => anim.setValue(0.02));

      // createAsync registers the status callback AND the update interval
      // atomically with recording start. Wiring them onto the Recording
      // object afterwards left expo-av on its default ~500ms cadence, so a
      // short voice note produced only a couple dozen metering samples.
      const { recording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        },
        updateAudioLevel,
        METERING_INTERVAL
      );

      // Finger already lifted (stray quick tap): unload immediately and
      // never enter the recording state
      if (releasedDuringStartRef.current) {
        await recording.stopAndUnloadAsync().catch(() => {});
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
        isBusyRef.current = false;
        return false;
      }

      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      durationIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setRecordingDuration(elapsed);

        // Auto-stop at max duration
        if (elapsed >= MAX_RECORDING_DURATION) {
          Logger.info('Max recording duration reached, auto-stopping');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          stopRecordingRef.current?.(false);
        }
      }, 100);

      Animated.spring(scaleAnim, { toValue: 1.2, useNativeDriver: true }).start();

      onRecordingStartRef.current?.();
      isBusyRef.current = false;
      return true;
    } catch (error) {
      Logger.error('Failed to start recording:', error);
      onErrorRef.current?.(error);
      isBusyRef.current = false;
      setIsRecording(false);
      return false;
    }
  };

  // Update ref so panResponder always has the latest function
  startRecordingRef.current = startRecording;

  const stopRecording = async (cancelled = false) => {
    Logger.debug(`stopRecording called with cancelled=${cancelled}, slideX=${slideXRef.current}`);

    if (isBusyRef.current) {
      Logger.debug('Already stopping recording, ignoring');
      return;
    }

    if (!recordingRef.current) {
      setIsRecording(false);
      return;
    }

    isBusyRef.current = true;

    try {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      const duration = Date.now() - (startTimeRef.current || Date.now());

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
      setIsCancelling(false);
      setAudioLevels(Array(WAVE_BAR_COUNT).fill(0.02));

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      // Reset animations
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
      slideAnim.setValue(0);
      slideXRef.current = 0;

      isBusyRef.current = false;

      if (cancelled) {
        Logger.debug('Recording cancelled by user');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onRecordingCancelRef.current?.();
        return;
      }

      if (duration < MIN_RECORDING_DURATION) {
        Logger.info('Recording too short, discarding');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onRecordingCancelRef.current?.();
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const waveform = downsampleWaveform(waveformDataRef.current, WAVEFORM_BAR_COUNT);
      onRecordingCompleteRef.current?.(uri, duration, waveform);
    } catch (error) {
      Logger.error('Failed to stop recording:', error);
      onErrorRef.current?.(error);
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
      setIsCancelling(false);
      isBusyRef.current = false;

      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
      slideAnim.setValue(0);
      slideXRef.current = 0;
    }
  };

  // Update ref so panResponder always has the latest function
  stopRecordingRef.current = stopRecording;

  const handleSlide = useCallback(
    dx => {
      slideXRef.current = dx;

      // Use spring with high tension for smoother native-driven animation
      Animated.spring(slideAnim, {
        toValue: dx,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }).start();

      // Only update state if it actually changed (reduces re-renders)
      const shouldCancel = dx < CANCEL_THRESHOLD;
      if (shouldCancel && !isCancellingRef.current) {
        isCancellingRef.current = true;
        setIsCancelling(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (!shouldCancel && isCancellingRef.current) {
        isCancellingRef.current = false;
        setIsCancelling(false);
      }
    },
    [slideAnim]
  );

  // Update ref so panResponder always has the latest function
  handleSlideRef.current = handleSlide;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current && !isBusyRef.current,
      onMoveShouldSetPanResponder: () => isRecordingRef.current,
      // Never surrender the touch mid-record (bubble swipeables would
      // otherwise steal it and silently cancel the recording)
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: async () => {
        if (!disabledRef.current && !isBusyRef.current && !isRecordingRef.current) {
          releasedDuringStartRef.current = false;
          // Immediate feedback BEFORE the async permission/recorder setup —
          // the button felt dead for the whole native round-trip otherwise
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // Use ref to get latest function
          await startRecordingRef.current?.();
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (isRecordingRef.current) {
          // Use ref to get latest function
          handleSlideRef.current?.(Math.min(0, gestureState.dx));
        }
      },
      onPanResponderRelease: () => {
        if (!isRecordingRef.current && isBusyRef.current) {
          // Start still in flight — flag it so the recorder unloads the
          // moment it comes up instead of recording to nobody
          releasedDuringStartRef.current = true;
          return;
        }
        if (isRecordingRef.current) {
          if (slideXRef.current < CANCEL_THRESHOLD) {
            // Swiped far enough - cancel the recording
            stopRecordingRef.current?.(true);
          } else {
            // Didn't swipe far enough - just animate back, keep recording
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 10,
            }).start();
            slideXRef.current = 0;
            isCancellingRef.current = false;
            setIsCancelling(false);
          }
        }
      },
      onPanResponderTerminate: () => {
        if (!isRecordingRef.current && isBusyRef.current) {
          releasedDuringStartRef.current = true;
          return;
        }
        if (isRecordingRef.current) {
          // System interrupted - cancel the recording
          stopRecordingRef.current?.(true);
        }
      },
    })
  ).current;

  const formatDuration = ms => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSend = () => {
    if (isRecording) {
      stopRecording(false);
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording(true);
    }
  };

  // Recording UI
  if (isRecording) {
    return (
      <View style={styles.recordingContainer}>
        {/* Trash button */}
        <TouchableOpacity style={[styles.actionButton, styles.trashButton]} onPress={handleCancel}>
          <Ionicons name="trash-outline" size={22} color={theme.colors.status.error} />
        </TouchableOpacity>

        {/* Swipe area wrapper - clips the sliding content */}
        <View style={styles.swipeAreaWrapper}>
          <Animated.View
            {...panResponder.panHandlers}
            style={[styles.swipeArea, { transform: [{ translateX: slideAnim }] }]}
          >
            {/* Slide hint or wave bars */}
            <View style={styles.waveContainer}>
              {isCancelling ? (
                <Text style={styles.cancelText}>Release to cancel</Text>
              ) : (
                <View style={styles.waveBars}>
                  {waveAnims.map((anim, index) => (
                    <Animated.View
                      key={index}
                      style={[
                        styles.waveBar,
                        {
                          height: anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [2, 28],
                          }),
                        },
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Slide hint text */}
            {!isCancelling && (
              <View style={styles.slideHint}>
                <Ionicons name="chevron-back" size={14} color={theme.colors.gray[500]} />
                <Text style={styles.slideText}>Slide to cancel</Text>
              </View>
            )}
          </Animated.View>
        </View>

        {/* Recording indicator + duration */}
        <View style={styles.recordingIndicator}>
          <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
        </View>

        {/* Send button */}
        <TouchableOpacity style={[styles.actionButton, styles.sendButton]} onPress={handleSend}>
          <Ionicons name="send" size={22} color={theme.colors.text.white} />
        </TouchableOpacity>
      </View>
    );
  }

  // Default mic button
  return (
    <Animated.View
      {...panResponder.panHandlers}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel="Hold to record a voice message"
      style={[styles.micButton, disabled && styles.micButtonDisabled]}
    >
      <Ionicons
        name="mic"
        size={22}
        color={disabled ? theme.colors.gray[300] : theme.colors.status.error}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonDisabled: {
    opacity: 0.5,
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: theme.spacing.xs,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trashButton: {
    backgroundColor: theme.colors.feedback.errorTint,
  },
  sendButton: {
    backgroundColor: theme.colors.status.error,
  },
  swipeAreaWrapper: {
    flex: 1,
    overflow: 'hidden',
    marginHorizontal: theme.spacing.xs,
  },
  swipeArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveContainer: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  waveBars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: theme.spacing.sm,
  },
  waveBar: {
    width: 2,
    backgroundColor: theme.colors.status.error,
    borderRadius: 1,
  },
  slideHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  slideText: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[500],
  },
  cancelText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.status.error,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
    marginRight: theme.spacing.xs,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.status.error,
    marginRight: 6,
  },
  durationText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
    minWidth: 40,
  },
});

export default AudioRecorder;
