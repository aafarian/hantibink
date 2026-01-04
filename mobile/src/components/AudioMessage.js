import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Logger from '../utils/logger';

const AudioMessage = ({ audioUrl, isOwnMessage, duration: providedDuration }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(providedDuration || 0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  // Update progress animation
  useEffect(() => {
    if (duration > 0) {
      Animated.timing(progressAnim, {
        toValue: position / duration,
        duration: 100,
        useNativeDriver: false,
      }).start();
    }
  }, [position, duration, progressAnim]);

  const onPlaybackStatusUpdate = useCallback(
    status => {
      if (status.isLoaded) {
        setPosition(status.positionMillis || 0);
        setDuration(status.durationMillis || 0);
        setIsPlaying(status.isPlaying);

        if (status.didJustFinish) {
          setIsPlaying(false);
          setPosition(0);
          progressAnim.setValue(0);
        }
      }
    },
    [progressAnim]
  );

  const handlePlayPause = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
        } else {
          // Reset to beginning if finished
          if (position >= duration - 100) {
            await sound.setPositionAsync(0);
          }
          await sound.playAsync();
        }
      } else {
        // Load and play
        setIsLoading(true);
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setIsLoading(false);
      }
    } catch (error) {
      Logger.error('Error playing audio:', error);
      setIsLoading(false);
    }
  };

  const formatTime = ms => {
    if (!ms || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
      <TouchableOpacity
        onPress={handlePlayPause}
        style={[styles.playButton, isOwnMessage ? styles.ownPlayButton : styles.otherPlayButton]}
        disabled={isLoading}
      >
        {isLoading ? (
          <View style={styles.loadingDot} />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={20}
            color={isOwnMessage ? '#fff' : '#D32F2F'}
          />
        )}
      </TouchableOpacity>

      <View style={styles.waveformContainer}>
        {/* Waveform bars (static visualization) */}
        <View style={styles.waveformBars}>
          {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.5, 0.7, 0.4, 0.6, 0.8, 0.5, 0.7, 0.4].map(
            (height, index) => (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height: 20 * height,
                    backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.4)' : 'rgba(211,47,47,0.3)',
                  },
                ]}
              />
            )
          )}
        </View>

        {/* Progress overlay */}
        <Animated.View style={[styles.progressOverlay, { width: progressWidth }]}>
          <View style={styles.waveformBars}>
            {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.5, 0.7, 0.4, 0.6, 0.8, 0.5, 0.7, 0.4].map(
              (height, index) => (
                <View
                  key={index}
                  style={[
                    styles.waveformBar,
                    {
                      height: 20 * height,
                      backgroundColor: isOwnMessage ? '#fff' : '#D32F2F',
                    },
                  ]}
                />
              )
            )}
          </View>
        </Animated.View>
      </View>

      <Text style={[styles.duration, isOwnMessage ? styles.ownDuration : styles.otherDuration]}>
        {isPlaying || position > 0 ? formatTime(position) : formatTime(duration)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 180,
    maxWidth: 250,
  },
  ownMessage: {
    backgroundColor: '#D32F2F',
  },
  otherMessage: {
    backgroundColor: '#F0F0F0',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  ownPlayButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  otherPlayButton: {
    backgroundColor: 'rgba(211,47,47,0.1)',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  waveformContainer: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    gap: 2,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  progressOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  duration: {
    fontSize: 12,
    marginLeft: 8,
    minWidth: 35,
    textAlign: 'right',
  },
  ownDuration: {
    color: 'rgba(255,255,255,0.8)',
  },
  otherDuration: {
    color: '#666',
  },
});

export default AudioMessage;
