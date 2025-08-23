import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../test-setup/helpers/test-utils.js';
import healthRouter from './health.js';

describe('Health Routes', () => {
  const app = createTestApp(healthRouter, '/health');

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: expect.any(String),
        version: expect.any(String),
      });
    });

    it('should include environment info', async () => {
      const response = await request(app).get('/health');
      
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('cpu');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /health/detailed', () => {
    it('should check detailed health with dependencies', async () => {
      const response = await request(app).get('/health/detailed');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        checks: expect.any(Object),
      });
      expect(response.body.checks).toHaveProperty('server');
    });

    it('should include database status in detailed health check', async () => {
      // This test makes a real database call through the health check endpoint
      // The test database is already connected in the test setup
      const response = await request(app).get('/health/detailed');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.checks).toHaveProperty('server');
      expect(response.body.checks.server.status).toBe('healthy');
      
      // Verify database check is included
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks.database).toHaveProperty('status');
      // Database should be healthy since test setup connects to test DB
      expect(response.body.checks.database.status).toBe('healthy');
      
      // Verify other checks are included (even if not implemented)
      expect(response.body.checks).toHaveProperty('redis');
      expect(response.body.checks).toHaveProperty('firebase');
    });
  });
});