import express from 'express';

/**
 * Create a test Express app with the given routes
 */
export const createTestApp = (router, basePath = '') => {
  const app = express();
  
  // Add middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Add routes
  if (basePath) {
    app.use(basePath, router);
  } else {
    app.use(router);
  }
  
  // Error handler (matches main app errorHandler.js format)
  // This handles unhandled errors that bubble up to the error handler
  app.use((err, req, res, _next) => {
    const statusCode = err.statusCode || err.status || 500;
    const status = statusCode >= 500 ? 'error' : 'fail';
    
    // Match the format from errorHandler.js sendErrorResponse
    res.status(statusCode).json({
      status,
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && {
        error: err,
        stack: err.stack,
      }),
    });
  });
  
  return app;
};

/**
 * Helper to assert successful response
 * Handles route responses with { success: true, data: ... } format
 */
export const expectSuccess = (response, statusCode = 200) => {
  expect(response.status).toBe(statusCode);
  expect(response.body.success).toBe(true);
  return response.body.data;
};

/**
 * Helper to assert error response
 * Handles both:
 * - Route error responses: { success: false, error: ..., message: ... }
 * - Error handler responses: { status: 'fail'/'error', message: ... }
 */
export const expectError = (response, statusCode = 400, errorMessage = null) => {
  expect(response.status).toBe(statusCode);
  
  // Handle both error formats
  if ('success' in response.body) {
    // Route error format
    expect(response.body.success).toBe(false);
    if (errorMessage) {
      const error = response.body.error || response.body.message;
      expect(error).toContain(errorMessage);
    }
    return response.body.error || response.body.message;
  } else {
    // Error handler format
    expect(response.body.status).toMatch(/^(fail|error)$/);
    if (errorMessage) {
      expect(response.body.message).toContain(errorMessage);
    }
    return response.body.message;
  }
};

/**
 * Helper to create authenticated request
 */
export const authRequest = (request, token) => {
  return request.set('Authorization', `Bearer ${token}`);
};

/**
 * Helper to wait for async operations
 */
export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));