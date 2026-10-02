/**
 * Pagos contra el emulador de Firestore con un Stripe falso que apunta lo
 * que se le pide. Se lanzan con `npm run test:functions` desde la raíz.
 */
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { crearPagos, comision, ErrorPago } = require('../pagos');

const projectId = 'demo-pagos';
let app;
let db;

function stripeFalso() {
  const llamadas = [];
  const apuntar = (nombre, devuelve) =>
    jest.fn(async (...args) => {
      llamadas.push([nombre, ...args]);
      return typeof devuelve === 'function' ? devuelve(...args) : devuelve;
    });
  let sesiones = 0;
  return {
    llamadas,
    v2: {
      core: {
        accounts: {
          create: apuntar('v2.accounts.create', { id: 'acct_ayuda' }),
          retrieve: apuntar('v2.accounts.retrieve', () => ({
            id: 'acct_ayuda',
            object: 'v2.core.account',
            configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: estadoTransferencias } } } } },
          })),
        },
        accountLinks: { create: apuntar('v2.accountLinks.create', { url: 'https://accounts.stripe.com/r/acct_ayuda#alu_test' }) },
      },
    },
    checkout: {
      sessions: {
        create: apuntar('checkout.create', () => ({
          id: `cs_${++sesiones}`,
          url: `https://checkout.stripe.com/c/pay/cs_${sesiones}`,
          expires_at: 1900000000,
        })),
        expire: apuntar('checkout.expire', {}),
        retrieve: apuntar('checkout.retrieve', (id) => ({ id, status: 'open', payment_status: 'unpaid', amount_total: 4320, created: 1700000000 })),
      },
    },
    paymentIntents: { retrieve: apuntar('paymentIntents.retrieve', (id) => ({ id, latest_charge: id === 'pi_2' ? 'ch_2' : 'ch_1' })) },
    charges: {
      retrieve: apuntar('charges.retrieve', (id) => {
        const devuelto = id === 'ch_1' && cargoReembolsado;
        return {
          id,
          status: 'succeeded',
          amount: 4320,
          amount_refunded: devuelto ? 4320 : 0,
          refunded: devuelto,
          created: id === 'ch_1' ? 1700000100 : 1700000400,
          refunds: { data: devuelto ? [{ id: 're_1', amount: 4320, status: 'succeeded', created: 1700000200, reason: 'duplicate' }] : [] },
        };
      }),
    },
    refunds: { create: apuntar('refunds.create', { id: 're_1' }) },
    transfers: {
      create: apuntar('transfers.create', { id: 'tr_1' }),
      list: apuntar('transfers.list', () => ({ data: transferencias })),
    },
  };
}

let stripe;
let pagos;
let estadoTransferencias = 'active';
let cargoReembolsado = false;
let transferencias = [];

beforeAll(() => {
  app = initializeApp({ projectId }, 'pagos');
  db = getFirestore(app);
});
afterAll(() => deleteApp(app));

beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
  estadoTransferencias = 'active';
  cargoReembolsado = false;
  transferencias = [];
  stripe = stripeFalso();
  pagos = crearPagos({ stripe, db, ahora: () => FieldValue.serverTimestamp(), web: 'https://web.test', proyecto: 'demo-pagos' });
});

async function servicioConOfertas({ precio = 4000, status = 'approved', cobros = true } = {}) {
  await db.doc('config/app').set({ pagosActivos: true });
  await db.doc('helpRequests/s1').set({ title: 'Subir un sofá', status, priceCents: precio, requesterId: 'ana', requesterName: 'Ana', helperId: null });
  await db.doc('applications/s1_luis').set({ serviceId: 's1', applicantId: 'luis', applicantName: 'Luis', status: 'pending' });
  await db.doc('applications/s1_mia').set({ serviceId: 's1', applicantId: 'mia', applicantName: 'Mia', status: 'pending' });
  await db.doc('users/luis').set({ name: 'Luis' });
  if (cobros) await db.doc('cuentasCobro/luis').set({ stripeAccountId: 'acct_luis', cobrosActivos: true });
}

const sesionPagada = (id = 'cs_1') => ({ id, payment_status: 'paid', payment_intent: 'pi_1', metadata: { serviceId: 's1', helperId: 'luis', requesterId: 'ana' } });

describe('cobros de quien ayuda', () => {
  it('crea la cuenta (v2, solo recibe transferencias) una sola vez y devuelve el formulario de Stripe', async () => {
    const r = await pagos.activarCobros('luis', 'luis@ejemplo.test');

    expect(r.url).toMatch(/^https:\/\/accounts\.stripe\.com/);
    expect(stripe.v2.core.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contact_email: 'luis@ejemplo.test',
        dashboard: 'express',
        identity: { country: 'CH', entity_type: 'individual' },
        defaults: { currency: 'chf', responsibilities: { fees_collector: 'application', losses_collector: 'application' } },
        configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
        metadata: { uid: 'luis' },
      }),
      { idempotencyKey: 'cuenta-luis' }
    );
    expect(stripe.v2.core.accountLinks.create).toHaveBeenCalledWith({
      account: 'acct_ayuda',
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          refresh_url: 'https://web.test/cobros?estado=reintentar',
          return_url: 'https://web.test/cobros?estado=listo',
        },
      },
    });

    await pagos.activarCobros('luis', 'luis@ejemplo.test');
    expect(stripe.v2.core.accounts.create).toHaveBeenCalledTimes(1);
    expect(stripe.v2.core.accountLinks.create).toHaveBeenCalledTimes(2);
  });

  it('al consultar el estado lo apunta en su perfil, sin el id de Stripe', async () => {
    await db.doc('users/luis').set({ name: 'Luis' });
    await db.doc('cuentasCobro/luis').set({ stripeAccountId: 'acct_luis', cobrosActivos: false });

    expect(await pagos.estadoCobros('luis')).toEqual({ conCuenta: true, activos: true, pendiente: false });
    expect((await db.doc('users/luis').get()).data()).toEqual({ name: 'Luis', cobrosActivos: true });
  });

  it('sin cuenta no pregunta a Stripe', async () => {
    expect(await pagos.estadoCobros('nadie')).toEqual({ conCuenta: false, activos: false, pendiente: false });
    expect(stripe.v2.core.accounts.retrieve).not.toHaveBeenCalled();
  });

  it('el aviso de Stripe activa o desactiva los cobros del perfil', async () => {
    await db.doc('users/luis').set({ name: 'Luis' });

    expect(await pagos.alActualizarCuenta({ object: 'account', metadata: { uid: 'luis' }, capabilities: { transfers: 'inactive' } })).toBe('pendiente');
    expect((await db.doc('users/luis').get()).data().cobrosActivos).toBe(false);
    expect(await pagos.alActualizarCuenta({ metadata: {} })).toBe('ignorado');
  });
});

describe('pagar al elegir una oferta', () => {
  it('cobra el precio más la gestión en Checkout y deja el pago pendiente', async () => {
    await servicioConOfertas();

    const r = await pagos.pagarOferta('ana', 'ana@ejemplo.test', { serviceId: 's1', applicantId: 'luis' });

    expect(r.url).toMatch(/^https:\/\/checkout\.stripe\.com/);
    const pedido = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(pedido.line_items.map((l) => l.price_data.unit_amount)).toEqual([4000, 320]);
    expect(pedido.line_items.every((l) => l.price_data.currency === 'chf')).toBe(true);
    expect(pedido.payment_intent_data).toEqual({
      transfer_group: 's1',
      metadata: { serviceId: 's1', helperId: 'luis', requesterId: 'ana', proyecto: 'demo-pagos' },
    });
    expect((await db.doc('pagos/s1').get()).data()).toMatchObject({
      estado: 'pendiente', precio: 4000, comision: 320, total: 4320, cuentaDestino: 'acct_luis', checkoutSessionId: 'cs_1',
    });
  });

  it('con los pagos apagados (config/app) no se cobra nada', async () => {
    await servicioConOfertas();
    await db.doc('config/app').set({ pagosActivos: false });

    await expect(pagos.pagarOferta('ana', null, { serviceId: 's1', applicantId: 'luis' })).rejects.toMatchObject({ motivo: 'noDisponible' });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('la gestión mínima es CHF 1', () => {
    expect(comision(1000)).toBe(100);
    expect(comision(4000)).toBe(320);
  });

  it.each([
    ['otra persona', { uid: 'luis' }, 'permission-denied', 'noEsTuyo'],
    ['un favor gratis', { precio: null }, 'failed-precondition', 'gratis'],
    ['un servicio ya aceptado', { status: 'accepted' }, 'failed-precondition', 'noDisponible'],
    ['alguien sin cuenta de cobros', { cobros: false }, 'failed-precondition', 'sinCobros'],
    ['una oferta que no existe', { applicantId: 'pepe' }, 'failed-precondition', 'oferta'],
  ])('no deja pagar a %s', async (_caso, { uid = 'ana', applicantId = 'luis', ...servicio }, codigo, motivo) => {
    await servicioConOfertas(servicio);

    await expect(pagos.pagarOferta(uid, null, { serviceId: 's1', applicantId })).rejects.toMatchObject({ codigo, motivo });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('si el perfil dice inactivo pero Stripe ya la activó, pregunta y deja pagar', async () => {
    await servicioConOfertas();
    await db.doc('cuentasCobro/luis').set({ stripeAccountId: 'acct_luis', cobrosActivos: false });

    await pagos.pagarOferta('ana', null, { serviceId: 's1', applicantId: 'luis' });

    expect(stripe.v2.core.accounts.retrieve).toHaveBeenCalledWith('acct_luis', { include: ['configuration.recipient', 'requirements'] });
    expect((await db.doc('cuentasCobro/luis').get()).data().cobrosActivos).toBe(true);
  });

  it('si Stripe aún no la ha activado, no deja pagar', async () => {
    await servicioConOfertas();
    await db.doc('cuentasCobro/luis').set({ stripeAccountId: 'acct_luis', cobrosActivos: false });
    estadoTransferencias = 'pending';

    await expect(pagos.pagarOferta('ana', null, { serviceId: 's1', applicantId: 'luis' })).rejects.toMatchObject({ codigo: 'failed-precondition' });
  });

  it('si se repite con otra oferta, anula el pago anterior a medias', async () => {
    await servicioConOfertas();
    await db.doc('cuentasCobro/mia').set({ stripeAccountId: 'acct_mia', cobrosActivos: true });
    await pagos.pagarOferta('ana', null, { serviceId: 's1', applicantId: 'luis' });

    await pagos.pagarOferta('ana', null, { serviceId: 's1', applicantId: 'mia' });

    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_1');
    expect((await db.doc('pagos/s1').get()).data()).toMatchObject({ checkoutSessionId: 'cs_2', helperId: 'mia' });
  });

  it('un servicio ya pagado no se vuelve a cobrar', async () => {
    await servicioConOfertas();
    await db.doc('pagos/s1').set({ estado: 'retenido' });

    await expect(pagos.pagarOferta('ana', null, { serviceId: 's1', applicantId: 'luis' })).rejects.toBeInstanceOf(ErrorPago);
  });
});

describe('aviso de pago completado', () => {
  beforeEach(async () => {
    await servicioConOfertas();
    await pagos.pagarOferta('ana', null, { serviceId: 's1', applicantId: 'luis' });
  });

  it('acepta el servicio con esa persona, rechaza las demás ofertas y retiene el dinero', async () => {
    expect(await pagos.alCompletarCheckout(sesionPagada())).toBe('retenido');

    expect((await db.doc('helpRequests/s1').get()).data()).toMatchObject({
      status: 'accepted', helperId: 'luis', helperName: 'Luis',
      pago: { estado: 'retenido', precio: 4000, comision: 320, total: 4320 },
    });
    expect((await db.doc('applications/s1_luis').get()).data().status).toBe('selected');
    expect((await db.doc('applications/s1_mia').get()).data().status).toBe('rejected');
    expect((await db.doc('pagos/s1').get()).data()).toMatchObject({ estado: 'retenido', paymentIntentId: 'pi_1', chargeId: 'ch_1' });
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it('si Stripe repite el aviso, no hace nada dos veces', async () => {
    await pagos.alCompletarCheckout(sesionPagada());

    expect(await pagos.alCompletarCheckout(sesionPagada())).toBe('repetido');
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it('un pago viejo (de un Checkout anulado) se devuelve', async () => {
    expect(await pagos.alCompletarCheckout(sesionPagada('cs_viejo'))).toBe('reembolsar');
    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_1', reason: 'duplicate' }, { idempotencyKey: 'reembolso-cs_viejo' });
    expect((await db.doc('helpRequests/s1').get()).data().status).toBe('approved');
  });

  it('un pago de otro entorno (otro proyecto) ni se toca ni se devuelve', async () => {
    const deFuera = { ...sesionPagada(), metadata: { ...sesionPagada().metadata, proyecto: 'neighborhood-c4dc9' } };

    expect(await pagos.alCompletarCheckout(deFuera)).toBe('ajeno');
    expect(stripe.refunds.create).not.toHaveBeenCalled();
    expect((await db.doc('helpRequests/s1').get()).data().status).toBe('approved');
  });

  it('sin registro de pago para ese servicio, no es nuestro: no se devuelve', async () => {
    const otro = { ...sesionPagada('cs_x'), metadata: { serviceId: 'desconocido', helperId: 'luis', requesterId: 'ana' } };

    expect(await pagos.alCompletarCheckout(otro)).toBe('ajeno');
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it('ignora los Checkout sin pagar o que no son de un servicio', async () => {
    expect(await pagos.alCompletarCheckout({ ...sesionPagada(), payment_status: 'unpaid' })).toBe('ignorado');
    expect(await pagos.alCompletarCheckout({ id: 'cs_x', payment_status: 'paid', metadata: {} })).toBe('ignorado');
  });
});

describe('liberar el pago al darlo por hecho', () => {
  beforeEach(async () => {
    await servicioConOfertas();
    await pagos.pagarOferta('ana', null, { serviceId: 's1', applicantId: 'luis' });
    await pagos.alCompletarCheckout(sesionPagada());
  });

  it('transfiere el precio entero a quien ayudó y la gestión se queda', async () => {
    expect(await pagos.liberarPago('s1', { status: 'accepted' }, { status: 'rated' })).toBe('pagado');

    expect(stripe.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4000, currency: 'chf', destination: 'acct_luis', transfer_group: 's1', source_transaction: 'ch_1' }),
      { idempotencyKey: 'liberar-s1' }
    );
    expect((await db.doc('pagos/s1').get()).data()).toMatchObject({ estado: 'pagado', transferId: 'tr_1' });
    expect((await db.doc('helpRequests/s1').get()).data().pago.estado).toBe('pagado');
  });

  it('solo al pasar a terminado, y una única vez', async () => {
    expect(await pagos.liberarPago('s1', { status: 'accepted' }, { status: 'in_progress' })).toBe('nada');
    await pagos.liberarPago('s1', { status: 'accepted' }, { status: 'completed' });
    expect(await pagos.liberarPago('s1', { status: 'completed' }, { status: 'rated' })).toBe('nada');
    expect(await pagos.liberarPago('s1', { status: 'accepted' }, { status: 'rated' })).toBe('nada');

    expect(stripe.transfers.create).toHaveBeenCalledTimes(1);
  });

  it('si la transferencia falla porque el cargo ya se devolvió, queda «reembolsado»', async () => {
    stripe.transfers.create.mockRejectedValueOnce(new Error('must not exceed the source amount of CHF 0.00'));
    cargoReembolsado = true;

    expect(await pagos.liberarPago('s1', { status: 'accepted' }, { status: 'rated' })).toBe('reembolsado');
    expect((await db.doc('pagos/s1').get()).data()).toMatchObject({ estado: 'reembolsado', error: expect.stringContaining('source amount') });
    expect((await db.doc('helpRequests/s1').get()).data().pago.estado).toBe('reembolsado');
  });

  it('si falla por otra cosa, queda «error» para revisarlo, no «retenido»', async () => {
    stripe.transfers.create.mockRejectedValueOnce(new Error('account not ready'));

    expect(await pagos.liberarPago('s1', { status: 'accepted' }, { status: 'rated' })).toBe('error');
    expect((await db.doc('helpRequests/s1').get()).data().pago.estado).toBe('error');
  });

  it('los favores gratis no mueven dinero', async () => {
    expect(await pagos.liberarPago('otro', { status: 'accepted' }, { status: 'rated' })).toBe('nada');
  });
});

describe('mis pagos (perfil)', () => {
  beforeEach(async () => {
    await servicioConOfertas();
    await pagos.pagarOferta('ana', null, { serviceId: 's1', applicantId: 'luis' });
  });

  it('quien paga ve el pago a medias; quien ayuda aún no', async () => {
    expect(await pagos.misPagos('ana')).toEqual([
      expect.objectContaining({ serviceId: 's1', rol: 'pagado', estado: 'pendiente', importe: 4320, titulo: 'Subir un sofá', otraPersona: 'Luis' }),
    ]);
    expect(await pagos.misPagos('luis')).toEqual([]);
  });

  it('retenido y pagado: cada uno ve su importe y a la otra persona, sin datos de Stripe', async () => {
    await pagos.alCompletarCheckout(sesionPagada());
    expect(await pagos.misPagos('luis')).toEqual([
      expect.objectContaining({ rol: 'cobrado', estado: 'retenido', importe: 4000, otraPersona: 'Ana' }),
    ]);

    await pagos.liberarPago('s1', { status: 'accepted' }, { status: 'rated' });
    const [deAna] = await pagos.misPagos('ana');
    const [deLuis] = await pagos.misPagos('luis');
    expect(deAna).toMatchObject({ rol: 'pagado', estado: 'pagado', importe: 4320, precio: 4000, comision: 320 });
    expect(deLuis).toMatchObject({ rol: 'cobrado', estado: 'pagado', importe: 4000 });
    expect(typeof deLuis.fecha).toBe('number');
    expect(JSON.stringify([deAna, deLuis])).not.toMatch(/acct_|ch_|cs_|pi_|tr_/);
  });

  it('un pago antiguo sin título ni nombres los toma del servicio', async () => {
    await db.doc('pagos/viejo').set({ serviceId: 's1', requesterId: 'ana', helperId: 'luis', estado: 'pagado', precio: 2000, comision: 160, total: 2160 });

    const viejo = (await pagos.misPagos('ana')).find((p) => p.importe === 2160);
    expect(viejo).toMatchObject({ titulo: 'Subir un sofá' });
  });

  it('nadie más ve nada', async () => {
    expect(await pagos.misPagos('pepe')).toEqual([]);
  });
});

describe('administración: ver y reintentar el pago', () => {
  /** Pagado y terminado, pero la transferencia falló (como «Move TV»). */
  async function terminadoSinPagar({ reembolsado = true } = {}) {
    await servicioConOfertas();
    await db.doc('users/ana').set({ name: 'Ana', email: 'ana@ejemplo.test' });
    await pagos.pagarOferta('ana', null, { serviceId: 's1', applicantId: 'luis' });
    await pagos.alCompletarCheckout(sesionPagada());
    cargoReembolsado = reembolsado;
    stripe.transfers.create.mockRejectedValueOnce(new Error('must not exceed the source amount of CHF 0.00'));
    await db.doc('helpRequests/s1').update({ status: 'rated' });
    await pagos.liberarPago('s1', { status: 'accepted' }, { status: 'rated' });
  }
  const sesionRecobro = (id) => ({
    id,
    payment_status: 'paid',
    payment_intent: 'pi_2',
    metadata: { serviceId: 's1', helperId: 'luis', requesterId: 'ana', proyecto: 'demo-pagos', recobro: '1' },
  });

  it('enseña el pago con el cobro, el reembolso y las transferencias, en orden', async () => {
    await terminadoSinPagar();
    transferencias = [{ id: 'tr_viejo', amount: 4000, reversed: true, created: 1700000300, source_transaction: 'ch_1' }];

    const r = await pagos.verPago('s1');

    expect(r.pago).toMatchObject({ estado: 'reembolsado', precio: 4000, comision: 320, total: 4320, titulo: 'Subir un sofá', helperName: 'Luis' });
    expect(r.pago.error).toMatch(/source amount/);
    expect(r.pago.ids).toMatchObject({ cargo: 'ch_1', paymentIntent: 'pi_1', cuentaDestino: 'acct_luis' });
    expect(r.movimientos.map((m) => [m.tipo, m.importe, m.estado])).toEqual([
      ['cobro', 4320, 'succeeded'],
      ['reembolso', 4320, 'succeeded'],
      ['transferencia', 4000, 'revertida'],
    ]);
    expect(stripe.transfers.list).toHaveBeenCalledWith({ transfer_group: 's1', limit: 20 });
    expect(r.reintento).toEqual({ posible: true, origen: 'cobrarDeNuevo' });
  });

  it('sin pago, o aún sin terminar, o ya pagado, no deja reintentar', async () => {
    expect((await pagos.verPago('nada')).reintento).toMatchObject({ posible: false });

    await servicioConOfertas();
    await pagos.pagarOferta('ana', null, { serviceId: 's1', applicantId: 'luis' });
    expect((await pagos.verPago('s1')).reintento.motivo).toMatch(/no llegó a pagar/);
    expect((await pagos.verPago('s1')).movimientos).toEqual([expect.objectContaining({ tipo: 'checkout', estado: 'open · unpaid' })]);

    await pagos.alCompletarCheckout(sesionPagada());
    expect((await pagos.verPago('s1')).reintento.motivo).toMatch(/aún no está terminado/);

    await pagos.liberarPago('s1', { status: 'accepted' }, { status: 'rated' });
    await db.doc('helpRequests/s1').update({ status: 'rated' });
    expect((await pagos.verPago('s1')).reintento.motivo).toMatch(/Ya está pagado/);
    await expect(pagos.reintentarPago('admin', { serviceId: 's1', origen: 'cobro' })).rejects.toMatchObject({ motivo: 'noDisponible' });
  });

  it('si el cobro sigue ahí, reintenta la transferencia desde el cobro con una clave nueva', async () => {
    await terminadoSinPagar({ reembolsado: false });
    expect((await pagos.verPago('s1')).reintento).toEqual({ posible: true, origen: 'cobro' });

    expect(await pagos.reintentarPago('admin', { serviceId: 's1', origen: 'cobro' })).toEqual({ estado: 'pagado', origen: 'cobro' });

    expect(stripe.transfers.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ amount: 4000, destination: 'acct_luis', transfer_group: 's1', source_transaction: 'ch_1' }),
      { idempotencyKey: 'reintento-s1-1' }
    );
    const pago = (await db.doc('pagos/s1').get()).data();
    expect(pago).toMatchObject({ estado: 'pagado', transferId: 'tr_1', error: '' });
    expect(pago.intentos).toEqual([expect.objectContaining({ origen: 'cobro', resultado: 'pagado', por: 'admin', transferId: 'tr_1' })]);
    expect((await db.doc('helpRequests/s1').get()).data().pago.estado).toBe('pagado');
  });

  it('si el cobro se devolvió, no paga Neighborhub: pide a quien pidió que vuelva a pagar', async () => {
    await terminadoSinPagar();
    const transferenciasAntes = stripe.transfers.create.mock.calls.length;

    const r = await pagos.reintentarPago('admin', { serviceId: 's1', origen: 'cobrarDeNuevo' });

    expect(r).toEqual({ estado: 'esperando', origen: 'cobrarDeNuevo', url: 'https://checkout.stripe.com/c/pay/cs_2', expira: 1900000000000 });
    expect(stripe.transfers.create.mock.calls.length).toBe(transferenciasAntes);
    expect(stripe.checkout.sessions.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        customer_email: 'ana@ejemplo.test',
        line_items: [
          expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 4000 }) }),
          expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 320 }) }),
        ],
        metadata: { serviceId: 's1', helperId: 'luis', requesterId: 'ana', proyecto: 'demo-pagos', recobro: '1' },
        payment_intent_data: expect.objectContaining({ transfer_group: 's1' }),
      })
    );
    const pago = (await db.doc('pagos/s1').get()).data();
    expect(pago).toMatchObject({ estado: 'reembolsado', recobro: expect.objectContaining({ checkoutSessionId: 'cs_2', estado: 'esperando', por: 'admin' }) });
    expect(pago.intentos).toEqual([expect.objectContaining({ origen: 'cobrarDeNuevo', resultado: 'enlace', checkoutSessionId: 'cs_2' })]);
    expect((await db.doc('helpRequests/s1').get()).data().pago).toMatchObject({ estado: 'reembolsado', porPagar: true });

    // Quien pidió lo ve para pagarlo; quien ayudó, aún sin cobrar.
    expect((await pagos.misPagos('ana'))[0]).toMatchObject({ estado: 'pendiente', urlPago: 'https://checkout.stripe.com/c/pay/cs_2' });
    const [deLuis] = await pagos.misPagos('luis');
    expect(deLuis.estado).toBe('reembolsado');
    expect(deLuis.urlPago).toBeUndefined();
    expect((await pagos.verPago('s1')).reintento).toMatchObject({
      origen: 'cobrarDeNuevo',
      enlace: { url: 'https://checkout.stripe.com/c/pay/cs_2', expira: 1900000000000, caducado: false },
    });
  });

  it('al pagar el enlace, el precio va a quien ayudó desde ese nuevo cobro, una sola vez', async () => {
    await terminadoSinPagar();
    await pagos.reintentarPago('admin', { serviceId: 's1', origen: 'cobrarDeNuevo' });

    expect(await pagos.alCompletarCheckout(sesionRecobro('cs_2'))).toBe('recobrado');

    expect(stripe.transfers.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ amount: 4000, destination: 'acct_luis', source_transaction: 'ch_2', transfer_group: 's1' }),
      { idempotencyKey: 'recobro-cs_2' }
    );
    const pago = (await db.doc('pagos/s1').get()).data();
    expect(pago).toMatchObject({
      estado: 'pagado',
      chargeId: 'ch_2',
      chargeIdOriginal: 'ch_1',
      paymentIntentId: 'pi_2',
      recobro: expect.objectContaining({ estado: 'pagado', pagadoCon: 'cs_2' }),
    });
    expect((await db.doc('helpRequests/s1').get()).data().pago).toMatchObject({ estado: 'pagado', porPagar: false });
    expect((await pagos.misPagos('ana'))[0]).toMatchObject({ estado: 'pagado' });
    expect((await pagos.misPagos('luis'))[0]).toMatchObject({ estado: 'pagado', importe: 4000 });

    // Los dos cobros (el devuelto y el nuevo) se ven en la administración.
    expect((await pagos.verPago('s1')).movimientos.filter((m) => m.tipo === 'cobro').map((m) => [m.id, m.detalle])).toEqual([
      ['ch_1', ''],
      ['ch_2', 'nuevo pago de quien pidió'],
    ]);

    const llamadas = stripe.transfers.create.mock.calls.length;
    expect(await pagos.alCompletarCheckout(sesionRecobro('cs_2'))).toBe('repetido');
    expect(stripe.transfers.create.mock.calls.length).toBe(llamadas);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it('un enlace nuevo anula el anterior; si alguien paga el viejo, se le devuelve', async () => {
    await terminadoSinPagar();
    await pagos.reintentarPago('admin', { serviceId: 's1', origen: 'cobrarDeNuevo' });
    await pagos.reintentarPago('admin', { serviceId: 's1', origen: 'cobrarDeNuevo' });

    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_2');
    expect((await db.doc('pagos/s1').get()).data().recobro.checkoutSessionId).toBe('cs_3');

    expect(await pagos.alCompletarCheckout(sesionRecobro('cs_2'))).toBe('reembolsar');
    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_2', reason: 'duplicate' }, { idempotencyKey: 'reembolso-cs_2' });
    expect((await db.doc('pagos/s1').get()).data().estado).toBe('reembolsado');
  });

  it('si Stripe falla al reintentar desde el cobro, apunta el intento y el siguiente usa otra clave', async () => {
    await terminadoSinPagar({ reembolsado: false });
    stripe.transfers.create.mockRejectedValueOnce(new Error('account not ready'));

    await expect(pagos.reintentarPago('admin', { serviceId: 's1', origen: 'cobro' })).rejects.toMatchObject({
      motivo: 'stripe',
      message: expect.stringContaining('account not ready'),
    });
    let pago = (await db.doc('pagos/s1').get()).data();
    expect(pago).toMatchObject({ estado: 'error', error: 'account not ready' });
    expect(pago.intentos).toEqual([expect.objectContaining({ resultado: 'error', error: 'account not ready' })]);
    expect((await pagos.verPago('s1')).intentos[0].fecha).toEqual(expect.any(Number));

    await pagos.reintentarPago('admin', { serviceId: 's1', origen: 'cobro' });
    expect(stripe.transfers.create).toHaveBeenLastCalledWith(expect.anything(), { idempotencyKey: 'reintento-s1-2' });
    pago = (await db.doc('pagos/s1').get()).data();
    expect(pago.estado).toBe('pagado');
    expect(pago.intentos.map((i) => i.resultado)).toEqual(['error', 'pagado']);
  });

  it('si la transferencia ya está en Stripe, solo la apunta (no paga dos veces)', async () => {
    await terminadoSinPagar();
    transferencias = [{ id: 'tr_hecha', amount: 4000, reversed: false, created: 1700000300 }];
    const llamadas = stripe.transfers.create.mock.calls.length;

    expect((await pagos.verPago('s1')).reintento).toEqual({ posible: true, origen: 'existente', transferId: 'tr_hecha' });
    await pagos.reintentarPago('admin', { serviceId: 's1', origen: 'existente' });

    expect(stripe.transfers.create.mock.calls.length).toBe(llamadas);
    expect((await db.doc('pagos/s1').get()).data()).toMatchObject({ estado: 'pagado', transferId: 'tr_hecha' });
  });

  it('si el origen cambió desde que se abrió, no hace nada', async () => {
    await terminadoSinPagar();

    await expect(pagos.reintentarPago('admin', { serviceId: 's1', origen: 'cobro' })).rejects.toMatchObject({ motivo: 'cambiado' });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect((await db.doc('pagos/s1').get()).data().estado).toBe('reembolsado');
  });
});
