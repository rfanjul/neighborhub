/**
 * Fotos de las pantallas sin sesión (bienvenida, entrar, crear cuenta).
 * Son de Unsplash, con su licencia libre (uso comercial, sin atribución
 * obligatoria), y se sirven desde su CDN a la medida que se pide.
 */
const unsplash = (id: string, ancho = 1080) =>
  `https://images.unsplash.com/photo-${id}?w=${ancho}&q=80&auto=format&fit=crop`;

export const fotosBienvenida = {
  /** Una vecina se ríe entre cajas de mudanza: pedir ayuda. */
  pedir: unsplash('1786396798391-8c3f330cf3a8'),
  /** Un vecino pasea un perro: ofrecerse a ayudar. */
  ofrecer: unsplash('1648304887391-a6c2cf2228e4'),
  /** Dos vecinas charlan en la escalera de casa: elegir y quedar. */
  elegir: unsplash('1626388787104-2ca553fe510c'),
  /** Chocar esos cinco: valorar y ganar reputación. */
  valorar: unsplash('1770270402445-b72169c6e48a'),
  /** Dos vecinas delante de casa: volver a entrar. */
  entrar: unsplash('1783094267285-ed7163045294'),
  /** Vecinos charlando en el porche: crear cuenta. */
  registro: unsplash('1642006891272-9f8237d69079'),
};
