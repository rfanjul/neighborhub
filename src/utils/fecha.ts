/** "Sep 2026": mes y año, que es todo lo que hace falta para fechas de perfil y reseñas. */
export function mesYAno(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
