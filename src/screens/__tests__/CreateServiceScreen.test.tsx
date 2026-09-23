import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import CreateServiceScreen from '../CreateServiceScreen';
import { api } from '../../firebase/data';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 47.37, longitude: 8.54 } })),
  Accuracy: { Balanced: 3 },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function renderScreen() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  return render(<CreateServiceScreen navigation={navigation as never} route={{ key: 'k', name: 'CreateService' } as never} />).then(
    () => navigation
  );
}

/**
 * Pulsa "Add a photo" y elige la opción indicada en el Alert. Devuelve todas
 * las alertas mostradas por el camino (p. ej. la de permiso denegado).
 */
async function anadirFoto(opcion: 'Take photo' | 'Choose from library') {
  const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
  const botones = alerta.mock.calls.at(-1)![2]!;
  // La opción del Alert actualiza el estado al volver del selector: dentro de act.
  await act(async () => {
    await botones.find((b) => b.text === opcion)!.onPress!();
  });
  const mostradas = alerta.mock.calls.map(([titulo, mensaje]) => [titulo, mensaje]);
  alerta.mockRestore();
  return mostradas;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getMe.mockResolvedValue({ id: 'uid-1', name: 'Ana' } as never);
  mockedApi.createService.mockResolvedValue({} as never);
  mockedApi.uploadServicePhoto.mockImplementation(async (uri: string) => `https://storage/${uri}`);
});

describe('CreateServiceScreen', () => {
  it('ya no pide créditos', async () => {
    await renderScreen();

    expect(screen.queryByText('Credits')).toBeNull();
  });

  it('pide título antes de enviar', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();

    await fireEvent.press(screen.getByText('Submit for review'));

    expect(alerta).toHaveBeenCalledWith('Add a title', expect.any(String));
    expect(mockedApi.createService).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('publica con fotos, coordenadas y créditos a cero', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'foto-1.jpg' }] });
    const navigation = await renderScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Need help moving a wardrobe'), 'Pintar pared');
    await anadirFoto('Take photo');
    await fireEvent.press(screen.getByText('Submit for review'));

    await waitFor(() => expect(mockedApi.createService).toHaveBeenCalled());
    expect(mockedApi.createService).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Pintar pared',
        credits: 0,
        photos: ['https://storage/foto-1.jpg'],
        coords: { latitude: 47.37, longitude: 8.54 },
      })
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('elige fotos de la galería', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'galeria.jpg' }] });
    await renderScreen();

    await anadirFoto('Choose from library');

    expect(screen.getByLabelText('Photo, long press to remove')).toBeTruthy();
  });

  it.each([
    ['Take photo', 'requestCameraPermissionsAsync', 'Allow camera access to take a photo.'],
    ['Choose from library', 'requestMediaLibraryPermissionsAsync', 'Allow photo access to pick a picture.'],
  ] as const)('explica qué permiso falta si se deniega (%s)', async (opcion, permiso, mensaje) => {
    (ImagePicker[permiso] as jest.Mock).mockResolvedValueOnce({ granted: false });
    await renderScreen();

    const mostradas = await anadirFoto(opcion);

    expect(mostradas).toContainEqual(['Permission needed', mensaje]);
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('no añade nada si se cancela el selector', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });
    await renderScreen();

    await anadirFoto('Take photo');

    expect(screen.queryByLabelText('Photo, long press to remove')).toBeNull();
  });

  it('quita una foto con pulsación larga', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'foto-1.jpg' }] });
    await renderScreen();
    await anadirFoto('Take photo');

    await fireEvent(screen.getByLabelText('Photo, long press to remove'), 'longPress');

    expect(screen.queryByLabelText('Photo, long press to remove')).toBeNull();
  });

  it('publica sin coordenadas si el GPS falla', async () => {
    (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(new Error('sin señal'));
    await renderScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Need help moving a wardrobe'), 'Pasear perro');
    await fireEvent.press(screen.getByText('Submit for review'));

    await waitFor(() => expect(mockedApi.createService).toHaveBeenCalledWith(expect.objectContaining({ coords: null })));
  });

  it('se cierra sin publicar', async () => {
    const navigation = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Close'));

    expect(navigation.goBack).toHaveBeenCalled();
    expect(mockedApi.createService).not.toHaveBeenCalled();
  });

  it('publica sin coordenadas si no hay permiso de ubicación', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    await renderScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Need help moving a wardrobe'), 'Pasear perro');
    await fireEvent.press(screen.getByText('Submit for review'));

    await waitFor(() => expect(mockedApi.createService).toHaveBeenCalledWith(expect.objectContaining({ coords: null })));
  });

  it('no sube fotos si la base de datos no responde', async () => {
    mockedApi.getMe.mockRejectedValue(new Error('Failed to get document because the client is offline.'));
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'foto-1.jpg' }] });
    await renderScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Need help moving a wardrobe'), 'Pintar pared');
    await anadirFoto('Take photo');
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent.press(screen.getByText('Submit for review'));

    await waitFor(() =>
      expect(alerta).toHaveBeenCalledWith(
        "Couldn't submit your service",
        'No se pudo conectar con el servidor. Inténtalo de nuevo en un momento.'
      )
    );
    expect(mockedApi.uploadServicePhoto).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('borra las fotos ya subidas si el alta falla', async () => {
    mockedApi.createService.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'foto-1.jpg' }] });
    await renderScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Need help moving a wardrobe'), 'Pintar pared');
    await anadirFoto('Take photo');
    const alerta2 = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent.press(screen.getByText('Submit for review'));

    await waitFor(() => expect(mockedApi.deleteServicePhoto).toHaveBeenCalledWith('https://storage/foto-1.jpg'));
    expect(alerta2).toHaveBeenCalledWith("Couldn't submit your service", 'No tienes permiso para hacer esto.');
    alerta2.mockRestore();
  });
});
