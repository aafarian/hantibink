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
  const [counter, setCounter] = useState(0);

  const showToast = (message, type = 'info', options = {}) => {
    const id = `${Date.now()}-${counter}`;
    setCounter(prev => prev + 1);

    const toast = {
      id,
      message,
      type,
      visible: true,
      ...options,
    };

    setToasts(prev => [...prev, toast]);

    // Auto-remove if no duration specified
    if (!options.persistent) {
      setTimeout(() => {
        hideToast(id);
      }, options.duration || 4000);
    }

    return id;
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
          duration={toast.duration}
          action={toast.action}
        />
      ))}
    </ToastContext.Provider>
  );
};
