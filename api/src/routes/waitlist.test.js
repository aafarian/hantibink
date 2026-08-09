import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../test-setup/helpers/test-utils.js';
import waitlistRouter from './waitlist.js';

describe('Waitlist Routes', () => {
  let app;

  beforeEach(() => {
    app = createTestApp(waitlistRouter, '/waitlist');
    vi.clearAllMocks();
  });

  it('signs up a new email and stores it', async () => {
    const response = await request(app)
      .post('/waitlist')
      .send({ email: 'early@example.com', name: 'Early Bird', source: 'instagram' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const row = await global.prisma.waitlist.findUnique({
      where: { email: 'early@example.com' },
    });
    expect(row).not.toBeNull();
    expect(row.name).toBe('Early Bird');
    expect(row.source).toBe('instagram');
  });

  it('is idempotent for duplicate emails (no enumeration)', async () => {
    await request(app).post('/waitlist').send({ email: 'dupe@example.com' });
    const second = await request(app).post('/waitlist').send({ email: 'dupe@example.com' });

    expect(second.status).toBe(200);
    expect(second.body.success).toBe(true);

    const count = await global.prisma.waitlist.count({
      where: { email: 'dupe@example.com' },
    });
    expect(count).toBe(1);
  });

  it('rejects invalid emails', async () => {
    const response = await request(app)
      .post('/waitlist')
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('requires an email', async () => {
    const response = await request(app).post('/waitlist').send({ name: 'No Email' });
    expect(response.status).toBe(400);
  });

  it('honeypot: fake success without writing', async () => {
    const response = await request(app)
      .post('/waitlist')
      .send({ email: 'bot@example.com', website: 'https://spam.example' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const row = await global.prisma.waitlist.findUnique({
      where: { email: 'bot@example.com' },
    });
    expect(row).toBeNull();
  });

  it('caps name and source lengths', async () => {
    const response = await request(app)
      .post('/waitlist')
      .send({ email: 'long@example.com', name: 'x'.repeat(101) });

    expect(response.status).toBe(400);
  });
});
