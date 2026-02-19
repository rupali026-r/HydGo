const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Fix "Cannot destructure property '__extends' of 'tslib.default'"
  // Shim adds tslib.default = tslib so both named and default imports work
  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    tslib$: path.resolve(__dirname, 'tslib-shim.js'),
  };

  return config;
};
