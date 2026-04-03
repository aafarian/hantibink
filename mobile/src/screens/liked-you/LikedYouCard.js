import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - 30) / 2; // 2 columns with padding

/**
 * LikedYouCard - Individual card component for the Liked You grid
 *
 * @param {Object} props
 * @param {Object} props.item - User data object
 * @param {number} props.index - Position in the list (used for layout)
 * @param {boolean} props.isPremium - Whether current user has premium
 * @param {Function} props.onPress - Called when card is pressed
 * @param {Function} props.onLike - Called when like button is pressed
 * @param {Function} props.onPass - Called when pass button is pressed
 * @param {Object|null} props.loadingAction - Loading state { userId, type: 'like' | 'pass' }
 */
const LikedYouCard = ({ item, index, isPremium, onPress, onLike, onPass, loadingAction }) => {
  const isEven = index % 2 === 0;

  return (
    <TouchableOpacity
      style={[styles.likeCard, isEven && styles.leftCard]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {item.isSuperLike && (
        <View style={styles.superLikeBadge}>
          <Ionicons name="star" size={16} color={theme.colors.premium} />
        </View>
      )}

      {item.isNew && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      )}

      <View style={styles.imageContainer}>
        {/* Show blurred/pixelated image for non-premium users */}
        {!isPremium ? (
          <Image
            source={{ uri: item.mainPhoto }}
            style={styles.cardImage}
            blurRadius={40} // Strong blur for maximum privacy
          />
        ) : (
          <Image source={{ uri: item.mainPhoto }} style={styles.cardImage} />
        )}

        {!isPremium && (
          <View style={styles.blurOverlay}>
            <View style={styles.lockCircle}>
              <Ionicons name="lock-closed" size={24} color="white" />
            </View>
          </View>
        )}

        {isPremium && (
          <LinearGradient
            colors={['transparent', theme.colors.overlay.heavy]}
            style={styles.gradient}
          >
            <Text style={styles.cardName}>
              {item.name}, {item.age}
            </Text>
            <Text style={styles.cardLocation}>
              <Ionicons name="location-outline" size={12} color="white" /> {item.location}
            </Text>
          </LinearGradient>
        )}
      </View>

      {isPremium && (
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.passQuickButton]}
            onPress={e => {
              e.stopPropagation();
              onPass(item);
            }}
            disabled={loadingAction?.userId === item.id}
          >
            {loadingAction?.userId === item.id && loadingAction?.type === 'pass' ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="close" size={20} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.likeQuickButton]}
            onPress={e => {
              e.stopPropagation();
              onLike(item);
            }}
            disabled={loadingAction?.userId === item.id}
          >
            {loadingAction?.userId === item.id && loadingAction?.type === 'like' ? (
              <ActivityIndicator size="small" color={theme.colors.secondary} />
            ) : (
              <Ionicons name="heart" size={20} color={theme.colors.secondary} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  likeCard: {
    width: CARD_WIDTH,
    marginBottom: 15,
    borderRadius: 15,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leftCard: {
    marginRight: 10,
  },
  imageContainer: {
    position: 'relative',
    height: CARD_WIDTH * 1.3,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)', // Slight dark overlay for better contrast
  },
  lockCircle: {
    backgroundColor: theme.colors.overlay.heavy,
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
  },
  cardName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: 4,
  },
  cardLocation: {
    color: 'white',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
  },
  superLikeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: theme.colors.premium,
    borderRadius: 15,
    padding: 6,
    zIndex: 1,
  },
  newBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: theme.colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 1,
  },
  newBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamily.bold,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
  quickActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passQuickButton: {
    backgroundColor: '#FFE5E5',
  },
  likeQuickButton: {
    backgroundColor: '#E5F9F9',
  },
});

/**
 * Custom comparison function for React.memo
 * Prevents re-renders when props haven't meaningfully changed
 */
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.mainPhoto === nextProps.item.mainPhoto &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.age === nextProps.item.age &&
    prevProps.item.location === nextProps.item.location &&
    prevProps.item.isSuperLike === nextProps.item.isSuperLike &&
    prevProps.item.isNew === nextProps.item.isNew &&
    prevProps.index === nextProps.index &&
    prevProps.isPremium === nextProps.isPremium &&
    prevProps.loadingAction?.userId === nextProps.loadingAction?.userId &&
    prevProps.loadingAction?.type === nextProps.loadingAction?.type
  );
};

export default memo(LikedYouCard, areEqual);
