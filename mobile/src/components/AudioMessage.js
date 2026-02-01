import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Logger from '../utils/logger';

// Layout constants - WhatsApp style (no scrolling)
const WAVEFORM_BAR_COUNT = 35;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const WAVEFORM_HEIGHT = 32;
const WAVEFORM_WIDTH = WAVEFORM_BAR_COUNT * BAR_WIDTH + (WAVEFORM_BAR_COUNT - 1) * BAR_GAP;
const PLAYHEAD_WIDTH = 2;
const PLAYHEAD_HEIGHT = WAVEFORM_HEIGHT + 8;

// Single audio playback - stop others when one plays
const audioEventListeners = new Set();
const emitAudioPlay = id => audioEventListeners.forEach(listener => listener(id));
const subscribeToAudioEvents = listener => {
  audioEventListeners.add(listener);
  return () => audioEventListeners.delete(listener);
};

const generateDefaultWaveform = () =>
  Array(WAVEFORM_BAR_COUNT)
    .fill(0)
    .map(() => 0.1 + Math.random() * 0.6);

const AudioMessage = ({
  audioUrl,
  isOwnMessage,
  duration: providedDuration,
  metadata,
  messageId,
}) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(providedDuration || 0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const soundRef = useRef(null);
  const instanceId = useRef(messageId || `audio-${Math.random()}`).current;
  const pendingSeekRef = useRef(null);
  const durationRef = useRef(duration);
  const wasPlayingBeforeScrubRef = useRef(false);

  // Keep refs updated
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Parse waveform from metadata
  const waveform = React.useMemo(() => {
    if (metadata) {
      try {
        const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
        if (parsed.waveform && Array.isArray(parsed.waveform)) {
          const source = parsed.waveform;
          if (source.length === WAVEFORM_BAR_COUNT) return source;

          // Resample to WAVEFORM_BAR_COUNT
          const result = [];
          for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
            const srcIndex = Math.floor((i / WAVEFORM_BAR_COUNT) * source.length);
            result.push(source[srcIndex] || 0.1);
          }
          return result;
        }
      } catch {
        // Invalid metadata
      }
    }
    return generateDefaultWaveform();
  }, [metadata]);

  // Parse duration from metadata
  useEffect(() => {
    if (!providedDuration && metadata) {
      try {
        const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
        if (parsed.durationMs) {
          setDuration(parsed.durationMs);
        }
      } catch {
        // Invalid metadata
      }
    }
  }, [metadata, providedDuration]);

  // Load duration from audio if not in metadata
  useEffect(() => {
    const loadDuration = async () => {
      if (duration === 0 && audioUrl && !sound) {
        try {
          const { sound: tempSound, status } = await Audio.Sound.createAsync(
            { uri: audioUrl },
            { shouldPlay: false }
          );
          // Only set duration if main sound wasn't loaded meanwhile (race condition fix)
          if (status.durationMillis && !soundRef.current) {
            setDuration(status.durationMillis);
          }
          await tempSound.unloadAsync();
        } catch (error) {
          Logger.debug('Could not preload duration:', error);
        }
      }
    };
    loadDuration();
  }, [audioUrl, duration, sound]);

  // Keep sound ref updated
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  // Listen for other audio starting - pause AND reset this one
  useEffect(() => {
    const unsubscribe = subscribeToAudioEvents(playingId => {
      if (playingId !== instanceId && soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.setPositionAsync(0).catch(() => {});
        setIsPlaying(false);
        setPosition(0);
      }
    });
    return unsubscribe;
  }, [instanceId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback(
    status => {
      if (status.isLoaded) {
        // Update position during playback (but not while scrubbing)
        if (status.isPlaying && !isScrubbing) {
          setPosition(status.positionMillis || 0);
        }
        setIsPlaying(status.isPlaying);

        if (status.durationMillis && status.durationMillis !== durationRef.current) {
          setDuration(status.durationMillis);
        }

        if (status.didJustFinish) {
          setIsPlaying(false);
          // Show 100% briefly, then reset UI only
          // Sound position is reset in handlePlayPause when user clicks play
          setPosition(durationRef.current);
          setTimeout(() => {
            setPosition(0);
          }, 300);
        }
      }
    },
    [isScrubbing]
  );

  const handlePlayPause = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
        } else {
          emitAudioPlay(instanceId);
          // Always reset to beginning if at or near end
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.positionMillis >= status.durationMillis - 100) {
            await sound.setPositionAsync(0);
            setPosition(0);
          }
          await sound.playAsync();
        }
      } else {
        setLoading(true);
        emitAudioPlay(instanceId);

        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const startPosition = pendingSeekRef.current ?? 0;
        pendingSeekRef.current = null;

        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          {
            shouldPlay: true,
            progressUpdateIntervalMillis: 100,
            positionMillis: startPosition,
          },
          onPlaybackStatusUpdate
        );

        if (status.durationMillis) {
          setDuration(status.durationMillis);
        }
        setSound(newSound);
        setLoading(false);
      }
    } catch (error) {
      Logger.error('Error playing audio:', error);
      setLoading(false);
    }
  };

  // Calculate seek position from touch X coordinate
  const calculateSeekFromX = useCallback(locationX => {
    const dur = durationRef.current;
    if (dur <= 0) return null;

    const fraction = Math.max(0, Math.min(1, locationX / WAVEFORM_WIDTH));
    return Math.round(fraction * dur);
  }, []);

  // Seek to position
  const seekToPosition = useCallback(async seekMs => {
    setPosition(seekMs);

    if (soundRef.current) {
      try {
        await soundRef.current.setPositionAsync(seekMs);
      } catch (error) {
        Logger.error('Error seeking:', error);
      }
    } else {
      pendingSeekRef.current = seekMs;
    }
  }, []);

  // Responder handlers for drag-to-scrub
  const handleResponderGrant = useCallback(
    event => {
      const { locationX } = event.nativeEvent;
      const seekMs = calculateSeekFromX(locationX);
      if (seekMs === null) return;

      setIsScrubbing(true);
      wasPlayingBeforeScrubRef.current = isPlaying;

      // Pause while scrubbing
      if (soundRef.current && isPlaying) {
        soundRef.current.pauseAsync().catch(() => {});
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPosition(seekMs);
    },
    [calculateSeekFromX, isPlaying]
  );

  const handleResponderMove = useCallback(
    event => {
      const { locationX } = event.nativeEvent;
      const seekMs = calculateSeekFromX(locationX);
      if (seekMs === null) return;

      setPosition(seekMs);
    },
    [calculateSeekFromX]
  );

  const handleResponderRelease = useCallback(
    async event => {
      const { locationX } = event.nativeEvent;
      const seekMs = calculateSeekFromX(locationX);

      setIsScrubbing(false);

      if (seekMs !== null) {
        await seekToPosition(seekMs);

        // Resume playing if was playing before scrub
        if (wasPlayingBeforeScrubRef.current && soundRef.current) {
          await soundRef.current.playAsync();
        }
      }
    },
    [calculateSeekFromX, seekToPosition]
  );

  const formatTime = ms => {
    if (!ms || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate progress (0 to 1)
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const playedBars = Math.floor(progress * WAVEFORM_BAR_COUNT);
  const playheadX = progress * WAVEFORM_WIDTH;

  const colors = isOwnMessage
    ? {
        playBg: 'rgba(255,255,255,0.25)',
        playIcon: '#fff',
        barPlayed: '#fff',
        barUnplayed: 'rgba(255,255,255,0.4)',
        timeText: 'rgba(255,255,255,0.9)',
        playhead: '#fff',
      }
    : {
        playBg: 'rgba(0,0,0,0.08)',
        playIcon: '#666',
        barPlayed: '#555',
        barUnplayed: 'rgba(0,0,0,0.2)',
        timeText: '#888',
        playhead: '#555',
      };

  // Show elapsed when playing/paused with progress, otherwise show duration
  const showElapsed = isPlaying || position > 0;
  const timeDisplay = showElapsed ? formatTime(position) : formatTime(duration);

  return (
    <View style={styles.container}>
      {/* Play/Pause Button */}
      <TouchableOpacity
        onPress={handlePlayPause}
        style={[styles.playButton, { backgroundColor: colors.playBg }]}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.playIcon} />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color={colors.playIcon}
            style={isPlaying ? {} : { marginLeft: 2 }}
          />
        )}
      </TouchableOpacity>

      {/* Waveform - with drag-to-scrub via responder system */}
      <View
        style={styles.waveformWrapper}
        onStartShouldSetResponder={() => !!soundRef.current}
        onMoveShouldSetResponder={() => !!soundRef.current}
        onResponderGrant={handleResponderGrant}
        onResponderMove={handleResponderMove}
        onResponderRelease={handleResponderRelease}
        onResponderTerminate={handleResponderRelease}
      >
        <View style={styles.waveformContainer} pointerEvents="none">
          {waveform.map((level, index) => {
            const isPlayed = index < playedBars;
            const barHeight = Math.max(4, Math.round(level * (WAVEFORM_HEIGHT - 8) + 4));
            return (
              <View
                key={index}
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: isPlayed ? colors.barPlayed : colors.barUnplayed,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Playhead - vertical line, only show when audio has been played/seeked */}
        {(isPlaying || position > 0) && (
          <View
            pointerEvents="none"
            style={[
              styles.playhead,
              {
                left: playheadX - PLAYHEAD_WIDTH / 2,
                backgroundColor: colors.playhead,
              },
            ]}
          />
        )}
      </View>

      {/* Duration/Time */}
      <Text style={[styles.time, { color: colors.timeText }]}>{timeDisplay}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformWrapper: {
    marginHorizontal: 8,
    height: WAVEFORM_HEIGHT + 8,
    justifyContent: 'center',
    position: 'relative',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: WAVEFORM_HEIGHT,
    gap: BAR_GAP,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  playhead: {
    position: 'absolute',
    width: PLAYHEAD_WIDTH,
    height: PLAYHEAD_HEIGHT,
    borderRadius: PLAYHEAD_WIDTH / 2,
    top: (WAVEFORM_HEIGHT + 8 - PLAYHEAD_HEIGHT) / 2,
  },
  time: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 36,
    textAlign: 'right',
  },
});

export default AudioMessage;
