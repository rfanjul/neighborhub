import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { pulsarEnAlerta } from '../../test-utils/alerta';
import NeighborProfileScreen from '../NeighborProfileScreen';
import { api } from '../../firebase/data';
import { servicio } from '../../test-utils/servicio';
import { perfil } from '../../test-utils/perfil';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (efecto: () => void) => require('react').useEffect(efecto, []),
}));

const mockedApi = api as jest.Mocked<typeof api>;

async function renderPerfil() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(<NeighborProfileScreen navigation={navigation as never} route={{ params: { userId: 'luis' } } as never} />);
  return navigation;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getUserProfile.mockResolvedValue(perfil());
  mockedApi.listServicesBy.mockResolvedValue([servicio({ id: 'a' }), servicio({ id: 'b' })]);
});

describe('NeighborProfileScreen', () => {
  it('enseña todos sus datos, cada uno con su valor', async () => {
    await renderPerfil();

    expect(await screen.findByText('Luis')).toBeTruthy();
    expect(mockedApi.getUserProfile).toHaveBeenCalledWith('luis');
    expect(screen.getByText('✓ Verified')).toBeTruthy();
    expect(screen.getByText('Trusted neighbor')).toBeTruthy();
    expect(screen.getByText('4.8 · 21 ratings')).toBeTruthy();
    expect(screen.getByText('27')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('4.8 ★')).toBeTruthy();
    expect(screen.getByText('Carpintero jubilado, tengo de todo en el taller.')).toBeTruthy();
    expect(screen.getByText('German, Spanish')).toBeTruthy();
    expect(screen.getByText('8003 Zürich')).toBeTruthy();
    expect(screen.getByText('< 1h')).toBeTruthy();
    expect(screen.getByText('Jul 2026')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByLabelText('Amateur')).toBeTruthy();
    expect(screen.getByLabelText('Veteran')).toBeTruthy();
    expect(screen.getByLabelText('Exemplary, locked: More than 50 helps')).toBeTruthy();
  });

  it('un vecino recién llegado no deja huecos: cada campo dice algo', async () => {
    mockedApi.getUserProfile.mockResolvedValue(
      perfil({
        bio: null, languages: null, city: null, postalCode: null, responseLabel: '—', memberSince: null,
        identityVerified: false, rating: 0, ratingCount: 0, servicesCompleted: 0, level: 1, levelLabel: 'New neighbor',
      })
    );
    mockedApi.listServicesBy.mockResolvedValue([]);
    await renderPerfil();

    expect(await screen.findByText("Luis hasn't written a bio yet.")).toBeTruthy();
    expect(screen.getAllByText('Not specified')).toHaveLength(3);
    expect(screen.getByText('No data yet')).toBeTruthy();
    expect(screen.getByText('Not verified yet')).toBeTruthy();
    expect(screen.getByText('No ratings yet')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.queryByText('✓ Verified')).toBeNull();
  });

  it('solo la ciudad, sin código postal', async () => {
    mockedApi.getUserProfile.mockResolvedValue(perfil({ postalCode: null, ratingCount: 1, rating: 5 }));
    await renderPerfil();

    expect(await screen.findByText('Zürich')).toBeTruthy();
    expect(screen.getByText('5.0 · 1 rating')).toBeTruthy();
  });

  it('ayudas y valoraciones llevan a sus ayudas con reseñas; servicios, a sus servicios', async () => {
    const navigation = await renderPerfil();

    await fireEvent.press(await screen.findByLabelText("See Luis's helps"));
    expect(navigation.navigate).toHaveBeenLastCalledWith('NeighborList', { userId: 'luis', lista: 'helps', nombre: 'Luis' });

    await fireEvent.press(screen.getByLabelText("See Luis's reviews"));
    expect(navigation.navigate).toHaveBeenLastCalledWith('NeighborList', { userId: 'luis', lista: 'helps', nombre: 'Luis' });

    await fireEvent.press(screen.getByLabelText("See Luis's services"));
    expect(navigation.navigate).toHaveBeenLastCalledWith('NeighborList', { userId: 'luis', lista: 'services', nombre: 'Luis' });
  });

  it('si no se pueden contar los servicios, cuenta cero', async () => {
    mockedApi.listServicesBy.mockRejectedValue(new Error('sin red'));
    await renderPerfil();

    await screen.findByText('Luis');
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('mientras carga no enseña nada a medias', async () => {
    mockedApi.getUserProfile.mockReturnValue(new Promise(() => {}));
    mockedApi.listServicesBy.mockReturnValue(new Promise(() => {}));
    await renderPerfil();

    expect(screen.queryByText('Luis')).toBeNull();
    expect(screen.queryByText("We couldn't find this neighbor.")).toBeNull();
  });

  it.each([
    ['no existe', () => mockedApi.getUserProfile.mockResolvedValue(null)],
    ['no se puede leer', () => mockedApi.getUserProfile.mockRejectedValue(new Error('x'))],
  ])('si el perfil %s lo dice', async (_caso, preparar) => {
    preparar();
    await renderPerfil();

    expect(await screen.findByText("We couldn't find this neighbor.")).toBeTruthy();
  });

  it('se denuncia al vecino desde la app, con un motivo, y se le da las gracias', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderPerfil();

    await fireEvent.press(await screen.findByText(/Report Luis/));
    expect(alerta).toHaveBeenLastCalledWith('Report', expect.stringMatching(/within 24 hours/), expect.any(Array));
    await pulsarEnAlerta(alerta, 'Harassment or threats');

    expect(mockedApi.denunciar).toHaveBeenCalledWith('user', 'luis', 'acoso');
    expect(alerta).toHaveBeenLastCalledWith('Thanks for letting us know', expect.any(String));
    alerta.mockRestore();
  });

  it('bloquear pide confirmación, lo avisa y se puede deshacer', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderPerfil();

    await fireEvent.press(await screen.findByText(/Block Luis/));
    expect(alerta).toHaveBeenLastCalledWith('Block Luis?', expect.stringMatching(/won't be notified/), expect.any(Array));
    await pulsarEnAlerta(alerta, 'Block');

    expect(mockedApi.bloquear).toHaveBeenCalledWith('luis');
    expect(await screen.findByText(/You've blocked Luis/)).toBeTruthy();
    await fireEvent.press(screen.getByText(/Unblock Luis/));
    await waitFor(() => expect(mockedApi.desbloquear).toHaveBeenCalledWith('luis'));
    expect(screen.queryByText(/You've blocked Luis/)).toBeNull();
    alerta.mockRestore();
  });

  it('si ya estaba bloqueado, lo dice al entrar', async () => {
    mockedApi.misBloqueos.mockResolvedValueOnce(['luis']);
    await renderPerfil();

    expect(await screen.findByText(/You've blocked Luis/)).toBeTruthy();
    expect(screen.getByText(/Unblock Luis/)).toBeTruthy();
  });

  it('si no se puede denunciar o bloquear, lo explica', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.denunciar.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' }));
    mockedApi.bloquear.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' }));
    await renderPerfil();

    await fireEvent.press(await screen.findByText(/Report Luis/));
    await pulsarEnAlerta(alerta, 'Spam or scam');
    expect(alerta).toHaveBeenLastCalledWith("Couldn't send the report", expect.any(String));

    await fireEvent.press(screen.getByText(/Block Luis/));
    await pulsarEnAlerta(alerta, 'Block');
    expect(alerta).toHaveBeenLastCalledWith("Couldn't update the block", expect.any(String));
    expect(screen.queryByText(/You've blocked Luis/)).toBeNull();
    alerta.mockRestore();
  });

  it('vuelve atrás', async () => {
    const navigation = await renderPerfil();

    await fireEvent.press(screen.getByLabelText('Back'));

    expect(navigation.goBack).toHaveBeenCalled();
  });
});
