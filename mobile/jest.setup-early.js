/**
 * Runs before the test framework loads (jest setupFiles).
 * Native-module shims that must exist before anything imports them.
 */
import 'react-native-gesture-handler/jestSetup';

// Reanimated 4 ships an official mock; the worklets runtime does not exist
// under Jest, so the mock is the supported path.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
