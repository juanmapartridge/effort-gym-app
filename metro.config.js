const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Desactiva la resolución de package exports ESM (.mjs) que inyectan `import.meta`
// en paquetes como Zustand v5 cuando Metro genera el bundle para Web.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;

