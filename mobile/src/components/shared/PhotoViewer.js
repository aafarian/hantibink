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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Logger from '../../utils/logger';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
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
        const { translationX, translationY, state, velocityX, velocityY } = event.nativeEvent;

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

    const handleSetMain = useCallback(() => {
      onSetMain?.(currentPhotoIndex);
      handleClose();
    }, [currentPhotoIndex, onSetMain, handleClose]);

    const handleDelete = useCallback(() => {
      onDelete?.(currentPhotoIndex);
      handleClose();
    }, [currentPhotoIndex, onDelete, handleClose]);

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
                <View style={styles.headerLeft}>
                  <Text style={styles.headerTitle}>
                    {photos.length > 1
                      ? `${title} (${currentPhotoIndex + 1}/${photos.length})`
                      : title}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
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
                        <Ionicons name="chevron-back" size={30} color="#fff" />
                      </TouchableOpacity>
                    )}

                    {currentPhotoIndex < photos.length - 1 && (
                      <TouchableOpacity
                        style={[styles.navButton, styles.nextButton]}
                        onPress={handleNext}
                      >
                        <Ionicons name="chevron-forward" size={30} color="#fff" />
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

                {/* Action Buttons */}
                {showActions && (
                  <View style={styles.actionButtons}>
                    {onDelete && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={handleDelete}
                      >
                        <Ionicons name="trash" size={20} color="#FF4444" />
                        <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Custom action buttons */}
                    {actionButtons.map((button, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.actionButton, button.style]}
                        onPress={button.onPress}
                      >
                        {button.icon && (
                          <Ionicons name={button.icon} size={20} color={button.color || '#333'} />
                        )}
                        <Text style={[styles.actionButtonText, { color: button.color || '#333' }]}>
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
    backgroundColor: '#fff',
  },
  bottomSheetIndicator: {
    backgroundColor: '#ccc',
    width: 40,
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: '#fff',
    flexDirection: 'column',
  },
  gestureWrapper: {
    flex: 1,
  },
  bottomSection: {
    backgroundColor: '#fff',
    flexShrink: 0, // Prevent shrinking
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexShrink: 0, // Prevent shrinking
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoContainer: {
    height: 400, // Fixed height for photo display
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#000', // Dark background for photo viewing
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -25,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#FF6B6B',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  deleteButton: {
    backgroundColor: '#fff5f5',
    borderColor: '#fed7d7',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  deleteButtonText: {
    color: '#FF4444',
  },
  customContent: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  noPhotoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotoText: {
    color: '#fff',
    fontSize: 16,
  },
});

PhotoViewer.displayName = 'PhotoViewer';

export default PhotoViewer;
