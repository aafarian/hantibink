/**
 * Centralized logging utility
 * Automatically handles development/production environment checks
 * No more scattered if (__DEV__) checks needed!
 */

const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';

class Logger {
  // Basic logging methods
  static log(message, ...args) {
    if (isDevelopment) {
      console.log(message, ...args);
    }
  }

  static info(message, ...args) {
    if (isDevelopment) {
      console.log(`ℹ️ ${message}`, ...args);
    }
  }

  static success(message, ...args) {
    if (isDevelopment) {
      console.log(`✅ ${message}`, ...args);
    }
  }

  static warn(message, ...args) {
    if (isDevelopment) {
      console.warn(`⚠️ ${message}`, ...args);
    }
  }

  static warning(message, ...args) {
    if (isDevelopment) {
      console.warn(`⚠️ ${message}`, ...args);
    }
  }

  static error(message, ...args) {
    // Always log errors, even in production
    console.error(`❌ ${message}`, ...args);
  }

  static debug(message, ...args) {
    if (isDevelopment) {
      console.log(`🔍 DEBUG: ${message}`, ...args);
    }
  }

  // Domain-specific logging methods
  static location(message, ...args) {
    if (isDevelopment) {
      console.log(`📍 ${message}`, ...args);
    }
  }

  static auth(message, ...args) {
    if (isDevelopment) {
      console.log(`🔐 ${message}`, ...args);
    }
  }

  static firebase(message, ...args) {
    if (isDevelopment) {
      console.log(`🔥 ${message}`, ...args);
    }
  }

  static navigation(message, ...args) {
    if (isDevelopment) {
      console.log(`🧭 ${message}`, ...args);
    }
  }

  static api(message, ...args) {
    if (isDevelopment) {
      console.log(`🌐 ${message}`, ...args);
    }
  }
}

export default Logger;
