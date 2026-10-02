/**
 * Notificaciones push de Neighborhub con el servicio de Expo
 * (https://exp.host/--/api/v2/push/send). La app guarda sus tokens y su
 * idioma en dispositivos/{uid}, un documento privado (los perfiles los lee
 * cualquiera, y con un token se le pueden mandar avisos a alguien); aquí se
 * escribe cada aviso en ese idioma y se manda a todos sus dispositivos.
 *
 * Qué avisa (decide), dado un cambio:
 *  - oferta nueva            → quien pide
 *  - mensaje nuevo           → la otra persona del chat
 *  - servicio aprobado       → quien pide
 *  - te han elegido          → quien ayuda (con el pago asegurado si lo hay)
 *  - pago confirmado         → quien pide
 *  - marcado como hecho      → quien pide (para que valore)
 *  - te han valorado         → quien ayuda
 *  - pago transferido        → quien ayuda (cobrado) y quien pide
 *  - hay que volver a pagar  → quien pide (administración pidió un pago nuevo)
 *  - cobros activados        → quien ayuda
 */

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';
const LOCALES = { en: 'en-US', de: 'de-CH', es: 'es-ES' };

const TEXTOS = {
  en: {
    oferta: ['New offer 🙋', '{nombre} offered to help with “{titulo}”.'],
    mensaje: ['{nombre}', '{texto}'],
    aprobado: ['Your request is live ✅', '“{titulo}” is now visible to your neighbors.'],
    elegido: ['You’ve been chosen! 🎉', '{nombre} picked you for “{titulo}”.'],
    elegidoPago: ['You’ve been chosen! 🎉', '{nombre} picked you for “{titulo}”. {precio} is secured for you.'],
    pagoConfirmado: ['Payment confirmed 💳', 'You paid {total}. {nombre} gets it when you mark “{titulo}” as done.'],
    hecho: ['Marked as done', '{nombre} marked “{titulo}” as done. Rate their help.'],
    valorado: ['New review ⭐️', '{nombre} rated your help with “{titulo}”: {estrellas}/5.'],
    cobrado: ['You’ve been paid 💰', '{precio} for “{titulo}” is on its way to your bank account.'],
    pagoTransferido: ['Payment released', '{precio} was paid to {nombre} for “{titulo}”.'],
    pagoPendiente: ['Payment needed 💳', 'Your payment for “{titulo}” was refunded, so {nombre} hasn’t been paid yet. Tap to pay {total}.'],
    cobrosActivos: ['Payouts set up ✅', 'You can now help with paid requests and get paid.'],
  },
  de: {
    oferta: ['Neues Angebot 🙋', '{nombre} möchte bei „{titulo}“ helfen.'],
    mensaje: ['{nombre}', '{texto}'],
    aprobado: ['Deine Anfrage ist online ✅', '„{titulo}“ ist jetzt für deine Nachbarn sichtbar.'],
    elegido: ['Du wurdest ausgewählt! 🎉', '{nombre} hat dich für „{titulo}“ ausgewählt.'],
    elegidoPago: ['Du wurdest ausgewählt! 🎉', '{nombre} hat dich für „{titulo}“ ausgewählt. {precio} sind dir sicher.'],
    pagoConfirmado: ['Zahlung bestätigt 💳', 'Du hast {total} bezahlt. {nombre} erhält es, sobald du „{titulo}“ als erledigt markierst.'],
    hecho: ['Als erledigt markiert', '{nombre} hat „{titulo}“ als erledigt markiert. Bewerte die Hilfe.'],
    valorado: ['Neue Bewertung ⭐️', '{nombre} hat deine Hilfe bei „{titulo}“ bewertet: {estrellas}/5.'],
    cobrado: ['Zahlung erhalten 💰', '{precio} für „{titulo}“ sind unterwegs auf dein Bankkonto.'],
    pagoTransferido: ['Zahlung freigegeben', '{precio} wurden für „{titulo}“ an {nombre} ausgezahlt.'],
    pagoPendiente: ['Zahlung offen 💳', 'Deine Zahlung für „{titulo}“ wurde erstattet, daher hat {nombre} noch nichts erhalten. Tippe, um {total} zu bezahlen.'],
    cobrosActivos: ['Auszahlungen eingerichtet ✅', 'Du kannst jetzt bei bezahlten Anfragen helfen und Geld erhalten.'],
  },
  es: {
    oferta: ['Nueva oferta 🙋', '{nombre} se ofrece a ayudarte con «{titulo}».'],
    mensaje: ['{nombre}', '{texto}'],
    aprobado: ['Tu servicio ya está publicado ✅', '«{titulo}» ya lo ven tus vecinos.'],
    elegido: ['¡Te han elegido! 🎉', '{nombre} te ha elegido para «{titulo}».'],
    elegidoPago: ['¡Te han elegido! 🎉', '{nombre} te ha elegido para «{titulo}». Tienes {precio} asegurados.'],
    pagoConfirmado: ['Pago confirmado 💳', 'Has pagado {total}. {nombre} lo recibe cuando marques «{titulo}» como hecho.'],
    hecho: ['Marcado como hecho', '{nombre} ha marcado «{titulo}» como hecho. Valora su ayuda.'],
    valorado: ['Nueva valoración ⭐️', '{nombre} ha valorado tu ayuda con «{titulo}»: {estrellas}/5.'],
    cobrado: ['Has cobrado 💰', '{precio} por «{titulo}» van de camino a tu cuenta.'],
    pagoTransferido: ['Pago liberado', 'Se han pagado {precio} a {nombre} por «{titulo}».'],
    pagoPendiente: ['Falta tu pago 💳', 'Tu pago de «{titulo}» se devolvió y {nombre} aún no ha cobrado. Toca para pagar {total}.'],
    cobrosActivos: ['Cobros activados ✅', 'Ya puedes ayudar en servicios con precio y cobrar por ello.'],
  },
};

const MONEDA = Object.fromEntries(
  Object.entries(LOCALES).map(([idioma, locale]) => [
    idioma,
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'CHF', minimumFractionDigits: 2 }),
  ])
);

/** Título y texto de un aviso en un idioma (inglés si no hay otro). Importes en céntimos. */
function escribir(tipo, idioma, datos = {}) {
  const lengua = TEXTOS[idioma] ? idioma : 'en';
  const moneda = MONEDA[lengua];
  const valores = { ...datos };
  for (const k of ['precio', 'total']) if (typeof valores[k] === 'number') valores[k] = moneda.format(valores[k] / 100);
  const rellenar = (s) => s.replace(/\{(\w+)\}/g, (_, k) => (valores[k] == null ? '' : String(valores[k])));
  const [titulo, cuerpo] = TEXTOS[lengua][tipo];
  return { title: rellenar(titulo), body: rellenar(cuerpo) };
}

const recortar = (texto, max = 140) => (texto.length > max ? `${texto.slice(0, max - 1)}…` : texto);

function crearAvisos({ db, fetch, quitarToken }) {
  /** Manda un aviso a todos los dispositivos de uid. Nunca lanza: un aviso no rompe nada. */
  async function avisar(uid, tipo, datos, destino) {
    if (!uid) return 0;
    try {
      const dispositivos = (await db.doc(`dispositivos/${uid}`).get()).data();
      const tokens = (dispositivos?.tokens ?? []).filter((t) => typeof t === 'string');
      if (!tokens.length) return 0;
      const { title, body } = escribir(tipo, dispositivos.idioma, datos);
      const mensajes = tokens.map((to) => ({ to, title, body: recortar(body), sound: 'default', data: destino }));
      const respuesta = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(mensajes),
      });
      const { data: tickets = [] } = await respuesta.json();
      // Dispositivos que ya no existen (app borrada): fuera de la lista.
      const caducados = tokens.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered');
      if (caducados.length) await quitarToken(uid, caducados);
      return tokens.length - caducados.length;
    } catch {
      return 0;
    }
  }

  async function nuevaOferta(oferta) {
    return avisar(oferta.requesterId, 'oferta', { nombre: oferta.applicantName, titulo: oferta.serviceTitle }, {
      pantalla: 'ServiceOffers',
      serviceId: oferta.serviceId,
    });
  }

  async function nuevoMensaje(serviceId, mensaje) {
    const servicio = (await db.doc(`helpRequests/${serviceId}`).get()).data();
    if (!servicio) return 0;
    const para = mensaje.senderId === servicio.requesterId ? servicio.helperId : servicio.requesterId;
    if (!para || para === mensaje.senderId) return 0;
    return avisar(para, 'mensaje', { nombre: mensaje.senderName || 'Neighborhub', texto: mensaje.text || '' }, { pantalla: 'Chat', serviceId });
  }

  /** Avisos por cambios de un servicio: estado y pago. */
  async function cambioServicio(serviceId, antes, despues) {
    if (!antes || !despues) return [];
    const titulo = despues.title || '';
    const enviados = [];
    const a = (uid, tipo, datos, pantalla) => enviados.push(avisar(uid, tipo, { titulo, ...datos }, { pantalla, serviceId }));
    const de = antes.status;
    const a_ = despues.status;

    if (de === 'pending' && a_ === 'approved') a(despues.requesterId, 'aprobado', {}, 'ServiceOffers');
    if (de === 'approved' && a_ === 'accepted') {
      const pago = despues.pago;
      a(despues.helperId, pago ? 'elegidoPago' : 'elegido', { nombre: despues.requesterName, precio: pago?.precio }, 'ServiceDetail');
      if (pago) a(despues.requesterId, 'pagoConfirmado', { nombre: despues.helperName, total: pago.total }, 'ServiceOffers');
    }
    if (['accepted', 'in_progress'].includes(de) && a_ === 'completed') {
      a(despues.requesterId, 'hecho', { nombre: despues.helperName }, 'ServiceOffers');
    }
    if (de !== 'rated' && a_ === 'rated') {
      const resena = (await db.doc(`reviews/${serviceId}`).get()).data();
      a(despues.helperId, 'valorado', { nombre: despues.requesterName, estrellas: resena?.rating ?? '' }, 'ServiceDetail');
    }
    if (!antes.pago?.porPagar && despues.pago?.porPagar) {
      a(despues.requesterId, 'pagoPendiente', { total: despues.pago.total, nombre: despues.helperName }, 'Payments');
    }
    if (antes.pago?.estado !== 'pagado' && despues.pago?.estado === 'pagado') {
      a(despues.helperId, 'cobrado', { precio: despues.pago.precio }, 'Payments');
      a(despues.requesterId, 'pagoTransferido', { precio: despues.pago.precio, nombre: despues.helperName }, 'Payments');
    }
    return Promise.all(enviados);
  }

  async function cambioPerfil(uid, antes, despues) {
    if (!antes?.cobrosActivos && despues?.cobrosActivos) return avisar(uid, 'cobrosActivos', {}, { pantalla: 'Payments' });
    return 0;
  }

  return { avisar, nuevaOferta, nuevoMensaje, cambioServicio, cambioPerfil };
}

module.exports = { crearAvisos, escribir, TEXTOS };
