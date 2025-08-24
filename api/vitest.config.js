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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'test-setup',
        '*.config.js',
        'src/migrations',
        'src/seeds',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test-helpers': path.resolve(__dirname, './test-setup/helpers'),
    },
  },
});