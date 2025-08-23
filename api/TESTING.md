# API Testing Documentation

## Overview

This project uses Vitest for testing with a real PostgreSQL database running in Docker. Tests are colocated with source files for better maintainability.

## Quick Start

```bash
# Run all tests
npm run test:all

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test src/routes/auth.test.js
```

## Test Database Setup

The test suite uses a dedicated PostgreSQL database running in Docker:

1. **Automatic Setup**: The database starts automatically when running tests
2. **Manual Control**:

   ```bash
   npm run test:db:up    # Start test database
   npm run test:db:down  # Stop test database
   ```

3. **Connection Details**:
   - Host: localhost
   - Port: 5433
   - Database: hantibink_test
   - User: test
   - Password: test

## Test Structure

### File Organization

```
src/
├── routes/
│   ├── auth.js
│   └── auth.test.js      # Test file colocated with source
├── middleware/
│   ├── auth.js
│   └── auth.test.js
└── utils/
    ├── jwt.js
    └── jwt.test.js
```

### Test Helpers

Located in `test-setup/helpers/`:

1. **factories.js**: Data factories for creating test entities

   ```javascript
   const { user, authHeader } = await userFactory.createWithAuth(prisma);
   ```

2. **test-utils.js**: Utility functions for testing
   ```javascript
   const app = createTestApp(router);
   expectSuccess(response, 200);
   expectError(response, 400, 'Error message');
   ```

## Writing Tests

### Basic Test Structure

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../test-setup/helpers/test-utils.js';
import { userFactory } from '../../test-setup/helpers/factories.js';

describe('Feature Name', () => {
  let app;

  beforeEach(() => {
    app = createTestApp(router, '/base-path');
  });

  it('should do something', async () => {
    const response = await request(app).get('/endpoint').send({ data: 'test' });

    expectSuccess(response, 200);
  });
});
```

### Testing Authenticated Routes

```javascript
it('should require authentication', async () => {
  const { authHeader } = await userFactory.createWithAuth(global.prisma);

  const response = await request(app)
    .get('/protected')
    .set('Authorization', authHeader);

  expectSuccess(response);
});
```

### Using Factories

```javascript
// Create a user with specific attributes
const user = await userFactory.create(global.prisma, {
  email: 'specific@example.com',
  isPremium: true,
});

// Create multiple users
const users = await userFactory.createMany(global.prisma, 5);

// Create user with photos
const user = await userFactory.create(global.prisma);
const photos = await photoFactory.createMany(global.prisma, user.id, 3);
```

## Database Management

### Automatic Cleanup

- Database is cleared before each test suite
- No manual cleanup needed in tests

### Manual Database Access

```bash
# Connect to test database
psql -h localhost -p 5433 -U test -d hantibink_test

# View database logs
docker logs hantibink-test-db
```

## Best Practices

1. **Test Isolation**: Each test suite starts with a clean database
2. **Use Factories**: Always use factories instead of manual data creation
3. **Colocate Tests**: Keep test files next to their source files
4. **Mock External Services**: Mock third-party APIs and services
5. **Test Real Scenarios**: Test actual user workflows, not just happy paths

## Coverage

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/index.html
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if test database is running
docker ps | grep hantibink-test-db

# Restart test database
npm run test:db:down && npm run test:db:up

# View database logs
docker logs hantibink-test-db
```

### Test Failures

1. Check database is running: `npm run test:db:up`
2. Check migrations: Tests run `prisma db push` automatically
3. Clear Docker volumes: `docker-compose -f docker-compose.test.yml down -v`

### Performance

- Tests run in parallel by default
- Use `.sequential` for tests that must run in order
- Database cleanup happens before each suite, not each test

## CI/CD Integration

For CI environments:

1. Start test database service
2. Wait for database to be ready
3. Run tests with coverage
4. Upload coverage reports

Example GitHub Actions:

```yaml
- name: Start test database
  run: npm run test:db:up

- name: Run tests
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```
