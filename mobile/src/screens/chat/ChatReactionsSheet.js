import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { getUserProfilePhoto, getUserDisplayName } from '../../utils/profileHelpers';
import { theme } from '../../styles/theme';

/**
 * ChatReactionsSheet - Bottom sheet showing detailed reactions on a message
 * Displays tabs (All/You/Them), scrollable list of reactions, and add reaction button
 */
const ChatReactionsSheet = ({
  sheetRef,
  message,
  currentUser,
  otherUser,
  activeTab,
  onTabChange,
  onAddReaction,
  onRemoveReaction,
  onClose,
}) => {
  // Snap points for reactions bottom sheet - fixed height for consistency
  const snapPoints = useMemo(() => [350], []);

  // Get reactions data for the bottom sheet
  const reactionsData = useMemo(() => {
    if (!message) return { reactionsList: [], filteredReactions: [] };

    const reactions = message.reactions || {};
    const reactionEntries = Object.entries(reactions).filter(([, users]) => users.length > 0);

    const reactionsList = [];
    reactionEntries.forEach(([emoji, userIds]) => {
      userIds.forEach(userId => {
        const isMe = userId === currentUser.uid;
        reactionsList.push({
          emoji,
          userId,
          name: isMe ? 'You' : getUserDisplayName(otherUser),
          avatar: isMe ? getUserProfilePhoto(currentUser) : getUserProfilePhoto(otherUser),
          isMe,
        });
      });
    });

    const filteredReactions = reactionsList.filter(r => {
      if (activeTab === 'all') return true;
      if (activeTab === 'you') return r.isMe;
      if (activeTab === 'them') return !r.isMe;
      return true;
    });

    return { reactionsList, filteredReactions };
  }, [message, activeTab, currentUser, otherUser]);

  // Backdrop for reactions sheet - tap to close
  const renderBackdrop = useCallback(
    props => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  // Handle sheet index change
  const handleSheetChange = useCallback(
    index => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle reaction removal
  const handleReactionPress = useCallback(
    reaction => {
      if (reaction.isMe && message) {
        onRemoveReaction(message.id, reaction.emoji);
      }
    },
    [message, onRemoveReaction]
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose={true}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetIndicator}
      backdropComponent={renderBackdrop}
      onChange={handleSheetChange}
    >
      <View style={styles.sheetContent}>
        <Text style={styles.title}>Reactions</Text>

        {message && (
          <>
            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'all' && styles.tabActive]}
                onPress={() => onTabChange('all')}
              >
                <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                  All ({reactionsData.reactionsList.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'you' && styles.tabActive]}
                onPress={() => onTabChange('you')}
              >
                <Text style={[styles.tabText, activeTab === 'you' && styles.tabTextActive]}>
                  You ({reactionsData.reactionsList.filter(r => r.isMe).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'them' && styles.tabActive]}
                onPress={() => onTabChange('them')}
              >
                <Text style={[styles.tabText, activeTab === 'them' && styles.tabTextActive]}>
                  {getUserDisplayName(otherUser).split(' ')[0]} (
                  {reactionsData.reactionsList.filter(r => !r.isMe).length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable reactions list - fixed height, fills available space */}
            <View style={styles.scrollContainer}>
              <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
                {reactionsData.filteredReactions.map((reaction, index) => (
                  <View
                    key={`${reaction.userId}-${reaction.emoji}-${index}`}
                    style={styles.reactionRow}
                  >
                    <View style={styles.reactionLeft}>
                      <Image source={{ uri: reaction.avatar }} style={styles.reactionAvatar} />
                      <Text style={styles.reactionName}>{reaction.name}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleReactionPress(reaction)}
                      activeOpacity={reaction.isMe ? 0.7 : 1}
                      style={styles.emojiContainer}
                    >
                      <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                      {reaction.isMe && (
                        <View style={styles.removeBadge}>
                          <Ionicons name="close" size={10} color={theme.colors.text.white} />
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}

                {reactionsData.filteredReactions.length === 0 && (
                  <View style={styles.noReactionsContainer}>
                    <Text style={styles.noReactionsText}>No reactions yet</Text>
                  </View>
                )}
              </BottomSheetScrollView>
            </View>

            {/* Add reaction button - anchored at bottom */}
            <TouchableOpacity
              style={styles.addReactionRow}
              onPress={onAddReaction}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
              <Text style={styles.addReactionText}>Add reaction</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: theme.colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetIndicator: {
    backgroundColor: '#ddd',
    width: 36,
    height: 4,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.tertiary,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  noReactionsContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.background.tertiary,
  },
  reactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  reactionName: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  noReactionsText: {
    fontSize: 14,
    color: theme.colors.text.muted,
    textAlign: 'center',
  },
  reactionEmoji: {
    fontSize: 24,
  },
  emojiContainer: {
    position: 'relative',
    marginRight: 8,
  },
  removeBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.text.muted,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addReactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.background.tertiary,
  },
  addReactionText: {
    fontSize: 16,
    color: theme.colors.primary,
    marginLeft: 12,
    fontWeight: '500',
  },
});

export default ChatReactionsSheet;
