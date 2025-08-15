const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { generateTokenPair } = require('../utils/jwt');
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

    // Create Firebase user
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

    // Create user in database
    const user = await prisma.user.create({
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

      await prisma.photo.createMany({
        data: photoData,
      });

      // Update user with main photo
      if (photoData.length > 0) {
        const mainPhoto = await prisma.photo.findFirst({
          where: { userId: user.id, isMain: true },
        });
        
        if (mainPhoto) {
          await prisma.user.update({
            where: { id: user.id },
            data: { mainPhotoId: mainPhoto.id },
          });
        }
      }
    }

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
    const { verifyToken } = require('../utils/jwt');
    
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

    // Update photos if provided
    if (photos && photos.length > 0) {
      // Delete existing photos
      await prisma.photo.deleteMany({
        where: { userId },
      });

      // Create new photos
      const photoData = photos.map((url, index) => ({
        userId,
        url,
        order: index,
        isMain: index === 0,
      }));

      await prisma.photo.createMany({
        data: photoData,
      });

      // Update main photo
      const mainPhoto = await prisma.photo.findFirst({
        where: { userId, isMain: true },
      });
      
      if (mainPhoto) {
        await prisma.user.update({
          where: { id: userId },
          data: { mainPhotoId: mainPhoto.id },
        });
      }
    }

    // Update interests if provided
    if (interests && interests.length > 0) {
      // Delete existing user interests
      await prisma.userInterest.deleteMany({
        where: { userId },
      });

      // Create or find interests and link to user
      for (const interestName of interests) {
        let interest = await prisma.interest.findUnique({
          where: { name: interestName },
        });

        if (!interest) {
          interest = await prisma.interest.create({
            data: { name: interestName },
          });
        }

        await prisma.userInterest.create({
          data: {
            userId,
            interestId: interest.id,
          },
        });
      }
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
