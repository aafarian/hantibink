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

### Code Review

Before committing any significant changes, **ALWAYS** review the code like a senior staff engineer, checking for:

1. **Redundant/Reusable Code** - Extract repeated logic into helper functions or shared utilities
2. **Unused Code** - Remove dead code, unused imports, and commented-out blocks
3. **Bad Practices** - Anti-patterns, security vulnerabilities (OWASP top 10), memory leaks
4. **Potential Improvements** - Better algorithms, cleaner abstractions, more readable code
5. **Edge Cases** - Null/undefined handling, empty arrays, network failures, race conditions
6. **Potential Errors** - Type mismatches, async/await issues, unhandled promise rejections
7. **Missing Tests** - Identify critical paths that should have test coverage
8. **API Response Handling** - Ensure all API responses are properly unwrapped (check `response.data.data` vs `response.data`)
9. **State Management** - Verify optimistic updates revert on failure, loading states are handled
10. **Database Operations** - Check for missing null checks, proper error handling, transaction usage where needed
11. **Memoization & Caching** - Use `useMemo`/`useCallback` for expensive computations and stable references; consider API response caching for frequently accessed, rarely-changing data

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

# React Hooks Best Practices

## useEffect Dependencies

### Always include all dependencies

```javascript
// ❌ BAD - Missing dependency
useEffect(() => {
  doSomething(value);
}, []); // 'value' is missing

// ✅ GOOD - All dependencies included
useEffect(() => {
  doSomething(value);
}, [value]);
```

### Use useCallback for functions used in useEffect

```javascript
// ❌ BAD - Function recreated every render
const loadData = async () => {
  const data = await fetchData(userId);
  setData(data);
};

useEffect(() => {
  loadData();
}, []); // Missing dependency

// ✅ GOOD - Function memoized with dependencies
const loadData = useCallback(async () => {
  const data = await fetchData(userId);
  setData(data);
}, [userId]);

useEffect(() => {
  loadData();
}, [loadData]);
```

### Use useMemo for derived values

```javascript
// ❌ BAD - Creates new object every render
const config = route?.params?.config || {};

const doSomething = useCallback(() => {
  // uses config
}, [config]); // Changes every render!

// ✅ GOOD - Memoized value
const config = useMemo(
  () => route?.params?.config || {},
  [route?.params?.config],
);

const doSomething = useCallback(() => {
  // uses config
}, [config]); // Stable reference
```

## Common Patterns

### Loading data on mount

```javascript
const Component = ({ userId }) => {
  const [data, setData] = useState(null);

  // Memoize the loading function
  const loadData = useCallback(async () => {
    try {
      const result = await fetchData(userId);
      setData(result);
    } catch (error) {
      Logger.error("Failed to load:", error);
    }
  }, [userId]);

  // Load on mount and when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]);
};
```

### Using route params

```javascript
const Screen = ({ route }) => {
  // Memoize route params to prevent unnecessary re-renders
  const params = useMemo(() => route?.params || {}, [route?.params]);

  const [state, setState] = useState({
    value: params.initialValue || "default",
  });
};
```

## Key Rules

1. **Always specify dependencies** - Never use empty arrays unless you truly want the effect to run only once
2. **Use useCallback for functions** - Especially if they're used in useEffect or passed as props
3. **Use useMemo for expensive computations** - Or when creating objects/arrays used as dependencies
4. **Don't lie about dependencies** - Include all values from component scope that are used inside the effect
5. **Use eslint-plugin-react-hooks** - It will catch most dependency issues

## React Keys

### Use stable, unique values as keys

```javascript
// ❌ BAD - Index can cause issues with reordering
items.map((item, index) => <Item key={index} />);

// ✅ GOOD - Stable unique identifier
items.map((item) => <Item key={item.id} />);

// ✅ GOOD - For simple strings/numbers
items.map((item) => <Item key={item} />);
```

## ScrollView Inside Modal

When using a ScrollView inside a Modal, **don't wrap it in touchable components** as they capture touch events and block scrolling.

### The Problem

Wrapping modal content in `Pressable` or `TouchableWithoutFeedback` (even for tap-outside-to-close) captures touch events and blocks scroll gestures.

### The Solution

Use a **sibling Pressable backdrop** instead of wrapping the content. The backdrop is absolutely positioned behind the modal, so taps on it close the modal, but the modal content (including ScrollView) isn't wrapped.

```javascript
// ❌ BAD - Touchable wrappers block ScrollView scrolling
<Modal visible={visible}>
  <TouchableWithoutFeedback onPress={onClose}>
    <View style={styles.overlay}>
      <TouchableWithoutFeedback>
        <View style={styles.content}>
          <ScrollView>{/* Won't scroll! */}</ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </View>
  </TouchableWithoutFeedback>
</Modal>

// ✅ GOOD - Backdrop as sibling, not wrapper
<Modal visible={visible} onRequestClose={onClose}>
  <View style={styles.container}>
    {/* Backdrop - absolutely positioned behind */}
    <Pressable style={styles.backdrop} onPress={onClose} />
    {/* Content - sibling, not child of Pressable */}
    <View style={styles.content}>
      <ScrollView style={{ maxHeight: 280 }}>
        {/* Scrolls correctly! */}
      </ScrollView>
    </View>
  </View>
</Modal>

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  content: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
});
```

### Key Points

1. **Backdrop as sibling** - Use `absoluteFillObject` to position behind modal content
2. **Modal content is NOT wrapped** - It's a sibling of the backdrop, not a child
3. **Set maxHeight on ScrollView** - Ensures bounded height to scroll within
4. **Use overflow: 'hidden' on content** - Ensures border radius clips correctly
5. **See example** - `Toast.js` error details modal uses this pattern
