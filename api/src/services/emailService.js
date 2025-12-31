const logger = require('../utils/logger');
const crypto = require('crypto');
const { getPrismaClient } = require('../config/database');

const prisma = getPrismaClient();

// Initialize SendGrid if API key is provided
let sgMail = null;
if (process.env.SENDGRID_API_KEY) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    logger.info('SendGrid initialized successfully');
  } catch (error) {
    logger.warn('SendGrid initialization failed:', error.message);
  }
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@hantibink.com';
const FROM_NAME = process.env.FROM_NAME || 'Hantibink';

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
    
    // Check if we should rate limit
    // The expiry is 24 hours from creation, so we calculate when it was created
    if (user.emailVerificationExpiry) {
      const tokenCreatedAt = new Date(user.emailVerificationExpiry.getTime() - 24 * 60 * 60 * 1000);
      const timeSinceLastEmail = Date.now() - tokenCreatedAt.getTime();
      if (timeSinceLastEmail < 5 * 60 * 1000) { // 5 minutes
        const waitTime = Math.ceil((5 * 60 * 1000 - timeSinceLastEmail) / 1000 / 60);
        throw new Error(`Please wait ${waitTime} more minute${waitTime > 1 ? 's' : ''} before requesting another verification email`);
      }
    }
    
    // Create new token
    const token = await createEmailVerification(userId);
    
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

/**
 * Send password reset email with 6-digit code
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} code - 6-digit reset code
 */
const sendPasswordResetEmail = async (email, name, code) => {
  try {
    const subject = 'Reset Your Hantibink Password';
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px 0; }
          .logo { font-size: 28px; font-weight: bold; color: #D32F2F; }
          .content { background: #f9f9f9; border-radius: 12px; padding: 30px; margin: 20px 0; }
          .code-box { background: #fff; border: 2px solid #D32F2F; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #D32F2F; }
          .footer { text-align: center; font-size: 12px; color: #999; margin-top: 30px; }
          .warning { background: #fff3cd; border-radius: 8px; padding: 15px; margin-top: 20px; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Hantibink</div>
          </div>
          <div class="content">
            <h2 style="margin-top: 0;">Hi ${name || 'there'},</h2>
            <p>We received a request to reset your password. Use the code below to complete the process:</p>
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            <p>This code will expire in <strong>15 minutes</strong>.</p>
            <div class="warning">
              <strong>Didn't request this?</strong> If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </div>
          </div>
          <div class="footer">
            <p>This email was sent by Hantibink. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Hantibink. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Hi ${name || 'there'},

We received a request to reset your password. Use the code below to complete the process:

${code}

This code will expire in 15 minutes.

Didn't request this? If you didn't request a password reset, you can safely ignore this email.

- The Hantibink Team
    `;

    // Send via SendGrid if available
    if (sgMail) {
      await sgMail.send({
        to: email,
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        text: textContent,
        html: htmlContent,
      });
      logger.info(`Password reset email sent to ${email} via SendGrid`);
      return true;
    }

    // Development fallback - log the code
    logger.info('========================================');
    logger.info('PASSWORD RESET CODE (SendGrid not configured)');
    logger.info(`Email: ${email}`);
    logger.info(`Code: ${code}`);
    logger.info('========================================');

    return true;
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
    // Don't throw - we still want to return success to prevent enumeration
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  createEmailVerification,
  verifyEmailWithToken,
  resendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};