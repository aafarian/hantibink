import React, { useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Logger from '../../utils/logger';
import { theme } from '../../styles/theme';

const { height: screenHeight } = Dimensions.get('window');
const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44;
const availableHeight = screenHeight - statusBarHeight;

/**
 * Reusable PhotoViewer component that opens a full-screen bottom sheet
 * Can be used anywhere in the app for viewing photos
 */
const PhotoViewer = forwardRef(
  (
    {
      photos = [],
      initialPhotoIndex = 0,
      showActions = false, // Whether to show action buttons
      onSetMain,
      onDelete,
      actionButtons = [], // Custom action buttons
      title = 'Photo',
      children, // Custom content below photo
      onClose, // Callback when bottom sheet closes
    },
    ref
  ) => {
    const bottomSheetRef = useRef(null);
    const snapPoints = useMemo(() => [availableHeight], []); // Full screen minus status bar

    const [currentPhotoIndex, setCurrentPhotoIndex] = React.useState(initialPhotoIndex);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      open: photoIndex => {
        const indexToUse = photoIndex !== undefined ? photoIndex : initialPhotoIndex;

        setCurrentPhotoIndex(indexToUse);
        // Add a small delay to ensure BottomSheet is ready
        setTimeout(() => {
          bottomSheetRef.current?.expand();
        }, 50);
      },
      close: () => {
        bottomSheetRef.current?.close();
      },
    }));

    const currentPhoto = photos[currentPhotoIndex];

    const handleClose = useCallback(() => {
      bottomSheetRef.current?.close();
      onClose?.(); // Notify parent component
    }, [onClose]);

    const handlePrevious = useCallback(() => {
      if (currentPhotoIndex > 0) {
        setCurrentPhotoIndex(currentPhotoIndex - 1);
      }
    }, [currentPhotoIndex]);

    const handleNext = useCallback(() => {
      if (currentPhotoIndex < photos.length - 1) {
        setCurrentPhotoIndex(currentPhotoIndex + 1);
      }
    }, [currentPhotoIndex, photos.length]);

    // Handle swipe gestures for photo navigation and sheet closing
    const onGestureEvent = useCallback(
      event => {
        const { translationX, translationY, state, velocityY } = event.nativeEvent;

        if (state === State.END) {
          const HORIZONTAL_THRESHOLD = 50;
          const VERTICAL_THRESHOLD = 150; // Increased for less sensitivity
          const VELOCITY_THRESHOLD = 800; // Increased for less sensitivity
          const HORIZONTAL_PRIORITY_THRESHOLD = 30; // If horizontal > vertical, prioritize navigation

          // Prioritize horizontal navigation if user is clearly swiping left/right
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

          // Check for vertical drag to close (much more restrictive now)
          if (
            (Math.abs(translationY) > VERTICAL_THRESHOLD &&
              Math.abs(translationX) < HORIZONTAL_PRIORITY_THRESHOLD) ||
            (translationY > 60 &&
              velocityY > VELOCITY_THRESHOLD &&
              Math.abs(translationX) < HORIZONTAL_PRIORITY_THRESHOLD)
          ) {
            if (translationY > 0) {
              // Dragging down
              handleClose();
              return;
            }
          }

          // Check for horizontal swipe for photo navigation (fallback)
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
          // Reset state when fully closed
          setCurrentPhotoIndex(initialPhotoIndex);
          onClose?.(); // Notify parent component
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
                  {/* Make Main Button - only show if not already main and onSetMain provided */}
                  {showActions && onSetMain && !isMainPhoto && (
                    <TouchableOpacity onPress={handleSetMain} style={styles.headerActionButton}>
                      <Ionicons name="star" size={22} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                  {/* Delete Button */}
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

              {/* Photo Display */}
              <View style={styles.photoContainer}>
                {currentPhoto ? (
                  <Image
                    source={{
                      uri: typeof currentPhoto === 'string' ? currentPhoto : currentPhoto?.url,
                    }}
                    style={styles.photo}
                    resizeMode="contain"
                    onError={error => {
                      Logger.log('Photo failed to load:', error, currentPhoto);
                    }}
                  />
                ) : (
                  <View style={styles.noPhotoContainer}>
                    <Text style={styles.noPhotoText}>No photo to display</Text>
                  </View>
                )}

                {/* Navigation Arrows (if multiple photos) */}
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
                        onPress={() => setCurrentPhotoIndex(index)}
                      />
                    ))}
                  </View>
                )}

                {/* Custom Action Buttons (if any) */}
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
    flexShrink: 0, // Prevent shrinking
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
    flexShrink: 0, // Prevent shrinking
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
    height: 400, // Fixed height for photo display
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: theme.colors.text.primary, // Dark background for photo viewing
  },
  photo: {
    width: '100%',
    height: '100%',
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
