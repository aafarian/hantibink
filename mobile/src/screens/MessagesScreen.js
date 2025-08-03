import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MessagesScreen = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageText, setMessageText] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      // Load user's matches
      const userLikes = await AsyncStorage.getItem('userLikes');
      const likes = userLikes ? JSON.parse(userLikes) : [];

      // Load sample profiles
      const sampleProfiles = await AsyncStorage.getItem('sampleProfiles');
      const profiles = sampleProfiles ? JSON.parse(sampleProfiles) : [];

      // Create conversations from mutual matches
      const mutualMatches = profiles.filter(
        profile => likes.includes(profile.id) && Math.random() > 0.3 // 70% chance of mutual match
      );

      // Load existing conversations or create new ones
      const savedConversations = await AsyncStorage.getItem('conversations');
      const existingConversations = savedConversations ? JSON.parse(savedConversations) : [];

      // Merge with new matches
      const newConversations = mutualMatches.map(match => {
        const existing = existingConversations.find(c => c.matchId === match.id);
        return (
          existing || {
            matchId: match.id,
            profile: match,
            messages: [],
            lastMessage: null,
            unreadCount: 0,
          }
        );
      });

      setConversations(newConversations);
      await AsyncStorage.setItem('conversations', JSON.stringify(newConversations));
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) {
      return;
    }

    const newMessage = {
      id: Date.now().toString(),
      text: messageText.trim(),
      senderId: 'currentUser',
      timestamp: new Date().toISOString(),
    };

    const updatedConversations = conversations.map(conv => {
      if (conv.matchId === selectedConversation.matchId) {
        return {
          ...conv,
          messages: [...conv.messages, newMessage],
          lastMessage: newMessage,
        };
      }
      return conv;
    });

    setConversations(updatedConversations);
    setMessageText('');
    await AsyncStorage.setItem('conversations', JSON.stringify(updatedConversations));
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity style={styles.conversationItem} onPress={() => setSelectedConversation(item)}>
      <Image source={{ uri: item.profile.photos[0] }} style={styles.conversationPhoto} />
      <View style={styles.conversationInfo}>
        <Text style={styles.conversationName}>{item.profile.name}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage ? item.lastMessage.text : 'Start a conversation!'}
        </Text>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadCount}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderMessage = ({ item }) => {
    const isOwnMessage = item.senderId === 'currentUser';

    return (
      <View
        style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}
      >
        <View style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {item.text}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
            ]}
          >
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (selectedConversation) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSelectedConversation(null)}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Image
            source={{ uri: selectedConversation.profile.photos[0] }}
            style={styles.chatHeaderPhoto}
          />
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName}>{selectedConversation.profile.name}</Text>
            <Text style={styles.chatHeaderStatus}>Online</Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          style={styles.messagesList}
          data={selectedConversation.messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          inverted={false}
        />

        {/* Message Input */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 15 }]}>
          <TextInput
            style={styles.messageInput}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={item => item.matchId}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={80} color="#ccc" />
            <Text style={styles.emptyStateText}>No conversations yet</Text>
            <Text style={styles.emptyStateSubtext}>Start matching to begin chatting!</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  conversationPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  unreadBadge: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FF6B6B',
  },
  chatHeaderPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 15,
    marginRight: 15,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  chatHeaderStatus: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
  },
  messagesList: {
    flex: 1,
    padding: 15,
  },
  messageContainer: {
    marginBottom: 10,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
  },
  ownBubble: {
    backgroundColor: '#FF6B6B',
    borderBottomRightRadius: 5,
  },
  otherBubble: {
    backgroundColor: '#e0e0e0',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 5,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherMessageTime: {
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#FF6B6B',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 100,
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

export default MessagesScreen;
