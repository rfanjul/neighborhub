/**
 * Los textos de App Store Connect caben en los límites de Apple, no repiten
 * en las palabras clave lo que ya dicen el nombre y el subtítulo, y enlazan
 * a páginas de la web que existen en su idioma.
 */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', '..');
const config = JSON.parse(fs.readFileSync(path.join(raiz, 'store.config.json'), 'utf8'));
const locales = Object.entries(config.apple.info);
const palabras = (texto) => texto.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);

describe('store.config.json', () => {
  it('la versión de la ficha es la de la app, la que llevará la build', () => {
    const app = JSON.parse(fs.readFileSync(path.join(raiz, 'app.json'), 'utf8'));
    expect(config.apple.version).toBe(app.expo.version);
  });

  it('la clasificación por edad es 16+, como piden los términos, y declara contenido de usuarios y chat', () => {
    const edad = config.apple.advisory;
    expect(edad.ageRatingOverrideV2).toBe('SIXTEEN_PLUS');
    expect(edad.userGeneratedContent).toBe(true);
    expect(edad.messagingAndChat).toBe(true);
    expect(edad.advertising).toBe(false);
  });

  it('tiene inglés, alemán y español', () => {
    expect(Object.keys(config.apple.info).sort()).toEqual(['de-DE', 'en-US', 'es-ES']);
  });

  it.each(locales)('%s cabe en los límites de Apple', (_locale, i) => {
    expect(i.title.length).toBeLessThanOrEqual(30);
    expect(i.subtitle.length).toBeLessThanOrEqual(30);
    expect(i.promoText.length).toBeLessThanOrEqual(170);
    expect(i.description.length).toBeLessThanOrEqual(4000);
    expect(i.keywords.join(',').length).toBeLessThanOrEqual(100);
  });

  it.each(locales)('%s no gasta palabras clave en lo que ya dicen nombre y subtítulo', (_locale, i) => {
    const yaIndexadas = new Set(palabras(`${i.title} ${i.subtitle}`));
    const repetidas = i.keywords.flatMap(palabras).filter((p) => yaIndexadas.has(p));
    expect(repetidas).toEqual([]);
    expect(new Set(i.keywords.map((k) => k.toLowerCase())).size).toBe(i.keywords.length);
  });

  it.each(locales)('%s enlaza a su web y no promete cosas que la app no tiene', (locale, i) => {
    const idioma = locale.slice(0, 2);
    for (const url of [i.marketingUrl, i.supportUrl, i.privacyPolicyUrl, i.privacyChoicesUrl]) {
      expect(url).toMatch(new RegExp(`^https://neighborhood-c4dc9\\.web\\.app/${idioma}(/|$)`));
    }
    expect(i.description).toContain(i.supportUrl);
    // Ni compras de créditos ni precios: la app no vende nada.
    expect(i.description).not.toMatch(/credit|guthaben|crédito|€|chf|\$/i);
  });

  it('las páginas enlazadas existen en la web generada', () => {
    const { construir } = require('../../scripts/build-web');
    const os = require('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-'));
    construir(dir);
    for (const [locale] of locales) {
      const idioma = locale.slice(0, 2);
      for (const pagina of ['index', 'support', 'privacy']) {
        expect(fs.existsSync(path.join(dir, idioma, `${pagina}.html`))).toBe(true);
      }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
