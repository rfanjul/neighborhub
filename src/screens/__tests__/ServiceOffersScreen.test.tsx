import React from 'react';
import { Alert, AppState, Linking } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ServiceOffersScreen from '../ServiceOffersScreen';
import { api, type Application } from '../../firebase/data';
import { servicio } from '../../test-utils/servicio';
import { perfil, resena } from '../../test-utils/perfil';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (efecto: () => void) => require('react').useEffect(efecto, []),
}));

const mockedApi = api as jest.Mocked<typeof api>;

const oferta = (id: string, nombre: string, status: Application['status'] = 'pending'): Application => ({
  id: `s1_${id}`,
  serviceId: 's1',
  serviceTitle: 'Pintar pared',
  applicantId: id,
  applicantName: nombre,
  requesterId: 'ana',
  comment: `Soy ${nombre}`,
  status,
});

async function renderOfertas() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(<ServiceOffersScreen navigation={navigation as never} route={{ params: { serviceId: 's1' } } as never} />);
  return navigation;
}

/** Pulsa el botón indicado del Alert de confirmación que se acaba de abrir. */
async function confirmar(alerta: jest.SpyInstance, boton: string) {
  const botones = alerta.mock.calls.at(-1)[2];
  await act(async () => {
    await botones.find((b: { text: string }) => b.text === boton).onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Por defecto un favor gratis: se elige sin pagar. Los de pago, en su describe.
  mockedApi.getService.mockResolvedValue(servicio({ title: 'Pintar pared', status: 'approved', priceCents: null }));
  mockedApi.listApplicationsForService.mockResolvedValue([oferta('luis', 'Luis'), oferta('marta', 'Marta')]);
});

describe('ServiceOffersScreen', () => {
  it('enseña las ofertas recibidas con su comentario', async () => {
    await renderOfertas();

    expect(await screen.findByText('Luis')).toBeTruthy();
    expect(screen.getByText('“Soy Marta”')).toBeTruthy();
    expect(screen.getByText('2 offers')).toBeTruthy();
  });

  it('cada oferta enseña quién es: valoración, ayudas, insignias, idiomas y bio', async () => {
    mockedApi.listApplicationsForService.mockResolvedValue([{ ...oferta('luis', 'Luis'), applicant: perfil() }]);
    await renderOfertas();

    expect(await screen.findByText('Carpintero jubilado, tengo de todo en el taller.')).toBeTruthy();
    expect(screen.getByText('✓ Verified')).toBeTruthy();
    expect(screen.getByText('4.8 · 21 ratings')).toBeTruthy();
    expect(screen.getByLabelText('4.8 out of 5 stars')).toBeTruthy();
    expect(screen.getByText('27 helps · Trusted neighbor')).toBeTruthy();
    expect(screen.getByText('Amateur')).toBeTruthy();
    expect(screen.getByText('Veteran')).toBeTruthy();
    expect(screen.queryByText('Exemplary')).toBeNull();
    expect(screen.getByText('Speaks German, Spanish')).toBeTruthy();
    expect(screen.getByText('Their offer')).toBeTruthy();
    expect(screen.getByText('“Soy Luis”')).toBeTruthy();
  });

  it('tocar a quien oferta abre su perfil, también sin perfil cargado', async () => {
    mockedApi.listApplicationsForService.mockResolvedValue([
      { ...oferta('luis', 'Luis'), applicant: perfil() },
      { ...oferta('marta', 'Marta'), applicant: null },
    ]);
    const navigation = await renderOfertas();

    await fireEvent.press(await screen.findByLabelText("See Luis's profile"));
    expect(navigation.navigate).toHaveBeenLastCalledWith('NeighborProfile', { userId: 'luis' });

    await fireEvent.press(screen.getByLabelText("See Marta's profile"));
    expect(navigation.navigate).toHaveBeenLastCalledWith('NeighborProfile', { userId: 'marta' });
  });

  it('un vecino nuevo sale sin valoraciones, sin insignias ni bio', async () => {
    mockedApi.listApplicationsForService.mockResolvedValue([
      {
        ...oferta('eva', 'Eva'),
        applicant: perfil({
          name: 'Eva', bio: null, languages: null, rating: 0, ratingCount: 0, servicesCompleted: 1,
          level: 1, levelLabel: 'New neighbor', identityVerified: false,
        }),
      },
    ]);
    await renderOfertas();

    expect(await screen.findByText('No ratings yet')).toBeTruthy();
    expect(screen.getByText('1 help · New neighbor')).toBeTruthy();
    expect(screen.queryByText('✓ Verified')).toBeNull();
    expect(screen.queryByText(/Speaks/)).toBeNull();
    expect(screen.queryByText('Amateur')).toBeNull();
  });

  it('con valoración antigua sin reseñas enseña la nota sin contarlas', async () => {
    mockedApi.listApplicationsForService.mockResolvedValue([
      { ...oferta('luis', 'Luis'), applicant: perfil({ rating: 4.5, ratingCount: 0, servicesCompleted: 0 }) },
    ]);
    await renderOfertas();

    expect(await screen.findByText('4.5')).toBeTruthy();
    expect(screen.getByText('0 helps · Trusted neighbor')).toBeTruthy();
  });

  it('una sola reseña se dice en singular', async () => {
    mockedApi.listApplicationsForService.mockResolvedValue([
      { ...oferta('luis', 'Luis'), applicant: perfil({ rating: 5, ratingCount: 1 }) },
    ]);
    await renderOfertas();

    expect(await screen.findByText('5.0 · 1 rating')).toBeTruthy();
  });

  it('elegir una pide confirmación y la selecciona', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderOfertas();

    await fireEvent.press((await screen.findAllByText('Choose'))[0]);
    expect(alerta).toHaveBeenCalledWith('Choose Luis?', expect.any(String), expect.any(Array));
    await confirmar(alerta, 'Choose');

    expect(mockedApi.selectApplicant).toHaveBeenCalledWith('s1', 's1_luis');
    alerta.mockRestore();
  });

  it('una vez elegida no se puede elegir otra, y se abre el chat', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'accepted', helperId: 'luis', helperName: 'Luis' }));
    mockedApi.listApplicationsForService.mockResolvedValue([oferta('luis', 'Luis', 'selected'), oferta('marta', 'Marta', 'rejected')]);
    const navigation = await renderOfertas();

    expect(await screen.findByText('Luis is helping you')).toBeTruthy();
    expect(screen.queryByText('Choose')).toBeNull();
    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByText('Not selected')).toBeTruthy();

    await fireEvent.press(screen.getByText('Open chat'));
    expect(navigation.navigate).toHaveBeenCalledWith('Chat', { serviceId: 's1' });
  });

  it('marcar como completado lleva a valorar a quien ayudó', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'accepted', helperId: 'luis', helperName: 'Luis' }));
    const navigation = await renderOfertas();

    await fireEvent.press(await screen.findByText('Mark as completed'));

    expect(navigation.navigate).toHaveBeenCalledWith('RateHelper', { serviceId: 's1' });
  });

  it('si quien ayudó ya lo marcó como hecho, falta mi valoración', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'completed', helperId: 'luis', helperName: 'Luis' }));
    const navigation = await renderOfertas();

    expect(await screen.findByText('Completed with Luis')).toBeTruthy();
    expect(screen.queryByText('Mark as completed')).toBeNull();
    await fireEvent.press(screen.getByText('Rate Luis'));

    expect(navigation.navigate).toHaveBeenCalledWith('RateHelper', { serviceId: 's1' });
  });

  it('ya valorado enseña mi valoración y no deja repetirla', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'rated', helperId: 'luis', helperName: 'Luis' }));
    mockedApi.getReview.mockResolvedValue(resena({ rating: 4, comment: 'Muy puntual' }));
    await renderOfertas();

    expect(await screen.findByText('Your rating')).toBeTruthy();
    expect(screen.getByLabelText('4 out of 5 stars')).toBeTruthy();
    expect(screen.getByText('“Muy puntual”')).toBeTruthy();
    expect(screen.queryByText('Rate Luis')).toBeNull();
    expect(screen.queryByText('Mark as completed')).toBeNull();
  });

  it('valorado sin comentario, o si la reseña no se puede leer, no rompe', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'rated', helperId: 'luis', helperName: 'Luis' }));
    mockedApi.getReview.mockResolvedValueOnce(resena({ rating: 5, comment: '' }));
    await renderOfertas();
    expect(await screen.findByText('Your rating')).toBeTruthy();

    mockedApi.getReview.mockRejectedValueOnce(new Error('sin red'));
    await renderOfertas();
    expect((await screen.findAllByText('Completed with Luis')).length).toBeGreaterThan(0);
  });

  it('pendiente de revisión explica que aún no llegan ofertas', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'pending', priceCents: null }));
    mockedApi.listApplicationsForService.mockResolvedValue([]);
    await renderOfertas();

    expect(await screen.findByText(/Waiting for review/)).toBeTruthy();
  });

  it('abierto y sin ofertas lo dice', async () => {
    mockedApi.listApplicationsForService.mockResolvedValue([]);
    await renderOfertas();

    expect(await screen.findByText(/No offers yet/)).toBeTruthy();
  });

  it('avisa si elegir falla', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.selectApplicant.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' }));
    await renderOfertas();

    await fireEvent.press((await screen.findAllByText('Choose'))[0]);
    await confirmar(alerta, 'Choose');

    await waitFor(() => expect(alerta).toHaveBeenCalledWith("Couldn't choose this offer", "You don't have permission to do this."));
    alerta.mockRestore();
  });

  it.each(['pending', 'approved'] as const)('%s se puede editar', async (status) => {
    mockedApi.getService.mockResolvedValue(servicio({ status }));
    const navigation = await renderOfertas();

    await fireEvent.press(await screen.findByText('Edit'));

    expect(navigation.navigate).toHaveBeenCalledWith('CreateService', { serviceId: 's1' });
  });

  it.each(['accepted', 'completed'] as const)('%s ya no se puede editar', async (status) => {
    mockedApi.getService.mockResolvedValue(servicio({ status, helperId: 'luis', helperName: 'Luis' }));
    await renderOfertas();

    await screen.findByText('Open chat');
    expect(screen.queryByText('Edit')).toBeNull();
  });

  it('un favor gratis sin elegir se cancela sin reembolso', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderOfertas();

    await fireEvent.press(await screen.findByText('Cancel request'));
    expect(alerta).toHaveBeenCalledWith('Cancel this request?', "It won't be shown anymore and the offers will be declined.", expect.any(Array));
    await confirmar(alerta, 'Cancel request');

    expect(mockedApi.cancelarServicio).toHaveBeenCalledWith('s1');
    expect(alerta).toHaveBeenLastCalledWith('Request cancelled.');
    alerta.mockRestore();
  });

  it('vuelve atrás', async () => {
    const navigation = await renderOfertas();

    await fireEvent.press(screen.getByLabelText('Back'));

    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe('servicios con precio: se pagan al crearlos', () => {
  const retenido = { pago: { estado: 'retenido' as const, precio: 4000, comision: 320, total: 4320 } };
  let abrir: jest.SpyInstance;
  beforeEach(() => {
    mockedApi.getService.mockResolvedValue(servicio({ title: 'Subir un sofá', status: 'approved', priceCents: 4000, ...retenido }));
    mockedApi.listApplicationsForService.mockResolvedValue([{ ...oferta('luis', 'Luis'), applicant: perfil({ cobrosActivos: true }) }]);
    abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });
  afterEach(() => abrir.mockRestore());

  it('sin pagar, explica que hay que pagar para revisarlo y abre Stripe', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'pending', priceCents: 4000 }));
    mockedApi.listApplicationsForService.mockResolvedValue([]);
    await renderOfertas();

    expect(await screen.findByText(/To send it for review, pay CHF\s43\.20 \(CHF\s40\.00 \+ CHF\s3\.20 service fee\)/)).toBeTruthy();
    expect(screen.queryByText(/Waiting for review/)).toBeNull();
    await fireEvent.press(screen.getByText(/^Pay CHF\s43\.20$/));

    expect(mockedApi.pagarServicio).toHaveBeenCalledWith('s1');
    expect(abrir).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_crear');
  });

  it('uno publicado sin pagar (de antes) pide pagar antes de elegir y no deja elegir', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'approved', priceCents: 4000 }));
    await renderOfertas();

    expect(await screen.findByText(/Pay CHF\s43\.20 \(CHF\s40\.00 \+ CHF\s3\.20 service fee\) before choosing someone/)).toBeTruthy();
    expect(screen.queryByText('Choose')).toBeNull();
  });

  it('pagado: dice que está retenido y elegir no cobra nada (lo hace el servidor)', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderOfertas();

    expect(await screen.findByText(/CHF\s43\.20 paid and held\. Whoever you choose gets CHF\s40\.00 when you mark it as done/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Choose'));
    expect(alerta).toHaveBeenCalledWith(
      'Choose Luis?',
      expect.stringMatching(/Luis gets CHF\s40\.00 when you mark the job as done.*can't cancel after choosing/),
      expect.any(Array)
    );
    await confirmar(alerta, 'Choose');

    expect(mockedApi.elegirOfertaPagada).toHaveBeenCalledWith('s1', 'luis');
    expect(mockedApi.selectApplicant).not.toHaveBeenCalled();
    expect(mockedApi.pagarOferta).not.toHaveBeenCalled();
    expect(abrir).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('quien aún no ha activado los cobros no se puede elegir', async () => {
    mockedApi.listApplicationsForService.mockResolvedValue([{ ...oferta('luis', 'Luis'), applicant: perfil({ cobrosActivos: false }) }]);
    await renderOfertas();

    expect(await screen.findByText("Can't receive payments yet")).toBeTruthy();
    expect(screen.queryByText('Choose')).toBeNull();
  });

  it('si el servidor no deja elegir, lo explica en el idioma de la app', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.elegirOfertaPagada.mockRejectedValueOnce(Object.assign(new Error('x'), { details: { motivo: 'sinCobros' } }));
    await renderOfertas();

    await fireEvent.press(await screen.findByText('Choose'));
    await confirmar(alerta, 'Choose');

    expect(alerta).toHaveBeenLastCalledWith("Couldn't choose this offer", "This person hasn't set up payouts yet, so they can't be paid.");
    alerta.mockRestore();
  });

  it('antes de elegir se cancela y se devuelve lo pagado', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.cancelarServicio.mockResolvedValueOnce({ reembolsado: 4320 });
    await renderOfertas();

    await fireEvent.press(await screen.findByText('Cancel request'));
    expect(alerta).toHaveBeenCalledWith('Cancel this request?', expect.stringMatching(/you'll get CHF\s43\.20 back/), expect.any(Array));
    mockedApi.getService.mockResolvedValue(
      servicio({ status: 'cancelled', priceCents: 4000, pago: { estado: 'reembolsado', precio: 4000, comision: 320, total: 4320 } })
    );
    await confirmar(alerta, 'Cancel request');

    expect(mockedApi.cancelarServicio).toHaveBeenCalledWith('s1');
    expect(alerta).toHaveBeenCalledWith(expect.stringMatching(/Request cancelled\. CHF\s43\.20 will be refunded to your card/));
    expect(await screen.findByText(/This request was cancelled\. CHF\s43\.20 refunded to you/)).toBeTruthy();
    expect(screen.queryByText('Cancel request')).toBeNull();
    expect(screen.queryByText('Choose')).toBeNull();
    alerta.mockRestore();
  });

  it('una vez elegido ya no se puede cancelar', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'accepted', priceCents: 4000, helperId: 'luis', helperName: 'Luis', ...retenido }));
    await renderOfertas();

    expect(await screen.findByText(/CHF\s43\.20 paid and held: Luis gets CHF\s40\.00 when you mark it as done/)).toBeTruthy();
    expect(screen.queryByText('Cancel request')).toBeNull();
  });

  it('si se devolvió el dinero o la transferencia falló, lo dice (no «retenido»)', async () => {
    mockedApi.getService.mockResolvedValue(
      servicio({ status: 'rated', priceCents: 4000, helperId: 'luis', helperName: 'Luis', pago: { estado: 'reembolsado', precio: 4000, comision: 320, total: 4320 } })
    );
    await renderOfertas();
    expect(await screen.findByText(/CHF\s43\.20 refunded to you\./)).toBeTruthy();
  });

  it('si hay que volver a pagar, lo explica y abre el enlace de Stripe', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockedApi.getService.mockResolvedValue(
      servicio({
        status: 'rated', priceCents: 4000, helperId: 'luis', helperName: 'Luis',
        pago: { estado: 'reembolsado', precio: 4000, comision: 320, total: 4320, porPagar: true },
      })
    );
    mockedApi.misPagos.mockResolvedValueOnce([
      { serviceId: 's1', rol: 'pagado', estado: 'pendiente', importe: 4320, precio: 4000, comision: 320, titulo: 'Subir un sofá', otraPersona: 'Luis', fecha: 1, urlPago: 'https://checkout.stripe.com/c/pay/cs_2' },
    ]);
    await renderOfertas();

    expect(await screen.findByText(/Your payment was refunded, so Luis hasn’t been paid yet\. Pay CHF\s43\.20 again/)).toBeTruthy();
    expect(screen.queryByText(/refunded to you/)).toBeNull();
    await fireEvent.press(screen.getByText(/^Pay CHF\s43\.20$/));

    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_2'));
    abrir.mockRestore();
  });

  it('si el enlace para volver a pagar ya no vale, lo dice', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.getService.mockResolvedValue(
      servicio({
        status: 'rated', priceCents: 4000, helperId: 'luis', helperName: 'Luis',
        pago: { estado: 'reembolsado', precio: 4000, comision: 320, total: 4320, porPagar: true },
      })
    );
    mockedApi.misPagos.mockResolvedValueOnce([]);
    await renderOfertas();

    await fireEvent.press(await screen.findByText(/^Pay CHF\s43\.20$/));

    await waitFor(() => expect(alerta).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(/link has expired/)));
    alerta.mockRestore();
  });

  it('con la transferencia fallida avisa de que se está revisando', async () => {
    mockedApi.getService.mockResolvedValue(
      servicio({ status: 'rated', priceCents: 4000, helperId: 'luis', helperName: 'Luis', pago: { estado: 'error', precio: 4000, comision: 320, total: 4320 } })
    );
    await renderOfertas();
    expect(await screen.findByText(/problem releasing the payment/)).toBeTruthy();
  });

  it('ya terminado dice que se pagó a quien ayudó', async () => {
    mockedApi.getService.mockResolvedValue(
      servicio({ status: 'rated', priceCents: 4000, helperId: 'luis', helperName: 'Luis', pago: { estado: 'pagado', precio: 4000, comision: 320, total: 4320 } })
    );
    await renderOfertas();

    expect(await screen.findByText(/CHF\s40\.00 paid to Luis\./)).toBeTruthy();
  });
});
