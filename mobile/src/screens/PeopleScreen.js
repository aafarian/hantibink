import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  PanGestureHandler,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;

const PeopleScreen = ({ navigation }) => {
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [position] = useState(new Animated.ValueXY());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      // Load sample profiles from local storage or create default ones
      const savedProfiles = await AsyncStorage.getItem('sampleProfiles');
      if (savedProfiles) {
        setProfiles(JSON.parse(savedProfiles));
      } else {
        // Create sample profiles
        const sampleProfiles = [
          {
            id: '1',
            name: 'Ani',
            age: 25,
            bio: 'Love hiking and Armenian coffee ☕',
            photos: ['https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400'],
            location: 'Yerevan, Armenia',
            interests: ['Hiking', 'Coffee', 'Photography'],
          },
          {
            id: '2',
            name: 'Saro',
            age: 28,
            bio: 'Software developer by day, musician by night 🎸',
            photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'],
            location: 'Yerevan, Armenia',
            interests: ['Music', 'Technology', 'Travel'],
          },
          {
            id: '3',
            name: 'Lusine',
            age: 23,
            bio: 'Art lover and foodie 🎨🍕',
            photos: ['https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400'],
            location: 'Yerevan, Armenia',
            interests: ['Art', 'Food', 'Travel'],
          },
          {
            id: '4',
            name: 'Armen',
            age: 27,
            bio: 'Passionate about Armenian history and culture 🇦🇲',
            photos: ['https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400'],
            location: 'Yerevan, Armenia',
            interests: ['History', 'Culture', 'Reading'],
          },
        ];
        setProfiles(sampleProfiles);
        await AsyncStorage.setItem('sampleProfiles', JSON.stringify(sampleProfiles));
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const handleLike = () => {
    if (currentIndex < profiles.length) {
      const currentProfile = profiles[currentIndex];
      saveLike(currentProfile);
      nextCard();
    }
  };

  const handleDislike = () => {
    if (currentIndex < profiles.length) {
      nextCard();
    }
  };

  const saveLike = async profile => {
    try {
      const existingLikes = await AsyncStorage.getItem('userLikes');
      const likes = existingLikes ? JSON.parse(existingLikes) : [];
      likes.push(profile.id);
      await AsyncStorage.setItem('userLikes', JSON.stringify(likes));
    } catch (error) {
      console.error('Error saving like:', error);
    }
  };

  const nextCard = () => {
    setCurrentIndex(prev => prev + 1);
    position.setValue({ x: 0, y: 0 });
  };

  const resetCards = () => {
    setCurrentIndex(0);
  };

  const renderCard = () => {
    if (currentIndex >= profiles.length) {
      return (
        <View style={styles.noMoreCards}>
          <Ionicons name="heart-outline" size={80} color="#ccc" />
          <Text style={styles.noMoreCardsText}>No more profiles to show</Text>
          <TouchableOpacity style={styles.resetButton} onPress={resetCards}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const profile = profiles[currentIndex];
    const rotate = position.x.interpolate({
      inputRange: [-width / 2, 0, width / 2],
      outputRange: ['-10deg', '0deg', '10deg'],
      extrapolate: 'clamp',
    });

    const likeOpacity = position.x.interpolate({
      inputRange: [0, width / 4],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    const dislikeOpacity = position.x.interpolate({
      inputRange: [-width / 4, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
          },
        ]}
      >
        <Image source={{ uri: profile.photos[0] }} style={styles.cardImage} />

        <View style={styles.cardOverlay}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>
              {profile.name}, {profile.age}
            </Text>
            <Text style={styles.cardLocation}>{profile.location}</Text>
            <Text style={styles.cardBio}>{profile.bio}</Text>

            <View style={styles.interestsContainer}>
              {profile.interests.map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Like/Dislike indicators */}
        <Animated.View style={[styles.likeIndicator, { opacity: likeOpacity }]}>
          <Text style={styles.likeText}>LIKE</Text>
        </Animated.View>

        <Animated.View style={[styles.dislikeIndicator, { opacity: dislikeOpacity }]}>
          <Text style={styles.dislikeText}>NOPE</Text>
        </Animated.View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter Button */}
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() =>
          navigation.navigate('Filter', {
            userPreferences: {
              ageRange: { min: 18, max: 50 }, // This should come from user profile
              maxDistance: 50, // This should come from user profile
              genderPreference: ['men', 'women'], // This should come from user profile
            },
          })
        }
      >
        <Ionicons name="filter" size={24} color="#FF6B6B" />
      </TouchableOpacity>

      <View style={styles.cardContainer}>{renderCard()}</View>

      <View style={[styles.actionsContainer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={styles.actionButton} onPress={handleDislike}>
          <Ionicons name="close" size={30} color="#FF6B6B" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons name="heart" size={30} color="#4ECDC4" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  filterButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: width - 40,
    height: height * 0.6,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
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
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 20,
  },
  cardInfo: {
    color: '#fff',
  },
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
  likeIndicator: {
    position: 'absolute',
    top: 50,
    right: 40,
    transform: [{ rotate: '15deg' }],
  },
  likeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4ECDC4',
    borderWidth: 4,
    borderColor: '#4ECDC4',
    padding: 10,
  },
  dislikeIndicator: {
    position: 'absolute',
    top: 50,
    left: 40,
    transform: [{ rotate: '-15deg' }],
  },
  dislikeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B6B',
    borderWidth: 4,
    borderColor: '#FF6B6B',
    padding: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    padding: 20,
    paddingBottom: 40,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noMoreCards: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noMoreCardsText: {
    fontSize: 18,
    color: '#666',
    marginTop: 20,
    marginBottom: 30,
  },
  resetButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PeopleScreen;
