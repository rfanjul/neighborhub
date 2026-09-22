const expoPreset = require('jest-expo/jest-preset.js');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // firebase se publica como ESM y hay que pasarlo por Babel como al resto
  // de paquetes que jest-expo ya transforma.
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map((pattern) =>
    pattern.includes('standard-navigation')
      ? pattern.replace('standard-navigation', 'standard-navigation|firebase|@firebase')
      : pattern
  ),
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**', '!src/test-utils/**'],
};
