import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ActivityScreen from '../ActivityScreen';
import { api, type Application } from '../../firebase/data';
import { servicio } from '../../test-utils/servicio';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (efecto: () => void) => require('react').useEffect(efecto, []),
}));

const mockedApi = api as jest.Mocked<typeof api>;

const oferta = (overrides: Partial<Application> = {}): Application => ({
  id: 'x_uid',
  serviceId: 'x',
  serviceTitle: 'Pasear a Toby',
  applicantId: 'uid',
  applicantName: 'Ruben',
  requesterId: 'luis',
  comment: 'Me encantan los perros',
  status: 'pending',
  ...overrides,
});

async function renderActividad(segmento?: 'services' | 'offers') {
  const navigation = { navigate: jest.fn() };
  await render(<ActivityScreen navigation={navigation as never} route={{ params: segmento ? { segmento } : undefined } as never} />);
  return navigation;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.listMyServices.mockResolvedValue([
    servicio({ id: 'p', title: 'Pintar pared', status: 'pending' }),
    servicio({ id: 'a', title: 'Montar armario', status: 'accepted', helperName: 'Marta' }),
  ]);
  mockedApi.listMyApplications.mockResolvedValue([
    oferta(),
    oferta({ id: 'y_uid', serviceId: 'y', serviceTitle: 'Hacer la compra', status: 'selected' }),
    oferta({ id: 'z_uid', serviceId: 'z', serviceTitle: 'Mudanza', status: 'rejected' }),
  ]);
});

describe('My services', () => {
  it('lista mis servicios con su estado y quién ayuda', async () => {
    await renderActividad();

    expect(await screen.findByText('Pintar pared')).toBeTruthy();
    expect(screen.getByText('Pending review')).toBeTruthy();
    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.getByText('with Marta')).toBeTruthy();
  });

  it('abre las ofertas recibidas de un servicio', async () => {
    const navigation = await renderActividad();

    await fireEvent.press(await screen.findByText('Montar armario'));

    expect(navigation.navigate).toHaveBeenCalledWith('ServiceOffers', { serviceId: 'a' });
  });

  it('sin servicios invita a publicar', async () => {
    mockedApi.listMyServices.mockResolvedValue([]);
    await renderActividad();

    expect(await screen.findByText(/haven't published any service/)).toBeTruthy();
  });
});

describe('My offers', () => {
  it('lista mis ofertas con su comentario y estado', async () => {
    await renderActividad('offers');

    expect(await screen.findByText('Pasear a Toby')).toBeTruthy();
    expect(screen.getAllByText('“Me encantan los perros”')).toHaveLength(3);
    expect(screen.getByText('Waiting')).toBeTruthy();
    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByText('Not selected')).toBeTruthy();
  });

  it('solo la seleccionada da acceso al chat', async () => {
    const navigation = await renderActividad('offers');

    const botones = await screen.findAllByText('Open chat');
    expect(botones).toHaveLength(1);

    await fireEvent.press(botones[0]);
    expect(navigation.navigate).toHaveBeenCalledWith('Chat', { serviceId: 'y' });
  });

  it('se llega cambiando de pestaña', async () => {
    await renderActividad();
    await screen.findByText('Pintar pared');

    await fireEvent.press(screen.getByText('My offers'));

    expect(screen.getByText('Pasear a Toby')).toBeTruthy();
  });

  it('sin ofertas explica cómo hacer una', async () => {
    mockedApi.listMyApplications.mockResolvedValue([]);
    await renderActividad('offers');

    expect(await screen.findByText(/haven't made any offer/)).toBeTruthy();
  });
});

it('si fallan las ofertas, los servicios se ven igual', async () => {
  mockedApi.listMyApplications.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
  await renderActividad();

  expect(await screen.findByText('Pintar pared')).toBeTruthy();
  expect(screen.queryByText(/Couldn't load/)).toBeNull();

  await fireEvent.press(screen.getByText('My offers'));
  expect(screen.getByText(/Couldn't load your offers/)).toBeTruthy();
});

it('si fallan los servicios lo dice en su pestaña', async () => {
  mockedApi.listMyServices.mockRejectedValue(new Error('offline'));
  await renderActividad();

  expect(await screen.findByText(/Couldn't load your services/)).toBeTruthy();
});
