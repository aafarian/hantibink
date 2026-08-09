import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import Skeleton from './Skeleton';
import { theme } from '../../styles/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const GRID_CARD_WIDTH = (screenWidth - 30) / 2;

/**
 * Loading placeholder for the Messages conversation list —
 * avatar circle + name/preview lines shaped like MatchCard rows.
 */
export const MatchListSkeleton = ({ rows = 6 }) => (
  <View style={styles.listContainer}>
    {Array.from({ length: rows }).map((_, index) => (
      <Reanimated.View
        key={`match-skeleton-${index}`}
        entering={FadeInDown.delay(index * 40).duration(300)}
        style={styles.matchRow}
      >
        <Skeleton width={60} height={60} borderRadius={30} />
        <View style={styles.matchRowText}>
          <Skeleton width="45%" height={16} borderRadius={4} />
          <Skeleton width="70%" height={12} borderRadius={4} style={styles.lineSpacing} />
        </View>
      </Reanimated.View>
    ))}
  </View>
);

/**
 * Loading placeholder for the Liked You two-column grid.
 */
export const CardGridSkeleton = ({ cards = 6 }) => (
  <View style={styles.gridContainer}>
    {Array.from({ length: cards }).map((_, index) => (
      <Reanimated.View
        key={`grid-skeleton-${index}`}
        entering={FadeInDown.delay(index * 40).duration(300)}
        style={styles.gridCard}
      >
        <Skeleton
          width={GRID_CARD_WIDTH}
          height={GRID_CARD_WIDTH * 1.3}
          borderRadius={theme.borderRadius.lg}
        />
      </Reanimated.View>
    ))}
  </View>
);

/**
 * Loading placeholder for the discovery deck — one large card silhouette.
 */
export const DeckCardSkeleton = () => (
  <Reanimated.View entering={FadeInDown.duration(300)} style={styles.deckContainer}>
    <Skeleton
      width={screenWidth - theme.spacing.xl * 2}
      height={screenHeight * 0.62}
      borderRadius={theme.borderRadius.xl}
    />
    <View style={styles.deckMeta}>
      <Skeleton width="50%" height={20} borderRadius={4} />
      <Skeleton width="35%" height={14} borderRadius={4} style={styles.lineSpacing} />
    </View>
  </Reanimated.View>
);

const styles = StyleSheet.create({
  listContainer: {
    padding: theme.spacing.md,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  matchRowText: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  lineSpacing: {
    marginTop: theme.spacing.sm,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  gridCard: {
    marginBottom: theme.spacing.lg,
  },
  deckContainer: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
  },
  deckMeta: {
    width: screenWidth - theme.spacing.xl * 2,
    marginTop: theme.spacing.lg,
  },
});
