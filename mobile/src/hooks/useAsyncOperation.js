import { useState, useCallback } from 'react';
import Logger from '../utils/logger';

export const useAsyncOperation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (operation, options = {}) => {
    const {
      loadingMessage = 'Loading...',
      errorMessage = 'Operation failed',
      successMessage = null,
      showSuccessToast = false,
      showErrorToast = true,
    } = options;

    try {
      setLoading(true);
      setError(null);

      Logger.info(loadingMessage);
      const result = await operation();

      if (successMessage) {
        Logger.success(successMessage);
      }

      return {
        success: true,
        data: result,
        showSuccessToast,
        successMessage,
      };
    } catch (err) {
      const errorMsg = err.message || errorMessage;
      setError(errorMsg);
      Logger.error(errorMessage, err);

      return {
        success: false,
        error: errorMsg,
        originalError: err,
        showErrorToast,
        errorMessage: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = () => {
    setLoading(false);
    setError(null);
  };

  return {
    loading,
    error,
    execute,
    reset,
    isError: !!error,
    isLoading: loading,
  };
};
