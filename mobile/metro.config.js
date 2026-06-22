const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Include .tflite files as bundled assets for ML models
config.resolver.assetExts.push('tflite');

module.exports = withNativeWind(config, { input: "./global.css" });
