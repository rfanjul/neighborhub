import { useSyncExternalStore } from 'react';
import { NativeModules, Settings } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en, { type Diccionario } from './en';
import de from './de';
import es from './es';

/**
 * Traducciones de la app (inglés, alemán y español) sin librerías ni módulos
 * nativos. El idioma sale del iPhone la primera vez y, si la persona elige
 * otro, se recuerda en el dispositivo.
 *
 *   t('muro.titulo')                       → "Need help nearby?"
 *   t('muro.hola', { nombre: 'Ana' })      → "Hi, Ana 👋"
 *   tp('comun.ayudas', 3)                  → "3 helps"
 */
export type Idioma = 'en' | 'de' | 'es';

export const idiomas: { codigo: Idioma; nombre: string }[] = [
  { codigo: 'en', nombre: 'English' },
  { codigo: 'de', nombre: 'Deutsch' },
  { codigo: 'es', nombre: 'Español' },
];

const diccionarios: Record<Idioma, Diccionario> = { en, de, es };
const CLAVE_GUARDADA = 'neighborhub.idioma';

/** Todas las rutas "a.b.c" del diccionario, para que TypeScript avise de erratas. */
type Rutas<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Rutas<T[K], `${P}${K}.`>;
}[keyof T & string];
export type Clave = Rutas<Diccionario>;
/** Claves con singular y plural ({ one, other }), para tp(). */
type Base<C> = C extends `${infer B}.other` ? B : never;
export type ClavePlural = Base<Clave>;

type Params = Record<string, string | number>;

function esIdioma(valor: unknown): valor is Idioma {
  return valor === 'en' || valor === 'de' || valor === 'es';
}

/** Idioma preferido del iPhone ("de-CH", "es_ES"…), por la vía que esté disponible. */
function preferidoDelSistema(): string {
  try {
    // Settings lee las preferencias del sistema también con la nueva arquitectura.
    const lista = Settings.get('AppleLanguages');
    if (Array.isArray(lista) && lista[0]) return String(lista[0]);
  } catch {
    // Sin el módulo nativo (tests, otras plataformas): se prueba lo siguiente.
  }
  const ajustes = NativeModules.SettingsManager?.settings;
  if (ajustes) return ajustes.AppleLanguages?.[0] ?? ajustes.AppleLocale ?? '';
  return Intl.DateTimeFormat().resolvedOptions().locale ?? '';
}

/** El idioma del iPhone si es uno de los nuestros; si no, inglés. */
export function idiomaDelDispositivo(): Idioma {
  const codigo = preferidoDelSistema().slice(0, 2).toLowerCase();
  return esIdioma(codigo) ? codigo : 'en';
}

let actual: Idioma = idiomaDelDispositivo();
const oyentes = new Set<() => void>();

export function idiomaActual(): Idioma {
  return actual;
}

/** Cambia el idioma de toda la app y lo recuerda para la próxima vez. */
export function cambiarIdioma(idioma: Idioma, { guardar = true } = {}) {
  if (idioma === actual) return;
  actual = idioma;
  oyentes.forEach((avisar) => avisar());
  if (guardar) AsyncStorage.setItem(CLAVE_GUARDADA, idioma).catch(() => {});
}

/** Al arrancar: si la persona eligió un idioma, se usa ese. */
export async function cargarIdiomaGuardado() {
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_GUARDADA);
    if (esIdioma(guardado)) cambiarIdioma(guardado, { guardar: false });
  } catch {
    // Sin almacenamiento, se queda el del iPhone.
  }
}

function buscar(dic: unknown, clave: string): string | undefined {
  const valor = clave.split('.').reduce<unknown>((nodo, parte) => (nodo as Record<string, unknown>)?.[parte], dic);
  return typeof valor === 'string' ? valor : undefined;
}

function rellenar(texto: string, params?: Params) {
  if (!params) return texto;
  return texto.replace(/\{(\w+)\}/g, (entero, nombre) => (nombre in params ? String(params[nombre]) : entero));
}

/** Texto en el idioma actual; si faltara, en inglés; y si tampoco, la clave. */
export function t(clave: Clave, params?: Params): string {
  const texto = buscar(diccionarios[actual], clave) ?? buscar(en, clave) ?? clave;
  return rellenar(texto, params);
}

/** Singular o plural según `cuenta` ({count} queda disponible en el texto). */
export function tp(clave: ClavePlural, cuenta: number, params?: Params): string {
  return t(`${clave}.${cuenta === 1 ? 'one' : 'other'}` as Clave, { count: cuenta, ...params });
}

/** Locale para fechas y números: "en-US", "de-CH", "es-ES". */
export function localeActual(): string {
  return { en: 'en-US', de: 'de-CH', es: 'es-ES' }[actual];
}

/** Idioma actual que re-renderiza el componente cuando cambia. */
export function useIdioma(): Idioma {
  return useSyncExternalStore(
    (avisar) => {
      oyentes.add(avisar);
      return () => oyentes.delete(avisar);
    },
    () => actual
  );
}

/** Nombre del nivel en el idioma actual; si no lo conocemos, el guardado. */
export function nivelTexto(nivel: number, guardado?: string | null): string {
  return buscar(diccionarios[actual], `niveles.${nivel}`) ?? guardado ?? '';
}

/** "German, English" (como se guarda) → "Deutsch, Englisch" en el idioma actual. */
export function idiomasTexto(lista: string | null | undefined): string {
  if (!lista) return '';
  return lista
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean)
    .map((i) => buscar(diccionarios[actual], `idiomasHablados.${i}`) ?? i)
    .join(', ');
}
