/**
 * Tests de las reglas de seguridad contra los emuladores de Firebase.
 * Van aparte de la suite normal porque necesitan Firestore y Storage
 * corriendo: se lanzan con `npm run test:rules`, que arranca los
 * emuladores, ejecuta estos tests y los apaga.
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/rules/**/*.test.ts'],
  transform: { '\\.[jt]sx?$': 'babel-jest' },
  testTimeout: 30000,
};
