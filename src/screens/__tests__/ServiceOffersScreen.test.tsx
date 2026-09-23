import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ServiceOffersScreen from '../ServiceOffersScreen';
import { api, type Application } from '../../firebase/data';
import { servicio } from '../../test-utils/servicio';

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
  mockedApi.getService.mockResolvedValue(servicio({ title: 'Pintar pared', status: 'approved' }));
  mockedApi.listApplicationsForService.mockResolvedValue([oferta('luis', 'Luis'), oferta('marta', 'Marta')]);
});

describe('ServiceOffersScreen', () => {
  it('enseña las ofertas recibidas con su comentario', async () => {
    await renderOfertas();

    expect(await screen.findByText('Luis')).toBeTruthy();
    expect(screen.getByText('“Soy Marta”')).toBeTruthy();
    expect(screen.getByText('2 offers')).toBeTruthy();
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

  it('se marca como completado tras confirmar', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.getService.mockResolvedValue(servicio({ status: 'accepted', helperId: 'luis', helperName: 'Luis' }));
    await renderOfertas();

    await fireEvent.press(await screen.findByText('Mark as completed'));
    await confirmar(alerta, 'Completed');

    expect(mockedApi.completeService).toHaveBeenCalledWith('s1');
    alerta.mockRestore();
  });

  it('completado ya no deja completarlo otra vez', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'completed', helperId: 'luis', helperName: 'Luis' }));
    await renderOfertas();

    expect(await screen.findByText('Completed with Luis')).toBeTruthy();
    expect(screen.queryByText('Mark as completed')).toBeNull();
  });

  it('pendiente de revisión explica que aún no llegan ofertas', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'pending' }));
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

    await waitFor(() => expect(alerta).toHaveBeenCalledWith("Couldn't choose this offer", 'No tienes permiso para hacer esto.'));
    alerta.mockRestore();
  });

  it('vuelve atrás', async () => {
    const navigation = await renderOfertas();

    await fireEvent.press(screen.getByLabelText('Back'));

    expect(navigation.goBack).toHaveBeenCalled();
  });
});
