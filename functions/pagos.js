/**
 * Pagos de Neighborhub con Stripe Connect, en cargos y transferencias
 * separados:
 *
 *  1. Quien ayuda activa los cobros: una cuenta conectada de Stripe
 *     (Accounts v2, configuración «recipient»: solo recibe transferencias) con
 *     el panel Express; Stripe le pide identidad e IBAN en su formulario. La
 *     plataforma responde de las pérdidas (aceptado en el perfil de
 *     plataforma de Stripe), que es lo que permite retener el dinero.
 *  2. Quien pide crea un servicio con precio y lo paga al momento en Stripe
 *     Checkout: el precio más la gestión (8 %, mínimo CHF 1). El dinero
 *     queda en la cuenta de la plataforma, retenido; solo entonces pasa a
 *     revisión. Hasta elegir a alguien puede cancelarlo y se le devuelve.
 *  3. Elige una oferta (ya pagada: no se cobra nada más). Desde ahí ya no se
 *     cancela.
 *  4. Al marcarlo como hecho quien pidió (o la administración), se transfiere
 *     el precio entero a quien ayudó; la gestión se queda en la plataforma
 *     (de ahí salen las comisiones de Stripe).
 *
 * Los servicios de antes de este cambio se pagaban al elegir la oferta
 * (pagarOferta); siguen funcionando igual.
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

  /**
   * Stripe Checkout con el precio y la gestión. recobro: el nuevo pago que
   * administración pide a quien pidió cuando el primero se devolvió.
   */
  function abrirCheckout({ serviceId, helperId, requesterId, email, titulo, precio, gestion, recobro = false, alCrear = false }) {
    // proyecto: el Sandbox de Stripe lo comparten la app real y los
    // emuladores; cada uno solo atiende sus propios pagos.
    const metadata = {
      serviceId,
      requesterId,
      ...(helperId ? { helperId } : {}),
      ...(proyecto ? { proyecto } : {}),
      ...(recobro ? { recobro: '1' } : {}),
      ...(alCrear ? { alCrear: '1' } : {}),
    };
    const linea = (nombre, importe) => ({
      quantity: 1,
      price_data: { currency: 'chf', unit_amount: importe, product_data: { name: nombre } },
    });
    return stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email || undefined,
      line_items: [linea(titulo || 'Servicio', precio), linea('Gestión Neighborhub (8 %, mínimo CHF 1)', gestion)],
      payment_intent_data: { transfer_group: serviceId, metadata },
      metadata,
      success_url: `${web}/pago?estado=ok`,
      cancel_url: `${web}/pago?estado=cancelado`,
    });
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
    if (pagoPrevio?.alCrear && pagoPrevio.estado === 'retenido') {
      // Pagado al crearlo: las builds antiguas aún pasan por aquí para elegir.
      await elegirOferta(uid, { serviceId, applicantId });
      return { url: `${web}/pago?estado=ok` };
    }
    if (pagoPrevio && pagoPrevio.estado !== 'pendiente') throw new ErrorPago('already-exists', 'Este servicio ya está pagado.', 'yaPagado');

    // Si quedó a medias un pago anterior (otra oferta, o se cerró Stripe), se anula:
    // así nunca se cobran dos.
    if (pagoPrevio?.checkoutSessionId) {
      await stripe.checkout.sessions.expire(pagoPrevio.checkoutSessionId).catch(() => {});
    }

    const precio = servicio.priceCents;
    const gestion = comision(precio);
    const sesion = await abrirCheckout({
      serviceId,
      helperId: applicantId,
      requesterId: uid,
      email,
      titulo: servicio.title,
      precio,
      gestion,
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
    const { serviceId, helperId, proyecto: deProyecto, recobro, alCrear } = sesion.metadata || {};
    if (!serviceId || (!helperId && !alCrear) || sesion.payment_status !== 'paid') return 'ignorado';
    // Un pago de otro entorno (p. ej. la app real vista desde los emuladores): ni se toca.
    if (deProyecto && proyecto && deProyecto !== proyecto) return 'ajeno';
    const intento = await stripe.paymentIntents.retrieve(sesion.payment_intent);
    const chargeId = typeof intento.latest_charge === 'string' ? intento.latest_charge : intento.latest_charge?.id;
    if (recobro) return alPagarRecobro(sesion, intento, chargeId);
    if (alCrear) return alPagarAlCrear(sesion, intento, chargeId);

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

  // --- Pago al crear el servicio ------------------------------------------

  /**
   * Quien pide paga su servicio con precio al crearlo (o, si se creó con los
   * pagos apagados, antes de poder elegir oferta). Mientras no esté pagado no
   * se publica.
   */
  async function pagarServicio(uid, email, { serviceId } = {}) {
    if (!serviceId) throw new ErrorPago('invalid-argument', 'Falta el servicio.', 'datos');
    const config = (await db.doc('config/app').get()).data();
    if (config?.pagosActivos !== true) throw new ErrorPago('failed-precondition', 'Los pagos están desactivados.', 'noDisponible');
    const [servicioSnap, pagoSnap] = await Promise.all([db.doc(`helpRequests/${serviceId}`).get(), db.doc(`pagos/${serviceId}`).get()]);
    const servicio = servicioSnap.data();
    const pagoPrevio = pagoSnap.data();
    if (!servicio) throw new ErrorPago('not-found', 'El servicio ya no existe.', 'noExiste');
    if (servicio.requesterId !== uid) throw new ErrorPago('permission-denied', 'Solo quien pide el servicio lo paga.', 'noEsTuyo');
    if (servicio.priceCents == null) throw new ErrorPago('failed-precondition', 'Es un favor gratis: no se paga.', 'gratis');
    if (!['pending', 'approved'].includes(servicio.status) || servicio.helperId) {
      throw new ErrorPago('failed-precondition', 'Este servicio ya no se puede pagar.', 'noDisponible');
    }
    if (pagoPrevio && pagoPrevio.estado !== 'pendiente') throw new ErrorPago('already-exists', 'Este servicio ya está pagado.', 'yaPagado');
    // Un pago anterior a medias (se cerró Stripe) se anula: así nunca se cobra dos veces.
    if (pagoPrevio?.checkoutSessionId) await stripe.checkout.sessions.expire(pagoPrevio.checkoutSessionId).catch(() => {});

    const precio = servicio.priceCents;
    const gestion = comision(precio);
    const sesion = await abrirCheckout({ serviceId, requesterId: uid, email, titulo: servicio.title, precio, gestion, alCrear: true });
    await db.doc(`pagos/${serviceId}`).set({
      serviceId,
      titulo: servicio.title || '',
      requesterId: uid,
      requesterName: servicio.requesterName || '',
      helperId: null,
      helperName: '',
      cuentaDestino: null,
      precio,
      comision: gestion,
      total: precio + gestion,
      moneda: 'chf',
      estado: 'pendiente',
      alCrear: true,
      checkoutSessionId: sesion.id,
      creado: ahora(),
      actualizado: ahora(),
    });
    return { url: sesion.url };
  }

  /**
   * Stripe confirma el pago del servicio: el dinero queda retenido y el
   * servicio ya puede revisarse y publicarse. Si entretanto se canceló, se
   * eligió a alguien o cambió el precio, se devuelve.
   */
  async function alPagarAlCrear(sesion, intento, chargeId) {
    const { serviceId } = sesion.metadata;
    const pagoRef = db.doc(`pagos/${serviceId}`);
    const servicioRef = db.doc(`helpRequests/${serviceId}`);
    const resultado = await db.runTransaction(async (tx) => {
      const [pagoSnap, servicioSnap] = await Promise.all([tx.get(pagoRef), tx.get(servicioRef)]);
      const pago = pagoSnap.data();
      const servicio = servicioSnap.data();
      if (!pago) return 'ajeno';
      if (pago.checkoutSessionId === sesion.id && pago.estado !== 'pendiente') return 'repetido';
      const valido =
        pago.checkoutSessionId === sesion.id &&
        servicio &&
        ['pending', 'approved'].includes(servicio.status) &&
        !servicio.helperId &&
        servicio.priceCents === pago.precio;
      if (!valido) {
        if (pago.checkoutSessionId === sesion.id) {
          tx.update(pagoRef, { estado: 'reembolsado', paymentIntentId: intento.id, chargeId, actualizado: ahora() });
        }
        return 'reembolsar';
      }
      tx.update(pagoRef, { estado: 'retenido', paymentIntentId: intento.id, chargeId, actualizado: ahora() });
      tx.update(servicioRef, {
        pago: { estado: 'retenido', precio: pago.precio, comision: pago.comision, total: pago.total },
        updatedAt: ahora(),
      });
      return 'retenido';
    });
    if (resultado === 'reembolsar') {
      await stripe.refunds.create({ payment_intent: intento.id, reason: 'requested_by_customer' }, { idempotencyKey: `reembolso-${sesion.id}` });
    }
    return resultado;
  }

  /**
   * Quien pide elige una oferta de un servicio ya pagado. No se cobra nada:
   * el dinero ya está retenido y queda apuntado para quien ayuda. Tiene que
   * tener los cobros activos para poder recibirlo.
   */
  async function elegirOferta(uid, { serviceId, applicantId } = {}) {
    if (!serviceId || !applicantId) throw new ErrorPago('invalid-argument', 'Falta el servicio o la oferta.', 'datos');
    let cuenta = (await db.doc(`cuentasCobro/${applicantId}`).get()).data();
    if (cuenta?.stripeAccountId && !cuenta.cobrosActivos) {
      // Puede que acabe de terminar el formulario y aún no lo hayamos apuntado.
      cuenta = { ...cuenta, cobrosActivos: (await estadoCobros(applicantId)).activos };
    }
    const servicioRef = db.doc(`helpRequests/${serviceId}`);
    const pagoRef = db.doc(`pagos/${serviceId}`);
    await db.runTransaction(async (tx) => {
      const [servicioSnap, pagoSnap, ofertas] = await Promise.all([
        tx.get(servicioRef),
        tx.get(pagoRef),
        tx.get(db.collection('applications').where('serviceId', '==', serviceId)),
      ]);
      const servicio = servicioSnap.data();
      const pago = pagoSnap.data();
      if (!servicio) throw new ErrorPago('not-found', 'El servicio ya no existe.', 'noExiste');
      if (servicio.requesterId !== uid) throw new ErrorPago('permission-denied', 'Solo quien pide el servicio elige.', 'noEsTuyo');
      if (servicio.status !== 'approved' || servicio.helperId) {
        throw new ErrorPago('failed-precondition', 'Este servicio ya no admite elegir oferta.', 'noDisponible');
      }
      if (pago?.estado !== 'retenido') throw new ErrorPago('failed-precondition', 'Primero hay que pagar el servicio.', 'sinPagar');
      const elegida = ofertas.docs.find((o) => o.data().applicantId === applicantId);
      if (!elegida || elegida.data().status !== 'pending') {
        throw new ErrorPago('failed-precondition', 'Esa oferta ya no está disponible.', 'oferta');
      }
      if (!cuenta?.stripeAccountId || !cuenta.cobrosActivos) {
        throw new ErrorPago('failed-precondition', 'Esta persona aún no ha activado los cobros.', 'sinCobros');
      }
      const helperName = elegida.data().applicantName ?? '';
      tx.update(servicioRef, { status: 'accepted', helperId: applicantId, helperName, updatedAt: ahora() });
      ofertas.docs.forEach((o) =>
        tx.update(o.ref, { status: o.id === elegida.id ? 'selected' : 'rejected', updatedAt: ahora() })
      );
      tx.update(pagoRef, { helperId: applicantId, helperName, cuentaDestino: cuenta.stripeAccountId, actualizado: ahora() });
    });
    return { estado: 'accepted' };
  }

  /**
   * Cancelar un servicio: solo mientras no se ha elegido a nadie. Si estaba
   * pagado, se devuelve el dinero entero a quien pidió. admin: la
   * administración lo rechaza (con el mismo reembolso).
   */
  async function cancelarServicio(uid, { serviceId } = {}, { admin = false } = {}) {
    if (!serviceId) throw new ErrorPago('invalid-argument', 'Falta el servicio.', 'datos');
    const servicioRef = db.doc(`helpRequests/${serviceId}`);
    const pagoRef = db.doc(`pagos/${serviceId}`);
    const [servicioSnap, pagoSnap] = await Promise.all([servicioRef.get(), pagoRef.get()]);
    const servicio = servicioSnap.data();
    const pago = pagoSnap.data();
    if (!servicio) throw new ErrorPago('not-found', 'El servicio ya no existe.', 'noExiste');
    if (!admin && servicio.requesterId !== uid) throw new ErrorPago('permission-denied', 'Solo quien pide el servicio lo cancela.', 'noEsTuyo');
    if (!['pending', 'approved'].includes(servicio.status) || servicio.helperId) {
      throw new ErrorPago('failed-precondition', 'Ya se eligió a alguien: el servicio no se puede cancelar.', 'yaElegido');
    }

    let reembolsado = 0;
    if (pago?.estado === 'retenido') {
      await stripe.refunds.create(
        { payment_intent: pago.paymentIntentId, reason: 'requested_by_customer', metadata: { serviceId, motivo: admin ? 'rechazado' : 'cancelado' } },
        { idempotencyKey: `cancelar-${serviceId}` }
      );
      reembolsado = pago.total;
      await pagoRef.update({ estado: 'reembolsado', cancelado: true, actualizado: ahora() });
    } else if (pago?.estado === 'pendiente') {
      // Pago a medias: se anula el enlace y no queda nada que devolver.
      if (pago.checkoutSessionId) await stripe.checkout.sessions.expire(pago.checkoutSessionId).catch(() => {});
      await pagoRef.delete();
    }

    await servicioRef.update({
      status: 'cancelled',
      cancelledBy: admin ? 'admin' : 'requester',
      cancelledAt: ahora(),
      updatedAt: ahora(),
      ...(reembolsado ? { pago: { estado: 'reembolsado', precio: pago.precio, comision: pago.comision, total: pago.total } } : {}),
    });
    const ofertas = await db.collection('applications').where('serviceId', '==', serviceId).get();
    await Promise.all(
      ofertas.docs.filter((o) => o.data().status === 'pending').map((o) => o.ref.update({ status: 'rejected', updatedAt: ahora() }))
    );
    return { estado: 'cancelled', reembolsado };
  }

  /** La administración da por hecho un servicio (si quien pidió no lo marca): se paga a quien ayudó. */
  async function marcarHechoAdmin(adminUid, { serviceId } = {}) {
    if (!serviceId) throw new ErrorPago('invalid-argument', 'Falta el servicio.', 'datos');
    const ref = db.doc(`helpRequests/${serviceId}`);
    const servicio = (await ref.get()).data();
    if (!servicio) throw new ErrorPago('not-found', 'El servicio ya no existe.', 'noExiste');
    if (!['accepted', 'in_progress'].includes(servicio.status) || !servicio.helperId) {
      throw new ErrorPago('failed-precondition', 'Solo un servicio en marcha se puede dar por hecho.', 'noDisponible');
    }
    // El paso a «completado» lo ve liberarPago, que transfiere a quien ayudó.
    await ref.update({ status: 'completed', completedBy: 'admin', completedByUid: adminUid, updatedAt: ahora() });
    return { estado: 'completed' };
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
    let pago = (await db.doc(`pagos/${serviceId}`).get()).data();
    if (pago?.estado !== 'retenido') return 'nada';
    if (!pago.cuentaDestino && despues.helperId) {
      const cuenta = (await db.doc(`cuentasCobro/${despues.helperId}`).get()).data();
      pago = { ...pago, helperId: despues.helperId, helperName: despues.helperName || '', cuentaDestino: cuenta?.stripeAccountId || null };
      await db.doc(`pagos/${serviceId}`).update({ helperId: pago.helperId, helperName: pago.helperName, cuentaDestino: pago.cuentaDestino });
    }
    if (!pago.cuentaDestino) {
      await db.doc(`pagos/${serviceId}`).update({ estado: 'error', error: 'Quien ayudó no tiene cuenta de cobro.', actualizado: ahora() });
      await db.doc(`helpRequests/${serviceId}`).update({ 'pago.estado': 'error' });
      return 'error';
    }
    return (await transferir(serviceId, pago, `liberar-${serviceId}`)).estado;
  }

  /**
   * Transfiere el precio a quien ayudó desde el cargo del pago (no hace falta
   * esperar a tener saldo disponible) y lo apunta. Si falla, no se queda
   * «retenido»: o el cargo ya se devolvió, o hay que mirarlo.
   */
  async function transferir(serviceId, pago, clave, metadata = {}) {
    const pagoRef = db.doc(`pagos/${serviceId}`);
    let transferencia;
    try {
      transferencia = await stripe.transfers.create(
        {
          amount: pago.precio,
          currency: 'chf',
          destination: pago.cuentaDestino,
          transfer_group: serviceId,
          source_transaction: pago.chargeId,
          metadata: { serviceId, helperId: pago.helperId, ...metadata },
        },
        { idempotencyKey: clave }
      );
    } catch (e) {
      const cargo = await stripe.charges.retrieve(pago.chargeId).catch(() => null);
      const estado = cargo?.refunded ? 'reembolsado' : 'error';
      const error = String(e.message || e).slice(0, 300);
      await pagoRef.update({ estado, error, actualizado: ahora() });
      await db.doc(`helpRequests/${serviceId}`).update(resumenServicio(pago, estado));
      return { estado, error };
    }
    await pagoRef.update({ estado: 'pagado', transferId: transferencia.id, error: '', actualizado: ahora() });
    await db.doc(`helpRequests/${serviceId}`).update(resumenServicio(pago, 'pagado'));
    return { estado: 'pagado', transferId: transferencia.id };
  }

  /** Lo que la app ve del pago en el servicio (entero: si se eligió sin pagar, no lo tenía). */
  const resumenServicio = (pago, estado) => ({
    pago: { estado, precio: pago.precio, comision: pago.comision, total: pago.total },
    ...(pago.sinPagoAlElegir ? { cobroPedido: false } : {}),
  });

  /**
   * Quien pidió ha pagado el enlace nuevo: el servicio ya está terminado, así
   * que el precio va a quien ayudó al momento, desde este cargo. Un enlace
   * viejo (ya sustituido) o un servicio ya pagado se devuelve.
   */
  async function alPagarRecobro(sesion, intento, chargeId) {
    const { serviceId } = sesion.metadata;
    const pagoRef = db.doc(`pagos/${serviceId}`);
    const resultado = await db.runTransaction(async (tx) => {
      const pago = (await tx.get(pagoRef)).data();
      if (!pago) return 'ajeno';
      if (pago.recobro?.pagadoCon === sesion.id) return 'repetido';
      if (pago.recobro?.checkoutSessionId !== sesion.id || pago.recobro?.estado !== 'esperando' || pago.estado === 'pagado') {
        return 'reembolsar';
      }
      tx.update(pagoRef, {
        estado: 'retenido',
        // El primer cargo (el devuelto) se guarda para la administración.
        chargeIdOriginal: pago.chargeIdOriginal || pago.chargeId || null,
        paymentIntentIdOriginal: pago.paymentIntentIdOriginal || pago.paymentIntentId || null,
        chargeId,
        paymentIntentId: intento.id,
        recobro: { ...pago.recobro, estado: 'pagado', pagadoCon: sesion.id, pagadoEn: new Date() },
        actualizado: ahora(),
      });
      return 'recobrado';
    });
    if (resultado === 'reembolsar') {
      await stripe.refunds.create({ payment_intent: intento.id, reason: 'duplicate' }, { idempotencyKey: `reembolso-${sesion.id}` });
      return resultado;
    }
    if (resultado !== 'recobrado') return resultado;
    const pago = (await pagoRef.get()).data();
    const r = await transferir(serviceId, pago, `recobro-${sesion.id}`, { recobro: '1' });
    return r.estado === 'pagado' ? 'recobrado' : r.estado;
  }

  // --- Administración ---------------------------------------------------

  const segundos = (t) => (t ? t * 1000 : 0);
  const milis = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : t instanceof Date ? t.getTime() : 0);

  /** El pago de un servicio, sus cargos, el enlace de un nuevo cobro y sus transferencias en Stripe. */
  async function leerPagoCompleto(serviceId) {
    const [pagoSnap, servicioSnap] = await Promise.all([
      db.doc(`pagos/${serviceId}`).get(),
      db.doc(`helpRequests/${serviceId}`).get(),
    ]);
    const pago = pagoSnap.data();
    const servicio = servicioSnap.data() || {};
    if (!pago) return { pago: null, servicio, cargo: null, cargos: [], sesion: null, recobro: null, transferencias: [] };
    const idsCargos = [...new Set([pago.chargeIdOriginal, pago.chargeId].filter(Boolean))];
    const [cargos, sesion, recobro, lista] = await Promise.all([
      Promise.all(idsCargos.map((id) => stripe.charges.retrieve(id, { expand: ['refunds'] }))),
      !pago.chargeId && pago.checkoutSessionId ? stripe.checkout.sessions.retrieve(pago.checkoutSessionId).catch(() => null) : null,
      pago.recobro?.estado === 'esperando' ? stripe.checkout.sessions.retrieve(pago.recobro.checkoutSessionId).catch(() => null) : null,
      stripe.transfers.list({ transfer_group: serviceId, limit: 20 }),
    ]);
    const cargo = cargos.find((c) => c.id === pago.chargeId) || null;
    return { pago, servicio, cargo, cargos, sesion, recobro, transferencias: lista?.data || [] };
  }

  /**
   * Si se puede volver a intentar pagar a quien ayudó, y cómo. El dinero
   * siempre es de quien pidió: si el cobro aún lo tiene, se transfiere desde
   * él; si se le devolvió, tiene que volver a pagar (un enlace nuevo de
   * Stripe, porque su tarjeta no se guarda). Si Stripe ya tiene la
   * transferencia, solo falta apuntarla.
   */
  function planReintento({ pago, servicio, cargo, recobro, transferencias }) {
    const no = (motivo) => ({ posible: false, motivo });
    if (!pago) {
      // Con precio, terminado y sin pago: se eligió con los pagos apagados (gratis). Se le puede pedir.
      if (terminado(servicio.status) && servicio.priceCents != null && servicio.helperId) {
        return { posible: true, origen: 'cobrarDeNuevo', motivoCobro: 'sinPago' };
      }
      return no('Este servicio no tiene pago.');
    }
    if (servicio.status === 'cancelled') return no('Servicio cancelado: el dinero se devolvió a quien pidió.');
    if (pago.estado === 'pagado') return no('Ya está pagado a quien ayudó.');
    if (pago.estado === 'pendiente' && !pago.recobro) return no('Quien pidió no llegó a pagar.');
    if (!terminado(servicio.status)) return no('El servicio aún no está terminado: se paga solo al marcarlo como hecho.');
    const hecha = transferencias.find((t) => !t.reversed && t.amount >= pago.precio);
    if (hecha) return { posible: true, origen: 'existente', transferId: hecha.id };
    if (!pago.cuentaDestino) return no('Quien ayudó no tiene cuenta de cobro.');
    const disponible = cargo && cargo.status === 'succeeded' ? cargo.amount - (cargo.amount_refunded || 0) : 0;
    if (disponible >= pago.precio) return { posible: true, origen: 'cobro' };
    const plan = { posible: true, origen: 'cobrarDeNuevo', motivoCobro: pago.sinPagoAlElegir ? 'sinPago' : 'devuelto' };
    if (pago.recobro?.estado === 'esperando') {
      const expira = milis(pago.recobro.expira);
      plan.enlace = { url: pago.recobro.url, expira, caducado: expira <= Date.now() || recobro?.status === 'expired' };
    }
    return plan;
  }

  /** Para la web de administración: el pago, sus movimientos y si se puede reintentar. */
  async function verPago(serviceId) {
    if (!serviceId) throw new ErrorPago('invalid-argument', 'Falta el servicio.', 'datos');
    const datos = await leerPagoCompleto(serviceId);
    const { pago, cargos, sesion, recobro, transferencias } = datos;
    if (!pago) {
      const reintento = planReintento(datos);
      const { servicio } = datos;
      const previsto = reintento.posible
        ? {
            precio: servicio.priceCents,
            comision: comision(servicio.priceCents),
            total: servicio.priceCents + comision(servicio.priceCents),
            requesterName: servicio.requesterName || '',
            helperName: servicio.helperName || '',
          }
        : null;
      return { pago: null, previsto, movimientos: [], intentos: [], reintento };
    }

    const movimientos = [];
    cargos.forEach((cargo) => {
      const nuevo = pago.chargeIdOriginal && cargo.id === pago.chargeId;
      movimientos.push({
        tipo: 'cobro',
        id: cargo.id,
        importe: cargo.amount,
        estado: cargo.status,
        fecha: segundos(cargo.created),
        detalle: nuevo ? 'nuevo pago de quien pidió' : '',
      });
      (cargo.refunds?.data || []).forEach((r) =>
        movimientos.push({ tipo: 'reembolso', id: r.id, importe: r.amount, estado: r.status, fecha: segundos(r.created), detalle: r.reason || '' })
      );
    });
    [sesion, recobro].filter(Boolean).forEach((x) =>
      movimientos.push({
        tipo: 'checkout',
        id: x.id,
        importe: x.amount_total ?? pago.total,
        estado: `${x.status} · ${x.payment_status}`,
        fecha: segundos(x.created),
        detalle: x === recobro ? (pago.sinPagoAlElegir ? 'enlace de pago para quien pidió' : 'enlace para volver a pagar') : '',
      })
    );
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
        sinPagoAlElegir: pago.sinPagoAlElegir === true,
        creado: milis(pago.creado),
        actualizado: milis(pago.actualizado),
        ids: {
          checkout: pago.checkoutSessionId || '',
          paymentIntent: pago.paymentIntentId || '',
          cargo: pago.chargeId || '',
          cargoOriginal: pago.chargeIdOriginal || '',
          cuentaDestino: pago.cuentaDestino || '',
          transferencia: pago.transferId || '',
        },
      },
      movimientos,
      intentos: (pago.intentos || []).map((i) => ({ ...i, fecha: milis(i.fecha), expira: milis(i.expira) })),
      reintento: planReintento(datos),
    };
  }

  /**
   * Vuelve a intentar pagar a quien ayudó. origen es el que enseñó verPago y
   * aceptó la persona de administración: si ha cambiado, no se hace nada.
   * cobrarDeNuevo no mueve dinero: crea el enlace (24 h) y la app avisa a
   * quien pidió; al pagarlo, alPagarRecobro transfiere.
   */
  async function reintentarPago(adminUid, { serviceId, origen } = {}) {
    if (!serviceId || !origen) throw new ErrorPago('invalid-argument', 'Falta el servicio o cómo pagar.', 'datos');
    const datos = await leerPagoCompleto(serviceId);
    const plan = planReintento(datos);
    if (!plan.posible) throw new ErrorPago('failed-precondition', plan.motivo, 'noDisponible');
    if (plan.origen !== origen) {
      throw new ErrorPago('failed-precondition', 'El pago ha cambiado desde que lo abriste: vuelve a abrirlo.', 'cambiado');
    }
    const { servicio } = datos;
    let { pago } = datos;
    const pagoRef = db.doc(`pagos/${serviceId}`);
    const intentos = pago?.intentos || [];
    const apuntar = (extra) => [...intentos, { fecha: new Date(), origen, por: adminUid, ...extra }];

    if (origen === 'existente') {
      await pagoRef.update({
        estado: 'pagado',
        transferId: plan.transferId,
        error: '',
        intentos: apuntar({ resultado: 'pagado', transferId: plan.transferId }),
        actualizado: ahora(),
      });
      await db.doc(`helpRequests/${serviceId}`).update({ 'pago.estado': 'pagado', 'pago.porPagar': false });
      return { estado: 'pagado', origen };
    }

    if (origen === 'cobro') {
      // Cada intento con su clave: Stripe recuerda los fallos de la anterior.
      const r = await transferir(serviceId, pago, `reintento-${serviceId}-${intentos.length + 1}`, {
        reintento: String(intentos.length + 1),
      });
      await pagoRef.update({
        intentos: apuntar(r.estado === 'pagado' ? { resultado: 'pagado', transferId: r.transferId } : { resultado: 'error', error: r.error }),
      });
      if (r.estado !== 'pagado') throw new ErrorPago('failed-precondition', `Stripe no hizo la transferencia: ${r.error}`, 'stripe');
      return { estado: 'pagado', origen };
    }

    if (!pago) {
      // Elegido sin pagar: se abre el pago ahora, hacia la cuenta de cobro de quien ayudó.
      let cuenta = (await db.doc(`cuentasCobro/${servicio.helperId}`).get()).data();
      if (cuenta?.stripeAccountId && !cuenta.cobrosActivos) {
        cuenta = { ...cuenta, cobrosActivos: (await estadoCobros(servicio.helperId)).activos };
      }
      if (!cuenta?.stripeAccountId || !cuenta.cobrosActivos) {
        throw new ErrorPago('failed-precondition', `${servicio.helperName || 'Quien ayudó'} aún no ha activado los cobros.`, 'sinCobros');
      }
      const gestion = comision(servicio.priceCents);
      pago = {
        serviceId,
        titulo: servicio.title || '',
        requesterId: servicio.requesterId,
        requesterName: servicio.requesterName || '',
        helperId: servicio.helperId,
        helperName: servicio.helperName || '',
        cuentaDestino: cuenta.stripeAccountId,
        precio: servicio.priceCents,
        comision: gestion,
        total: servicio.priceCents + gestion,
        moneda: 'chf',
        estado: 'pendiente',
        sinPagoAlElegir: true,
      };
      await pagoRef.set({ ...pago, creado: ahora(), actualizado: ahora() });
    }

    // cobrarDeNuevo: el enlace anterior (si lo hay) deja de valer; así nunca se cobra dos veces.
    if (pago.recobro?.checkoutSessionId) {
      await stripe.checkout.sessions.expire(pago.recobro.checkoutSessionId).catch(() => {});
    }
    // El email de quien pidió está en sus datos privados, no en el perfil público.
    const quienPide = (await db.doc(`privado/${pago.requesterId}`).get()).data() || {};
    const sesion = await abrirCheckout({
      serviceId,
      helperId: pago.helperId,
      requesterId: pago.requesterId,
      email: quienPide.email,
      titulo: pago.titulo || servicio.title,
      precio: pago.precio,
      gestion: pago.comision,
      recobro: true,
    });
    const expira = sesion.expires_at ? new Date(sesion.expires_at * 1000) : new Date(Date.now() + 24 * 3600 * 1000);
    await pagoRef.update({
      recobro: { checkoutSessionId: sesion.id, url: sesion.url, creado: new Date(), expira, estado: 'esperando', por: adminUid },
      intentos: apuntar({ resultado: 'enlace', checkoutSessionId: sesion.id, expira }),
      actualizado: ahora(),
    });
    // La app de quien pidió le avisa y le enseña el botón para pagar. Si se eligió sin pagar,
    // el servicio no tiene resumen de pago (las builds anteriores lo leerían como «retenido»).
    await db
      .doc(`helpRequests/${serviceId}`)
      .update(pago.sinPagoAlElegir ? { cobroPedido: { total: pago.total, precio: pago.precio } } : { 'pago.porPagar': true });
    return { estado: 'esperando', origen, url: sesion.url, expira: expira.getTime() };
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
    const filas = [
      ...pagados.docs.map((d) => ({ d: d.data(), rol: 'pagado' })),
      ...cobrados.docs.map((d) => ({ d: d.data(), rol: 'cobrado' })).filter((f) => f.d.estado !== 'pendiente'),
    ];
    // Administración pidió volver a pagar y el enlace aún vale: quien pidió lo ve para pagarlo.
    const porPagar = (d, rol) =>
      rol === 'pagado' && d.estado !== 'pagado' && d.recobro?.estado === 'esperando' && milis(d.recobro.expira) > Date.now();
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
          estado: porPagar(d, rol) ? 'pendiente' : d.estado,
          ...(porPagar(d, rol) ? { urlPago: d.recobro.url } : {}),
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
    pagarServicio,
    elegirOferta,
    cancelarServicio,
    marcarHechoAdmin,
  };
}

module.exports = { crearPagos, comision, cuentaActiva, ErrorPago };
