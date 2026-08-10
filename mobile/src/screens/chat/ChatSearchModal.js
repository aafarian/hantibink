import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiDataService from '../../services/ApiDataService';
import { theme } from '../../styles/theme';

const FILTERS = [
  { id: 'ALL', label: 'All', icon: 'search' },
  { id: 'AUDIO', label: 'Voice', icon: 'mic' },
  { id: 'GAME', label: 'Games', icon: 'game-controller' },
];

const RESULT_ICONS = {
  TEXT: 'chatbubble-outline',
  AUDIO: 'mic',
  GAME: 'game-controller',
  GIF: 'image-outline',
};

const previewFor = message => {
  if (message.messageType === 'AUDIO') {
    return 'Voice message';
  }
  if (message.messageType === 'GIF') {
    return 'GIF';
  }
  return message.content || '';
};

const formatWhen = createdAt => {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

/**
 * Search this conversation by word and/or filter to voice notes / games.
 * Tapping a result jumps to it in the thread (when it's loaded).
 */
const ChatSearchModal = ({ visible, matchId, onClose, onJumpToMessage }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Debounced search whenever the query or filter changes
  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const q = query.trim();
    const type = filter === 'ALL' ? null : filter;
    if (!q && !type) {
      setResults([]);
      setSearched(false);
      return undefined;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      const found = await ApiDataService.searchMessages(matchId, { q, type });
      setResults(found);
      setSearched(true);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [visible, query, filter, matchId]);

  const close = () => {
    setQuery('');
    setFilter('ALL');
    setResults([]);
    setSearched(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.content}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={theme.colors.text.muted} />
            <TextInput
              style={styles.input}
              placeholder="Search this conversation…"
              placeholderTextColor={theme.colors.text.muted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              maxLength={100}
              returnKeyType="search"
            />
            <TouchableOpacity
              onPress={close}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Close search"
            >
              <Ionicons name="close" size={22} color={theme.colors.text.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.chips}>
            {FILTERS.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, filter === item.id && styles.chipActive]}
                onPress={() => setFilter(item.id)}
              >
                <Ionicons
                  name={item.icon}
                  size={14}
                  color={filter === item.id ? theme.colors.text.white : theme.colors.text.secondary}
                />
                <Text style={[styles.chipText, filter === item.id && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
            {loading && <ActivityIndicator size="small" color={theme.colors.primary} />}
          </View>

          <FlatList
            data={results}
            keyExtractor={item => item.id}
            style={styles.results}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              searched && !loading ? (
                <Text style={styles.emptyText}>No matches in this conversation</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultRow} onPress={() => onJumpToMessage(item)}>
                <Ionicons
                  name={RESULT_ICONS[item.messageType] || 'chatbubble-outline'}
                  size={16}
                  color={theme.colors.primary}
                />
                <View style={styles.resultText}>
                  <Text style={styles.resultPreview} numberOfLines={1}>
                    {previewFor(item)}
                  </Text>
                  <Text style={styles.resultWhen}>{formatWhen(item.createdAt)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.text.muted} />
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 80,
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay.medium,
  },
  content: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    width: '92%',
    maxWidth: 420,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
    paddingVertical: theme.spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.background.tertiary,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
  },
  chipText: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.secondary,
  },
  chipTextActive: {
    color: theme.colors.text.white,
  },
  results: {
    flexGrow: 0,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.light,
  },
  resultText: {
    flex: 1,
  },
  resultPreview: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
  },
  resultWhen: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
  },
});

export default ChatSearchModal;
