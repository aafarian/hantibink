import AsyncStorage from '@react-native-async-storage/async-storage';

class DataService {
  // User Profile
  static async saveUserProfile(profile) {
    try {
      await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
      return true;
    } catch (error) {
      console.error('Error saving user profile:', error);
      return false;
    }
  }

  static async getUserProfile() {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      return profile ? JSON.parse(profile) : null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  // User Likes
  static async saveUserLikes(likes) {
    try {
      await AsyncStorage.setItem('userLikes', JSON.stringify(likes));
      return true;
    } catch (error) {
      console.error('Error saving user likes:', error);
      return false;
    }
  }

  static async getUserLikes() {
    try {
      const likes = await AsyncStorage.getItem('userLikes');
      return likes ? JSON.parse(likes) : [];
    } catch (error) {
      console.error('Error getting user likes:', error);
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
      console.error('Error adding user like:', error);
      return false;
    }
  }

  // Sample Profiles
  static async saveSampleProfiles(profiles) {
    try {
      await AsyncStorage.setItem('sampleProfiles', JSON.stringify(profiles));
      return true;
    } catch (error) {
      console.error('Error saving sample profiles:', error);
      return false;
    }
  }

  static async getSampleProfiles() {
    try {
      const profiles = await AsyncStorage.getItem('sampleProfiles');
      return profiles ? JSON.parse(profiles) : [];
    } catch (error) {
      console.error('Error getting sample profiles:', error);
      return [];
    }
  }

  // Conversations
  static async saveConversations(conversations) {
    try {
      await AsyncStorage.setItem('conversations', JSON.stringify(conversations));
      return true;
    } catch (error) {
      console.error('Error saving conversations:', error);
      return false;
    }
  }

  static async getConversations() {
    try {
      const conversations = await AsyncStorage.getItem('conversations');
      return conversations ? JSON.parse(conversations) : [];
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  }

  static async addMessageToConversation(matchId, message) {
    try {
      const conversations = await this.getConversations();
      const updatedConversations = conversations.map(conv => {
        if (conv.matchId === matchId) {
          return {
            ...conv,
            messages: [...conv.messages, message],
            lastMessage: message,
          };
        }
        return conv;
      });
      await this.saveConversations(updatedConversations);
      return true;
    } catch (error) {
      console.error('Error adding message to conversation:', error);
      return false;
    }
  }

  // User Preferences
  static async saveUserPreferences(preferences) {
    try {
      await AsyncStorage.setItem('userPreferences', JSON.stringify(preferences));
      return true;
    } catch (error) {
      console.error('Error saving user preferences:', error);
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
      console.error('Error getting user preferences:', error);
      return {
        ageRange: [18, 50],
        maxDistance: 50,
        interests: [],
        showMen: true,
        showWomen: true,
      };
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
      console.error('Error clearing all data:', error);
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
      console.error('Error initializing sample data:', error);
      return false;
    }
  }
}

export default DataService;
