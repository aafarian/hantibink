import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Logger from '../utils/logger';
const CANCEL_THRESHOLD = -80; // Slide left this far to cancel
const MIN_RECORDING_DURATION = 500; // Minimum 500ms recording

const AudioRecorder = ({ onRecordingComplete, onRecordingStart, onRecordingCancel, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);

  const recordingRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const slideXRef = useRef(0);

  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

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
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      // Wave animation
      const wave = Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      wave.start();

      return () => {
        pulse.stop();
        wave.stop();
      };
    } else {
      pulseAnim.setValue(1);
      waveAnim.setValue(0);
    }
  }, [isRecording, pulseAnim, waveAnim]);

  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Logger.warn('Audio recording permission denied');
        return false;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);

      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Date.now() - startTimeRef.current);
      }, 100);

      // Scale up animation
      Animated.spring(scaleAnim, {
        toValue: 1.5,
        useNativeDriver: true,
      }).start();

      onRecordingStart?.();
      return true;
    } catch (error) {
      Logger.error('Failed to start recording:', error);
      return false;
    }
  };

  const stopRecording = async (cancelled = false) => {
    try {
      if (!recordingRef.current) return;

      // Clear interval
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Stop and get URI
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const duration = Date.now() - startTimeRef.current;

      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
      setIsCancelling(false);

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      // Reset animations
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
      slideAnim.setValue(0);
      slideXRef.current = 0;

      // Check if cancelled or too short
      if (cancelled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onRecordingCancel?.();
        return;
      }

      if (duration < MIN_RECORDING_DURATION) {
        Logger.info('Recording too short, discarding');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      // Success - send the recording
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRecordingComplete?.(uri, duration);
    } catch (error) {
      Logger.error('Failed to stop recording:', error);
      setIsRecording(false);
      setRecordingDuration(0);
      setIsCancelling(false);
    }
  };

  const handleSlide = useCallback(
    dx => {
      slideXRef.current = dx;
      slideAnim.setValue(dx);

      if (dx < CANCEL_THRESHOLD && !isCancelling) {
        setIsCancelling(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (dx >= CANCEL_THRESHOLD && isCancelling) {
        setIsCancelling(false);
      }
    },
    [isCancelling, slideAnim]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => isRecording,
      onPanResponderGrant: async () => {
        if (!disabled) {
          await startRecording();
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (isRecording) {
          handleSlide(Math.min(0, gestureState.dx));
        }
      },
      onPanResponderRelease: () => {
        if (isRecording) {
          stopRecording(slideXRef.current < CANCEL_THRESHOLD);
        }
      },
      onPanResponderTerminate: () => {
        if (isRecording) {
          stopRecording(true);
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

  if (isRecording) {
    return (
      <View style={styles.recordingOverlay}>
        <Animated.View
          style={[
            styles.recordingContent,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Cancel hint */}
          <View style={styles.cancelHint}>
            <Ionicons name="chevron-back" size={16} color={isCancelling ? '#D32F2F' : '#999'} />
            <Text style={[styles.cancelText, isCancelling && styles.cancelTextActive]}>
              {isCancelling ? 'Release to cancel' : 'Slide to cancel'}
            </Text>
          </View>

          {/* Recording indicator */}
          <View style={styles.recordingIndicator}>
            <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
          </View>
        </Animated.View>

        {/* Mic button (recording state) */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.micButtonRecording,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Ionicons name="mic" size={24} color="#fff" />
        </Animated.View>
      </View>
    );
  }

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.micButton, disabled && styles.micButtonDisabled]}
    >
      <Ionicons name="mic" size={22} color={disabled ? '#ccc' : '#D32F2F'} />
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
  micButtonRecording: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  recordingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  recordingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 16,
  },
  cancelHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 4,
  },
  cancelTextActive: {
    color: '#D32F2F',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D32F2F',
    marginRight: 8,
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});

export default AudioRecorder;
