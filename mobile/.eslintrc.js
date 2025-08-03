module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    'react-native/react-native': true,
  },
  extends: ['eslint:recommended', '@react-native-community', 'prettier'],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['react', 'react-native', 'prettier'],
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-unused-vars': 'warn',
    'react/react-in-jsx-scope': 'off',
    'react-native/no-unused-styles': 'warn',
  },
};
