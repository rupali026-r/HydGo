// Shim to fix "Cannot destructure property '__extends' of 'tslib.default' as it is undefined"
// Some compiled code does: import tslib from 'tslib'; const { __extends } = tslib;
// But Metro ESM interop wraps CJS modules so .default becomes undefined.
// This shim re-exports everything and ensures .default points back to the helpers object.

var tslib = require('./node_modules/tslib/tslib.js');

// Ensure .default exists for ESM interop destructuring
if (!tslib.default) {
  try {
    Object.defineProperty(tslib, 'default', {
      value: tslib,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  } catch (e) {
    // Property might already exist but not be configurable
  }
}

module.exports = tslib;
