# 🗄️ Database Setup & Management

This document covers the PostgreSQL database setup, schema design, and management for the Hantibink API.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Database Schema](#database-schema)
- [Local Development](#local-development)
- [Production Setup](#production-setup)
- [Common Operations](#common-operations)
- [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

### Option 1: Automated Setup

```bash
npm run setup:dev
```

### Option 2: Manual Setup

```bash
# 1. Generate Prisma client
npm run db:generate

# 2. Push schema to database
npm run db:push

# 3. Seed with initial data
npm run db:seed
```

## 🏗️ Database Schema

### Core Models

#### **Users**

- User profiles, authentication, preferences
- Location data for matching
- Profile statistics and settings

#### **Photos**

- User profile photos
- Main photo selection
- Photo ordering

#### **Interests**

- Predefined interest categories
- Many-to-many relationship with users

#### **UserActions**

- Like/pass/super-like actions
- Prevents duplicate actions
- Tracks user behavior

#### **Matches**

- Created when two users like each other
- Tracks last message for quick access
- Read status for unread counts

#### **Messages**

- Real-time chat messages
- Read/delivery status
- Support for media attachments

#### **Subscriptions**

- Premium subscription management
- Stripe integration ready
- Auto-renewal tracking

#### **Notifications**

- Push notifications
- In-app notifications
- Read status tracking

#### **Reports**

- User reporting system
- Admin review workflow
- Safety and moderation

## 💻 Local Development

### Prerequisites

You need PostgreSQL running locally. Choose one option:

#### Option A: Homebrew (macOS)

```bash
brew install postgresql@15
brew services start postgresql@15
createdb hantibink_dev
createuser hantibink_user
psql -d hantibink_dev -c "ALTER USER hantibink_user WITH PASSWORD 'hantibink_password';"
```

#### Option B: Docker

```bash
docker run --name hantibink-postgres \
  -e POSTGRES_DB=hantibink_dev \
  -e POSTGRES_USER=hantibink_user \
  -e POSTGRES_PASSWORD=hantibink_password \
  -p 5432:5432 -d postgres:15-alpine
```

#### Option C: Docker Compose

```bash
cd .. && docker-compose up postgres -d
```

### Environment Variables

Ensure your `.env` file has:

```env
DATABASE_URL="postgresql://hantibink_user:hantibink_password@localhost:5432/hantibink_dev?schema=public"
```

## 🚀 Production Setup

### Docker Compose (Recommended)

```bash
docker-compose up -d
```

### Manual Production Setup

1. Set up PostgreSQL server
2. Create production database
3. Set `DATABASE_URL` environment variable
4. Run migrations: `npm run db:migrate:deploy`
5. Seed production data if needed

## 🛠️ Common Operations

### Database Management

```bash
# View database in browser
npm run db:studio

# Reset database (⚠️ DESTRUCTIVE)
npm run db:reset

# Create new migration
npm run db:migrate

# Deploy migrations to production
npm run db:migrate:deploy

# Seed database
npm run db:seed
```

### Schema Changes

1. Modify `prisma/schema.prisma`
2. Generate client: `npm run db:generate`
3. Push changes: `npm run db:push` (dev) or `npm run db:migrate` (prod)

### Backup & Restore

```bash
# Backup
pg_dump hantibink_dev > backup.sql

# Restore
psql hantibink_dev < backup.sql
```

## 🔍 Troubleshooting

### Common Issues

#### "Database does not exist"

```bash
createdb hantibink_dev
```

#### "Connection refused"

```bash
# Check if PostgreSQL is running
brew services list | grep postgresql
# or
docker ps | grep postgres
```

#### "Permission denied"

```bash
# Grant permissions to user
psql -d hantibink_dev -c "GRANT ALL PRIVILEGES ON DATABASE hantibink_dev TO hantibink_user;"
```

#### "Schema out of sync"

```bash
# Reset and regenerate
npm run db:reset
npm run setup:dev
```

### Performance Tips

1. **Indexes**: Key indexes are defined in schema for:
   - User location queries
   - Match lookups
   - Message ordering

2. **Connection Pooling**: Prisma handles connection pooling automatically

3. **Query Optimization**: Use Prisma's query optimization features:
   ```javascript
   // Include related data efficiently
   const user = await prisma.user.findUnique({
     where: { id: userId },
     include: {
       photos: true,
       interests: { include: { interest: true } },
     },
   });
   ```

## 📊 Monitoring

### Health Checks

The API includes database health checks at `/health/detailed`

### Logging

Database queries are logged in development mode for debugging.

### Metrics

Consider adding these production metrics:

- Connection pool usage
- Query performance
- Error rates
- Database size growth

## 🔐 Security

### Best Practices

- ✅ Environment variables for credentials
- ✅ Connection string encryption
- ✅ Prepared statements (Prisma default)
- ✅ Input validation
- ✅ Rate limiting on database operations

### Backup Strategy

- Daily automated backups
- Point-in-time recovery
- Cross-region replication for production

## 📚 Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Design Best Practices](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
