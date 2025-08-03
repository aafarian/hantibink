# Shared

Common utilities, types, and constants shared across mobile app and backend API.

## 🎯 Purpose

This directory contains code that is used by both the mobile app and backend API to ensure consistency and reduce duplication.

## 📁 Structure (Planned)

```
shared/
├── types/           # TypeScript type definitions
│   ├── user.ts     # User profile types
│   ├── match.ts    # Matching algorithm types
│   └── message.ts  # Chat message types
├── utils/           # Utility functions
│   ├── validation.ts # Form validation rules
│   ├── constants.ts  # App-wide constants
│   └── helpers.ts    # Common helper functions
├── config/          # Shared configuration
│   └── app.ts      # App-wide settings
└── README.md       # This file
```

## 🔧 Usage

### In Mobile App

```javascript
// Example usage in React Native
import { validateEmail } from "../shared/utils/validation";
import { UserProfile } from "../shared/types/user";
```

### In Backend API

```javascript
// Example usage in Node.js API
import { validateEmail } from "../shared/utils/validation";
import { UserProfile } from "../shared/types/user";
```

## 📝 Coming Soon

- User profile type definitions
- Validation schemas for forms
- Constants for app configuration
- Utility functions for data transformation
- Shared enums for status codes and categories
