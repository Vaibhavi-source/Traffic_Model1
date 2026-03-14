module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for react-native-reanimated 4.x
      'react-native-reanimated/plugin',
    ],
  };
};
