import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Logger from '../utils/logger';
import { MaterialIcons } from '@expo/vector-icons';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service here
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });

    // Enhanced logging for better debugging
    Logger.error('ErrorBoundary caught an error:', {
      name: error.name || 'Error',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // In production, you would send this to a service like Sentry
    // logErrorToService(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#FF6B6B" />
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorMessage}>
            We've encountered an unexpected error. Please try again.
          </Text>

          {this.state.error && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>Debug Info (Development Only):</Text>
              <Text style={styles.debugText}>
                {this.state.error.name}: {this.state.error.message}
              </Text>
              {this.state.errorInfo?.componentStack && (
                <Text style={styles.debugText}>
                  {'\n'}Component Stack:{'\n'}
                  {this.state.errorInfo.componentStack.slice(0, 300)}...
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>

          {this.props.showFallback && (
            <TouchableOpacity style={styles.fallbackButton} onPress={this.props.onFallback}>
              <Text style={styles.fallbackButtonText}>Go Back to Home</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fallbackButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  fallbackButtonText: {
    color: '#666',
    fontSize: 16,
  },
  debugContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;
