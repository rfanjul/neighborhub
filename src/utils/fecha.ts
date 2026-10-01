import { localeActual } from '../i18n';

/** "Sep 2026" / "Sept. 2026" / "sept 2026": mes y año en el idioma de la app. */
export function mesYAno(ms: number): string {
  return new Date(ms).toLocaleDateString(localeActual(), { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
