/**
 * Pagos de Neighborhub con Stripe Connect, en cargos y transferencias
 * separados:
 *
 *  1. Quien ayuda activa los cobros: una cuenta conectada de Stripe
 *     (Accounts v2, configuración «recipient»: solo recibe transferencias) con
 *     el panel Express; Stripe le pide identidad e IBAN en su formulario. La
 *     plataforma responde de las pérdidas (aceptado en el perfil de
 *     plataforma de Stripe), que es lo que permite retener el dinero.
 *  2. Quien pide elige una oferta de un servicio con precio y paga en Stripe
 *     Checkout el precio más la gestión (8 %, mínimo CHF 1). El dinero queda
 *     en la cuenta de la plataforma: retenido.
 *  3. Al marcarlo como hecho, se transfiere el precio entero a quien ayudó;
 *     la gestión se queda en la plataforma (de ahí salen las comisiones de
 *     Stripe).
 *
 * Solo este servidor habla con Stripe y escribe pagos/ y cuentasCobro/; las
 * reglas de Firestore no dejan a la app ni leerlas.
 *
 * Todo recibe stripe y db de fuera para poder probarlo sin red.
 */

const COMISION = 0.08;
const COMISION_MINIMA = 100;
const terminado = (estado) => estado === 'completed' || estado === 'rated';

/** Lo mismo que src/pagos/precio.ts: 8 %, como poco CHF 1, en céntimos. */
const comision = (precio) => Math.max(COMISION_MINIMA, Math.round(precio * COMISION));

/**
 * Error con un código de HttpsError y un motivo corto que la app traduce
 * (el mensaje es para los logs).
 */
class ErrorPago extends Error {
  constructor(codigo, mensaje, motivo) {
    super(mensaje);
    this.codigo = codigo;
    this.motivo = motivo;
  }
}

/**
 * Una cuenta conectada puede cobrar cuando Stripe le deja recibir
 * transferencias. Vale para la cuenta de Accounts v2 y para el aviso
 * account.updated, que llega con la forma de v1.
 */
const cuentaActiva = (cuenta) =>
  cuenta?.object === 'account'
    ? cuenta.capabilities?.transfers === 'active'
    : cuenta?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === 'active';

function crearPagos({ stripe, db, ahora, web, proyecto }) {
  async function guardarEstadoCuenta(uid, activos) {
    await db.doc(`cuentasCobro/${uid}`).set({ cobrosActivos: activos, actualizado: ahora() }, { merge: true });
    // El perfil público solo dice si puede cobrar; el id de Stripe no sale de cuentasCobro.
    await db.doc(`users/${uid}`).update({ cobrosActivos: activos }).catch(() => {});
  }

  /** Crea (una vez) la cuenta Express y devuelve el enlace al formulario de Stripe. */
  async function activarCobros(uid, email) {
    const ref = db.doc(`cuentasCobro/${uid}`);
    let cuenta = (await ref.get()).data();
    if (!cuenta?.stripeAccountId) {
      const creada = await stripe.v2.core.accounts.create(
        {
          contact_email: email || undefined,
          dashboard: 'express',
          identity: { country: 'CH', entity_type: 'individual' },
          defaults: {
            currency: 'chf',
            responsibilities: { fees_collector: 'application', losses_collector: 'application' },
          },
          configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
          metadata: { uid },
        },
        // Si se reintenta tras un fallo, Stripe devuelve la misma cuenta.
        { idempotencyKey: `cuenta-${uid}` }
      );
      cuenta = { stripeAccountId: creada.id, cobrosActivos: false };
      await ref.set({ ...cuenta, creado: ahora(), actualizado: ahora() });
    }
    const enlace = await stripe.v2.core.accountLinks.create({
      account: cuenta.stripeAccountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          refresh_url: `${web}/cobros?estado=reintentar`,
          return_url: `${web}/cobros?estado=listo`,
        },
      },
    });
    return { url: enlace.url };
  }

  /** Pregunta a Stripe cómo va la cuenta y lo apunta en el perfil. */
  async function estadoCobros(uid) {
    const cuenta = (await db.doc(`cuentasCobro/${uid}`).get()).data();
    if (!cuenta?.stripeAccountId) return { conCuenta: false, activos: false, pendiente: false };
    const stripeCuenta = await stripe.v2.core.accounts.retrieve(cuenta.stripeAccountId, {
      include: ['configuration.recipient', 'requirements'],
    });
    const activos = cuentaActiva(stripeCuenta);
    await guardarEstadoCuenta(uid, activos);
    return { conCuenta: true, activos, pendiente: !activos };
  }

  /** Abre el pago de la oferta elegida en Stripe Checkout. */
  async function pagarOferta(uid, email, { serviceId, applicantId } = {}) {
    if (!serviceId || !applicantId) throw new ErrorPago('invalid-argument', 'Falta el servicio o la oferta.', 'datos');
    const config = (await db.doc('config/app').get()).data();
    if (config?.pagosActivos !== true) throw new ErrorPago('failed-precondition', 'Los pagos están desactivados.', 'noDisponible');
    const [servicioSnap, ofertaSnap, cuentaSnap, pagoSnap] = await Promise.all([
      db.doc(`helpRequests/${serviceId}`).get(),
      db.doc(`applications/${serviceId}_${applicantId}`).get(),
      db.doc(`cuentasCobro/${applicantId}`).get(),
      db.doc(`pagos/${serviceId}`).get(),
    ]);
    const servicio = servicioSnap.data();
    const oferta = ofertaSnap.data();
    let cuenta = cuentaSnap.data();
    const pagoPrevio = pagoSnap.data();
    if (!servicio) throw new ErrorPago('not-found', 'El servicio ya no existe.', 'noExiste');
    if (servicio.requesterId !== uid) throw new ErrorPago('permission-denied', 'Solo quien pide el servicio lo paga.', 'noEsTuyo');
    if (servicio.status !== 'approved') throw new ErrorPago('failed-precondition', 'Este servicio ya no admite elegir oferta.', 'noDisponible');
    if (servicio.priceCents == null) throw new ErrorPago('failed-precondition', 'Es un favor gratis: se elige sin pagar.', 'gratis');
    if (!oferta || oferta.status !== 'pending') throw new ErrorPago('failed-precondition', 'Esa oferta ya no está disponible.', 'oferta');
    if (cuenta?.stripeAccountId && !cuenta.cobrosActivos) {
      // Puede que acabe de terminar el formulario y aún no lo hayamos apuntado.
      const { activos } = await estadoCobros(applicantId);
      cuenta = { ...cuenta, cobrosActivos: activos };
    }
    if (!cuenta?.cobrosActivos || !cuenta.stripeAccountId) {
      throw new ErrorPago('failed-precondition', 'Esta persona aún no ha activado los cobros.', 'sinCobros');
    }
    if (pagoPrevio && pagoPrevio.estado !== 'pendiente') throw new ErrorPago('already-exists', 'Este servicio ya está pagado.', 'yaPagado');

    // Si quedó a medias un pago anterior (otra oferta, o se cerró Stripe), se anula:
    // así nunca se cobran dos.
    if (pagoPrevio?.checkoutSessionId) {
      await stripe.checkout.sessions.expire(pagoPrevio.checkoutSessionId).catch(() => {});
    }

    const precio = servicio.priceCents;
    const gestion = comision(precio);
    // proyecto: el Sandbox de Stripe lo comparten la app real y los
    // emuladores; cada uno solo atiende sus propios pagos.
    const metadata = { serviceId, helperId: applicantId, requesterId: uid, ...(proyecto ? { proyecto } : {}) };
    const linea = (nombre, importe) => ({
      quantity: 1,
      price_data: { currency: 'chf', unit_amount: importe, product_data: { name: nombre } },
    });
    const sesion = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email || undefined,
      line_items: [linea(servicio.title || 'Servicio', precio), linea('Gestión Neighborhub (8 %, mínimo CHF 1)', gestion)],
      payment_intent_data: { transfer_group: serviceId, metadata },
      metadata,
      success_url: `${web}/pago?estado=ok`,
      cancel_url: `${web}/pago?estado=cancelado`,
    });
    await db.doc(`pagos/${serviceId}`).set({
      serviceId,
      titulo: servicio.title || '',
      requesterId: uid,
      requesterName: servicio.requesterName || '',
      helperId: applicantId,
      helperName: oferta.applicantName || '',
      cuentaDestino: cuenta.stripeAccountId,
      precio,
      comision: gestion,
      total: precio + gestion,
      moneda: 'chf',
      estado: 'pendiente',
      checkoutSessionId: sesion.id,
      creado: ahora(),
      actualizado: ahora(),
    });
    return { url: sesion.url };
  }

  /**
   * Stripe avisa de que se ha pagado: el servicio pasa a aceptado con esa
   * persona y el dinero queda retenido. Si entretanto el servicio cambió (o
   * es un pago viejo), se devuelve el dinero.
   */
  async function alCompletarCheckout(sesion) {
    const { serviceId, helperId, proyecto: deProyecto } = sesion.metadata || {};
    if (!serviceId || !helperId || sesion.payment_status !== 'paid') return 'ignorado';
    // Un pago de otro entorno (p. ej. la app real vista desde los emuladores): ni se toca.
    if (deProyecto && proyecto && deProyecto !== proyecto) return 'ajeno';
    const intento = await stripe.paymentIntents.retrieve(sesion.payment_intent);
    const chargeId = typeof intento.latest_charge === 'string' ? intento.latest_charge : intento.latest_charge?.id;

    const resultado = await db.runTransaction(async (tx) => {
      const servicioRef = db.doc(`helpRequests/${serviceId}`);
      const pagoRef = db.doc(`pagos/${serviceId}`);
      const [servicio, pago, ofertas] = await Promise.all([
        tx.get(servicioRef),
        tx.get(pagoRef),
        tx.get(db.collection('applications').where('serviceId', '==', serviceId)),
      ]);
      const datosPago = pago.data();
      // Sin registro de pago para ese servicio, no es un pago nuestro: nunca
      // se devuelve dinero que no sabemos de dónde viene.
      if (!datosPago) return 'ajeno';
      // Stripe reintenta los avisos: el segundo no hace nada.
      if (datosPago?.checkoutSessionId === sesion.id && datosPago.estado !== 'pendiente') return 'repetido';
      const elegida = ofertas.docs.find((o) => o.data().applicantId === helperId);
      const valido =
        servicio.exists && servicio.data().status === 'approved' && datosPago?.checkoutSessionId === sesion.id && elegida;
      if (!valido) return 'reembolsar';

      tx.update(servicioRef, {
        status: 'accepted',
        helperId,
        helperName: elegida.data().applicantName ?? null,
        pago: { estado: 'retenido', precio: datosPago.precio, comision: datosPago.comision, total: datosPago.total },
        updatedAt: ahora(),
      });
      ofertas.docs.forEach((o) =>
        tx.update(o.ref, { status: o.id === elegida.id ? 'selected' : 'rejected', updatedAt: ahora() })
      );
      tx.update(pagoRef, { estado: 'retenido', paymentIntentId: intento.id, chargeId, actualizado: ahora() });
      return 'retenido';
    });

    if (resultado === 'reembolsar') {
      await stripe.refunds.create({ payment_intent: intento.id, reason: 'duplicate' }, { idempotencyKey: `reembolso-${sesion.id}` });
    }
    return resultado;
  }

  async function alActualizarCuenta(cuenta) {
    const uid = cuenta.metadata?.uid;
    if (!uid) return 'ignorado';
    const activos = cuentaActiva(cuenta);
    await guardarEstadoCuenta(uid, activos);
    return activos ? 'activa' : 'pendiente';
  }

  /**
   * Al darse por hecho (completado o valorado), el precio va a quien ayudó.
   * Se llama en cada cambio del servicio; solo actúa en el paso a terminado.
   */
  async function liberarPago(serviceId, antes, despues) {
    if (!antes || !despues || terminado(antes.status) || !terminado(despues.status)) return 'nada';
    const pagoRef = db.doc(`pagos/${serviceId}`);
    const pago = (await pagoRef.get()).data();
    if (pago?.estado !== 'retenido') return 'nada';
    let transferencia;
    try {
      transferencia = await stripe.transfers.create(
        {
          amount: pago.precio,
          currency: 'chf',
          destination: pago.cuentaDestino,
          transfer_group: serviceId,
          // Del propio cargo: no hace falta esperar a tener saldo disponible.
          source_transaction: pago.chargeId,
          metadata: { serviceId, helperId: pago.helperId },
        },
        { idempotencyKey: `liberar-${serviceId}` }
      );
    } catch (e) {
      // Que no se quede «retenido» para siempre: o ya se devolvió, o hay que mirarlo.
      const cargo = await stripe.charges.retrieve(pago.chargeId).catch(() => null);
      const estado = cargo?.refunded ? 'reembolsado' : 'error';
      await pagoRef.update({ estado, error: String(e.message || e).slice(0, 300), actualizado: ahora() });
      await db.doc(`helpRequests/${serviceId}`).update({ 'pago.estado': estado });
      return estado;
    }
    await pagoRef.update({ estado: 'pagado', transferId: transferencia.id, actualizado: ahora() });
    await db.doc(`helpRequests/${serviceId}`).update({ 'pago.estado': 'pagado' });
    return 'pagado';
  }

  // --- Administración ---------------------------------------------------

  const segundos = (t) => (t ? t * 1000 : 0);

  /** El pago de un servicio, su cargo y sus transferencias en Stripe. */
  async function leerPagoCompleto(serviceId) {
    const [pagoSnap, servicioSnap] = await Promise.all([
      db.doc(`pagos/${serviceId}`).get(),
      db.doc(`helpRequests/${serviceId}`).get(),
    ]);
    const pago = pagoSnap.data();
    const servicio = servicioSnap.data() || {};
    if (!pago) return { pago: null, servicio, cargo: null, sesion: null, transferencias: [] };
    const [cargo, sesion, lista] = await Promise.all([
      pago.chargeId ? stripe.charges.retrieve(pago.chargeId, { expand: ['refunds'] }) : null,
      !pago.chargeId && pago.checkoutSessionId ? stripe.checkout.sessions.retrieve(pago.checkoutSessionId).catch(() => null) : null,
      stripe.transfers.list({ transfer_group: serviceId, limit: 20 }),
    ]);
    return { pago, servicio, cargo, sesion, transferencias: lista?.data || [] };
  }

  /**
   * Si se puede volver a intentar pagar a quien ayudó y de dónde saldría el
   * dinero: del cobro, si aún lo tiene; si se devolvió a quien pidió, del
   * saldo de Neighborhub. Si Stripe ya tiene la transferencia, solo falta
   * apuntarla.
   */
  function planReintento({ pago, servicio, cargo, transferencias }) {
    const no = (motivo) => ({ posible: false, motivo });
    if (!pago) return no('Este servicio no tiene pago.');
    if (pago.estado === 'pagado') return no('Ya está pagado a quien ayudó.');
    if (pago.estado === 'pendiente') return no('Quien pidió no llegó a pagar.');
    if (!terminado(servicio.status)) return no('El servicio aún no está terminado: se paga solo al marcarlo como hecho.');
    const hecha = transferencias.find((t) => !t.reversed && t.amount >= pago.precio);
    if (hecha) return { posible: true, origen: 'existente', transferId: hecha.id };
    if (!pago.cuentaDestino) return no('Quien ayudó no tiene cuenta de cobro.');
    const disponible = cargo && cargo.status === 'succeeded' ? cargo.amount - (cargo.amount_refunded || 0) : 0;
    return { posible: true, origen: disponible >= pago.precio ? 'cobro' : 'saldo' };
  }

  /** Para la web de administración: el pago, sus movimientos y si se puede reintentar. */
  async function verPago(serviceId) {
    if (!serviceId) throw new ErrorPago('invalid-argument', 'Falta el servicio.', 'datos');
    const datos = await leerPagoCompleto(serviceId);
    const { pago, cargo, sesion, transferencias } = datos;
    if (!pago) return { pago: null, movimientos: [], intentos: [], reintento: planReintento(datos) };

    const movimientos = [];
    if (cargo) {
      movimientos.push({ tipo: 'cobro', id: cargo.id, importe: cargo.amount, estado: cargo.status, fecha: segundos(cargo.created) });
      (cargo.refunds?.data || []).forEach((r) =>
        movimientos.push({ tipo: 'reembolso', id: r.id, importe: r.amount, estado: r.status, fecha: segundos(r.created), detalle: r.reason || '' })
      );
    } else if (sesion) {
      movimientos.push({
        tipo: 'checkout',
        id: sesion.id,
        importe: sesion.amount_total ?? pago.total,
        estado: `${sesion.status} · ${sesion.payment_status}`,
        fecha: segundos(sesion.created),
      });
    }
    transferencias.forEach((t) =>
      movimientos.push({
        tipo: 'transferencia',
        id: t.id,
        importe: t.amount,
        estado: t.reversed ? 'revertida' : 'hecha',
        fecha: segundos(t.created),
        detalle: t.source_transaction ? 'del cobro' : 'del saldo de Neighborhub',
      })
    );
    movimientos.sort((a, b) => a.fecha - b.fecha);

    const milis = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : t instanceof Date ? t.getTime() : 0);
    return {
      pago: {
        estado: pago.estado,
        precio: pago.precio,
        comision: pago.comision,
        total: pago.total,
        titulo: pago.titulo || datos.servicio.title || '',
        requesterName: pago.requesterName || datos.servicio.requesterName || '',
        helperName: pago.helperName || datos.servicio.helperName || '',
        error: pago.error || '',
        origenPago: pago.origenPago || '',
        creado: milis(pago.creado),
        actualizado: milis(pago.actualizado),
        ids: {
          checkout: pago.checkoutSessionId || '',
          paymentIntent: pago.paymentIntentId || '',
          cargo: pago.chargeId || '',
          cuentaDestino: pago.cuentaDestino || '',
          transferencia: pago.transferId || '',
        },
      },
      movimientos,
      intentos: (pago.intentos || []).map((i) => ({ ...i, fecha: milis(i.fecha) })),
      reintento: planReintento(datos),
    };
  }

  /**
   * Vuelve a intentar pagar a quien ayudó. origen es el que enseñó verPago y
   * aceptó la persona de administración: si ha cambiado, no se hace nada.
   */
  async function reintentarPago(adminUid, { serviceId, origen } = {}) {
    if (!serviceId || !origen) throw new ErrorPago('invalid-argument', 'Falta el servicio o el origen del dinero.', 'datos');
    const datos = await leerPagoCompleto(serviceId);
    const plan = planReintento(datos);
    if (!plan.posible) throw new ErrorPago('failed-precondition', plan.motivo, 'noDisponible');
    if (plan.origen !== origen) {
      throw new ErrorPago('failed-precondition', 'El pago ha cambiado desde que lo abriste: vuelve a abrirlo.', 'cambiado');
    }
    const { pago, cargo } = datos;
    const pagoRef = db.doc(`pagos/${serviceId}`);
    const intentos = pago.intentos || [];
    const intento = { fecha: new Date(), origen, por: adminUid };

    let transferId = plan.transferId;
    if (origen !== 'existente') {
      try {
        const transferencia = await stripe.transfers.create(
          {
            amount: pago.precio,
            currency: 'chf',
            destination: pago.cuentaDestino,
            transfer_group: serviceId,
            ...(origen === 'cobro' ? { source_transaction: pago.chargeId } : {}),
            metadata: { serviceId, helperId: pago.helperId, reintento: String(intentos.length + 1), origen },
          },
          // Cada intento con su clave: Stripe recuerda los fallos de la anterior.
          { idempotencyKey: `reintento-${serviceId}-${intentos.length + 1}` }
        );
        transferId = transferencia.id;
      } catch (e) {
        const error = String(e.message || e).slice(0, 300);
        await pagoRef.update({ intentos: [...intentos, { ...intento, resultado: 'error', error }], error, actualizado: ahora() });
        throw new ErrorPago('failed-precondition', `Stripe no hizo la transferencia: ${error}`, 'stripe');
      }
    }

    await pagoRef.update({
      estado: 'pagado',
      transferId,
      origenPago: origen,
      // Del saldo: quien pidió recuperó su dinero y lo sigue viendo así.
      ...(origen === 'saldo' && cargo?.amount_refunded ? { devueltoAQuienPide: true } : {}),
      intentos: [...intentos, { ...intento, resultado: 'pagado', transferId }],
      error: '',
      actualizado: ahora(),
    });
    await db.doc(`helpRequests/${serviceId}`).update({ 'pago.estado': 'pagado' });
    return { estado: 'pagado', origen };
  }

  /**
   * Lo que he pagado y lo que he cobrado, con su estado, para el perfil.
   * Solo campos seguros: nada de ids de Stripe. Quien ayuda no ve los pagos
   * a medias (puede que al final elijan a otra persona).
   */
  async function misPagos(uid) {
    const [pagados, cobrados] = await Promise.all([
      db.collection('pagos').where('requesterId', '==', uid).get(),
      db.collection('pagos').where('helperId', '==', uid).get(),
    ]);
    const milis = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);
    const filas = [
      ...pagados.docs.map((d) => ({ d: d.data(), rol: 'pagado' })),
      ...cobrados.docs.map((d) => ({ d: d.data(), rol: 'cobrado' })).filter((f) => f.d.estado !== 'pendiente'),
    ];
    // Pagos antiguos sin título ni nombres: se completan con el servicio.
    const sinTitulo = [...new Set(filas.filter((f) => !f.d.titulo).map((f) => f.d.serviceId))];
    const servicios = new Map(
      await Promise.all(sinTitulo.map(async (id) => [id, (await db.doc(`helpRequests/${id}`).get()).data() || {}]))
    );
    return filas
      .map(({ d, rol }) => {
        const s = servicios.get(d.serviceId) || {};
        return {
          serviceId: d.serviceId,
          rol,
          // Si se pagó a quien ayudó desde el saldo de Neighborhub, quien pidió sigue con su reembolso.
          estado: rol === 'pagado' && d.devueltoAQuienPide ? 'reembolsado' : d.estado,
          importe: rol === 'pagado' ? d.total : d.precio,
          precio: d.precio,
          comision: d.comision,
          titulo: d.titulo || s.title || '',
          otraPersona: rol === 'pagado' ? d.helperName || s.helperName || '' : d.requesterName || s.requesterName || '',
          fecha: milis(d.actualizado) || milis(d.creado),
        };
      })
      .sort((a, b) => b.fecha - a.fecha)
      .slice(0, 50);
  }

  return {
    activarCobros,
    estadoCobros,
    pagarOferta,
    alCompletarCheckout,
    alActualizarCuenta,
    liberarPago,
    misPagos,
    verPago,
    reintentarPago,
  };
}

module.exports = { crearPagos, comision, cuentaActiva, ErrorPago };
