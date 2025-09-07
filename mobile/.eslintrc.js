module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    'react-native/react-native': true,
  },
  extends: ['eslint:recommended', '@react-native-community', 'prettier'],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
    requireConfigFile: false,
    babelOptions: {
      presets: ['babel-preset-expo'],
    },
  },
  plugins: ['react', 'react-native', 'prettier'],
  rules: {
    'prettier/prettier': 'error',

    // Console warnings - only warn in production files, allow in utils
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Variable rules - be more lenient for development
    'prefer-const': 'error',
    'no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],

    // React rules
    'react/react-in-jsx-scope': 'off',

    // React Native rules - keep these for code quality
    'react-native/no-unused-styles': 'warn',
    'react-native/no-inline-styles': 'off', // Turned off - too many to fix right now

    // Hook dependency warnings - these are important!
    'react-hooks/exhaustive-deps': 'error',

    // Keep important rules but make them warnings during development
    'no-shadow': 'warn',
    'no-catch-shadow': 'off', // This rule is deprecated
    'no-alert': 'warn', // Warn about alerts but don't error
  },

  // File-specific overrides
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      rules: {
        'no-unused-vars': 'warn', // Test files should still warn about unused vars
      },
    },
  ],
};
