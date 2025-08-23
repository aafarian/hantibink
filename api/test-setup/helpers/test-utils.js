import express from 'express';
import bodyParser from 'body-parser';

/**
 * Create a test Express app with the given routes
 */
export const createTestApp = (router, basePath = '') => {
  const app = express();
  
  // Add middleware
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  
  // Add routes
  if (basePath) {
    app.use(basePath, router);
  } else {
    app.use(router);
  }
  
  // Error handler
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  });
  
  return app;
};

/**
 * Helper to assert successful response
 */
export const expectSuccess = (response, statusCode = 200) => {
  expect(response.status).toBe(statusCode);
  expect(response.body.success).toBe(true);
  return response.body.data;
};

/**
 * Helper to assert error response
 */
export const expectError = (response, statusCode = 400, errorMessage = null) => {
  expect(response.status).toBe(statusCode);
  expect(response.body.success).toBe(false);
  expect(response.body.error).toBeDefined();
  
  if (errorMessage) {
    expect(response.body.error).toContain(errorMessage);
  }
  
  return response.body.error;
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