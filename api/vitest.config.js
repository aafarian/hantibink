import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test-setup/setup.js'],
    include: ['src/**/*.test.js'],
    hookTimeout: 20000, // Increase timeout for database operations
    testTimeout: 10000,
    // Run tests sequentially to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**'],
      exclude: [
        'node_modules',
        'test-setup',
        '*.config.js',
        'src/**/*.test.js',
        // Boot/config/tooling code isn't unit-testable in this harness
        'src/server.js',
        'src/config/**',
        'src/scripts/**',
      ],
      // Regression floor: set a few points below measured coverage so CI
      // fails on backsliding without demanding aspirational numbers.
      thresholds: {
        lines: 55,
        statements: 55,
        functions: 45,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test-helpers': path.resolve(__dirname, './test-setup/helpers'),
    },
  },
});