import React, {
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import ProfileCard from './ProfileCard';

const { height: screenHeight } = Dimensions.get('window');
const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44;
const availableHeight = screenHeight - statusBarHeight;

/**
 * Bottom sheet for viewing other users' full profiles
 * Uses the shared ProfileCard component for consistent styling
 */
const ProfileBottomSheet = forwardRef(({ profile, onClose }, ref) => {
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => [availableHeight * 0.85], []);
  const isOpenRef = useRef(false);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    open: () => {
      bottomSheetRef.current?.expand();
      isOpenRef.current = true;
    },
    close: () => {
      bottomSheetRef.current?.close();
      isOpenRef.current = false;
    },
  }));

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.close();
    isOpenRef.current = false;
    onClose?.();
  }, [onClose]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isOpenRef.current) {
        handleClose();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [handleClose]);

  if (!profile) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetIndicator}
      topInset={statusBarHeight}
      onChange={index => {
        if (index === -1) {
          isOpenRef.current = false;
          onClose?.();
        } else {
          isOpenRef.current = true;
        }
      }}
    >
      <View style={styles.container}>
        {/* Close button */}
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close-circle" size={32} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>

        {/* Profile Card with full details */}
        <ProfileCard profile={profile} showFullDetails={true} style={styles.profileCard} />

        {/* Tap hint */}
        <Text style={styles.tapHint}>Tap photo to see more</Text>
      </View>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheetIndicator: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    width: 36,
    height: 4,
  },
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 20,
    zIndex: 10,
  },
  profileCard: {
    flex: 1,
  },
  tapHint: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 12,
  },
});

ProfileBottomSheet.displayName = 'ProfileBottomSheet';

export default ProfileBottomSheet;
