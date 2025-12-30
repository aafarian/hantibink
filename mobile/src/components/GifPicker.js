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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GIF_SIZE = (SCREEN_WIDTH - 48) / 3; // 3 columns with padding
const GIPHY_API_KEY = environment.giphyApiKey;

const GifPicker = ({ visible, onClose, onSelectGif }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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

    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  const searchGifs = useCallback(async query => {
    if (!GIPHY_API_KEY) {
      setError('GIPHY API key not configured');
      return;
    }

    setIsLoading(true);
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
      setIsLoading(false);
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
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E91E63" />
          <Text style={styles.loadingText}>Loading GIFs...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="sad-outline" size={48} color="#999" />
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
          <Ionicons name="search-outline" size={48} color="#999" />
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
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Choose a GIF</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search GIPHY"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#999" />
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 36,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  gridContainer: {
    paddingHorizontal: 12,
    paddingBottom: 60,
  },
  gifItem: {
    width: GIF_SIZE,
    height: GIF_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#E91E63',
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  attribution: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 8,
  },
  attributionText: {
    fontSize: 12,
    color: '#999',
    marginRight: 4,
  },
  giphyLogo: {
    width: 60,
    height: 20,
    resizeMode: 'contain',
  },
});

export default GifPicker;
