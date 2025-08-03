import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LikedYouScreen = () => {
  const [matches, setMatches] = useState([]);
  const [incomingLikes, setIncomingLikes] = useState([]);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      // Load user's likes
      const userLikes = await AsyncStorage.getItem('userLikes');
      const likes = userLikes ? JSON.parse(userLikes) : [];

      // Load sample profiles to simulate matches
      const sampleProfiles = await AsyncStorage.getItem('sampleProfiles');
      const profiles = sampleProfiles ? JSON.parse(sampleProfiles) : [];

      // Simulate mutual matches (profiles that also liked the user)
      const mutualMatches = profiles.filter(
        profile => likes.includes(profile.id) && Math.random() > 0.5 // 50% chance of mutual match
      );

      // Simulate incoming likes (profiles that liked the user but user hasn't seen them yet)
      const incoming = profiles.filter(
        profile => !likes.includes(profile.id) && Math.random() > 0.7 // 30% chance of incoming like
      );

      setMatches(mutualMatches);
      setIncomingLikes(incoming);
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  };

  const handleLikeBack = async profile => {
    try {
      // Add to user's likes
      const existingLikes = await AsyncStorage.getItem('userLikes');
      const likes = existingLikes ? JSON.parse(existingLikes) : [];
      if (!likes.includes(profile.id)) {
        likes.push(profile.id);
        await AsyncStorage.setItem('userLikes', JSON.stringify(likes));
      }

      // Move from incoming likes to matches
      setIncomingLikes(prev => prev.filter(p => p.id !== profile.id));
      setMatches(prev => [...prev, profile]);
    } catch (error) {
      console.error('Error handling like back:', error);
    }
  };

  const handlePass = profile => {
    setIncomingLikes(prev => prev.filter(p => p.id !== profile.id));
  };

  const renderMatch = ({ item }) => (
    <View style={styles.matchCard}>
      <Image source={{ uri: item.photos[0] }} style={styles.matchPhoto} />
      <View style={styles.matchInfo}>
        <Text style={styles.matchName}>
          {item.name}, {item.age}
        </Text>
        <Text style={styles.matchLocation}>{item.location}</Text>
        <Text style={styles.matchBio} numberOfLines={2}>
          {item.bio}
        </Text>
      </View>
      <TouchableOpacity style={styles.messageButton}>
        <Ionicons name="chatbubble" size={20} color="#fff" />
        <Text style={styles.messageButtonText}>Message</Text>
      </TouchableOpacity>
    </View>
  );

  const renderIncomingLike = ({ item }) => (
    <View style={styles.likeCard}>
      <Image source={{ uri: item.photos[0] }} style={styles.likePhoto} />
      <View style={styles.likeInfo}>
        <Text style={styles.likeName}>
          {item.name}, {item.age}
        </Text>
        <Text style={styles.likeLocation}>{item.location}</Text>
        <Text style={styles.likeBio} numberOfLines={2}>
          {item.bio}
        </Text>
      </View>
      <View style={styles.likeActions}>
        <TouchableOpacity
          style={[styles.likeActionButton, styles.passButton]}
          onPress={() => handlePass(item)}
        >
          <Ionicons name="close" size={20} color="#FF6B6B" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.likeActionButton, styles.likeBackButton]}
          onPress={() => handleLikeBack(item)}
        >
          <Ionicons name="heart" size={20} color="#4ECDC4" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Mutual Matches Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="heart" size={24} color="#FF6B6B" />
          <Text style={styles.sectionTitle}>Mutual Matches</Text>
          <Text style={styles.matchCount}>({matches.length})</Text>
        </View>

        {matches.length > 0 ? (
          <FlatList
            data={matches}
            renderItem={renderMatch}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={50} color="#ccc" />
            <Text style={styles.emptyStateText}>No mutual matches yet</Text>
            <Text style={styles.emptyStateSubtext}>Keep swiping to find your match!</Text>
          </View>
        )}
      </View>

      {/* Incoming Likes Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="eye" size={24} color="#4ECDC4" />
          <Text style={styles.sectionTitle}>Liked You</Text>
          <Text style={styles.likeCount}>({incomingLikes.length})</Text>
        </View>

        {incomingLikes.length > 0 ? (
          <FlatList
            data={incomingLikes}
            renderItem={renderIncomingLike}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="eye-outline" size={50} color="#ccc" />
            <Text style={styles.emptyStateText}>No new likes</Text>
            <Text style={styles.emptyStateSubtext}>Your profile will appear to others soon!</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 10,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
  },
  matchCount: {
    fontSize: 16,
    color: '#FF6B6B',
    marginLeft: 5,
  },
  likeCount: {
    fontSize: 16,
    color: '#4ECDC4',
    marginLeft: 5,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    marginBottom: 10,
  },
  matchPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  matchLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  matchBio: {
    fontSize: 12,
    color: '#999',
  },
  messageButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
  },
  likeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    marginBottom: 10,
  },
  likePhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  likeInfo: {
    flex: 1,
  },
  likeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  likeLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  likeBio: {
    fontSize: 12,
    color: '#999',
  },
  likeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  likeActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  likeBackButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default LikedYouScreen;
