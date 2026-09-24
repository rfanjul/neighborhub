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

  it('no filtra por radio: con ubicación siguen saliendo también los lejanos', async () => {
    conUbicacion();
    await renderMapa();

    expect(await screen.findByTestId('marcador-lejos')).toBeTruthy();
    expect(screen.queryByText('1 km')).toBeNull();
  });

  it('la tarjeta enseña la foto del servicio si tiene', async () => {
    mockedApi.listServices.mockResolvedValue([{ ...cerca, photos: ['https://ej/pared.jpg'] }]);
    await renderMapa();

    await fireEvent.press(await screen.findByTestId('marcador-cerca'));

    expect(screen.getByLabelText('Foto de Pintar pared').props.source).toEqual({ uri: 'https://ej/pared.jpg' });
  });

  it('al tocar un marcador enseña el servicio con su distancia y lleva al detalle', async () => {
    conUbicacion();
    const navigation = await renderMapa();

    await waitFor(() => expect(Location.getCurrentPositionAsync).toHaveBeenCalled());
    await fireEvent.press(await screen.findByTestId('marcador-cerca'));

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
