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

/**
 * Create a mock Socket.IO instance for testing real-time events
 */
export const createMockSocketIO = () => {
  const emitCalls = [];
  const mock = {
    to: function(room) {
      return {
        emit: (event, data) => {
          emitCalls.push({ room, event, data });
        },
      };
    },
    emit: (event, data) => {
      emitCalls.push({ room: null, event, data });
    },
    getEmitCalls: () => emitCalls,
    clearEmitCalls: () => emitCalls.length = 0,
    findEmit: (event, room = null) => {
      return emitCalls.find(call => call.event === event && (room === null || call.room === room));
    },
    countEmits: (event) => {
      return emitCalls.filter(call => call.event === event).length;
    },
  };
  return mock;
};

/**
 * Create a complete discovery scenario with two compatible users
 * User1 is a male interested in females
 * User2 is a female interested in males
 * Both have photos and location set
 */
export const createDiscoveryScenario = async (prisma, factories) => {
  const { userFactory, photoFactory } = factories;

  // Create user1 (male looking for female)
  const user1Auth = await userFactory.createWithAuth(prisma, {
    gender: 'MAN',
    interestedIn: ['WOMAN'],
    location: 'New York',
    latitude: 40.7128,
    longitude: -74.0060,
    minAge: 18,
    maxAge: 50,
    maxDistance: 100,
    isActive: true,
  });
  await photoFactory.create(prisma, user1Auth.user.id, { isMain: true });

  // Create user2 (female looking for male)
  const user2 = await userFactory.create(prisma, {
    gender: 'WOMAN',
    interestedIn: ['MAN'],
    location: 'New York',
    latitude: 40.7580,
    longitude: -73.9855,
    minAge: 18,
    maxAge: 50,
    maxDistance: 100,
    isActive: true,
  });
  await photoFactory.create(prisma, user2.id, { isMain: true });

  return { user1: user1Auth, user2 };
};