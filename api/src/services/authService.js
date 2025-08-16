const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { generateTokenPair, verifyToken } = require('../utils/jwt');
const { verifyIdToken } = require('../config/firebase');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Map mobile relationship type values to database enum values
 */
const mapRelationshipType = (relationshipType) => {
  if (!relationshipType) {return null;}
  
  // Handle array (multi-select) - take first value
  const value = Array.isArray(relationshipType) ? relationshipType[0] : relationshipType;
  
  if (!value) {return null;}
  
  // Map mobile values to database enum values
  const mapping = {
    'casual': 'CASUAL',
    'serious': 'SERIOUS', 
    'friendship': 'FRIENDSHIP',
    'marriage': 'MARRIAGE',
    'hookups': 'CASUAL', // Map hookups to casual
    'not-sure': null, // Map not-sure to null
  };
  
  return mapping[value] || null;
};

/**
 * Map mobile smoking preference to database enum values
 */
const mapSmokingPreference = (smoking) => {
  if (!smoking) {
    return null;
  }
  
  // Normalize case and handle UI variations
  const normalizedValue = smoking.toLowerCase().replace('sometimes', 'socially');
  
  // Return the normalized value directly to match validation schema
  const validValues = ['never', 'socially', 'regularly'];
  return validValues.includes(normalizedValue) ? normalizedValue : null;
};

/**
 * Map mobile drinking preference to database enum values
 */
const mapDrinkingPreference = (drinking) => {
  if (!drinking) {
    return null;
  }
  
  // Normalize case
  const normalizedValue = drinking.toLowerCase();
  
  // Return the normalized value directly to match validation schema
  const validValues = ['never', 'socially', 'regularly'];
  return validValues.includes(normalizedValue) ? normalizedValue : null;
};

/**
 * Register a new user
 */
const registerUser = async (userData) => {
  try {
    const { 
      name, email, password, birthDate, gender, interestedIn, location, photos, locationText,
      bio, education, profession, height, relationshipType, religion, smoking, drinking, travel, pets, interests = []
    } = userData;
    
    // Debug: Log the incoming registration data
    logger.debug('✅ Required registration data:', {
      name: !!name,
      email: !!email,
      password: !!password,
      birthDate: !!birthDate,
      gender: !!gender,
      interestedIn: !!interestedIn,
      locationText: !!locationText,
      location: !!location,
    });
    logger.debug('🔹 Optional profile data (Step 3):', {
      bio: bio || null,
      education: education || null,
      profession: profession || null,
      height: height || null,
      relationshipType: Array.isArray(relationshipType) ? relationshipType : (relationshipType ? [relationshipType] : []),
      religion: religion || null,
      smoking: smoking || null,
      drinking: drinking || null,
      travel: travel || null,
      pets: pets || null,
      interests: Array.isArray(interests) ? interests : [],
      photos: photos?.length > 0 ? `${photos.length} photos` : null,
    });

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Convert gender and interestedIn to enum values
    const genderEnum = gender.toUpperCase();
    const interestedInEnum = Array.isArray(interestedIn) ? interestedIn.map(g => g.toUpperCase()) : [];

    // Using PostgreSQL + JWT authentication (no Firebase Auth)
    const firebaseUid = null;

    // Use database transaction for all database operations
    const result = await prisma.$transaction(async (tx) => {
      // Create user in database
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          birthDate: new Date(birthDate),
          gender: genderEnum,
          interestedIn: interestedInEnum,
          firebaseUid,
          location: locationText,
          latitude: location?.latitude,
          longitude: location?.longitude,
          bio: bio || null,
          education: education || null,
          profession: profession || null,
          height: height || null,
          relationshipType: mapRelationshipType(relationshipType),
          religion: religion || null,
          smoking: mapSmokingPreference(smoking),
          drinking: mapDrinkingPreference(drinking),
          travel: travel || null,
          pets: pets || null,
          isActive: true,
        },
      });

      // Create photos
      if (photos && photos.length > 0) {
        const photoData = photos.map((url, index) => ({
          userId: user.id,
          url,
          order: index,
          isMain: index === 0, // First photo is main
        }));

        await tx.photo.createMany({
          data: photoData,
        });

        // Update user with main photo
        const mainPhoto = await tx.photo.findFirst({
          where: { userId: user.id, isMain: true },
        });
        
        if (mainPhoto) {
          await tx.user.update({
            where: { id: user.id },
            data: { mainPhotoId: mainPhoto.id },
          });
        }
      }

      // Create interests
      if (interests && interests.length > 0) {
        // Find existing interests
        const existingInterests = await tx.interest.findMany({
          where: { name: { in: interests } },
        });

        const existingInterestNames = existingInterests.map(i => i.name);
        const newInterestNames = interests.filter(name => !existingInterestNames.includes(name));

        // Create new interests in bulk
        if (newInterestNames.length > 0) {
          await tx.interest.createMany({
            data: newInterestNames.map(name => ({ name })),
            skipDuplicates: true,
          });
        }

        // Get all interest IDs
        const allInterests = await tx.interest.findMany({
          where: { name: { in: interests } },
        });

        // Create user interests in bulk
        await tx.userInterest.createMany({
          data: allInterests.map(interest => ({
            userId: user.id,
            interestId: interest.id,
          })),
        });
      }

      return user;
    });

    const user = result;

    // Generate JWT tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      firebaseUid: user.firebaseUid,
    });

    logger.info(`✅ User registered successfully: ${user.email}`);

    // Return user data without password
    // eslint-disable-next-line no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      tokens,
    };
  } catch (error) {
    logger.error('❌ User registration failed:', error);
    throw error;
  }
};

/**
 * Login user with email and password
 */
const loginUser = async (email, password) => {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        photos: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      firebaseUid: user.firebaseUid,
    });

    // Update last active time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
    });

    logger.info(`✅ User logged in successfully: ${user.email}`);

    // Return user data without password
    // eslint-disable-next-line no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      tokens,
    };
  } catch (error) {
    logger.error('❌ User login failed:', error);
    throw error;
  }
};

/**
 * Login user with Firebase ID token
 */
const loginWithFirebase = async (idToken) => {
  try {
    // Verify Firebase ID token
    const decodedToken = await verifyIdToken(idToken);
    
    // Find user by Firebase UID
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      include: {
        photos: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    // Generate JWT tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      firebaseUid: user.firebaseUid,
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info(`✅ User logged in with Firebase: ${user.email}`);

    // Return user data without password
    // eslint-disable-next-line no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      tokens,
    };
  } catch (error) {
    logger.error('❌ Firebase login failed:', error);
    throw error;
  }
};

/**
 * Refresh JWT tokens
 */
const refreshTokens = async (refreshToken) => {
  try {
    
    // Verify refresh token
    const decoded = verifyToken(refreshToken);
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Generate new token pair
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      firebaseUid: user.firebaseUid,
    });

    logger.info(`✅ Tokens refreshed for user: ${user.email}`);

    return tokens;
  } catch (error) {
    logger.error('❌ Token refresh failed:', error);
    throw error;
  }
};

/**
 * Get user profile
 */
const getUserProfile = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        photos: {
          orderBy: { order: 'asc' },
        },
        interests: {
          include: {
            interest: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Return user data without password
    // eslint-disable-next-line no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;
    
    return userWithoutPassword;
  } catch (error) {
    logger.error('❌ Failed to get user profile:', error);
    throw error;
  }
};

/**
 * Update user profile
 */
const updateUserProfile = async (userId, updateData) => {
  try {
    const { photos, interests, ...userData } = updateData;

    // Update user data with proper mapping
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...userData,
        // Apply mapping functions for enum fields
        relationshipType: userData.relationshipType ? mapRelationshipType(userData.relationshipType) : undefined,
        smoking: userData.smoking ? mapSmokingPreference(userData.smoking) : undefined,
        drinking: userData.drinking ? mapDrinkingPreference(userData.drinking) : undefined,
        latitude: updateData.location?.latitude,
        longitude: updateData.location?.longitude,
        address: updateData.location?.address,
        city: updateData.location?.city,
        country: updateData.location?.country,
        updatedAt: new Date(),
      },
    });

    // Update photos if provided (use transaction)
    if (photos && photos.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Delete existing photos
        await tx.photo.deleteMany({
          where: { userId },
        });

        // Create new photos
        const photoData = photos.map((url, index) => ({
          userId,
          url,
          order: index,
          isMain: index === 0,
        }));

        await tx.photo.createMany({
          data: photoData,
        });

        // Update main photo
        const mainPhoto = await tx.photo.findFirst({
          where: { userId, isMain: true },
        });
        
        if (mainPhoto) {
          await tx.user.update({
            where: { id: userId },
            data: { mainPhotoId: mainPhoto.id },
          });
        }
      });
    }

    // Update interests if provided (use transaction with bulk operations)
    if (interests && interests.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Delete existing user interests
        await tx.userInterest.deleteMany({
          where: { userId },
        });

        // Find existing interests
        const existingInterests = await tx.interest.findMany({
          where: { name: { in: interests } },
        });

        const existingInterestNames = existingInterests.map(i => i.name);
        const newInterestNames = interests.filter(name => !existingInterestNames.includes(name));

        // Create new interests in bulk
        if (newInterestNames.length > 0) {
          await tx.interest.createMany({
            data: newInterestNames.map(name => ({ name })),
            skipDuplicates: true,
          });
        }

        // Get all interest IDs
        const allInterests = await tx.interest.findMany({
          where: { name: { in: interests } },
        });

        // Create user interests in bulk
        await tx.userInterest.createMany({
          data: allInterests.map(interest => ({
            userId,
            interestId: interest.id,
          })),
        });
      });
    }

    logger.info(`✅ User profile updated: ${user.email}`);

    // Return updated user profile
    return await getUserProfile(userId);
  } catch (error) {
    logger.error('❌ Failed to update user profile:', error);
    throw error;
  }
};

/**
 * Add photo to user profile
 */
const addUserPhoto = async (userId, photoUrl, isMain = false) => {
  try {
    // Get current photo count
    const photoCount = await prisma.photo.count({
      where: { userId },
    });

    // Limit to 6 photos max
    if (photoCount >= 6) {
      throw new Error('Maximum 6 photos allowed');
    }

    // If this is the first photo or explicitly set as main, make it main
    const shouldBeMain = isMain || photoCount === 0;

    await prisma.$transaction(async (tx) => {
      // If setting as main, remove main flag from other photos
      if (shouldBeMain) {
        await tx.photo.updateMany({
          where: { userId, isMain: true },
          data: { isMain: false },
        });
      }

      // Create the new photo
      const newPhoto = await tx.photo.create({
        data: {
          userId,
          url: photoUrl,
          order: photoCount,
          isMain: shouldBeMain,
        },
      });

      // Update user's main photo if this is the main photo
      if (shouldBeMain) {
        await tx.user.update({
          where: { id: userId },
          data: { mainPhotoId: newPhoto.id },
        });
      }

      return newPhoto;
    });

    logger.info(`✅ Photo added for user ${userId}: ${shouldBeMain ? 'main' : 'additional'}`);
    return await getUserProfile(userId);
  } catch (error) {
    logger.error('❌ Add photo error:', error);
    throw error;
  }
};

/**
 * Delete photo from user profile
 */
const deleteUserPhoto = async (userId, photoId) => {
  try {
    const photo = await prisma.photo.findFirst({
      where: { id: photoId, userId },
    });

    if (!photo) {
      throw new Error('Photo not found');
    }

    await prisma.$transaction(async (tx) => {
      // Delete the photo
      await tx.photo.delete({
        where: { id: photoId },
      });

      // If this was the main photo, set another photo as main
      if (photo.isMain) {
        const nextMainPhoto = await tx.photo.findFirst({
          where: { userId },
          orderBy: { order: 'asc' },
        });

        if (nextMainPhoto) {
          await tx.photo.update({
            where: { id: nextMainPhoto.id },
            data: { isMain: true },
          });

          await tx.user.update({
            where: { id: userId },
            data: { mainPhotoId: nextMainPhoto.id },
          });
        } else {
          // No photos left, clear main photo
          await tx.user.update({
            where: { id: userId },
            data: { mainPhotoId: null },
          });
        }
      }

      // Reorder remaining photos
      const remainingPhotos = await tx.photo.findMany({
        where: { userId },
        orderBy: { order: 'asc' },
      });

      for (let i = 0; i < remainingPhotos.length; i++) {
        await tx.photo.update({
          where: { id: remainingPhotos[i].id },
          data: { order: i },
        });
      }
    });

    logger.info(`✅ Photo deleted for user ${userId}: ${photoId}`);
    return await getUserProfile(userId);
  } catch (error) {
    logger.error('❌ Delete photo error:', error);
    throw error;
  }
};

/**
 * Reorder user photos
 */
const reorderUserPhotos = async (userId, photoIds) => {
  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < photoIds.length; i++) {
        const photoId = photoIds[i];
        
        // Verify photo belongs to user
        const photo = await tx.photo.findFirst({
          where: { id: photoId, userId },
        });

        if (!photo) {
          throw new Error(`Photo ${photoId} not found or doesn't belong to user`);
        }

        // Update order
        await tx.photo.update({
          where: { id: photoId },
          data: { order: i },
        });
      }
    });

    logger.info(`✅ Photos reordered for user ${userId}`);
    return await getUserProfile(userId);
  } catch (error) {
    logger.error('❌ Reorder photos error:', error);
    throw error;
  }
};

/**
 * Set main photo
 */
const setMainPhoto = async (userId, photoId) => {
  try {
    await prisma.$transaction(async (tx) => {
      // Verify photo belongs to user
      const photo = await tx.photo.findFirst({
        where: { id: photoId, userId },
      });

      if (!photo) {
        throw new Error('Photo not found or doesn\'t belong to user');
      }

      // Remove main flag from all photos
      await tx.photo.updateMany({
        where: { userId, isMain: true },
        data: { isMain: false },
      });

      // Set this photo as main
      await tx.photo.update({
        where: { id: photoId },
        data: { isMain: true },
      });

      // Update user's main photo
      await tx.user.update({
        where: { id: userId },
        data: { mainPhotoId: photoId },
      });
    });

    logger.info(`✅ Main photo set for user ${userId}: ${photoId}`);
    return await getUserProfile(userId);
  } catch (error) {
    logger.error('❌ Set main photo error:', error);
    throw error;
  }
};

module.exports = {
  registerUser,
  loginUser,
  loginWithFirebase,
  refreshTokens,
  getUserProfile,
  updateUserProfile,
  addUserPhoto,
  deleteUserPhoto,
  reorderUserPhotos,
  setMainPhoto,
};
