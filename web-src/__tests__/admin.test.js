/**
 * La web de administración (web/admin): lo que se comprueba sin navegador.
 * El acceso de verdad lo cierran las reglas de Firestore (isAdmin) y sus
 * tests en rules/__tests__.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { construir } = require('../../scripts/build-web');

const carpeta = path.join(__dirname, '..', '..', 'web', 'admin');
const html = fs.readFileSync(path.join(carpeta, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(carpeta, 'admin.js'), 'utf8');

describe('web/admin', () => {
  it('no la indexan los buscadores', () => {
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow">/);
  });

  it('carga Auth y Firestore de Firebase antes que su script', () => {
    const orden = ['firebase-app-compat', 'firebase-auth-compat', 'firebase-firestore-compat', '/__/firebase/init.js', '/admin/admin.js'];
    const posiciones = orden.map((s) => html.indexOf(s));
    expect(posiciones.every((p) => p > 0)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  });

  it('nunca pinta lo que escriben los vecinos como HTML', () => {
    expect(js).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
    expect(js).toMatch(/textContent/);
  });

  it('solo deja entrar con el claim admin, pidiendo un token recién emitido', () => {
    expect(js).toMatch(/getIdTokenResult\(true\)/);
    expect(js).toMatch(/claims\.admin/);
  });

  it('las fotos solo se cargan por https', () => {
    expect(js).toMatch(/\^https:\\\/\\\//);
  });

  it('regenerar la web no borra la administración', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-'));
    fs.mkdirSync(path.join(dir, 'admin'));
    fs.writeFileSync(path.join(dir, 'admin', 'index.html'), '<p>admin</p>');

    construir(dir);

    expect(fs.existsSync(path.join(dir, 'admin', 'index.html'))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
