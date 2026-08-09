const logger = require('../utils/logger');
const crypto = require('crypto');
const { getPrismaClient } = require('../config/database');

const prisma = getPrismaClient();

// Email transport: Resend when RESEND_API_KEY is set, console fallback
// otherwise (dev/test). Every sender below routes through sendEmail so the
// provider can be swapped in exactly one place.
let resendClient = null;
if (process.env.RESEND_API_KEY) {
  try {
    const { Resend } = require('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
    logger.info('Resend email transport initialized');
  } catch (error) {
    logger.warn('Resend initialization failed:', error.message);
  }
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@hantibink.com';
const FROM_NAME = process.env.FROM_NAME || 'Hantibink';

/**
 * Send an email through the configured transport.
 * Returns true when handed to the provider (or logged in fallback mode).
 */
const sendEmail = async ({ to, subject, html, text, logLabel, logExtra = {} }) => {
  if (resendClient) {
    const { error } = await resendClient.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });
    if (error) {
      throw new Error(`Resend send failed: ${error.message || error.name}`);
    }
    logger.info(`${logLabel || 'Email'} sent to ${to} via Resend`);
    return true;
  }

  // Development fallback - log instead of sending
  logger.info('========================================');
  logger.info(`${logLabel || 'EMAIL'} (no email provider configured)`);
  logger.info(`Email: ${to}`);
  Object.entries(logExtra).forEach(([k, v]) => logger.info(`${k}: ${v}`));
  logger.info('========================================');
  return true;
};

/**
 * Generate a verification token
 */
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Send verification email
 */
const sendVerificationEmail = async (email, name, token) => {
  try {
    // Links to the API-hosted verification page (GET /api/auth/verify-email)
    const verificationUrl = `${process.env.APP_URL || 'http://localhost:4242'}/api/auth/verify-email?token=${token}`;
    const subject = 'Verify Your Hantibink Account';

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
          .logo { font-size: 28px; font-weight: bold; color: #C0392B; }
          .content { background: #f9f9f9; border-radius: 12px; padding: 30px; margin: 20px 0; }
          .btn { display: inline-block; background: #C0392B; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .btn:hover { background: #A93226; }
          .link-box { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 15px 0; word-break: break-all; font-size: 13px; color: #666; }
          .footer { text-align: center; font-size: 12px; color: #999; margin-top: 30px; }
          .expiry { color: #C0392B; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Hantibink</div>
          </div>
          <div class="content">
            <h2 style="margin-top: 0;">Welcome to Hantibink, ${name || 'there'}!</h2>
            <p>We're excited to have you join our community. Please verify your email address to get started:</p>
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="btn">Verify My Email</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <div class="link-box">${verificationUrl}</div>
            <p>This link will expire in <span class="expiry">24 hours</span>.</p>
          </div>
          <div class="footer">
            <p>If you didn't create a Hantibink account, you can safely ignore this email.</p>
            <p>&copy; ${new Date().getFullYear()} Hantibink. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Welcome to Hantibink, ${name || 'there'}!

We're excited to have you join our community. Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create a Hantibink account, you can safely ignore this email.

- The Hantibink Team
    `;

    return await sendEmail({
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
      logLabel: 'EMAIL VERIFICATION',
      logExtra: { 'Verification URL': verificationUrl },
    });
  } catch (error) {
    logger.error('Failed to send verification email:', error);
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
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const subject = 'Welcome to Hantibink!';

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
          .logo { font-size: 28px; font-weight: bold; color: #C0392B; }
          .content { background: #f9f9f9; border-radius: 12px; padding: 30px; margin: 20px 0; }
          .btn { display: inline-block; background: #C0392B; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .checklist { background: #fff; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .checklist-item { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
          .checklist-item:last-child { border-bottom: none; }
          .check-icon { width: 24px; height: 24px; background: #C0392B; border-radius: 50%; color: #fff; text-align: center; line-height: 24px; margin-right: 12px; font-size: 14px; }
          .footer { text-align: center; font-size: 12px; color: #999; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Hantibink</div>
          </div>
          <div class="content">
            <h2 style="margin-top: 0;">You're all set, ${name || 'there'}!</h2>
            <p>Your email has been verified and you're ready to start discovering amazing people in the Armenian community.</p>

            <div class="checklist">
              <h3 style="margin-top: 0; color: #C0392B;">Complete your profile for better matches:</h3>
              <div class="checklist-item">
                <span class="check-icon">1</span>
                <span><strong>Add photos</strong> - Show your personality with great pictures</span>
              </div>
              <div class="checklist-item">
                <span class="check-icon">2</span>
                <span><strong>Write your bio</strong> - Let others know what makes you unique</span>
              </div>
              <div class="checklist-item">
                <span class="check-icon">3</span>
                <span><strong>Add interests</strong> - Find people who share your passions</span>
              </div>
              <div class="checklist-item">
                <span class="check-icon">4</span>
                <span><strong>Set preferences</strong> - Customize who you want to meet</span>
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${appUrl}" class="btn">Start Discovering</a>
            </div>
          </div>
          <div class="footer">
            <p>Happy connecting!</p>
            <p>&copy; ${new Date().getFullYear()} Hantibink. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
You're all set, ${name || 'there'}!

Your email has been verified and you're ready to start discovering amazing people in the Armenian community.

Complete your profile for better matches:

1. Add photos - Show your personality with great pictures
2. Write your bio - Let others know what makes you unique
3. Add interests - Find people who share your passions
4. Set preferences - Customize who you want to meet

Start discovering at: ${appUrl}

Happy connecting!
- The Hantibink Team
    `;

    return await sendEmail({
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
      logLabel: 'WELCOME EMAIL',
    });
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
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
          .logo { font-size: 28px; font-weight: bold; color: #C0392B; }
          .content { background: #f9f9f9; border-radius: 12px; padding: 30px; margin: 20px 0; }
          .code-box { background: #fff; border: 2px solid #C0392B; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #C0392B; }
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

    return await sendEmail({
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
      logLabel: 'PASSWORD RESET CODE',
      logExtra: { Code: code },
    });
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
    // Don't throw - we still want to return success to prevent enumeration
    return false;
  }
};

/**
 * Send the waitlist confirmation email.
 */
const sendWaitlistEmail = async (email, name) => {
  try {
    const subject = "You're on the Hantibink list 🎉";
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
          .logo { font-size: 28px; font-weight: bold; color: #C0392B; }
          .content { background: #f9f9f9; border-radius: 12px; padding: 30px; margin: 20px 0; }
          .footer { text-align: center; font-size: 12px; color: #999; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><div class="logo">Hantibink</div></div>
          <div class="content">
            <h2 style="margin-top: 0;">You're on the list${name ? `, ${name}` : ''}!</h2>
            <p>Thanks for signing up. You'll be among the first to know when Hantibink launches.</p>
            <p>Great connections are worth the wait. ❤️</p>
          </div>
          <div class="footer">
            <p>You received this because this address joined the Hantibink waitlist. If this wasn't you, just ignore this email.</p>
            <p>&copy; ${new Date().getFullYear()} Hantibink. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    const textContent = `You're on the list${name ? `, ${name}` : ''}!\n\nThanks for signing up. You'll be among the first to know when Hantibink launches.\n\n- The Hantibink Team`;

    return await sendEmail({
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
      logLabel: 'WAITLIST CONFIRMATION',
    });
  } catch (error) {
    logger.error('Failed to send waitlist email:', error);
    // Never fail the signup because the confirmation email failed
    return false;
  }
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  createEmailVerification,
  verifyEmailWithToken,
  resendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendWaitlistEmail,
};