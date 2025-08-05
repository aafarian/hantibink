import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  deleteDoc,
  addDoc,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import Logger from '../utils/logger';

class DataService {
  // Firebase User Profile Methods
  static async getUserProfile(userId) {
    try {
      if (!userId) {
        Logger.error('No userId provided to getUserProfile');
        return null;
      }

      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        Logger.success('User profile loaded from Firebase');
        return userData;
      } else {
        Logger.warn('No user profile found in Firebase');
        return null;
      }
    } catch (error) {
      Logger.error('Error getting user profile from Firebase:', error);
      return null;
    }
  }

  static async updateUserProfile(userId, profileData) {
    try {
      if (!userId) {
        Logger.error('No userId provided to updateUserProfile');
        return false;
      }

      await updateDoc(doc(db, 'users', userId), {
        ...profileData,
        updatedAt: new Date().toISOString(),
      });

      Logger.success('User profile updated in Firebase');
      return true;
    } catch (error) {
      Logger.error('Error updating user profile in Firebase:', error);
      return false;
    }
  }

  // Get other users for swiping (exclude current user and already liked/passed users)
  static async getUsersForSwiping(currentUserId, excludeUserIds = []) {
    try {
      if (!currentUserId) {
        Logger.error('No currentUserId provided to getUsersForSwiping');
        return [];
      }

      // For now, get all users (later we can add back isActive filter when all users have it set)
      const usersQuery = query(
        collection(db, 'users'),
        // where('isActive', '==', true), // Temporarily commented out
        limit(20) // Limit to 20 users for performance
      );

      const querySnapshot = await getDocs(usersQuery);
      const users = [];

      querySnapshot.forEach(currDoc => {
        const userData = { id: currDoc.id, ...currDoc.data() };

        // Exclude current user and already processed users
        if (userData.id !== currentUserId && !excludeUserIds.includes(userData.id)) {
          users.push(userData);
        }
      });

      Logger.success(`Loaded ${users.length} users for swiping`);
      return users;
    } catch (error) {
      Logger.error('Error getting users for swiping:', error);
      return [];
    }
  }

  // Save like/pass action
  static async saveLikeAction(userId, targetUserId, action) {
    try {
      const actionData = {
        userId,
        targetUserId,
        action, // 'like' or 'pass'
        timestamp: new Date().toISOString(),
      };

      await setDoc(doc(db, 'userActions', `${userId}_${targetUserId}`), actionData);
      Logger.success(`${action} action saved for user ${targetUserId}`);

      // Check for match if this was a like
      if (action === 'like') {
        const matchCreated = await this.checkAndCreateMatch(userId, targetUserId);
        if (matchCreated) {
          Logger.success(`🎉 Match created between ${userId} and ${targetUserId}!`);
          return { success: true, isMatch: true };
        }
      }

      return { success: true, isMatch: false };
    } catch (error) {
      Logger.error('Error saving like action:', error);
      return { success: false, isMatch: false };
    }
  }

  // Get user's like/pass history
  static async getUserActions(userId) {
    try {
      const actionsQuery = query(collection(db, 'userActions'), where('userId', '==', userId));

      const querySnapshot = await getDocs(actionsQuery);
      const actions = [];

      querySnapshot.forEach(currDoc => {
        actions.push(currDoc.data());
      });

      return actions;
    } catch (error) {
      Logger.error('Error getting user actions:', error);
      return [];
    }
  }

  // Check if two users have liked each other and create a match
  static async checkAndCreateMatch(userId, targetUserId) {
    try {
      Logger.info(`Checking for match between ${userId} and ${targetUserId}`);

      // Check if target user has already liked this user
      const reverseActionDoc = await getDoc(doc(db, 'userActions', `${targetUserId}_${userId}`));

      if (reverseActionDoc.exists() && reverseActionDoc.data().action === 'like') {
        Logger.info(`Mutual like found! Creating match between ${userId} and ${targetUserId}`);
        // It's a match! Create match record
        return await this.createMatch(userId, targetUserId);
      } else {
        Logger.info(`No reverse like found for ${targetUserId} -> ${userId}`);
      }

      return false;
    } catch (error) {
      Logger.error('Error checking for match:', error);
      return false;
    }
  }

  // Create a match record between two users
  static async createMatch(userId1, userId2) {
    try {
      const matchId = `${userId1}_${userId2}`;
      const timestamp = new Date().toISOString();

      // Get user profiles for testing logs
      const user1Profile = await this.getUserProfile(userId1);
      const user2Profile = await this.getUserProfile(userId2);

      const matchData = {
        id: matchId,
        users: [userId1, userId2],
        user1: userId1,
        user2: userId2,
        timestamp,
        lastMessage: null,
        lastMessageTime: null,
        isActive: true,
      };

      // Create match document (we'll use the smaller userId first for consistency)
      const sortedUsers = [userId1, userId2].sort();
      const finalMatchId = `${sortedUsers[0]}_${sortedUsers[1]}`;

      await setDoc(doc(db, 'matches', finalMatchId), {
        ...matchData,
        id: finalMatchId,
        user1: sortedUsers[0],
        user2: sortedUsers[1],
      });

      Logger.match(`🎉 MATCH CREATED: ${finalMatchId}`);
      Logger.match(
        `👤 User 1: ${user1Profile?.name || 'Unknown'} (${user1Profile?.email || 'No email'})`
      );
      Logger.match(
        `👤 User 2: ${user2Profile?.name || 'Unknown'} (${user2Profile?.email || 'No email'})`
      );
      Logger.match(
        `📧 TEST LOGIN EMAILS: ${user1Profile?.email || 'N/A'} | ${user2Profile?.email || 'N/A'}`
      );

      return true;
    } catch (error) {
      Logger.error('Error creating match:', error);
      return false;
    }
  }

  // Get user's matches
  static async getUserMatches(userId) {
    try {
      Logger.info(`Getting matches for user: ${userId}`);

      const matchesQuery = query(
        collection(db, 'matches'),
        where('users', 'array-contains', userId),
        where('isActive', '==', true)
      );

      const querySnapshot = await getDocs(matchesQuery);
      const matches = [];

      querySnapshot.forEach(currDoc => {
        const matchData = { id: currDoc.id, ...currDoc.data() };
        Logger.info(`Found match: ${currDoc.id} with users:`, matchData.users);
        matches.push(matchData);
      });

      // Sort by most recent matches first
      matches.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      Logger.success(`Found ${matches.length} matches for user ${userId}`);
      Logger.info(
        'All matches:',
        matches.map(m => ({ id: m.id, users: m.users }))
      );
      return matches;
    } catch (error) {
      Logger.error('Error getting user matches:', error);
      return [];
    }
  }

  // Get match details with other user's profile
  static async getMatchWithProfiles(matchId, currentUserId) {
    try {
      const matchDoc = await getDoc(doc(db, 'matches', matchId));

      if (!matchDoc.exists()) {
        return null;
      }

      const matchData = matchDoc.data();
      const otherUserId = matchData.users.find(id => id !== currentUserId);

      if (!otherUserId) {
        return null;
      }

      const otherUserProfile = await this.getUserProfile(otherUserId);

      return {
        ...matchData,
        otherUser: otherUserProfile,
        otherUserId,
      };
    } catch (error) {
      Logger.error('Error getting match with profiles:', error);
      return null;
    }
  }

  // Debug method to get all matches in the database
  static async getAllMatches() {
    try {
      const matchesQuery = query(collection(db, 'matches'));
      const querySnapshot = await getDocs(matchesQuery);
      const allMatches = [];

      querySnapshot.forEach(currDoc => {
        allMatches.push({ id: currDoc.id, ...currDoc.data() });
      });

      Logger.info(`DEBUG: Total matches in database: ${allMatches.length}`);
      allMatches.forEach(match => {
        Logger.info(
          `DEBUG: Match ${match.id} - Users: [${match.users.join(', ')}] - Active: ${match.isActive}`
        );
      });

      return allMatches;
    } catch (error) {
      Logger.error('Error getting all matches:', error);
      return [];
    }
  }

  // Debug method to clear all matches (for testing)
  static async clearAllMatches() {
    try {
      const matchesQuery = query(collection(db, 'matches'));
      const querySnapshot = await getDocs(matchesQuery);

      const deletePromises = [];
      querySnapshot.forEach(currDoc => {
        deletePromises.push(deleteDoc(currDoc.ref));
      });

      await Promise.all(deletePromises);
      Logger.warn(`DEBUG: Cleared ${deletePromises.length} matches from database`);
      return true;
    } catch (error) {
      Logger.error('Error clearing matches:', error);
      return false;
    }
  }

  // Legacy AsyncStorage methods (kept for backward compatibility)
  static async saveUserProfile(profile) {
    try {
      await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
      return true;
    } catch (error) {
      Logger.error('Error saving user profile to AsyncStorage:', error);
      return false;
    }
  }

  static async getUserProfileFromStorage() {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      return profile ? JSON.parse(profile) : null;
    } catch (error) {
      Logger.error('Error getting user profile from AsyncStorage:', error);
      return null;
    }
  }

  // User Likes
  static async saveUserLikes(likes) {
    try {
      await AsyncStorage.setItem('userLikes', JSON.stringify(likes));
      return true;
    } catch (error) {
      Logger.error('Error saving user likes:', error);
      return false;
    }
  }

  static async getUserLikes() {
    try {
      const likes = await AsyncStorage.getItem('userLikes');
      return likes ? JSON.parse(likes) : [];
    } catch (error) {
      Logger.error('Error getting user likes:', error);
      return [];
    }
  }

  static async addUserLike(profileId) {
    try {
      const likes = await this.getUserLikes();
      if (!likes.includes(profileId)) {
        likes.push(profileId);
        await this.saveUserLikes(likes);
      }
      return true;
    } catch (error) {
      Logger.error('Error adding user like:', error);
      return false;
    }
  }

  // Sample Profiles
  static async saveSampleProfiles(profiles) {
    try {
      await AsyncStorage.setItem('sampleProfiles', JSON.stringify(profiles));
      return true;
    } catch (error) {
      Logger.error('Error saving sample profiles:', error);
      return false;
    }
  }

  static async getSampleProfiles() {
    try {
      const profiles = await AsyncStorage.getItem('sampleProfiles');
      return profiles ? JSON.parse(profiles) : [];
    } catch (error) {
      Logger.error('Error getting sample profiles:', error);
      return [];
    }
  }

  // Conversations
  static async saveConversations(conversations) {
    try {
      await AsyncStorage.setItem('conversations', JSON.stringify(conversations));
      return true;
    } catch (error) {
      Logger.error('Error saving conversations:', error);
      return false;
    }
  }

  static async getConversations() {
    try {
      const conversations = await AsyncStorage.getItem('conversations');
      return conversations ? JSON.parse(conversations) : [];
    } catch (error) {
      Logger.error('Error getting conversations:', error);
      return [];
    }
  }

  // REAL-TIME MESSAGING METHODS

  // Send a message and save to Firebase
  static async sendMessage(matchId, senderId, messageText) {
    try {
      const messageData = {
        text: messageText.trim(),
        senderId: senderId,
        timestamp: new Date().toISOString(),
        createdAt: new Date(),
        readBy: [senderId], // Sender has "read" their own message
      };

      // Add message to the messages subcollection
      const messagesRef = collection(db, 'matches', matchId, 'messages');
      const messageDoc = await addDoc(messagesRef, messageData);

      // Update the match document with last message info
      await updateDoc(doc(db, 'matches', matchId), {
        lastMessage: messageText.trim(),
        lastMessageTime: messageData.timestamp,
      });

      Logger.success(`Message sent to match ${matchId}: ${messageText.trim()}`);
      return { success: true, messageId: messageDoc.id };
    } catch (error) {
      Logger.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  // Get messages for a specific match (one-time fetch)
  static async getMessages(matchId) {
    try {
      const messagesQuery = query(
        collection(db, 'matches', matchId, 'messages'),
        orderBy('createdAt', 'asc')
      );

      const querySnapshot = await getDocs(messagesQuery);
      const messages = [];

      querySnapshot.forEach(currDoc => {
        messages.push({
          id: currDoc.id,
          ...currDoc.data(),
        });
      });

      Logger.info(`Loaded ${messages.length} messages for match ${matchId}`);
      return messages;
    } catch (error) {
      Logger.error('Error getting messages:', error);
      return [];
    }
  }

  // Set up real-time listener for messages in a match
  static subscribeToMessages(matchId, callback) {
    try {
      const messagesQuery = query(
        collection(db, 'matches', matchId, 'messages'),
        orderBy('createdAt', 'asc')
      );

      const unsubscribe = onSnapshot(
        messagesQuery,
        querySnapshot => {
          const messages = [];
          querySnapshot.forEach(currDoc => {
            messages.push({
              id: currDoc.id,
              ...currDoc.data(),
            });
          });

          Logger.info(`Real-time update: ${messages.length} messages for match ${matchId}`);
          callback(messages);
        },
        error => {
          Logger.error('Error in messages listener:', error);
          callback([]);
        }
      );

      return unsubscribe;
    } catch (error) {
      Logger.error('Error setting up messages listener:', error);
      return null;
    }
  }

  // Subscribe to real-time changes for a specific match document
  static subscribeToMatch(matchId, callback) {
    try {
      const matchRef = doc(db, 'matches', matchId);

      const unsubscribe = onSnapshot(
        matchRef,
        docSnapshot => {
          if (docSnapshot.exists()) {
            const matchData = {
              id: docSnapshot.id,
              ...docSnapshot.data(),
            };
            Logger.info(`Real-time match update for match ${matchId}`);
            callback(matchData);
          }
        },
        error => {
          Logger.error('Error in match listener:', error);
        }
      );

      return unsubscribe;
    } catch (error) {
      Logger.error('Error setting up match listener:', error);
      return null;
    }
  }

  // Mark messages as read when user opens a conversation
  static async markMessagesAsRead(matchId, userId) {
    try {
      const readTimestamp = new Date().toISOString();

      // Get all unread messages for this user
      const messagesRef = collection(db, 'matches', matchId, 'messages');
      const messagesQuery = query(messagesRef, where('senderId', '!=', userId));
      const snapshot = await getDocs(messagesQuery);

      const updatePromises = [];

      snapshot.forEach(messageDoc => {
        const messageData = messageDoc.data();
        const readBy = messageData.readBy || [];

        // If user hasn't read this message yet, mark it as read
        if (!readBy.includes(userId)) {
          readBy.push(userId);
          updatePromises.push(updateDoc(messageDoc.ref, { readBy }));
        }
      });

      // Execute all updates
      await Promise.all(updatePromises);

      // Also update the match document for backward compatibility
      await updateDoc(doc(db, 'matches', matchId), {
        [`lastReadBy_${userId}`]: readTimestamp,
      });

      Logger.info(
        `Marked ${updatePromises.length} messages as read for match ${matchId} by user ${userId}`
      );
      return { success: true };
    } catch (error) {
      Logger.error('Error marking messages as read:', error);
      return { success: false, error: error.message };
    }
  }

  // Get unread count for a specific match
  static getUnreadCount(messages, match, currentUserId) {
    try {
      // Count messages from other users that current user hasn't read
      return messages.filter(msg => {
        if (msg.senderId === currentUserId) return false; // Don't count own messages

        const readBy = msg.readBy || [];
        return !readBy.includes(currentUserId); // Message is unread if user not in readBy array
      }).length;
    } catch (error) {
      Logger.error('Error calculating unread count:', error);
      return 0;
    }
  }

  // Mark conversation as viewed (less aggressive than marking messages as read)
  static async markConversationAsViewed(matchId, userId) {
    try {
      const viewTimestamp = new Date().toISOString();

      // Update the match document to track when user last viewed the conversation
      await updateDoc(doc(db, 'matches', matchId), {
        [`lastViewedBy_${userId}`]: viewTimestamp,
      });

      Logger.info(`Marked conversation as viewed for match ${matchId} by user ${userId}`);
      return { success: true };
    } catch (error) {
      Logger.error('Error marking conversation as viewed:', error);
      return { success: false, error: error.message };
    }
  }

  // Get conversations unread count (different from message-level unread count)
  static getConversationUnreadCount(messages, match, currentUserId) {
    try {
      const lastViewedTimestamp = match[`lastViewedBy_${currentUserId}`];

      if (!lastViewedTimestamp) {
        // User has never viewed this conversation, so count all messages from other user
        return messages.filter(msg => msg.senderId !== currentUserId).length > 0 ? 1 : 0;
      }

      const lastViewedDate = new Date(lastViewedTimestamp);

      // Check if there are any messages from other user sent after last viewed time
      const hasNewMessages = messages.some(msg => {
        if (msg.senderId === currentUserId) return false; // Don't count own messages
        const messageDate = new Date(msg.timestamp || msg.createdAt);
        return messageDate > lastViewedDate;
      });

      return hasNewMessages ? 1 : 0;
    } catch (error) {
      Logger.error('Error calculating conversation unread count:', error);
      return 0;
    }
  }

  // Legacy method - kept for compatibility but updated to use Firebase
  static async addMessageToConversation(matchId, message) {
    return await this.sendMessage(matchId, message.senderId, message.text);
  }

  // User Preferences
  static async saveUserPreferences(preferences) {
    try {
      await AsyncStorage.setItem('userPreferences', JSON.stringify(preferences));
      return true;
    } catch (error) {
      Logger.error('Error saving user preferences:', error);
      return false;
    }
  }

  static async getUserPreferences() {
    try {
      const preferences = await AsyncStorage.getItem('userPreferences');
      return preferences
        ? JSON.parse(preferences)
        : {
            ageRange: [18, 50],
            maxDistance: 50,
            interests: [],
            showMen: true,
            showWomen: true,
          };
    } catch (error) {
      Logger.error('Error getting user preferences:', error);
      return {
        ageRange: [18, 50],
        maxDistance: 50,
        interests: [],
        showMen: true,
        showWomen: true,
      };
    }
  }

  // ========================
  // TYPING INDICATORS
  // ========================

  // Set typing status for a user in a conversation
  static async setTypingStatus(matchId, userId, isTyping) {
    try {
      const typingRef = doc(db, 'matches', matchId, 'typing', userId);

      if (isTyping) {
        await setDoc(typingRef, {
          isTyping: true,
          timestamp: new Date(),
        });
      } else {
        await deleteDoc(typingRef);
      }
    } catch (error) {
      Logger.error('Error setting typing status:', error);
      throw error;
    }
  }

  // Subscribe to typing status for a conversation
  static subscribeToTypingStatus(matchId, currentUserId, callback) {
    try {
      const typingCollectionRef = collection(db, 'matches', matchId, 'typing');

      const unsubscribe = onSnapshot(typingCollectionRef, snapshot => {
        const typingUsers = [];

        snapshot.forEach(currDoc => {
          const data = currDoc.data();
          const userId = currDoc.id;

          // Only include other users who are typing (not current user)
          if (userId !== currentUserId && data.isTyping && data.timestamp) {
            try {
              // Check if typing indicator is recent (within 5 seconds)
              const timestamp = data.timestamp.toDate
                ? data.timestamp.toDate()
                : new Date(data.timestamp);
              const timeDiff = new Date() - timestamp;
              if (timeDiff < 5000) {
                typingUsers.push({
                  userId,
                  timestamp,
                });
              }
            } catch (error) {
              Logger.error('Error parsing typing timestamp:', error);
            }
          }
        });

        callback(typingUsers);
      });

      return unsubscribe;
    } catch (error) {
      Logger.error('Error subscribing to typing status:', error);
      return null;
    }
  }

  // Clean up old typing indicators (called periodically)
  static async cleanupTypingStatus(matchId) {
    try {
      const typingCollectionRef = collection(db, 'matches', matchId, 'typing');
      const snapshot = await getDocs(typingCollectionRef);

      const now = new Date();
      const promises = [];

      snapshot.forEach(currDoc => {
        const data = currDoc.data();
        const timeDiff = now - data.timestamp.toDate();

        // Remove typing indicators older than 5 seconds
        if (timeDiff > 5000) {
          promises.push(deleteDoc(currDoc.ref));
        }
      });

      await Promise.all(promises);
    } catch (error) {
      Logger.error('Error cleaning up typing status:', error);
    }
  }

  // Clear all data (for testing/reset)
  static async clearAllData() {
    try {
      const keys = [
        'userProfile',
        'userLikes',
        'sampleProfiles',
        'conversations',
        'userPreferences',
      ];
      await AsyncStorage.multiRemove(keys);
      return true;
    } catch (error) {
      Logger.error('Error clearing all data:', error);
      return false;
    }
  }

  // Initialize sample data
  static async initializeSampleData() {
    try {
      const sampleProfiles = [
        {
          id: '1',
          name: 'Ani',
          age: 25,
          bio: 'Love hiking and Armenian coffee ☕',
          photos: ['https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400'],
          location: 'Yerevan, Armenia',
          interests: ['Hiking', 'Coffee', 'Photography'],
          gender: 'female',
        },
        {
          id: '2',
          name: 'Saro',
          age: 28,
          bio: 'Software developer by day, musician by night 🎸',
          photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'],
          location: 'Yerevan, Armenia',
          interests: ['Music', 'Technology', 'Travel'],
          gender: 'male',
        },
        {
          id: '3',
          name: 'Lusine',
          age: 23,
          bio: 'Art lover and foodie 🎨🍕',
          photos: ['https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400'],
          location: 'Yerevan, Armenia',
          interests: ['Art', 'Food', 'Travel'],
          gender: 'female',
        },
        {
          id: '4',
          name: 'Armen',
          age: 27,
          bio: 'Passionate about Armenian history and culture 🇦🇲',
          photos: ['https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400'],
          location: 'Yerevan, Armenia',
          interests: ['History', 'Culture', 'Reading'],
          gender: 'male',
        },
        {
          id: '5',
          name: 'Narine',
          age: 26,
          bio: 'Dance instructor and fitness enthusiast 💃',
          photos: ['https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400'],
          location: 'Yerevan, Armenia',
          interests: ['Dance', 'Fitness', 'Health'],
          gender: 'female',
        },
        {
          id: '6',
          name: 'Vartan',
          age: 29,
          bio: 'Chef who loves creating Armenian fusion cuisine 👨‍🍳',
          photos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400'],
          location: 'Yerevan, Armenia',
          interests: ['Cooking', 'Food', 'Travel'],
          gender: 'male',
        },
      ];

      await this.saveSampleProfiles(sampleProfiles);
      return true;
    } catch (error) {
      Logger.error('Error initializing sample data:', error);
      return false;
    }
  }
}

export default DataService;
