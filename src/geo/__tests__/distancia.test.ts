import { distanciaKm, formatearDistancia } from '../distancia';

const zurichHb = { latitude: 47.3779, longitude: 8.5403 };
const zurichBellevue = { latitude: 47.3667, longitude: 8.5449 };
const berna = { latitude: 46.949, longitude: 7.4474 };

describe('distanciaKm', () => {
  it('es cero entre un punto y él mismo', () => {
    expect(distanciaKm(zurichHb, zurichHb)).toBe(0);
  });

  it('mide bien distancias cortas dentro de una ciudad', () => {
    expect(distanciaKm(zurichHb, zurichBellevue)).toBeCloseTo(1.29, 1);
  });

  it('mide bien distancias entre ciudades', () => {
    expect(distanciaKm(zurichHb, berna)).toBeCloseTo(95.5, 0);
  });

  it('es simétrica', () => {
    expect(distanciaKm(berna, zurichHb)).toBeCloseTo(distanciaKm(zurichHb, berna), 10);
  });
});

describe('formatearDistancia', () => {
  it.each([
    [0, '10 m'],
    [0.347, '350 m'],
    [1.234, '1.2 km'],
    [9.96, '10.0 km'],
    [12.4, '12 km'],
  ])('%p km se lee "%s"', (km, texto) => {
    expect(formatearDistancia(km)).toBe(texto);
  });
});
