import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import MapScreen from '../MapScreen';
import { api } from '../../firebase/data';
import { servicio } from '../../test-utils/servicio';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (efecto: () => void) => require('react').useEffect(efecto, []),
}));

const mockedApi = api as jest.Mocked<typeof api>;

// Yo, en la estación central de Zúrich.
const aqui = { latitude: 47.3779, longitude: 8.5403 };
const cerca = servicio({ id: 'cerca', title: 'Pintar pared', coords: { latitude: 47.3667, longitude: 8.5449 } }); // 1.3 km
const lejos = servicio({ id: 'lejos', title: 'Mudanza en Winterthur', coords: { latitude: 47.4997, longitude: 8.7241 } }); // ~19 km
const sinSitio = servicio({ id: 'sin', title: 'Sin coordenadas', coords: null });

async function renderMapa() {
  const navigation = { navigate: jest.fn() };
  await render(<MapScreen navigation={navigation as never} route={{} as never} />);
  return navigation;
}

function conUbicacion() {
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({ coords: aqui });
}

beforeEach(() => {
  jest.clearAllMocks();
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  mockedApi.listServices.mockResolvedValue([cerca, lejos, sinSitio]);
});

describe('MapScreen', () => {
  it('pone en el mapa los servicios que tienen coordenadas', async () => {
    await renderMapa();

    expect(await screen.findByTestId('marcador-cerca')).toBeTruthy();
    expect(screen.getByTestId('marcador-lejos')).toBeTruthy();
    expect(screen.queryByTestId('marcador-sin')).toBeNull();
  });

  it('con ubicación filtra por el radio elegido', async () => {
    conUbicacion();
    await renderMapa();

    await waitFor(() => expect(screen.queryByTestId('marcador-lejos')).toBeNull());
    expect(screen.getByTestId('marcador-cerca')).toBeTruthy();

    await fireEvent.press(screen.getByText('10 km'));
    expect(screen.queryByTestId('marcador-lejos')).toBeNull();
  });

  it('avisa si en el radio no hay nada', async () => {
    conUbicacion();
    await renderMapa();
    await screen.findByTestId('marcador-cerca');

    await fireEvent.press(screen.getByText('1 km'));

    expect(screen.getByText('No services within 1 km.')).toBeTruthy();
  });

  it('avisa si aún no hay servicios con ubicación', async () => {
    mockedApi.listServices.mockResolvedValue([sinSitio]);
    await renderMapa();

    expect(await screen.findByText('No services with a location yet.')).toBeTruthy();
  });

  it('avisa si no se pudieron cargar', async () => {
    mockedApi.listServices.mockRejectedValue(new Error('offline'));
    await renderMapa();

    expect(await screen.findByText(/Couldn't load services/)).toBeTruthy();
  });

  it('al tocar un marcador enseña el servicio con su distancia y lleva al detalle', async () => {
    conUbicacion();
    const navigation = await renderMapa();

    await waitFor(() => expect(screen.queryByTestId('marcador-lejos')).toBeNull());
    await fireEvent.press(screen.getByTestId('marcador-cerca'));

    expect(screen.getByText('Pintar pared')).toBeTruthy();
    expect(screen.getByText('1.3 km away · Ana')).toBeTruthy();

    await fireEvent.press(screen.getByText('Pintar pared'));
    expect(navigation.navigate).toHaveBeenCalledWith('ServiceDetail', { serviceId: 'cerca' });
  });

  it('tocar el mapa fuera de un marcador cierra la tarjeta', async () => {
    await renderMapa();
    await fireEvent.press(await screen.findByTestId('marcador-cerca'));
    expect(screen.getByText('Pintar pared')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('mapa'));

    expect(screen.queryByText('Pintar pared')).toBeNull();
  });

  it('sin ubicación la tarjeta no inventa una distancia', async () => {
    await renderMapa();

    await fireEvent.press(await screen.findByTestId('marcador-cerca'));

    expect(screen.getByText('Ana')).toBeTruthy();
  });
});
