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
        create: apuntar('checkout.create', () => ({ id: `cs_${++sesiones}`, url: `https://checkout.stripe.com/c/pay/cs_${sesiones}` })),
        expire: apuntar('checkout.expire', {}),
      },
    },
    paymentIntents: { retrieve: apuntar('paymentIntents.retrieve', { id: 'pi_1', latest_charge: 'ch_1' }) },
    refunds: { create: apuntar('refunds.create', { id: 're_1' }) },
    transfers: { create: apuntar('transfers.create', { id: 'tr_1' }) },
  };
}

let stripe;
let pagos;
let estadoTransferencias = 'active';

beforeAll(() => {
  app = initializeApp({ projectId }, 'pagos');
  db = getFirestore(app);
});
afterAll(() => deleteApp(app));

beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
  estadoTransferencias = 'active';
  stripe = stripeFalso();
  pagos = crearPagos({ stripe, db, ahora: () => FieldValue.serverTimestamp(), web: 'https://web.test' });
});

async function servicioConOfertas({ precio = 4000, status = 'approved', cobros = true } = {}) {
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
    expect(pedido.payment_intent_data).toEqual({ transfer_group: 's1', metadata: { serviceId: 's1', helperId: 'luis', requesterId: 'ana' } });
    expect((await db.doc('pagos/s1').get()).data()).toMatchObject({
      estado: 'pendiente', precio: 4000, comision: 320, total: 4320, cuentaDestino: 'acct_luis', checkoutSessionId: 'cs_1',
    });
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
