import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Logger from '../../utils/logger';
import { theme } from '../../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 4:5 portrait is the dating-app standard. Used everywhere.
const ASPECT_RATIO = 4 / 5;

// Crop frame size derived from screen, leaving padding for header/footer
const FRAME_WIDTH = SCREEN_WIDTH - 32;
const FRAME_HEIGHT = FRAME_WIDTH / ASPECT_RATIO;

// Scale bounds
const MIN_SCALE = 1;
const MAX_SCALE = 4;

/**
 * Wizard-style crop carousel. Takes an array of image URIs, walks the user
 * through cropping each one to a fixed 4:5 portrait aspect, and returns the
 * cropped URIs on completion.
 *
 * UX:
 *   - Header: progress ("Photo 2 of 3"), close button
 *   - Image area: image with pan + pinch gestures, fixed centered 4:5 crop frame
 *   - Footer: Skip / (Back) / Next or Use all (N)
 *
 * The image is positioned so its initial state fills the crop frame at the
 * minimum scale (no empty space inside the frame). Pan and pinch let the user
 * recompose. On commit, the visible region inside the frame is what gets cropped.
 *
 * @param {boolean} props.visible
 * @param {string[]} props.imageUris       Local URIs to crop
 * @param {(results: Array<{uri: string, originalUri: string, skipped: boolean}>) => void} props.onComplete
 * @param {() => void} props.onCancel      User dismissed without committing
 */
const PhotoCropCarousel = ({ visible, imageUris, onComplete, onCancel }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageInfos, setImageInfos] = useState([]); // [{ width, height, fitScale }]
  const [transforms, setTransforms] = useState([]); // [{ tx, ty, scale }] saved per photo
  const [skipped, setSkipped] = useState(new Set());
  const [committing, setCommitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Live gesture values for the current photo (committed back to `transforms` on advance)
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(MIN_SCALE);

  // Reset state when a new batch is opened
  useEffect(() => {
    if (!visible || imageUris.length === 0) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setCurrentIndex(0);
    setSkipped(new Set());

    // Probe each image for its dimensions so we know the fitScale
    Promise.all(
      imageUris.map(async uri => {
        try {
          const info = await ImageManipulator.manipulateAsync(uri, [], {});
          return { uri, width: info.width, height: info.height };
        } catch (probeErr) {
          Logger.error('PhotoCropCarousel: failed to probe image', probeErr);
          return { uri, width: SCREEN_WIDTH, height: SCREEN_WIDTH };
        }
      })
    ).then(infos => {
      if (cancelled) {
        return;
      }
      const computed = infos.map(info => {
        // Scale required so the image's smaller axis covers the frame
        const fitScaleX = FRAME_WIDTH / info.width;
        const fitScaleY = FRAME_HEIGHT / info.height;
        const fitScale = Math.max(fitScaleX, fitScaleY);
        return { ...info, fitScale };
      });
      setImageInfos(computed);
      setTransforms(computed.map(() => ({ tx: 0, ty: 0, scale: MIN_SCALE })));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [visible, imageUris]);

  // Load the current photo's saved transform into the gesture values when index changes
  useEffect(() => {
    const t = transforms[currentIndex];
    if (!t) {
      return;
    }
    tx.value = t.tx;
    ty.value = t.ty;
    scale.value = t.scale;
  }, [currentIndex, transforms, tx, ty, scale]);

  const currentInfo = imageInfos[currentIndex];
  const totalCount = imageUris.length;
  const usableCount = totalCount - skipped.size;

  // Persist current gesture values back into the transforms array
  const persistCurrentTransform = useCallback(() => {
    setTransforms(prev => {
      const next = [...prev];
      next[currentIndex] = { tx: tx.value, ty: ty.value, scale: scale.value };
      return next;
    });
  }, [currentIndex, tx, ty, scale]);

  // Pan gesture — uses Reanimated worklets so movement is smooth on the UI thread
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const savedScale = useSharedValue(MIN_SCALE);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          savedTx.value = tx.value;
          savedTy.value = ty.value;
        })
        .onUpdate(e => {
          tx.value = savedTx.value + e.translationX;
          ty.value = savedTy.value + e.translationY;
        })
        .onEnd(() => {
          // Clamp so the image always covers the frame (no empty space inside)
          if (!currentInfo) {
            return;
          }
          const effectiveScale = currentInfo.fitScale * scale.value;
          const renderedW = currentInfo.width * effectiveScale;
          const renderedH = currentInfo.height * effectiveScale;
          const maxTx = (renderedW - FRAME_WIDTH) / 2;
          const maxTy = (renderedH - FRAME_HEIGHT) / 2;
          if (tx.value > maxTx) {
            tx.value = withTiming(maxTx);
          } else if (tx.value < -maxTx) {
            tx.value = withTiming(-maxTx);
          }
          if (ty.value > maxTy) {
            ty.value = withTiming(maxTy);
          } else if (ty.value < -maxTy) {
            ty.value = withTiming(-maxTy);
          }
        }),
    [tx, ty, scale, savedTx, savedTy, currentInfo]
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          savedScale.value = scale.value;
        })
        .onUpdate(e => {
          const next = savedScale.value * e.scale;
          if (next < MIN_SCALE) {
            scale.value = MIN_SCALE;
          } else if (next > MAX_SCALE) {
            scale.value = MAX_SCALE;
          } else {
            scale.value = next;
          }
        })
        .onEnd(() => {
          // After zoom, re-clamp pan so we still cover the frame
          if (!currentInfo) {
            return;
          }
          const effectiveScale = currentInfo.fitScale * scale.value;
          const renderedW = currentInfo.width * effectiveScale;
          const renderedH = currentInfo.height * effectiveScale;
          const maxTx = (renderedW - FRAME_WIDTH) / 2;
          const maxTy = (renderedH - FRAME_HEIGHT) / 2;
          if (tx.value > maxTx) {
            tx.value = withTiming(maxTx);
          } else if (tx.value < -maxTx) {
            tx.value = withTiming(-maxTx);
          }
          if (ty.value > maxTy) {
            ty.value = withTiming(maxTy);
          } else if (ty.value < -maxTy) {
            ty.value = withTiming(-maxTy);
          }
        }),
    [tx, ty, scale, savedScale, currentInfo]
  );

  const composed = useMemo(
    () => Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // Advance / back / skip
  const advance = useCallback(() => {
    persistCurrentTransform();
    if (currentIndex < totalCount - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, totalCount, persistCurrentTransform]);

  const goBack = useCallback(() => {
    persistCurrentTransform();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex, persistCurrentTransform]);

  const handleSkip = useCallback(() => {
    setSkipped(prev => {
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });
    if (currentIndex < totalCount - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, totalCount]);

  // Convert per-photo transform → ImageManipulator crop region in source-image pixels.
  // Derivation: image is centered in the frame, so the image's top-left in screen
  // space is at (frameCenter - renderedW/2 + tx, frameCenter - renderedH/2 + ty).
  // The frame's top-left is at frameCenter - FRAME/2. The visible source pixel at
  // the frame's top-left is therefore (frameLeft - imageLeft) / effectiveScale =
  // (renderedW - FRAME)/2 - tx, divided by effectiveScale.
  const buildCrop = useCallback((info, transform) => {
    const effectiveScale = info.fitScale * transform.scale;
    const cropOriginX = (info.width * effectiveScale - FRAME_WIDTH) / 2 - transform.tx;
    const cropOriginY = (info.height * effectiveScale - FRAME_HEIGHT) / 2 - transform.ty;
    return {
      originX: Math.max(0, Math.round(cropOriginX / effectiveScale)),
      originY: Math.max(0, Math.round(cropOriginY / effectiveScale)),
      width: Math.min(info.width, Math.round(FRAME_WIDTH / effectiveScale)),
      height: Math.min(info.height, Math.round(FRAME_HEIGHT / effectiveScale)),
    };
  }, []);

  const handleCommit = useCallback(async () => {
    persistCurrentTransform();
    setCommitting(true);
    try {
      // Read the just-persisted transforms by closing over the next state via callback
      const latest = transforms.map((t, i) =>
        i === currentIndex ? { tx: tx.value, ty: ty.value, scale: scale.value } : t
      );
      const results = await Promise.all(
        imageUris.map(async (uri, i) => {
          if (skipped.has(i)) {
            return { uri, originalUri: uri, skipped: true };
          }
          const info = imageInfos[i];
          const crop = buildCrop(info, latest[i]);
          try {
            const out = await ImageManipulator.manipulateAsync(uri, [{ crop }], {
              compress: 0.8,
              format: ImageManipulator.SaveFormat.JPEG,
            });
            return { uri: out.uri, originalUri: uri, skipped: false };
          } catch (cropErr) {
            Logger.error(`PhotoCropCarousel: crop failed for photo ${i}, using original`, cropErr);
            return { uri, originalUri: uri, skipped: false };
          }
        })
      );
      onComplete(results);
    } finally {
      setCommitting(false);
    }
  }, [
    transforms,
    currentIndex,
    tx,
    ty,
    scale,
    imageUris,
    imageInfos,
    skipped,
    buildCrop,
    persistCurrentTransform,
    onComplete,
  ]);

  if (!visible) {
    return null;
  }

  const isLast = currentIndex === totalCount - 1;
  const showCommit = isLast;
  const isCurrentSkipped = skipped.has(currentIndex);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <GestureHandlerRootView style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel photo selection"
          >
            <Ionicons name="close" size={28} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>
            Photo {currentIndex + 1} of {totalCount}
          </Text>
          <View style={styles.headerRight} />
        </View>

        {/* Image area */}
        <View style={styles.imageArea}>
          {loading || !currentInfo ? (
            <ActivityIndicator size="large" color={theme.colors.primary} />
          ) : (
            <>
              <GestureDetector gesture={composed}>
                <View style={styles.gestureSurface} pointerEvents="auto">
                  <Animated.View style={[styles.imageWrapper, animatedStyle]}>
                    <Image
                      source={{ uri: currentInfo.uri }}
                      style={{
                        width: currentInfo.width * currentInfo.fitScale,
                        height: currentInfo.height * currentInfo.fitScale,
                      }}
                      resizeMode="cover"
                    />
                  </Animated.View>
                </View>
              </GestureDetector>

              {/* Crop frame overlay — pointer-events: none so it doesn't eat gestures */}
              <View style={styles.frameOverlay} pointerEvents="none">
                <View style={styles.frame}>
                  {/* Rule-of-thirds grid */}
                  <View style={[styles.gridLine, styles.gridLineH, { top: '33.33%' }]} />
                  <View style={[styles.gridLine, styles.gridLineH, { top: '66.66%' }]} />
                  <View style={[styles.gridLine, styles.gridLineV, { left: '33.33%' }]} />
                  <View style={[styles.gridLine, styles.gridLineV, { left: '66.66%' }]} />
                </View>
              </View>

              {isCurrentSkipped && (
                <View style={styles.skippedBadge} pointerEvents="none">
                  <Text style={styles.skippedBadgeText}>SKIPPED</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={goBack}
              disabled={currentIndex === 0 || committing}
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
            >
              <Text style={[styles.secondaryButtonText, currentIndex === 0 && styles.disabledText]}>
                Back
              </Text>
            </Pressable>

            <Pressable
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={committing}
              accessibilityRole="button"
              accessibilityLabel="Skip this photo"
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </Pressable>

            {showCommit ? (
              <Pressable
                style={[
                  styles.primaryButton,
                  (usableCount === 0 || committing) && styles.primaryButtonDisabled,
                ]}
                onPress={handleCommit}
                disabled={usableCount === 0 || committing}
                accessibilityRole="button"
                accessibilityLabel={`Use ${usableCount} photos`}
              >
                {committing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Use all ({usableCount})</Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={styles.primaryButton}
                onPress={advance}
                disabled={committing}
                accessibilityRole="button"
                accessibilityLabel="Next photo"
              >
                <Text style={styles.primaryButtonText}>Next</Text>
              </Pressable>
            )}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 12,
    backgroundColor: theme.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
  },
  headerRight: {
    width: 28, // match close-icon width so title is centered
  },
  imageArea: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gestureSurface: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    borderWidth: 2,
    borderColor: '#fff',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  gridLineH: {
    left: 0,
    right: 0,
    height: 1,
  },
  gridLineV: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  skippedBadge: {
    position: 'absolute',
    top: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  skippedBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: theme.colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  disabledText: {
    color: theme.colors.text.muted,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
  },
});

export default PhotoCropCarousel;
