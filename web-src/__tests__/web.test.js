/**
 * La web en tres idiomas: los textos cuadran entre sí y las páginas
 * generadas llevan todo lo necesario (idioma, alternativas, enlaces).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { construir, textos, idiomas } = require('../../scripts/build-web');

/** Forma del objeto: claves, longitudes de listas y huecos {x} de cada texto. */
function forma(valor) {
  if (typeof valor === 'string') return (valor.match(/\{\w+\}/g) || []).sort().join(',');
  if (Array.isArray(valor)) return valor.map(forma);
  return Object.fromEntries(
    Object.entries(valor)
      .filter(([k]) => !['lang', 'nombreIdioma'].includes(k))
      .map(([k, v]) => [k, forma(v)])
  );
}

describe('textos de la web', () => {
  it.each(['de', 'es'])('%s tiene las mismas claves, listas y huecos que el inglés', (idioma) => {
    expect(forma(textos[idioma])).toEqual(forma(textos.en));
  });

  it('ningún texto está vacío', () => {
    const vacios = [];
    const recorrer = (v, ruta) => {
      if (typeof v === 'string') {
        if (!v.trim()) vacios.push(ruta);
      } else Object.entries(v).forEach(([k, x]) => recorrer(x, `${ruta}.${k}`));
    };
    idiomas.forEach((i) => recorrer(textos[i], i));
    expect(vacios).toEqual([]);
  });
});

describe('páginas generadas', () => {
  let dir;
  const leer = (ruta) => fs.readFileSync(path.join(dir, ruta), 'utf8');

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-'));
    expect(construir(dir)).toBe(14);
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it.each(idiomas)('en %s están las cuatro páginas, en su idioma y con alternativas', (i) => {
    for (const pagina of ['index', 'privacy', 'terms', 'support']) {
      const html = leer(`${i}/${pagina}.html`);
      expect(html).toContain(`<html lang="${i}">`);
      idiomas.forEach((otro) => expect(html).toContain(`hreflang="${otro}"`));
      expect(html).toContain('class="selector-idioma"');
      expect(html).not.toMatch(/\{(contacto|privacidad|borrar|reportar)\}/);
    }
  });

  it.each(idiomas)('el formulario de %s lleva sus textos y su idioma', (i) => {
    const html = leer(`${i}/support.html`);
    expect(html).toContain(`data-idioma="${i}"`);
    expect(html).toContain(`data-ok="${textos[i].contacto.ok}"`);
    expect(html).toContain('/contacto.js');
    expect(html).toContain(`href="/${i}/privacy"`);
  });

  it('las legales enlazan al contacto de su idioma', () => {
    expect(leer('de/privacy.html')).toContain('href="/de/support#contacto"');
    expect(leer('es/terms.html')).toContain('href="/es/support?tipo=reportar#contacto"');
    expect(leer('en/privacy.html')).toContain('href="/en/support?tipo=borrar-cuenta#contacto"');
  });

  it('la raíz manda a cada cual a su idioma y la 404 habla los tres', () => {
    expect(leer('index.html')).toContain("location.replace('/'");
    const noEncontrada = leer('404.html');
    idiomas.forEach((i) => expect(noEncontrada).toContain(textos[i].noEncontrada.h1));
  });
});
