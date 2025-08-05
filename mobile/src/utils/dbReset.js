import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import Logger from './logger';

/**
 * Clear all users from the database
 * WARNING: This will delete ALL user data!
 */
export const nukeUsersDatabase = async () => {
  try {
    Logger.info('🚨 Starting database nuke...');

    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const deletePromises = [];

    Logger.info(`Found ${usersSnapshot.size} users to delete`);

    // Delete each user document
    usersSnapshot.forEach(userDoc => {
      deletePromises.push(deleteDoc(doc(db, 'users', userDoc.id)));
    });

    // Wait for all deletions to complete
    await Promise.all(deletePromises);

    Logger.success(`💥 Successfully deleted ${usersSnapshot.size} users`);
    return usersSnapshot.size;
  } catch (error) {
    Logger.error('Error nuking users database:', error);
    throw error;
  }
};

/**
 * Clear all matches from the database
 */
export const nukeMatchesDatabase = async () => {
  try {
    Logger.info('🚨 Starting matches nuke...');

    const matchesSnapshot = await getDocs(collection(db, 'matches'));
    const deletePromises = [];

    Logger.info(`Found ${matchesSnapshot.size} matches to delete`);

    matchesSnapshot.forEach(matchDoc => {
      deletePromises.push(deleteDoc(doc(db, 'matches', matchDoc.id)));
    });

    await Promise.all(deletePromises);

    Logger.success(`💥 Successfully deleted ${matchesSnapshot.size} matches`);
    return matchesSnapshot.size;
  } catch (error) {
    Logger.error('Error nuking matches database:', error);
    throw error;
  }
};

/**
 * Clear all user actions from the database
 */
export const nukeUserActionsDatabase = async () => {
  try {
    Logger.info('🚨 Starting user actions nuke...');

    const actionsSnapshot = await getDocs(collection(db, 'userActions'));
    const deletePromises = [];

    Logger.info(`Found ${actionsSnapshot.size} user actions to delete`);

    actionsSnapshot.forEach(actionDoc => {
      deletePromises.push(deleteDoc(doc(db, 'userActions', actionDoc.id)));
    });

    await Promise.all(deletePromises);

    Logger.success(`💥 Successfully deleted ${actionsSnapshot.size} user actions`);
    return actionsSnapshot.size;
  } catch (error) {
    Logger.error('Error nuking user actions database:', error);
    throw error;
  }
};

/**
 * Clear Firebase Authentication accounts
 * NOTE: This only deletes the CURRENT logged-in user's auth account
 * Other auth accounts cannot be deleted from client-side for security
 */
export const nukeCurrentUserAuth = async () => {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      Logger.info(`🔥 Deleting current user's auth account: ${currentUser.email}`);
      await deleteUser(currentUser);
      Logger.success('✅ Current user auth account deleted');
      return 1;
    } else {
      Logger.info('No current user to delete from auth');
      return 0;
    }
  } catch (error) {
    if (error.code === 'auth/requires-recent-login') {
      Logger.warn('⚠️  Auth deletion requires recent login. Logging out instead...');
      try {
        await auth.signOut();
        Logger.success('✅ User logged out successfully');
        return 1;
      } catch (logoutError) {
        Logger.error('Error logging out:', logoutError);
        return 0;
      }
    } else {
      Logger.error('Error deleting current user auth:', error);
      return 0;
    }
  }
};

/**
 * Nuclear option - clear everything!
 */
export const nukeEntireDatabase = async () => {
  try {
    Logger.info('☢️  NUCLEAR OPTION: Clearing entire database...');

    const [usersDeleted, matchesDeleted, actionsDeleted] = await Promise.all([
      nukeUsersDatabase(),
      nukeMatchesDatabase(),
      nukeUserActionsDatabase(),
    ]);

    Logger.success(`☢️  NUCLEAR COMPLETE!`);
    Logger.success(`   👥 Users deleted: ${usersDeleted}`);
    Logger.success(`   💕 Matches deleted: ${matchesDeleted}`);
    Logger.success(`   👆 Actions deleted: ${actionsDeleted}`);

    return {
      usersDeleted,
      matchesDeleted,
      actionsDeleted,
      totalDeleted: usersDeleted + matchesDeleted + actionsDeleted,
    };
  } catch (error) {
    Logger.error('Error in nuclear database wipe:', error);
    throw error;
  }
};

/**
 * COMPLETE nuclear option - clear database AND current user's auth account
 */
export const nukeEverythingIncludingAuth = async () => {
  try {
    Logger.info('☢️💀 TOTAL NUCLEAR: Clearing database AND auth...');

    // First clear database
    const dbResults = await nukeEntireDatabase();

    // Then delete current user's auth account
    const authDeleted = await nukeCurrentUserAuth();

    Logger.success(`☢️💀 TOTAL NUCLEAR COMPLETE!`);
    Logger.success(`   👥 Firestore users deleted: ${dbResults.usersDeleted}`);
    Logger.success(`   💕 Matches deleted: ${dbResults.matchesDeleted}`);
    Logger.success(`   👆 Actions deleted: ${dbResults.actionsDeleted}`);
    Logger.success(`   🔐 Auth accounts deleted: ${authDeleted}`);

    return {
      ...dbResults,
      authDeleted,
      totalDeleted: dbResults.totalDeleted + authDeleted,
    };
  } catch (error) {
    Logger.error('Error in total nuclear wipe:', error);
    throw error;
  }
};

/**
 * Create test users with proper cloud images
 */
export const createTestUsers = async () => {
  try {
    Logger.info('👥 Creating test users...');

    const testUsers = [
      {
        id: 'test-user-1',
        name: 'Emma Johnson',
        email: 'emma@test.com',
        age: 25,
        gender: 'female',
        interestedIn: 'male',
        bio: 'Love hiking, coffee, and good conversations! Always up for trying new restaurants and exploring the city.',
        location: 'San Francisco, CA',
        photos: [
          'https://images.unsplash.com/photo-1494790108755-2616b5b123bb?w=400&h=400&fit=crop&crop=center',
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=center',
          'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=center',
        ],
        profession: 'Software Engineer',
        education: 'Stanford University',
        religion: 'Agnostic',
        height: '5\'6"',
        smoking: 'never',
        drinking: 'socially',
        pets: 'love_dogs',
        travel: 'love_traveling',
        languages: ['English', 'Spanish'],
        interests: ['hiking', 'photography', 'cooking', 'yoga', 'traveling'],
        relationshipType: 'serious',
        preferences: {
          ageRange: { min: 22, max: 35 },
          maxDistance: 25,
        },
        isActive: true,
        isPremium: false,
        profileViews: 0,
        totalLikes: 0,
        totalMatches: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'test-user-2',
        name: 'Alex Chen',
        email: 'alex@test.com',
        age: 28,
        gender: 'male',
        interestedIn: 'female',
        bio: 'Entrepreneur and adventure seeker. Love rock climbing, craft beer, and building cool things. Looking for someone to explore life with!',
        location: 'San Francisco, CA',
        photos: [
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=center',
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=center',
          'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=center',
        ],
        profession: 'Product Manager',
        education: 'UC Berkeley',
        religion: 'Spiritual',
        height: '5\'10"',
        smoking: 'never',
        drinking: 'regularly',
        pets: 'have_cats',
        travel: 'love_traveling',
        languages: ['English', 'Mandarin'],
        interests: ['rock_climbing', 'entrepreneurship', 'craft_beer', 'tech', 'surfing'],
        relationshipType: 'open_to_both',
        preferences: {
          ageRange: { min: 23, max: 32 },
          maxDistance: 30,
        },
        isActive: true,
        isPremium: true,
        profileViews: 0,
        totalLikes: 0,
        totalMatches: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'test-user-3',
        name: 'Maya Patel',
        email: 'maya@test.com',
        age: 26,
        gender: 'female',
        interestedIn: 'male',
        bio: 'Doctor by day, foodie by night! Love trying new cuisines, reading, and spending time with friends and family.',
        location: 'Palo Alto, CA',
        photos: [
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=center',
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop&crop=center',
        ],
        profession: 'Doctor',
        education: 'Harvard Medical School',
        religion: 'Hindu',
        height: '5\'4"',
        smoking: 'never',
        drinking: 'occasionally',
        pets: 'love_both',
        travel: 'occasionally',
        languages: ['English', 'Hindi', 'Gujarati'],
        interests: ['medicine', 'reading', 'cooking', 'family_time', 'volunteering'],
        relationshipType: 'serious',
        preferences: {
          ageRange: { min: 25, max: 35 },
          maxDistance: 20,
        },
        isActive: true,
        isPremium: false,
        profileViews: 0,
        totalLikes: 0,
        totalMatches: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'test-user-4',
        name: 'Jake Williams',
        email: 'jake@test.com',
        age: 29,
        gender: 'male',
        interestedIn: 'female',
        bio: 'Marketing creative with a passion for music and art. Play guitar in a local band and love discovering new artists.',
        location: 'San Jose, CA',
        photos: [
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=center',
          'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=center',
        ],
        profession: 'Creative Director',
        education: 'Art Center College',
        religion: 'Atheist',
        height: '5\'11"',
        smoking: 'occasionally',
        drinking: 'socially',
        pets: 'have_dogs',
        travel: 'love_traveling',
        languages: ['English'],
        interests: ['music', 'art', 'concerts', 'photography', 'design'],
        relationshipType: 'casual',
        preferences: {
          ageRange: { min: 21, max: 30 },
          maxDistance: 35,
        },
        isActive: true,
        isPremium: false,
        profileViews: 0,
        totalLikes: 0,
        totalMatches: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Create users using batch write for efficiency
    const batch = writeBatch(db);

    testUsers.forEach(user => {
      const userRef = doc(db, 'users', user.id);
      // Set mainPhoto to first photo
      const userData = {
        ...user,
        mainPhoto: user.photos[0],
      };
      batch.set(userRef, userData);
    });

    await batch.commit();

    Logger.success(`👥 Successfully created ${testUsers.length} test users!`);
    Logger.info('Test users:');
    testUsers.forEach(user => {
      Logger.info(`   • ${user.name} (${user.email})`);
    });

    return testUsers;
  } catch (error) {
    Logger.error('Error creating test users:', error);
    throw error;
  }
};
