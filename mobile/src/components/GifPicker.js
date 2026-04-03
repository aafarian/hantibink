import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Logger from '../utils/logger';
import environment from '../config/environment';
import { theme } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GIF_SIZE = (SCREEN_WIDTH - 48) / 3; // 3 columns with padding
const GIPHY_API_KEY = environment.giphyApiKey;

const GifPicker = ({ visible, onClose, onSelectGif }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const searchTimeoutRef = useRef(null);

  const loadTrendingGifs = useCallback(async () => {
    if (!GIPHY_API_KEY) {
      setError('GIPHY API key not configured');
      Logger.warn(
        'GIPHY API key not configured. Set EXPO_PUBLIC_GIPHY_API_KEY in your environment.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=30&rating=pg-13`
      );
      const data = await response.json();

      if (data.data) {
        setGifs(data.data);
      }
    } catch (err) {
      Logger.error('Failed to load trending GIFs:', err);
      setError('Failed to load GIFs');
    } finally {
      setLoading(false);
    }
  }, []);

  const searchGifs = useCallback(async query => {
    if (!GIPHY_API_KEY) {
      setError('GIPHY API key not configured');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=30&rating=pg-13`
      );
      const data = await response.json();

      if (data.data) {
        setGifs(data.data);
      }
    } catch (err) {
      Logger.error('Failed to search GIFs:', err);
      setError('Failed to search GIFs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load trending GIFs on mount
  useEffect(() => {
    if (visible) {
      loadTrendingGifs();
    }
  }, [visible, loadTrendingGifs]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchGifs(searchQuery);
      }, 300);
    } else if (visible) {
      loadTrendingGifs();
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, visible, searchGifs, loadTrendingGifs]);

  const handleSelectGif = useCallback(
    gif => {
      // Use the fixed height version for display, original for sending
      const gifUrl = gif.images?.fixed_height?.url || gif.images?.original?.url;
      if (gifUrl && onSelectGif) {
        onSelectGif(gifUrl);
      }
      onClose();
    },
    [onSelectGif, onClose]
  );

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    setSearchQuery('');
    onClose();
  }, [onClose]);

  const renderGifItem = ({ item }) => {
    const previewUrl = item.images?.fixed_height_small?.url || item.images?.fixed_height?.url;

    return (
      <TouchableOpacity
        style={styles.gifItem}
        onPress={() => handleSelectGif(item)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: previewUrl }} style={styles.gifImage} resizeMode="cover" />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading GIFs...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="sad-outline" size={theme.icons.xl} color={theme.colors.text.muted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTrendingGifs}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (searchQuery && gifs.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={theme.icons.xl} color={theme.colors.text.muted} />
          <Text style={styles.emptyText}>No GIFs found for "{searchQuery}"</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Choose a GIF</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={theme.icons.sm}
            color={theme.colors.text.muted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search GIPHY"
            placeholderTextColor={theme.colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={theme.icons.sm} color={theme.colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* GIF Grid */}
        {gifs.length > 0 ? (
          <FlatList
            data={gifs}
            renderItem={renderGifItem}
            keyExtractor={item => item.id}
            numColumns={3}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          renderEmpty()
        )}

        {/* GIPHY Attribution */}
        <View style={styles.attribution}>
          <Text style={styles.attributionText}>Powered by</Text>
          <Image
            source={{ uri: 'https://giphy.com/static/img/giphy_logo_square_social.png' }}
            style={styles.giphyLogo}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
  },
  headerSpacer: {
    width: theme.icons.lg + theme.spacing.xs, // Match close button touchable area
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[100],
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    paddingVertical: theme.spacing.md,
    color: theme.colors.text.primary,
  },
  clearButton: {
    padding: theme.spacing.xs,
  },
  gridContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.icons.xxl, // Space for attribution overlay
  },
  gifItem: {
    width: GIF_SIZE,
    height: GIF_SIZE,
    margin: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.background.tertiary,
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xxxl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
  },
  errorText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xxl,
  },
  retryText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  attribution: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: theme.spacing.sm,
  },
  attributionText: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    marginRight: theme.spacing.xs,
  },
  giphyLogo: {
    width: 60,
    height: 20,
    resizeMode: 'contain',
  },
});

export default GifPicker;
