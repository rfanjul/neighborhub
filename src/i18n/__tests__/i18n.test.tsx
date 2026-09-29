import React from 'react';
import { NativeModules, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  cambiarIdioma,
  cargarIdiomaGuardado,
  idiomaActual,
  idiomaDelDispositivo,
  idiomasTexto,
  localeActual,
  nivelTexto,
  t,
  tp,
  useIdioma,
  type Clave,
} from '..';
import en from '../en';
import de from '../de';
import es from '../es';
import SelectorIdioma from '../../components/SelectorIdioma';

// Settings de iOS necesita su módulo nativo: en test se sustituye.
const mockAjustes = jest.fn();
jest.mock('react-native/Libraries/Settings/Settings', () => ({
  __esModule: true,
  default: { get: (clave: string) => mockAjustes(clave) },
}));

afterEach(() => cambiarIdioma('en', { guardar: false }));

/** Todas las hojas del diccionario como [ruta, texto]. */
function hojas(dic: object, prefijo = ''): [string, string][] {
  return Object.entries(dic).flatMap(([k, v]) =>
    typeof v === 'string' ? [[`${prefijo}${k}`, v] as [string, string]] : hojas(v, `${prefijo}${k}.`)
  );
}
const huecos = (texto: string) => (texto.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('diccionarios', () => {
  const base = hojas(en);

  it.each([
    ['alemán', de],
    ['español', es],
  ])('el %s tiene todas las claves, sin textos vacíos y con los mismos huecos', (_nombre, dic) => {
    const suyas = new Map(hojas(dic));
    expect([...suyas.keys()].sort()).toEqual(base.map(([k]) => k).sort());
    for (const [clave, texto] of base) {
      const traduccion = suyas.get(clave)!;
      expect(traduccion.trim()).not.toBe('');
      expect({ clave, huecos: huecos(traduccion) }).toEqual({ clave, huecos: huecos(texto) });
    }
  });
});

describe('t y tp', () => {
  it('traduce al idioma actual y rellena los huecos', () => {
    expect(t('muro.hola', { nombre: 'Ana' })).toBe('Hi, Ana 👋');
    cambiarIdioma('de', { guardar: false });
    expect(t('muro.hola', { nombre: 'Ana' })).toBe('Hallo, Ana 👋');
    cambiarIdioma('es', { guardar: false });
    expect(t('muro.hola', { nombre: 'Ana' })).toBe('Hola, Ana 👋');
  });

  it('un hueco sin valor se deja tal cual', () => {
    expect(t('muro.hola')).toBe('Hi, {nombre} 👋');
  });

  it('una clave que no existe devuelve la propia clave', () => {
    expect(t('no.existe' as Clave)).toBe('no.existe');
  });

  it('elige singular o plural', () => {
    expect(tp('comun.ayudas', 1)).toBe('1 help');
    expect(tp('comun.ayudas', 3)).toBe('3 helps');
    cambiarIdioma('de', { guardar: false });
    expect(tp('comun.ayudas', 0)).toBe('0 Hilfen');
  });

  it('el locale de fechas acompaña al idioma', () => {
    expect(localeActual()).toBe('en-US');
    cambiarIdioma('de', { guardar: false });
    expect(localeActual()).toBe('de-CH');
  });
});

describe('datos del perfil', () => {
  it('el nivel sale por número, o el guardado si no lo conocemos', () => {
    cambiarIdioma('de', { guardar: false });
    expect(nivelTexto(2, 'Helpful neighbor')).toBe('Hilfsbereit');
    expect(nivelTexto(9, 'Leyenda')).toBe('Leyenda');
    expect(nivelTexto(9)).toBe('');
  });

  it('los idiomas hablados se traducen uno a uno', () => {
    cambiarIdioma('es', { guardar: false });
    expect(idiomasTexto('German, English, Klingon')).toBe('Alemán, Inglés, Klingon');
    expect(idiomasTexto(null)).toBe('');
  });
});

describe('idioma del dispositivo y el guardado', () => {
  const ajustes = NativeModules.SettingsManager;
  afterEach(() => {
    NativeModules.SettingsManager = ajustes;
  });

  it('lo toma de los ajustes del sistema', () => {
    mockAjustes.mockReturnValueOnce(['de-CH', 'en']);
    expect(idiomaDelDispositivo()).toBe('de');
    expect(mockAjustes).toHaveBeenCalledWith('AppleLanguages');
  });

  describe('sin Settings', () => {
    beforeEach(() => {
      mockAjustes.mockImplementation(() => {
        throw new Error('sin módulo');
      });
    });
    afterEach(() => mockAjustes.mockReset());

    it.each([
      [{ AppleLanguages: ['de-CH', 'en'] }, 'de'],
      [{ AppleLocale: 'es_ES' }, 'es'],
      [{ AppleLanguages: ['fr-CH'] }, 'en'],
      [{}, 'en'],
    ])('con SettingsManager %p usa %s', (settings, esperado) => {
      NativeModules.SettingsManager = { settings };
      expect(idiomaDelDispositivo()).toBe(esperado);
    });

    it.each([
      ['es-ES', 'es'],
      ['fr-FR', 'en'],
    ])('y sin SettingsManager, el locale de Intl (%s → %s)', (locale, esperado) => {
      NativeModules.SettingsManager = undefined;
      const intl = jest
        .spyOn(Intl, 'DateTimeFormat')
        .mockReturnValue({ resolvedOptions: () => ({ locale }) } as unknown as Intl.DateTimeFormat);
      expect(idiomaDelDispositivo()).toBe(esperado);
      intl.mockRestore();
    });
  });

  it('cambiar de idioma lo recuerda y al arrancar se recupera', async () => {
    cambiarIdioma('de');
    await act(async () => {});
    expect(await AsyncStorage.getItem('neighborhub.idioma')).toBe('de');

    cambiarIdioma('en', { guardar: false });
    await cargarIdiomaGuardado();
    expect(idiomaActual()).toBe('de');
  });

  it('un valor guardado raro o un fallo del almacenamiento no cambian nada', async () => {
    await AsyncStorage.setItem('neighborhub.idioma', 'xx');
    await cargarIdiomaGuardado();
    expect(idiomaActual()).toBe('en');

    const lectura = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('sin disco'));
    await cargarIdiomaGuardado();
    expect(idiomaActual()).toBe('en');
    lectura.mockRestore();
  });
});

describe('SelectorIdioma y useIdioma', () => {
  function Saludo() {
    useIdioma();
    return <Text>{t('muro.titulo')}</Text>;
  }

  it('cambiar de idioma repinta lo que lo usa', async () => {
    await render(
      <>
        <SelectorIdioma />
        <Saludo />
      </>
    );
    expect(screen.getByText('Need help nearby?')).toBeTruthy();
    expect(screen.getByLabelText('English').props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByLabelText('Deutsch'));

    expect(screen.getByText('Brauchst du Hilfe in der Nähe?')).toBeTruthy();
    expect(screen.getByLabelText('Deutsch').props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByLabelText('Español'));
    expect(screen.getByText('¿Necesitas ayuda cerca?')).toBeTruthy();
  });

  it('también sobre una foto', async () => {
    await render(<SelectorIdioma sobreFoto />);
    expect(screen.getByLabelText('English')).toBeTruthy();
  });
});
