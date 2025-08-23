# Claude Code Rules and Guidelines

## Project-Specific Rules

### Logging

- **ALWAYS** use the Logger utility instead of console.log, console.error, etc.
  - Mobile: `import Logger from '../utils/logger';`
  - API: `const logger = require('../utils/logger');`
- Use appropriate log levels:
  - `Logger.info()` / `logger.info()` for general information
  - `Logger.error()` / `logger.error()` for errors
  - `Logger.warn()` / `logger.warn()` for warnings
  - `Logger.debug()` / `logger.debug()` for debug information
  - `Logger.success()` for success messages (mobile only)

### Code Quality

- **ALWAYS** make sure the code we write doesn't have lint issues
- Fix lint errors immediately, don't use eslint-disable comments unless absolutely necessary

### Error Handling

- Always use try-catch blocks for async operations
- Log errors with appropriate context using Logger/logger
- Provide meaningful error messages to users via toast notifications (mobile) or API responses

### API Development

- Use transactions for multiple database operations that should be atomic
- Always validate input data using the validation middleware
- Return consistent response formats: `{ success: true/false, data/error, message }`
- Use appropriate HTTP status codes

### Mobile Development

- Use the TodoWrite tool for complex multi-step tasks
- Always check for null/undefined before accessing object properties
- Use optional chaining (`?.`) and nullish coalescing (`??`) where appropriate
- Import order: React, React Native, third-party libs, contexts, services, components, utils, styles

### Git Commits

- Only commit when explicitly asked by the user
- Include descriptive commit messages
- Run lint before committing

### Testing Changes

- Test the actual functionality, not just the code compilation

### Performance

- Use `useCallback` and `useMemo` for expensive operations in React components
- Avoid unnecessary re-renders by properly managing dependencies
- Clean up timers, intervals, and subscriptions in useEffect cleanup functions

### Documentation

- Add JSDoc comments for utility functions and complex logic
- Keep comments concise and relevant
- Don't add comments for self-explanatory code

## Project Structure

### Mobile App (`/mobile`)

- Components: `/src/components`
- Screens: `/src/screens`
- Contexts: `/src/contexts`
- Services: `/src/services`
- Utils: `/src/utils`
- Navigation: `/src/navigation`

### API (`/api`)

- Routes: `/src/routes`
- Services: `/src/services`
- Middleware: `/src/middleware`
- Utils: `/src/utils`
- Config: `/src/config`

## Common Commands

### Development

- Start both: `npm run dev`
- Start API only: `cd api && npm run dev`
- Start Mobile only: `cd mobile && npm start`

### Linting

- Lint all: `npm run lint`
- Fix auto-fixable issues: `npx eslint --fix [path]`

### Database

- Generate Prisma client: `cd api && npx prisma generate`
- Run migrations: `cd api && npx prisma migrate dev`
- Open Prisma Studio: `cd api && npx prisma studio`

## Environment Variables

### API Required

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT tokens
- `ADMIN_EMAIL` - Admin user email

### Mobile Required

- API endpoint configuration in `src/config/api.js`

## Important Notes

- The app uses JWT authentication, not Firebase Auth (though Firebase is used for some features)
- Premium features are controlled by `isPremium` flag on user profile
- All API calls should go through `ApiClient` or `ApiDataService`
- Toast notifications are handled via `ToastContext`
- Location services are managed via `LocationContext`
