const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { generateTokenPair, verifyToken } = require('../utils/jwt');
const { createFirebaseUser, verifyIdToken } = require('../config/firebase');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Register a new user
 */
const registerUser = async (userData) => {
  try {
    const { name, email, password, birthDate, gender, interestedIn, location, photos } = userData;

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

    // Create Firebase user first (outside transaction)
    let firebaseUser;
    try {
      firebaseUser = await createFirebaseUser({
        email,
        password,
        displayName: name,
        emailVerified: false,
      });
    } catch (firebaseError) {
      logger.error('❌ Failed to create Firebase user:', firebaseError);
      throw new Error('Failed to create authentication account');
    }

    // Use database transaction for all database operations
    const result = await prisma.$transaction(async (tx) => {
      // Create user in database
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          birthDate: new Date(birthDate),
          gender,
          interestedIn,
          firebaseUid: firebaseUser.uid,
          latitude: location?.latitude,
          longitude: location?.longitude,
          address: location?.address,
          city: location?.city,
          country: location?.country,
          isActive: true,
          emailVerified: false,
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

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
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

    // Update user data
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...userData,
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

module.exports = {
  registerUser,
  loginUser,
  loginWithFirebase,
  refreshTokens,
  getUserProfile,
  updateUserProfile,
};
