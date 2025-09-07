const logger = require('../utils/logger');
const crypto = require('crypto');
const { getPrismaClient } = require('../config/database');

const prisma = getPrismaClient();

/**
 * Generate a verification token
 */
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Send verification email (placeholder - integrate with email provider)
 */
const sendVerificationEmail = async (email, name, token) => {
  try {
    const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    
    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    logger.info('📧 Verification email would be sent to:', {
      to: email,
      name,
      verificationUrl,
    });
    
    // For development, log the verification link
    if (process.env.NODE_ENV === 'development') {
      logger.info(`📧 Verification link for ${email}: ${verificationUrl}`);
    }
    
    // Placeholder for actual email sending
    // await sendgrid.send({
    //   to: email,
    //   from: process.env.FROM_EMAIL,
    //   subject: 'Verify your HantieBink account',
    //   html: `
    //     <h1>Welcome to HantieBink, ${name}!</h1>
    //     <p>Please verify your email address by clicking the link below:</p>
    //     <a href="${verificationUrl}">Verify Email</a>
    //     <p>Or copy and paste this link: ${verificationUrl}</p>
    //     <p>This link will expire in 24 hours.</p>
    //   `,
    // });
    
    return true;
  } catch (error) {
    logger.error('❌ Failed to send verification email:', error);
    throw error;
  }
};

/**
 * Create and store email verification token
 */
const createEmailVerification = async (userId) => {
  try {
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Store token in database (you'll need to add EmailVerification model to schema)
    // For now, we'll store it as a user property
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: token,
        emailVerificationExpiry: expiresAt,
      },
    });
    
    return token;
  } catch (error) {
    logger.error('❌ Failed to create email verification:', error);
    throw error;
  }
};

/**
 * Verify email with token
 */
const verifyEmailWithToken = async (token) => {
  try {
    // Find user with this token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: {
          gt: new Date(), // Token not expired
        },
      },
    });
    
    if (!user) {
      throw new Error('Invalid or expired verification token');
    }
    
    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
        // If user has completed setup, make them discoverable
        isDiscoverable: user.onboardingStage === 'SETUP_COMPLETE',
      },
    });
    
    logger.info(`✅ Email verified for user: ${user.email}`);
    return user;
  } catch (error) {
    logger.error('❌ Email verification failed:', error);
    throw error;
  }
};

/**
 * Resend verification email
 */
const resendVerificationEmail = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.emailVerified) {
      throw new Error('Email already verified');
    }
    
    // Check if we should rate limit (e.g., max 3 emails per hour)
    // This is a simplified check - you might want to use Redis for proper rate limiting
    if (user.emailVerificationExpiry) {
      const timeSinceLastEmail = Date.now() - (user.emailVerificationExpiry.getTime() - 24 * 60 * 60 * 1000);
      if (timeSinceLastEmail < 5 * 60 * 1000) { // 5 minutes
        throw new Error('Please wait 5 minutes before requesting another verification email');
      }
    }
    
    // Create new token
    const token = await createEmailVerification(userId, user.email);
    
    // Send email
    await sendVerificationEmail(user.email, user.name, token);
    
    logger.info(`📧 Verification email resent to: ${user.email}`);
    return true;
  } catch (error) {
    logger.error('❌ Failed to resend verification email:', error);
    throw error;
  }
};

/**
 * Send welcome email after verification
 */
const sendWelcomeEmail = async (email, name) => {
  try {
    // TODO: Integrate with actual email service
    logger.info('📧 Welcome email would be sent to:', {
      to: email,
      name,
    });
    
    // Placeholder for actual email sending
    // await sendgrid.send({
    //   to: email,
    //   from: process.env.FROM_EMAIL,
    //   subject: 'Welcome to HantieBink!',
    //   html: `
    //     <h1>Welcome to HantieBink, ${name}!</h1>
    //     <p>Your email has been verified and you're all set to start discovering amazing people!</p>
    //     <p>Complete your profile to get the best matches:</p>
    //     <ul>
    //       <li>Add photos to show your personality</li>
    //       <li>Write a bio that stands out</li>
    //       <li>Share your interests</li>
    //     </ul>
    //     <p>Happy swiping!</p>
    //   `,
    // });
    
    return true;
  } catch (error) {
    logger.error('❌ Failed to send welcome email:', error);
    // Don't throw - welcome email is not critical
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  createEmailVerification,
  verifyEmailWithToken,
  resendVerificationEmail,
  sendWelcomeEmail,
};