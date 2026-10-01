#!/usr/bin/env node
/**
 * Arranca Metro en modo demo (puerto 8086): la app habla con los emuladores
 * locales y el login ofrece entrar con la cuenta demo de seed-data.js.
 * Antes: npm run demo:emulators y npm run demo:seed.
 */
const { spawn } = require('child_process');
const { cuentaDemo } = require('./seed-data');

const env = {
  ...process.env,
  EXPO_PUBLIC_USE_EMULATORS: '1',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-neighborhub',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-neighborhub.appspot.com',
  EXPO_PUBLIC_DEMO_EMAIL: cuentaDemo.email,
  EXPO_PUBLIC_DEMO_PASSWORD: cuentaDemo.password,
};
const args = ['expo', 'start', '--dev-client', '--port', '8086', ...process.argv.slice(2)];
spawn('npx', args, { env, stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 0));
