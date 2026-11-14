// Jest stand-in for the @expo-google-fonts packages. Each export is its own
// name (the bundler makes it a number), so theme files load without the .ttf
// files and a test can check that a face's family names the file it loads.
module.exports = new Proxy(
  {},
  {
    get: (_target, key) => (key === '__esModule' ? true : key === 'default' ? undefined : String(key)),
  },
);
