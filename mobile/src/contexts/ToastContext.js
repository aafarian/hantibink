import React, { createContext, useContext, useState } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info', options = {}) => {
    let toastId = null;

    // Check if a toast with the same message already exists
    setToasts(prev => {
      const existingToast = prev.find(t => t.message === message && t.type === type);
      if (existingToast && !options.allowDuplicate) {
        // Don't add duplicate toast
        toastId = existingToast.id;
        return prev;
      }

      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      toastId = id;
      const toast = {
        id,
        message,
        type,
        visible: true,
        autoHide: !options.persistent, // Let Toast component handle timing
        duration: options.duration || 4000,
        ...options,
      };

      return [...prev, toast];
    });

    return toastId;
  };

  const hideToast = id => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showSuccess = (message, options = {}) => {
    return showToast(message, 'success', options);
  };

  const showError = (message, options = {}) => {
    return showToast(message, 'error', options);
  };

  const showWarning = (message, options = {}) => {
    return showToast(message, 'warning', options);
  };

  const showInfo = (message, options = {}) => {
    return showToast(message, 'info', options);
  };

  const value = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          visible={toast.visible}
          onHide={() => hideToast(toast.id)}
          autoHide={toast.autoHide}
          duration={toast.duration}
          action={toast.action}
        />
      ))}
    </ToastContext.Provider>
  );
};
