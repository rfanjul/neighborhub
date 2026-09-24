import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import WallScreen from '../WallScreen';
import { api } from '../../firebase/data';
import { useAuth } from '../../auth/AuthContext';
import { authValue } from '../../test-utils/renderWithAuth';
import { servicio } from '../../test-utils/servicio';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (efecto: () => void) => require('react').useEffect(efecto, []),
}));
jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedApi = api as jest.Mocked<typeof api>;

async function renderMuro(auth = {}) {
  (useAuth as jest.Mock).mockReturnValue(authValue(auth));
  const navigation = { navigate: jest.fn() };
  await render(<WallScreen navigation={navigation as never} route={{} as never} />);
  return navigation;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getMe.mockResolvedValue({ credits: 42 } as never);
  mockedApi.listServices.mockResolvedValue([
    servicio({ id: 'a', title: 'Pintar una pared' }),
    servicio({ id: 'b', title: 'Pasear a Toby', category: 'dog', requester: { ...servicio().requester, name: 'Luis' } }),
  ]);
});

describe('WallScreen', () => {
  it('saluda a quien ha entrado, no al usuario de ejemplo', async () => {
    await renderMuro({ profile: { name: 'Ruben Fanjul' } });

    expect(screen.getByText('Hi, Ruben 👋')).toBeTruthy();
    expect(screen.queryByText(/Anna/)).toBeNull();
  });

  it('usa el nombre del acceso si aún no hay perfil', async () => {
    await renderMuro({ user: { displayName: 'Ruben Fanjul' }, profile: null });

    expect(screen.getByText('Hi, Ruben 👋')).toBeTruthy();
  });

  it('enseña los servicios y los créditos reales', async () => {
    await renderMuro();

    expect(await screen.findByText('Pasear a Toby')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.queryByText(/Showing demo data/)).toBeNull();
  });

  it('filtra por título, categoría o persona', async () => {
    await renderMuro();
    await screen.findByText('Pasear a Toby');

    await fireEvent.changeText(screen.getByPlaceholderText('Search requests...'), 'luis');

    expect(screen.getByText('Pasear a Toby')).toBeTruthy();
    expect(screen.queryByText('Pintar una pared')).toBeNull();
  });

  it('dice qué búsqueda no encontró nada', async () => {
    await renderMuro();
    await screen.findByText('Pasear a Toby');

    await fireEvent.changeText(screen.getByPlaceholderText('Search requests...'), 'fontanero');

    expect(screen.getByText('No requests match "fontanero".')).toBeTruthy();
  });

  it('con el muro vacío invita a publicar en vez de hablar de búsquedas', async () => {
    mockedApi.listServices.mockResolvedValue([]);
    await renderMuro();

    expect(await screen.findByText('No requests nearby yet. Be the first to ask for help!')).toBeTruthy();
  });

  it('si Firestore no responde avisa de que son datos de ejemplo', async () => {
    mockedApi.listServices.mockRejectedValue(new Error('offline'));
    await renderMuro();

    expect(await screen.findByText(/Showing demo data/)).toBeTruthy();
  });

  it('abre el detalle al tocar un servicio', async () => {
    const navigation = await renderMuro();

    await fireEvent.press(await screen.findByText('Pasear a Toby'));

    expect(navigation.navigate).toHaveBeenCalledWith('ServiceDetail', { serviceId: 'b' });
  });
});
