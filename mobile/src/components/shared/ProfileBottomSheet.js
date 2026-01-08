import React, {
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useCallback,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  Image,
  BackHandler,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';

const { height: screenHeight } = Dimensions.get('window');
const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44;
const availableHeight = screenHeight - statusBarHeight;

/**
 * Bottom sheet for viewing other users' full profiles
 * Styled to match the swipe card design
 */
const ProfileBottomSheet = forwardRef(({ profile, onClose }, ref) => {
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => [availableHeight * 0.85], []);
  const isOpenRef = useRef(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    open: () => {
      setCurrentPhotoIndex(0); // Reset to first photo when opening
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

  const calculateAge = birthDate => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Helper to get photo URL
  const getPhotoUrl = photo => {
    if (typeof photo === 'string') return photo;
    if (photo?.url) return photo.url;
    return null;
  };

  // Get all valid photo URLs
  const getPhotos = () => {
    if (!profile?.photos) return [];
    return profile.photos.map(getPhotoUrl).filter(Boolean);
  };

  // Handle photo tap to cycle through photos
  const handlePhotoTap = () => {
    const photos = getPhotos();
    if (photos.length > 1) {
      setCurrentPhotoIndex(prev => (prev + 1) % photos.length);
    }
  };

  // Get interests as strings
  const getInterests = () => {
    if (!profile?.interests) return [];
    return profile.interests
      .map(interest => {
        if (typeof interest === 'object') {
          return interest.interest?.name || interest.name || '';
        }
        return interest;
      })
      .filter(Boolean);
  };

  if (!profile) return null;

  const photos = getPhotos();
  const currentPhoto = photos[currentPhotoIndex] || photos[0];
  const age = profile.age || calculateAge(profile.birthDate);
  const interests = getInterests();

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

        {/* Photo indicators */}
        {photos.length > 1 && (
          <View style={styles.photoIndicators}>
            {photos.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.photoIndicator,
                  index === currentPhotoIndex && styles.photoIndicatorActive,
                ]}
              />
            ))}
          </View>
        )}

        {/* Card content - matches swipe card exactly */}
        <TouchableOpacity activeOpacity={0.95} onPress={handlePhotoTap} style={styles.card}>
          <Image source={{ uri: currentPhoto }} style={styles.cardImage} resizeMode="cover" />

          {/* Gradient overlay with profile info */}
          <View style={styles.cardOverlay}>
            <ScrollView
              style={styles.cardScrollView}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>
                  {profile.name}
                  {age && <Text>, {age}</Text>}
                </Text>
                {profile.location && <Text style={styles.cardLocation}>{profile.location}</Text>}
                {profile.bio && (
                  <Text style={styles.cardBio} numberOfLines={4}>
                    {profile.bio}
                  </Text>
                )}

                {interests.length > 0 && (
                  <View style={styles.interestsContainer}>
                    {interests.slice(0, 6).map((interest, index) => (
                      <View key={index} style={styles.interestTag}>
                        <Text style={styles.interestText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>

        {/* Tap hint for multiple photos */}
        {photos.length > 1 && <Text style={styles.tapHint}>Tap photo to see more</Text>}
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
  photoIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  photoIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  photoIndicatorActive: {
    backgroundColor: '#fff',
    width: 24,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    maxHeight: '50%',
  },
  cardScrollView: {
    padding: 20,
  },
  cardInfo: {},
  cardName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  cardLocation: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  cardBio: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 15,
    lineHeight: 20,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 5,
  },
  interestText: {
    color: '#fff',
    fontSize: 12,
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
