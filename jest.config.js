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
  // text-summary sale por consola (de ahí lee GitLab el %), cobertura alimenta
  // las anotaciones de cobertura en los merge requests y lcov el informe HTML.
  coverageReporters: ['text', 'text-summary', 'json-summary', 'cobertura', 'lcov'],
  // Mínimo exigido en CI: por debajo de esto, `jest --coverage` falla y con él
  // el pipeline, que es lo que impide mergear una PR que baje la cobertura.
  coverageThreshold: {
    global: { statements: 90, branches: 90, functions: 90, lines: 90 },
  },
  // En CI además se escribe el informe JUnit que GitLab enseña en la pestaña
  // de tests del pipeline.
  reporters: process.env.CI
    ? ['default', ['jest-junit', { outputDirectory: 'coverage', outputName: 'junit.xml' }]]
    : ['default'],
};
