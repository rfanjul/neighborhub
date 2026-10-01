/**
 * Cloud Functions de Neighborhub (Zúrich, europe-west6; el disparador de
 * Firestore en europe-west1, dentro de eur3 como la base de datos): los pagos con
 * Stripe Connect. La lógica está en pagos.js; aquí solo se conecta con
 * Firebase. La clave secreta y la del webhook son secretos de Firebase
 * (en local, functions/.secret.local, fuera de git).
 */
const { setGlobalOptions } = require('firebase-functions/v2');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const StripeModulo = require('stripe');
const { crearPagos, ErrorPago } = require('./pagos');

const Stripe = StripeModulo.default || StripeModulo;
setGlobalOptions({ region: 'europe-west6', maxInstances: 5 });
initializeApp();

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const WEB = 'https://neighborhood-c4dc9.web.app';

let stripe;
function pagos() {
  stripe = stripe || new Stripe(STRIPE_SECRET_KEY.value());
  return crearPagos({ stripe, db: getFirestore(), ahora: () => FieldValue.serverTimestamp(), web: WEB });
}

/** Funciones que llama la app: con sesión, y con errores que la app entiende. */
function llamable(accion) {
  return onCall({ secrets: [STRIPE_SECRET_KEY] }, async (peticion) => {
    if (!peticion.auth) throw new HttpsError('unauthenticated', 'Hay que entrar en la app.');
    try {
      return await accion(pagos(), peticion.auth, peticion.data || {});
    } catch (e) {
      if (e instanceof ErrorPago) throw new HttpsError(e.codigo, e.message, { motivo: e.motivo });
      // Lo justo para depurar: sin las cabeceras ni el cuerpo de Stripe.
      logger.error('Stripe', { tipo: e.type, codigo: e.code, mensaje: e.message, peticion: e.requestId });
      throw new HttpsError('internal', 'No se pudo hablar con Stripe.', { motivo: 'generico' });
    }
  });
}

exports.activarCobros = llamable((p, auth) => p.activarCobros(auth.uid, auth.token.email));
exports.estadoCobros = llamable((p, auth) => p.estadoCobros(auth.uid));
exports.pagarOferta = llamable((p, auth, datos) => p.pagarOferta(auth.uid, auth.token.email, datos));

/**
 * Comprueba la firma con cualquiera de los secretos (separados por comas):
 * Stripe firma con uno el endpoint de pagos y con otro el de Connect.
 */
function verificar(cuerpo, firma) {
  const secretos = STRIPE_WEBHOOK_SECRET.value().split(',').map((x) => x.trim()).filter(Boolean);
  for (const secreto of secretos) {
    try {
      return stripe.webhooks.constructEvent(cuerpo, firma, secreto);
    } catch {
      // Se prueba con el siguiente.
    }
  }
  throw new Error('Firma no válida');
}

/** Avisos de Stripe: solo se aceptan si vienen firmados con un secreto del webhook. */
exports.stripeWebhook = onRequest({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  let evento;
  try {
    const p = pagos();
    evento = verificar(req.rawBody, req.headers['stripe-signature']);
    let resultado = 'ignorado';
    if (evento.type === 'checkout.session.completed') resultado = await p.alCompletarCheckout(evento.data.object);
    if (evento.type === 'account.updated') resultado = await p.alActualizarCuenta(evento.data.object);
    logger.info(`${evento.type}: ${resultado}`, { id: evento.id });
    res.json({ recibido: true, resultado });
  } catch (e) {
    if (!evento) {
      res.status(400).send('Firma no válida');
      return;
    }
    // Un 500 hace que Stripe reintente más tarde.
    logger.error(`${evento.type} falló`, { tipo: e.type, codigo: e.code, mensaje: e.message, peticion: e.requestId });
    res.status(500).send('Error procesando el aviso');
  }
});

/** Dado por hecho: el precio va a quien ayudó. */
exports.liberarPago = onDocumentUpdated(
  { document: 'helpRequests/{serviceId}', region: 'europe-west1', secrets: [STRIPE_SECRET_KEY] },
  async (evento) => {
    const resultado = await pagos().liberarPago(evento.params.serviceId, evento.data?.before.data(), evento.data?.after.data());
    if (resultado !== 'nada') logger.info(`liberarPago ${evento.params.serviceId}: ${resultado}`);
  }
);
