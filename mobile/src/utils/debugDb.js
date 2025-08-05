import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import Logger from './logger';

/**
 * Debug function to check what's actually in the database
 */
export const checkDatabase = async () => {
  try {
    console.log('🔍 CHECKING DATABASE CONTENTS...');

    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    console.log(`📊 Found ${usersSnapshot.size} users in database:`);

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      console.log(`👤 User: ${userData.name} (${userData.email})`);
      console.log(`   📸 Photos: ${userData.photos?.length || 0} photos`);
      console.log(`   🎯 First photo: ${userData.photos?.[0] || 'none'}`);
      console.log(`   🌟 Main photo: ${userData.mainPhoto || 'none'}`);
      console.log('   ---');
    });

    // Get all matches
    const matchesSnapshot = await getDocs(collection(db, 'matches'));
    console.log(`💕 Found ${matchesSnapshot.size} matches in database`);

    // Get all user actions
    const actionsSnapshot = await getDocs(collection(db, 'userActions'));
    console.log(`👆 Found ${actionsSnapshot.size} user actions in database`);

    console.log('🔍 DATABASE CHECK COMPLETE!');

    return {
      usersCount: usersSnapshot.size,
      matchesCount: matchesSnapshot.size,
      actionsCount: actionsSnapshot.size,
      users: usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  } catch (error) {
    console.error('❌ Error checking database:', error);
    throw error;
  }
};

/**
 * Check current auth user
 */
export const checkCurrentUser = async () => {
  try {
    const { auth } = await import('../config/firebase');
    const currentUser = auth.currentUser;

    console.log('🔍 CHECKING CURRENT AUTH USER...');
    if (currentUser) {
      console.log(`👤 Logged in as: ${currentUser.email}`);
      console.log(`   🆔 UID: ${currentUser.uid}`);
      console.log(`   📅 Created: ${currentUser.metadata.creationTime}`);
      console.log(`   🕐 Last sign in: ${currentUser.metadata.lastSignInTime}`);
    } else {
      console.log('❌ No user currently logged in');
    }

    return currentUser;
  } catch (error) {
    console.error('❌ Error checking current user:', error);
    throw error;
  }
};
