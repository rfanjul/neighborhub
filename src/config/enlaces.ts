import { Linking } from 'react-native';
import { idiomaActual } from '../i18n';

/** La web pública (Firebase Hosting), con una versión por idioma. */
export const WEB = 'https://neighborhood-c4dc9.web.app';

type TipoContacto = 'pregunta' | 'problema' | 'reportar' | 'borrar-cuenta' | 'otro';

/** Páginas de la web en el idioma actual de la app. */
export const enlaces = {
  privacidad: () => `${WEB}/${idiomaActual()}/privacy`,
  terminos: () => `${WEB}/${idiomaActual()}/terms`,
  soporte: () => `${WEB}/${idiomaActual()}/support`,
  /** Formulario de contacto ya rellenado: tipo de consulta y a qué se refiere. */
  contacto: (tipo: TipoContacto, referencia?: string) =>
    `${WEB}/${idiomaActual()}/support?origen=app&tipo=${tipo}` +
    `${referencia ? `&ref=${encodeURIComponent(referencia)}` : ''}#contacto`,
};

/** Abre la página en el navegador; si no se puede, no pasa nada. */
export function abrirEnlace(url: string) {
  Linking.openURL(url).catch(() => {});
}
