import { cambiarIdioma } from '../../i18n';
import { comision, formatearPrecio, leerPrecio, precioValido, totalAPagar } from '../precio';

// Intl separa la moneda con un espacio duro; aquí da igual cuál.
const plano = (texto: string) => texto.replace(/\s/g, ' ');

afterEach(() => cambiarIdioma('en', { guardar: false }));

describe('gestión', () => {
  it.each([
    [4000, 320, 4320],
    [10000, 800, 10800],
    [12550, 1004, 13554],
  ])('sobre %p céntimos es el 8 %%: %p, y se paga %p', (precio, gestion, total) => {
    expect(comision(precio)).toBe(gestion);
    expect(totalAPagar(precio)).toBe(total);
  });

  it('nunca baja de CHF 1, para que lo barato no salga a pérdida', () => {
    expect(comision(500)).toBe(100);
    expect(comision(1250)).toBe(100);
    expect(totalAPagar(1000)).toBe(1100);
  });
});

describe('precio válido', () => {
  it('gratis, o de CHF 5 a CHF 1000 en céntimos enteros', () => {
    expect(precioValido(null)).toBe(true);
    expect(precioValido(500)).toBe(true);
    expect(precioValido(100000)).toBe(true);
    expect(precioValido(499)).toBe(false);
    expect(precioValido(100001)).toBe(false);
    expect(precioValido(1250.5)).toBe(false);
  });
});

describe('formatearPrecio', () => {
  it('sin decimales si es redondo, con ellos si no o si se piden', () => {
    expect(plano(formatearPrecio(4000))).toBe('CHF 40');
    expect(plano(formatearPrecio(1250))).toBe('CHF 12.50');
    expect(plano(formatearPrecio(4000, { exacto: true }))).toBe('CHF 40.00');
  });

  it('con el formato de moneda de cada idioma', () => {
    cambiarIdioma('de', { guardar: false });
    expect(plano(formatearPrecio(1250))).toBe('CHF 12.50');
    cambiarIdioma('es', { guardar: false });
    expect(plano(formatearPrecio(1250))).toBe('12,50 CHF');
  });
});

describe('leerPrecio', () => {
  it.each([
    ['40', 4000],
    ['12.50', 1250],
    ['12,5', 1250],
    [' CHF 40 ', 4000],
    ['Fr. 25', 2500],
  ])('"%s" son %p céntimos', (texto, centimos) => {
    expect(leerPrecio(texto)).toBe(centimos);
  });

  it.each(['', 'abc', '12.345', '-5', '1e3'])('"%s" no es un importe', (texto) => {
    expect(leerPrecio(texto)).toBeNull();
  });
});
