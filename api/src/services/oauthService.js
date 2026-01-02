const { OAuth2Client } = require('google-auth-library');
const { getPrismaClient } = require('../config/database');
const { generateTokenPair } = require('../utils/jwt');
const logger = require('../utils/logger');

const prisma = getPrismaClient();

// Initialize Google OAuth client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

/**
 * Verify Google ID token and extract user info
 */
const verifyGoogleToken = async (idToken) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    
    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload.name,
      picture: payload.picture,
      givenName: payload.given_name,
      familyName: payload.family_name,
    };
  } catch (error) {
    logger.error('Failed to verify Google token:', error);
    throw new Error('Invalid Google token');
  }
};

/**
 * Handle OAuth authentication (login or register)
 */
const handleOAuthAuth = async (provider, providerData) => {
  try {
    const { email, providerId, name, picture, emailVerified } = providerData;
    
    // Check if OAuth account already exists
    const existingOAuth = await prisma.oAuthAccount.findFirst({
      where: {
        provider,
        providerId,
      },
      include: {
        user: {
          include: {
            photos: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (existingOAuth) {
      // User exists, log them in
      const { accessToken, refreshToken } = generateTokenPair({
        userId: existingOAuth.user.id,
        email: existingOAuth.user.email,
      });

      logger.info(`✅ OAuth login successful for ${email}`);

      return {
        success: true,
        isNewUser: false,
        user: existingOAuth.user,
        token: accessToken,
        refreshToken,
        requiresSetup: !existingOAuth.user.hasCompletedOnboarding,
      };
    }

    // Check if email already exists (user might have registered with email/password)
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        photos: {
          orderBy: { order: 'asc' },
        },
      },
    });
    
    if (existingUser) {
      // Link OAuth account to existing user
      await prisma.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider,
          providerId,
        },
      });
      
      // Update email verification if OAuth provider verified it
      if (emailVerified && !existingUser.emailVerified) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { emailVerified: true },
        });
      }
      
      const { accessToken, refreshToken } = generateTokenPair({
        userId: existingUser.id,
        email: existingUser.email,
      });

      logger.info(`✅ OAuth account linked to existing user ${email}`);

      return {
        success: true,
        isNewUser: false,
        user: existingUser,
        token: accessToken,
        refreshToken,
        requiresSetup: !existingUser.hasCompletedOnboarding,
      };
    }
    
    // Create new user with OAuth
    // birthDate is now nullable, so OAuth users can be created without it
    // They'll be prompted to complete their profile via the gatekeeping flow
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        emailVerified,
        mainPhotoUrl: picture,
        registrationMethod: provider.toUpperCase(),
        onboardingStage: 'REGISTERED', // New users need to complete setup
        oauthAccounts: {
          create: {
            provider,
            providerId,
          },
        },
        // Create a Photo record from Google profile picture if available
        ...(picture && {
          photos: {
            create: {
              url: picture,
              order: 0,
              isMain: true,
            },
          },
        }),
      },
      // Include photos in the response so the mobile app has them immediately
      include: {
        photos: {
          orderBy: { order: 'asc' },
        },
      },
    });
    
    const { accessToken, refreshToken } = generateTokenPair({
      userId: newUser.id,
      email: newUser.email,
    });

    logger.info(`✅ New user registered via ${provider}: ${email}`);

    // Build list of missing fields dynamically
    const missingFields = ['birthDate', 'gender', 'interestedIn', 'location'];
    if (!picture) {
      missingFields.push('photos');
    }

    return {
      success: true,
      isNewUser: true,
      user: newUser,
      token: accessToken,
      refreshToken,
      requiresSetup: true,
      missingFields,
    };
  } catch (error) {
    logger.error(`OAuth ${provider} error:`, error);
    throw error;
  }
};

/**
 * Verify Google access token and get user info
 */
const verifyGoogleAccessToken = async (accessToken) => {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user info from Google');
    }
    
    const userInfo = await response.json();
    
    return {
      googleId: userInfo.id,
      email: userInfo.email,
      emailVerified: userInfo.verified_email,
      name: userInfo.name,
      picture: userInfo.picture,
      givenName: userInfo.given_name,
      familyName: userInfo.family_name,
    };
  } catch (error) {
    logger.error('Failed to verify Google access token:', error);
    throw new Error('Invalid Google access token');
  }
};

/**
 * Handle Google OAuth
 */
const googleAuth = async (idToken, accessToken) => {
  try {
    let googleData;
    
    // Try ID token first, fall back to access token
    if (idToken) {
      googleData = await verifyGoogleToken(idToken);
    } else if (accessToken) {
      googleData = await verifyGoogleAccessToken(accessToken);
    } else {
      throw new Error('No authentication token provided');
    }
    
    // Handle authentication
    return await handleOAuthAuth('google', {
      email: googleData.email,
      providerId: googleData.googleId,
      name: googleData.name,
      picture: googleData.picture,
      emailVerified: googleData.emailVerified,
    });
  } catch (error) {
    logger.error('Google OAuth error:', error);
    throw error;
  }
};

/**
 * Complete OAuth profile setup (add missing fields like birthDate)
 */
const completeOAuthProfile = async (userId, profileData) => {
  try {
    const { birthDate, gender, interestedIn } = profileData;
    
    // Update user with missing required fields
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        birthDate: birthDate ? new Date(birthDate) : undefined,
        gender,
        interestedIn,
        hasCompletedOnboarding: true,
        onboardingStage: 'SETUP_COMPLETE',
      },
    });
    
    logger.info(`✅ OAuth profile completed for user ${userId}`);
    
    return {
      success: true,
      user: updatedUser,
    };
  } catch (error) {
    logger.error('Complete OAuth profile error:', error);
    throw error;
  }
};

/**
 * Check if user exists by email
 */
const checkUserExists = async (email) => {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        registrationMethod: true,
        oauthAccounts: {
          select: {
            provider: true,
          },
        },
      },
    });
    
    if (!user) {
      return {
        exists: false,
      };
    }
    
    return {
      exists: true,
      hasPassword: !!user.password,
      registrationMethod: user.registrationMethod,
      oauthProviders: user.oauthAccounts.map(acc => acc.provider),
    };
  } catch (error) {
    logger.error('Check user exists error:', error);
    throw error;
  }
};

module.exports = {
  googleAuth,
  completeOAuthProfile,
  checkUserExists,
  handleOAuthAuth,
};