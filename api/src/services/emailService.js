/**
 * Email Service for sending transactional emails
 * Uses nodemailer with Gmail or other SMTP providers
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // For development, you can use Gmail with app-specific password
      // For production, use services like SendGrid, AWS SES, etc.
      
      if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        logger.warn('Email configuration missing. Email service disabled.');
        return;
      }

      this.transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      // Verify connection
      this.transporter.verify((error, _success) => {
        if (error) {
          logger.error('Email service connection failed:', error);
        } else {
          logger.info('✉️ Email service ready');
        }
      });
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  async sendPasswordResetEmail(email, resetToken) {
    if (!this.transporter) {
      logger.warn('Email service not configured. Logging reset token instead.');
      logger.info(`Password reset token for ${email}: ${resetToken}`);
      return { success: true, message: 'Email service not configured. Token logged.' };
    }

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"Hantibink" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request - Hantibink',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 30px; background: #FF6B6B; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to reset your password for your Hantibink account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666;">${resetUrl}</p>
              <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
              <p>If you didn't request this password reset, please ignore this email.</p>
              <div class="footer">
                <p>© 2024 Hantibink. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request

        Hello,

        We received a request to reset your password for your Hantibink account.

        Click this link to reset your password:
        ${resetUrl}

        This link will expire in 1 hour for security reasons.

        If you didn't request this password reset, please ignore this email.

        © 2024 Hantibink. All rights reserved.
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Password reset email sent to ${email}:`, info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send password reset email to ${email}:`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(email, name) {
    if (!this.transporter) {
      logger.warn('Email service not configured.');
      return { success: true, message: 'Email service not configured.' };
    }

    const mailOptions = {
      from: `"Hantibink" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Hantibink! 💕',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Hantibink! 💕</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Welcome to Hantibink - the Armenian dating app that brings hearts together!</p>
              <p>Your account has been successfully created. Here are some tips to get started:</p>
              <ul>
                <li>Complete your profile to increase your chances of finding matches</li>
                <li>Add photos that show your personality</li>
                <li>Be genuine and authentic in your interactions</li>
                <li>Stay safe and report any inappropriate behavior</li>
              </ul>
              <p>We're excited to help you connect with amazing people in the Armenian community!</p>
              <div class="footer">
                <p>© 2024 Hantibink. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Welcome email sent to ${email}:`, info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send welcome email to ${email}:`, error);
      // Don't throw error for welcome emails - they're not critical
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();