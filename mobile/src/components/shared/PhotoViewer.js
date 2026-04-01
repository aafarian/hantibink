import React, { useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import Logger from '../../utils/logger';
import { theme } from '../../styles/theme';

const { height: screenHeight } = Dimensions.get('window');
const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44;
const availableHeight = screenHeight - statusBarHeight;

/**
 * Reusable PhotoViewer component that opens a full-screen bottom sheet
 * Can be used anywhere in the app for viewing photos
 * Features smooth crossfade transitions between photos
 */
const PhotoViewer = forwardRef(
  (
    {
      photos = [],
      initialPhotoIndex = 0,
      showActions = false,
      onSetMain,
      onDelete,
      actionButtons = [],
      title = 'Photo',
      children,
      onClose,
    },
    ref
  ) => {
    const bottomSheetRef = useRef(null);
    const snapPoints = useMemo(() => [availableHeight], []);

    const [currentPhotoIndex, setCurrentPhotoIndex] = React.useState(initialPhotoIndex);
    const [nextPhotoIndex, setNextPhotoIndex] = React.useState(null);

    // Animation values for photo transitions
    const currentOpacity = useSharedValue(1);
    const currentScale = useSharedValue(1);
    const currentTranslateX = useSharedValue(0);
    const nextOpacity = useSharedValue(0);
    const nextScale = useSharedValue(0.95);
    const nextTranslateX = useSharedValue(0);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      open: photoIndex => {
        const indexToUse = photoIndex !== undefined ? photoIndex : initialPhotoIndex;
        setCurrentPhotoIndex(indexToUse);
        setNextPhotoIndex(null);
        // Reset animation values
        currentOpacity.value = 1;
        currentScale.value = 1;
        currentTranslateX.value = 0;
        setTimeout(() => {
          bottomSheetRef.current?.expand();
        }, 50);
      },
      close: () => {
        bottomSheetRef.current?.close();
      },
    }));

    const currentPhoto = photos[currentPhotoIndex];
    const nextPhoto = nextPhotoIndex !== null ? photos[nextPhotoIndex] : null;

    const handleClose = useCallback(() => {
      bottomSheetRef.current?.close();
      onClose?.();
    }, [onClose]);

    // Animate to a new photo with crossfade and slide
    const animateToPhoto = useCallback(
      (newIndex, direction) => {
        if (newIndex === currentPhotoIndex || newIndex < 0 || newIndex >= photos.length) return;

        // Set up the next photo
        setNextPhotoIndex(newIndex);

        // Initial position for next photo (slight offset in direction of swipe)
        const slideOffset = direction === 'next' ? 30 : -30;
        nextTranslateX.value = slideOffset;
        nextOpacity.value = 0;
        nextScale.value = 0.98;

        // Animate current photo out
        currentOpacity.value = withTiming(0, { duration: 200 });
        currentScale.value = withTiming(0.95, { duration: 200 });
        currentTranslateX.value = withTiming(-slideOffset, { duration: 200 });

        // Animate next photo in
        nextOpacity.value = withTiming(1, { duration: 250 });
        nextScale.value = withSpring(1, { damping: 15, stiffness: 150 });
        nextTranslateX.value = withTiming(0, {
          duration: 250,
          easing: Easing.out(Easing.ease),
        });

        // After animation completes, update state
        setTimeout(() => {
          setCurrentPhotoIndex(newIndex);
          setNextPhotoIndex(null);
          // Reset animation values for current
          currentOpacity.value = 1;
          currentScale.value = 1;
          currentTranslateX.value = 0;
        }, 260);
      },
      [
        currentPhotoIndex,
        photos.length,
        currentOpacity,
        currentScale,
        currentTranslateX,
        nextOpacity,
        nextScale,
        nextTranslateX,
      ]
    );

    const handlePrevious = useCallback(() => {
      if (currentPhotoIndex > 0) {
        animateToPhoto(currentPhotoIndex - 1, 'prev');
      }
    }, [currentPhotoIndex, animateToPhoto]);

    const handleNext = useCallback(() => {
      if (currentPhotoIndex < photos.length - 1) {
        animateToPhoto(currentPhotoIndex + 1, 'next');
      }
    }, [currentPhotoIndex, photos.length, animateToPhoto]);

    // Handle swipe gestures for photo navigation and sheet closing
    const onGestureEvent = useCallback(
      event => {
        const { translationX, translationY, state, velocityY } = event.nativeEvent;

        if (state === State.END) {
          const HORIZONTAL_THRESHOLD = 50;
          const VERTICAL_THRESHOLD = 150;
          const VELOCITY_THRESHOLD = 800;
          const HORIZONTAL_PRIORITY_THRESHOLD = 30;

          // Prioritize horizontal navigation
          if (
            Math.abs(translationX) > HORIZONTAL_PRIORITY_THRESHOLD &&
            Math.abs(translationX) > Math.abs(translationY)
          ) {
            if (translationX > HORIZONTAL_THRESHOLD) {
              handlePrevious();
              return;
            } else if (translationX < -HORIZONTAL_THRESHOLD) {
              handleNext();
              return;
            }
          }

          // Check for vertical drag to close
          if (
            (Math.abs(translationY) > VERTICAL_THRESHOLD &&
              Math.abs(translationX) < HORIZONTAL_PRIORITY_THRESHOLD) ||
            (translationY > 60 &&
              velocityY > VELOCITY_THRESHOLD &&
              Math.abs(translationX) < HORIZONTAL_PRIORITY_THRESHOLD)
          ) {
            if (translationY > 0) {
              handleClose();
              return;
            }
          }

          // Fallback horizontal swipe
          if (Math.abs(translationY) < VERTICAL_THRESHOLD / 3) {
            if (translationX > HORIZONTAL_THRESHOLD) {
              handlePrevious();
            } else if (translationX < -HORIZONTAL_THRESHOLD) {
              handleNext();
            }
          }
        }
      },
      [handlePrevious, handleNext, handleClose]
    );

    const isMainPhoto = currentPhotoIndex === 0;

    const handleSetMain = useCallback(() => {
      if (isMainPhoto) return;
      onSetMain?.(currentPhotoIndex);
      handleClose();
    }, [currentPhotoIndex, onSetMain, handleClose, isMainPhoto]);

    const canDelete = photos.length > 1;

    const handleDelete = useCallback(() => {
      if (!canDelete) {
        Alert.alert(
          'Cannot Delete',
          'You need at least one photo on your profile. Add another photo before deleting this one.',
          [{ text: 'OK' }]
        );
        return;
      }
      onDelete?.(currentPhotoIndex);
      handleClose();
    }, [currentPhotoIndex, onDelete, handleClose, canDelete]);

    // Tap on dot to go directly to photo
    const handleDotPress = useCallback(
      index => {
        if (index === currentPhotoIndex) return;
        animateToPhoto(index, index > currentPhotoIndex ? 'next' : 'prev');
      },
      [currentPhotoIndex, animateToPhoto]
    );

    // Animated styles
    const currentPhotoStyle = useAnimatedStyle(() => ({
      opacity: currentOpacity.value,
      transform: [{ scale: currentScale.value }, { translateX: currentTranslateX.value }],
    }));

    const nextPhotoStyle = useAnimatedStyle(() => ({
      opacity: nextOpacity.value,
      transform: [{ scale: nextScale.value }, { translateX: nextTranslateX.value }],
    }));

    if (!photos.length) return null;

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        onClose={() => {
          setCurrentPhotoIndex(initialPhotoIndex);
          setNextPhotoIndex(null);
          onClose?.();
        }}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <PanGestureHandler onHandlerStateChange={onGestureEvent}>
            <View style={styles.gestureWrapper}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={handleClose} style={styles.backButton}>
                  <Ionicons name="arrow-back" size={24} color={theme.colors.text.secondary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle}>
                    {photos.length > 1
                      ? `${title} (${currentPhotoIndex + 1}/${photos.length})`
                      : title}
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  {showActions && onSetMain && !isMainPhoto && (
                    <TouchableOpacity onPress={handleSetMain} style={styles.headerActionButton}>
                      <Ionicons name="star" size={22} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                  {showActions && onDelete && (
                    <TouchableOpacity
                      onPress={handleDelete}
                      style={[
                        styles.headerActionButton,
                        !canDelete && styles.headerActionButtonDisabled,
                      ]}
                    >
                      <Ionicons
                        name="trash"
                        size={22}
                        color={canDelete ? theme.colors.status.error : theme.colors.border.medium}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Photo Display with animated transitions */}
              <View style={styles.photoContainer}>
                {/* Current Photo */}
                {currentPhoto && (
                  <Animated.Image
                    source={{
                      uri: typeof currentPhoto === 'string' ? currentPhoto : currentPhoto?.url,
                    }}
                    style={[styles.photo, styles.photoAbsolute, currentPhotoStyle]}
                    resizeMode="contain"
                    onError={error => {
                      Logger.log('Photo failed to load:', error, currentPhoto);
                    }}
                  />
                )}

                {/* Next Photo (during transition) */}
                {nextPhoto && (
                  <Animated.Image
                    source={{
                      uri: typeof nextPhoto === 'string' ? nextPhoto : nextPhoto?.url,
                    }}
                    style={[styles.photo, styles.photoAbsolute, nextPhotoStyle]}
                    resizeMode="contain"
                  />
                )}

                {!currentPhoto && !nextPhoto && (
                  <View style={styles.noPhotoContainer}>
                    <Text style={styles.noPhotoText}>No photo to display</Text>
                  </View>
                )}

                {/* Navigation Arrows */}
                {photos.length > 1 && (
                  <>
                    {currentPhotoIndex > 0 && (
                      <TouchableOpacity
                        style={[styles.navButton, styles.prevButton]}
                        onPress={handlePrevious}
                      >
                        <Ionicons name="chevron-back" size={30} color={theme.colors.text.white} />
                      </TouchableOpacity>
                    )}

                    {currentPhotoIndex < photos.length - 1 && (
                      <TouchableOpacity
                        style={[styles.navButton, styles.nextButton]}
                        onPress={handleNext}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={30}
                          color={theme.colors.text.white}
                        />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>

              {/* Bottom Section */}
              <View style={styles.bottomSection}>
                {/* Photo Dots Indicator */}
                {photos.length > 1 && (
                  <View style={styles.dotsContainer}>
                    {photos.map((_, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.dot, index === currentPhotoIndex && styles.activeDot]}
                        onPress={() => handleDotPress(index)}
                      />
                    ))}
                  </View>
                )}

                {/* Custom Action Buttons */}
                {showActions && actionButtons.length > 0 && (
                  <View style={styles.actionButtons}>
                    {actionButtons.map((button, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.actionButton, button.style]}
                        onPress={button.onPress}
                      >
                        {button.icon && (
                          <Ionicons
                            name={button.icon}
                            size={20}
                            color={button.color || theme.colors.text.primary}
                          />
                        )}
                        <Text
                          style={[
                            styles.actionButtonText,
                            { color: button.color || theme.colors.text.primary },
                          ]}
                        >
                          {button.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Custom Content */}
                {children && <View style={styles.customContent}>{children}</View>}
              </View>
            </View>
          </PanGestureHandler>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: theme.colors.background.primary,
  },
  bottomSheetIndicator: {
    backgroundColor: theme.colors.border.medium,
    width: 40,
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    flexDirection: 'column',
  },
  gestureWrapper: {
    flex: 1,
  },
  bottomSection: {
    backgroundColor: theme.colors.background.primary,
    flexShrink: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: theme.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
    flexShrink: 0,
  },
  backButton: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionButton: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionButtonDisabled: {
    opacity: 0.5,
  },
  headerTitle: {
    color: theme.colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  photoContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: theme.colors.text.primary,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -25,
    backgroundColor: theme.colors.background.overlay,
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  prevButton: {
    left: 20,
  },
  nextButton: {
    right: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: theme.colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border.light,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: theme.colors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: theme.colors.background.primary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.secondary,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  customContent: {
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  noPhotoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotoText: {
    color: theme.colors.text.white,
    fontSize: 16,
  },
});

PhotoViewer.displayName = 'PhotoViewer';

export default PhotoViewer;
