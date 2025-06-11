
const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  };
  config.resolver = {
    ...resolver,
    // assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
    // sourceExts: [...resolver.sourceExts, 'svg'],
    assetExts: [...resolver.assetExts.filter((ext) => ext !== 'svg'), 'mp3'], // Add mp3 to assetExts
    sourceExts: [...resolver.sourceExts, 'svg'], // Keep svg in sourceExts for transformer
  };

  return config;
})();