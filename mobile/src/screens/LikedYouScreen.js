import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../contexts/ToastContext';
import { useTabNavigation } from '../hooks/useTabNavigation';
import { useMatchesWithProfiles } from '../hooks/useMatches';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorScreen, EmptyState } from '../components/ErrorScreen';
import { MatchCard } from '../components/MatchCard';
import { commonStyles } from '../styles/commonStyles';
import Logger from '../utils/logger';
import { getUserProfilePhoto } from '../utils/profileHelpers';
const LikedYouScreen = () => {
  const { showError } = useToast();
  const { navigateToMessages } = useTabNavigation();
  const { conversations, loading, error, refresh } = useMatchesWithProfiles();

  // Convert conversations to the format this screen expects
  const matchesWithProfiles = conversations.map(conversation => ({
    id: conversation.otherUserId,
    matchId: conversation.matchId,
    name: conversation.otherUser?.name || 'Unknown User',
    age: conversation.otherUser?.age || '?',
    location: conversation.otherUser?.location || 'Unknown location',
    bio: conversation.otherUser?.bio || 'No bio available',
    photos: conversation.otherUser?.photos || [],
    mainPhoto:
      conversation.otherUser?.mainPhoto ||
      conversation.otherUser?.photos?.[0] ||
      'https://via.placeholder.com/150',
    otherUser: conversation.otherUser, // Pass through for MatchCard component
  }));

  const incomingLikes = []; // TODO: Implement incoming likes feature

  const handleLikeBack = async profile => {
    // TODO: Implement like back functionality when incoming likes feature is ready
    Logger.info('Like back pressed for:', profile.name);
    showError('Incoming likes feature coming soon!');
  };

  const handlePass = profile => {
    // TODO: Implement pass functionality when incoming likes feature is ready
    Logger.info('Pass pressed for:', profile.name);
  };

  const renderMatch = ({ item }) => (
    <MatchCard
      match={item}
      onPress={() => {
        // TODO: Navigate to user profile or chat
        Logger.info('Tapped on match:', item.name);
      }}
      onMessagePress={() => {
        const navResult = navigateToMessages();
        if (!navResult.success) {
          showError('Failed to open messages. Please go to the Messages tab manually.');
        }
      }}
    />
  );

  const renderIncomingLike = ({ item }) => (
    <View style={styles.likeCard}>
      <Image source={{ uri: getUserProfilePhoto(item) }} style={styles.likePhoto} />
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

  if (loading) {
    return <LoadingScreen message="Loading your matches..." />;
  }

  if (error) {
    return <ErrorScreen message="Failed to load matches" onRetry={refresh} />;
  }

  return (
    <ScrollView style={commonStyles.container}>
      {/* Mutual Matches Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="heart" size={24} color="#FF6B6B" />
          <Text style={styles.sectionTitle}>Mutual Matches</Text>
          <Text style={styles.matchCount}>({matchesWithProfiles.length})</Text>
        </View>

        {matchesWithProfiles.length > 0 ? (
          <FlatList
            data={matchesWithProfiles}
            renderItem={renderMatch}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        ) : (
          <EmptyState
            icon="heart-outline"
            title="No mutual matches yet"
            subtitle="Keep swiping to find your match!"
          />
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
