import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ServiceDetailScreen, { accionPrincipal } from '../ServiceDetailScreen';
import { api, type Application } from '../../firebase/data';
import { useAuth } from '../../auth/AuthContext';
import { authValue } from '../../test-utils/renderWithAuth';
import { servicio } from '../../test-utils/servicio';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (efecto: () => void) => require('react').useEffect(efecto, []),
}));
jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedApi = api as jest.Mocked<typeof api>;

const oferta = (status: Application['status']): Application => ({
  id: 's1_luis',
  serviceId: 's1',
  serviceTitle: 'Pintar una pared',
  applicantId: 'luis',
  applicantName: 'Luis',
  requesterId: 'ana',
  comment: 'Tengo escalera',
  status,
});

async function renderDetalle(uid = 'luis') {
  (useAuth as jest.Mock).mockReturnValue(authValue({ user: { uid } as never }));
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(
    <ServiceDetailScreen navigation={navigation as never} route={{ key: 'k', name: 'ServiceDetail', params: { serviceId: 's1' } } as never} />
  );
  return navigation;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.listMyApplications.mockResolvedValue([]);
});

describe('qué se puede hacer con un servicio', () => {
  it('ofrecerse solo si está aprobado y es de otro', () => {
    expect(accionPrincipal(servicio({ status: 'approved' }), 'luis', null)).toEqual({ label: 'Apply to help', destino: 'Apply' });
  });

  it.each([
    ['pending', 'Waiting for review'],
    ['accepted', 'No longer taking offers'],
    ['completed', 'No longer taking offers'],
  ] as const)('no ofrecerse si está %s', (status, label) => {
    const accion = accionPrincipal(servicio({ status }), 'luis', null);

    expect(accion.label).toBe(label);
    expect(accion.destino).toBeUndefined();
  });

  it('quien lo publicó ve sus ofertas, aunque siga pendiente', () => {
    expect(accionPrincipal(servicio({ status: 'pending' }), 'ana', null)).toEqual({ label: 'View offers', destino: 'ServiceOffers' });
  });

  it('quien fue elegido abre el chat', () => {
    expect(accionPrincipal(servicio({ status: 'accepted', helperId: 'luis' }), 'luis', oferta('selected'))).toEqual({
      label: 'Open chat',
      destino: 'Chat',
    });
  });

  it('con una oferta ya enviada no se oferta dos veces', () => {
    expect(accionPrincipal(servicio({ status: 'approved' }), 'luis', oferta('pending'))).toMatchObject({ label: 'Offer sent' });
  });

  it('una oferta rechazada lo dice', () => {
    expect(accionPrincipal(servicio({ status: 'accepted', helperId: 'marta' }), 'luis', oferta('rejected'))).toMatchObject({
      label: 'Offer not selected',
    });
  });
});

describe('ServiceDetailScreen', () => {
  it('carga el servicio y enseña sus datos y fotos', async () => {
    mockedApi.getService.mockResolvedValue(
      servicio({ title: 'Montar un armario', durationLabel: '3 horas', photos: ['https://ej/1.jpg', 'https://ej/2.jpg'] })
    );
    await renderDetalle();

    expect(await screen.findByText('Montar un armario')).toBeTruthy();
    expect(screen.getByText('3 horas')).toBeTruthy();
    expect(screen.getAllByLabelText('Foto de Montar un armario')).toHaveLength(2);
  });

  it('sin créditos no enseña la fila de créditos', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ credits: 0 }));
    await renderDetalle();

    await screen.findByText('Pintar una pared');
    expect(screen.queryByText('Credits requested')).toBeNull();
  });

  it('en uno aprobado lleva a la pantalla de oferta', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'approved' }));
    const navigation = await renderDetalle();

    await fireEvent.press(await screen.findByText('Apply to help'));

    expect(navigation.navigate).toHaveBeenCalledWith('Apply', { serviceId: 's1' });
  });

  it('en uno pendiente el botón no hace nada', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'pending' }));
    const navigation = await renderDetalle();

    await fireEvent.press(await screen.findByText('Waiting for review'));

    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(screen.getByText('Offers open once an admin approves it.')).toBeTruthy();
  });

  it('si ya me ofrecí lo dice en vez de dejar ofertar otra vez', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ status: 'approved' }));
    mockedApi.listMyApplications.mockResolvedValue([oferta('pending')]);
    await renderDetalle();

    expect(await screen.findByText('Offer sent')).toBeTruthy();
  });

  it('si Firestore falla sigue enseñando la versión local', async () => {
    mockedApi.getService.mockRejectedValue(new Error('offline'));
    mockedApi.listMyApplications.mockRejectedValue(new Error('offline'));
    await renderDetalle();

    await waitFor(() => expect(mockedApi.getService).toHaveBeenCalledWith('s1'));
  });

  it('vuelve atrás', async () => {
    mockedApi.getService.mockResolvedValue(servicio());
    const navigation = await renderDetalle();

    await fireEvent.press(screen.getByLabelText('Back'));

    expect(navigation.goBack).toHaveBeenCalled();
  });
});
