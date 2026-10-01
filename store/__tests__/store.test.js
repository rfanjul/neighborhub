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

/** Ancho y alto de un JPEG, leídos de su cabecera SOF (sin dependencias). */
function medidasJpeg(archivo) {
  const b = fs.readFileSync(archivo);
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error(`${archivo} no es un JPEG`);
  for (let i = 2; i < b.length; ) {
    const marca = b[i + 1];
    const largo = b.readUInt16BE(i + 2);
    if (marca >= 0xc0 && marca <= 0xc3) return { alto: b.readUInt16BE(i + 5), ancho: b.readUInt16BE(i + 7) };
    i += 2 + largo;
  }
  throw new Error(`${archivo} sin cabecera SOF`);
}

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

  it.each(locales)('%s tiene capturas de iPhone 6,5" (1284 x 2778) en su idioma', (locale, i) => {
    const capturas = i.screenshots.APP_IPHONE_65;
    // Apple pide entre 1 y 10; con menos de 3 la ficha se queda corta.
    expect(capturas.length).toBeGreaterThanOrEqual(3);
    expect(capturas.length).toBeLessThanOrEqual(10);
    for (const captura of capturas) {
      expect(captura).toMatch(new RegExp(`^\\./store/screenshots/${locale.slice(0, 2)}/`));
      expect(medidasJpeg(path.join(raiz, captura))).toEqual({ ancho: 1284, alto: 2778 });
    }
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
