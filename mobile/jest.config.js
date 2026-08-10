/** Jest configuration for the Hantibink mobile app (Expo SDK 54). */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup-early.js'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  transformIgnorePatterns: [
    // Prefix semantics (no trailing slash), matching jest-expo's default —
    // 'expo' must also cover expo-modules-core, expo-asset, etc.
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|react-native-svg|react-native-reanimated|react-native-worklets|@gorhom/bottom-sheet|socket\\.io-client|engine\\.io-client|@socket\\.io/.*|mixpanel-react-native|rn-emoji-keyboard|@ptomasroos/react-native-multi-slider)/?)',
  ],
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/jest.assetMock.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/dist/'],
  clearMocks: true,
};
