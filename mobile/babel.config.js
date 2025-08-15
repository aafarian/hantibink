module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Enable reanimated plugin for better performance
      'react-native-reanimated/plugin',
    ],
  };
};
