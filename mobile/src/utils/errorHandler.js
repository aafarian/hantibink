import Logger from './logger';

// Global error handler that works with the toast system
export const handleError = (error, userMessage, options = {}) => {
  const { showToast = true, logError = true, retryAction = null, fallbackAction = null } = options;

  // Log the error
  if (logError) {
    Logger.error(userMessage, error);
  }

  // Return error info for the calling component to handle with toast
  return {
    message: userMessage,
    originalError: error,
    showToast,
    retryAction,
    fallbackAction,
    timestamp: new Date().toISOString(),
  };
};

// Enhanced error handler that automatically calls showError if provided
export const handleErrorWithToast = (error, userMessage, showError, options = {}) => {
  const errorInfo = handleError(error, userMessage, options);

  if (showError && errorInfo.showToast) {
    showError(errorInfo.message, {
      action: errorInfo.retryAction
        ? { text: errorInfo.retryAction, onPress: options.onRetry }
        : undefined,
    });
  }

  return errorInfo;
};

// Specific error handlers
export const handleNetworkError = error => {
  return handleError(error, 'Network connection failed. Please check your internet connection.', {
    retryAction: 'Retry',
  });
};

export const handleAuthError = error => {
  return handleError(error, 'Authentication failed. Please log in again.', {
    fallbackAction: 'Login',
  });
};

export const handleValidationError = (error, field) => {
  return handleError(error, `Please check your ${field} and try again.`, {
    showToast: true,
  });
};

export const handleFirebaseError = error => {
  let userMessage = 'Something went wrong. Please try again.';

  // Common Firebase error codes
  switch (error.code) {
    case 'auth/user-not-found':
      userMessage = 'Account not found. Please check your email.';
      break;
    case 'auth/wrong-password':
      userMessage = 'Incorrect password. Please try again.';
      break;
    case 'auth/too-many-requests':
      userMessage = 'Too many failed attempts. Please try again later.';
      break;
    case 'auth/network-request-failed':
      return handleNetworkError(error);
    case 'permission-denied':
      userMessage = 'Permission denied. Please contact support.';
      break;
    case 'unavailable':
      userMessage = 'Service temporarily unavailable. Please try again.';
      break;
    default:
      userMessage = 'Something went wrong. Please try again.';
  }

  return handleError(error, userMessage);
};
