import { nukeEntireDatabase, nukeEverythingIncludingAuth, createTestUsers } from './dbReset';
import { checkDatabase, checkCurrentUser } from './debugDb';
import Logger from './logger';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

/**
 * Development utility to reset database and create fresh test data
 * Only available in development mode
 */
export const resetDatabaseWithTestUsers = async () => {
  if (!__DEV__) {
    throw new Error('Database reset is only available in development mode');
  }

  try {
    Logger.info('🔄 Starting database reset...');

    // Step 1: Nuke everything
    const deletionResults = await nukeEntireDatabase();

    // Step 2: Create fresh test users
    const testUsers = await createTestUsers();

    Logger.success('🎉 DATABASE RESET COMPLETE!');
    Logger.success(`   🗑️  Deleted: ${deletionResults.totalDeleted} records`);
    Logger.success(`   👥 Created: ${testUsers.length} test users`);
    Logger.success('   ✨ Ready for testing with clean data!');

    return {
      deletionResults,
      testUsers,
    };
  } catch (error) {
    Logger.error('Error resetting database:', error);
    throw error;
  }
};

/**
 * COMPLETE nuke - deletes current user's auth account AND database, leaves EMPTY
 */
export const completeNuke = async () => {
  if (!__DEV__) {
    throw new Error('Complete nuke is only available in development mode');
  }

  try {
    Logger.info('💀 Starting COMPLETE NUKE (auth + database)...');

    // Nuke everything including current user's auth - NO test users created
    const deletionResults = await nukeEverythingIncludingAuth();

    Logger.success('💀 COMPLETE NUKE FINISHED!');
    Logger.success(
      `   🗑️  Firestore deleted: ${deletionResults.totalDeleted - deletionResults.authDeleted} records`
    );
    Logger.success(
      `   🔐 Auth handled: ${deletionResults.authDeleted} accounts (deleted or logged out)`
    );
    Logger.success('   ✨ Database is now COMPLETELY EMPTY!');
    Logger.success('   🚀 You are logged out - ready for fresh start!');

    return deletionResults;
  } catch (error) {
    Logger.error('Error in complete nuke:', error);
    throw error;
  }
};

/**
 * COMPLETE reset - deletes current user's auth account AND database, then creates test users
 */
export const completeResetWithTestUsers = async () => {
  if (!__DEV__) {
    throw new Error('Complete reset is only available in development mode');
  }

  try {
    Logger.info('🔄💀 Starting COMPLETE reset (including auth)...');

    // Step 1: Nuke everything including current user's auth
    const deletionResults = await nukeEverythingIncludingAuth();

    // Step 2: Create fresh test users
    const testUsers = await createTestUsers();

    Logger.success('🎉💀 COMPLETE RESET FINISHED!');
    Logger.success(
      `   🗑️  Firestore deleted: ${deletionResults.totalDeleted - deletionResults.authDeleted} records`
    );
    Logger.success(
      `   🔐 Auth handled: ${deletionResults.authDeleted} accounts (deleted or logged out)`
    );
    Logger.success(`   👥 Created: ${testUsers.length} test users`);
    Logger.success('   ✨ You should now be logged out - ready for fresh testing!');

    return {
      deletionResults,
      testUsers,
    };
  } catch (error) {
    Logger.error('Error in complete reset:', error);
    throw error;
  }
};

/**
 * Simple reset that just logs out current user and resets database
 * Use this if completeReset() fails due to auth issues
 */
export const simpleResetWithLogout = async () => {
  if (!__DEV__) {
    throw new Error('Simple reset is only available in development mode');
  }

  try {
    Logger.info('🔄 Starting SIMPLE reset (logout + database)...');

    // Step 1: Log out current user
    try {
      await auth.signOut();
      Logger.success('✅ User logged out');
    } catch (error) {
      Logger.warn('Could not log out user:', error);
    }

    // Step 2: Nuke database only
    const deletionResults = await nukeEntireDatabase();

    // Step 3: Create fresh test users
    const testUsers = await createTestUsers();

    Logger.success('🎉 SIMPLE RESET COMPLETE!');
    Logger.success(`   🗑️  Deleted: ${deletionResults.totalDeleted} records`);
    Logger.success(`   👥 Created: ${testUsers.length} test users`);
    Logger.success('   ✨ You are logged out - register a new account!');

    return {
      deletionResults,
      testUsers,
    };
  } catch (error) {
    Logger.error('Error in simple reset:', error);
    throw error;
  }
};

/**
 * Fix existing users by setting missing isActive field to true
 */
export const fixExistingUsers = async () => {
  if (!__DEV__) {
    throw new Error('Fix existing users is only available in development mode');
  }

  try {
    Logger.info('🔧 Fixing existing users...');

    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let fixedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();

      // Check if user is missing isActive field or has it set to false/null
      if (userData.isActive !== true) {
        await updateDoc(doc(db, 'users', userDoc.id), {
          isActive: true,
          updatedAt: new Date().toISOString(),
        });
        fixedCount++;
        Logger.info(`✅ Fixed user: ${userData.name || userData.email || userDoc.id}`);
      }
    }

    Logger.success(`🎉 Fixed ${fixedCount} users with isActive: true`);
    return { fixedCount, totalUsers: usersSnapshot.docs.length };
  } catch (error) {
    Logger.error('Error fixing existing users:', error);
    throw error;
  }
};

/**
 * Quick development function - expose to global scope for easy console access
 * Usage: resetDB() in React Native debugger console
 */
// Force global registration regardless of __DEV__ for debugging
console.log('🔧 DevTools module loading...', { __DEV__ });

global.resetDB = resetDatabaseWithTestUsers;
global.completeReset = completeResetWithTestUsers;
global.completeNuke = completeNuke;
global.simpleReset = simpleResetWithLogout;
global.nukeDB = nukeEntireDatabase;
global.nukeAuth = nukeEverythingIncludingAuth;
global.createTestUsers = createTestUsers;
global.checkDB = checkDatabase;
global.checkUser = checkCurrentUser;
global.fixUsers = fixExistingUsers;

console.log('🛠️  Dev tools loaded and registered globally!');
console.log('   • resetDB() - Reset database only, keep auth');
console.log('   • completeReset() - Reset database AND auth, CREATE test users');
console.log('   • completeNuke() - Reset database AND auth, EMPTY database');
console.log('   • simpleReset() - Logout + database reset (if auth fails)');
console.log('   • nukeDB() - Just delete database');
console.log('   • nukeAuth() - Delete database AND auth');
console.log('   • createTestUsers() - Just create test users');
console.log("   • checkDB() - See what's in the database");
console.log('   • checkUser() - See current logged in user');
console.log('   • fixUsers() - Fix existing users isActive field');

if (__DEV__) {
  Logger.info('🛠️  Dev tools loaded:');
  Logger.info('   • resetDB() - Reset database only, keep auth');
  Logger.info('   • completeReset() - Reset database AND current user auth');
  Logger.info('   • nukeDB() - Just delete database');
  Logger.info('   • nukeAuth() - Delete database AND auth');
  Logger.info('   • createTestUsers() - Just create test users');
}
