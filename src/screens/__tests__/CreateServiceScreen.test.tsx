import React from 'react';
import { Alert } from 'react-native';
import { Linking } from 'react-native';
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

function renderScreen(serviceId?: string) {
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() };
  const route = { key: 'k', name: 'CreateService', params: serviceId ? { serviceId } : undefined };
  return render(<CreateServiceScreen navigation={navigation as never} route={route as never} />).then(() => navigation);
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
  it('ya no pide créditos y por defecto es un favor gratis', async () => {
    await renderScreen();

    expect(screen.queryByText('Credits')).toBeNull();
    expect(screen.getByText('A favor between neighbors: nobody pays anything.')).toBeTruthy();
  });

  it('con precio se paga al enviarlo: lo crea, abre Stripe y deja ver el servicio', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockedApi.createService.mockResolvedValue({ id: 'nuevo' } as never);
    const navigation = await renderScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Need help moving a wardrobe'), 'Subir un sofá');
    await fireEvent.press(screen.getByText('Paid'));
    await fireEvent.changeText(screen.getByLabelText('Price'), '40');

    expect(screen.getByText(/You'll pay CHF\s43\.20 now: CHF\s40\.00 for your neighbor plus a CHF\s3\.20 service fee/)).toBeTruthy();
    expect(screen.getByText(/Cancel before choosing someone and you get it all back/)).toBeTruthy();
    await fireEvent.press(screen.getByText(/^Pay CHF\s43\.20 and submit$/));

    await waitFor(() => expect(mockedApi.createService).toHaveBeenCalledWith(expect.objectContaining({ priceCents: 4000 })));
    expect(navigation.replace).toHaveBeenCalledWith('ServiceOffers', { serviceId: 'nuevo' });
    expect(mockedApi.pagarServicio).toHaveBeenCalledWith('nuevo');
    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_crear'));
    expect(navigation.goBack).not.toHaveBeenCalled();
    abrir.mockRestore();
  });

  it('si no se puede abrir el pago, el servicio queda creado y explica cómo pagarlo luego', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.createService.mockResolvedValue({ id: 'nuevo' } as never);
    mockedApi.pagarServicio.mockRejectedValueOnce(new Error('sin red'));
    const navigation = await renderScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Need help moving a wardrobe'), 'Subir un sofá');
    await fireEvent.press(screen.getByText('Paid'));
    await fireEvent.changeText(screen.getByLabelText('Price'), '40');
    await fireEvent.press(screen.getByText(/^Pay CHF/));

    await waitFor(() =>
      expect(alerta).toHaveBeenCalledWith("Couldn't start the payment", expect.stringMatching(/pay it later from Activity → My services/))
    );
    expect(navigation.replace).toHaveBeenCalledWith('ServiceOffers', { serviceId: 'nuevo' });
    alerta.mockRestore();
  });

  it('gratis no pide pago', async () => {
    const navigation = await renderScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Need help moving a wardrobe'), 'Pasear a Toby');
    await fireEvent.press(screen.getByText('Submit for review'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(mockedApi.pagarServicio).not.toHaveBeenCalled();
  });

  it('acepta coma decimal y la gestión mínima es CHF 1', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByText('Paid'));
    await fireEvent.changeText(screen.getByLabelText('Price'), '12,50');

    expect(screen.getByText(/You'll pay CHF\s13\.50 now: CHF\s12\.50 for your neighbor plus a CHF\s1\.00 service fee/)).toBeTruthy();
  });

  it.each(['', '3', '2000', 'abc'])('con precio "%s" no publica y explica el rango', async (texto) => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Need help moving a wardrobe'), 'Subir un sofá');
    await fireEvent.press(screen.getByText('Paid'));
    await fireEvent.changeText(screen.getByLabelText('Price'), texto);
    await fireEvent.press(screen.getByText('Submit for review'));

    expect(alerta).toHaveBeenCalledWith('Check the price', expect.stringMatching(/Between CHF\s5 and CHF\s1,000/));
    expect(mockedApi.createService).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('pide título antes de enviar', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();

    await fireEvent.press(screen.getByText('Submit for review'));

    expect(alerta).toHaveBeenCalledWith('Add a title', expect.any(String));
    expect(mockedApi.createService).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('publica con fotos, coordenadas y gratis', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'foto-1.jpg' }] });
    const navigation = await renderScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Need help moving a wardrobe'), 'Pintar pared');
    await anadirFoto('Take photo');
    await fireEvent.press(screen.getByText('Submit for review'));

    await waitFor(() => expect(mockedApi.createService).toHaveBeenCalled());
    expect(mockedApi.createService).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Pintar pared',
        priceCents: null,
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
        "Couldn't reach the server. Please try again in a moment."
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
    expect(alerta2).toHaveBeenCalledWith("Couldn't submit your service", "You don't have permission to do this.");
    alerta2.mockRestore();
  });
});

describe('editar un servicio', () => {
  const existente = {
    id: 's1',
    title: 'Pintar pared',
    category: 'painting',
    description: 'Del salón',
    durationLabel: '—',
    photos: ['https://storage/vieja-1.jpg', 'https://storage/vieja-2.jpg'],
    status: 'pending',
    priceCents: null,
  };

  beforeEach(() => {
    mockedApi.getService.mockResolvedValue(existente as never);
    mockedApi.updateService.mockResolvedValue(existente as never);
  });

  it('carga los datos actuales y cambia los textos de la pantalla', async () => {
    await renderScreen('s1');

    expect(await screen.findByDisplayValue('Pintar pared')).toBeTruthy();
    expect(screen.getByDisplayValue('Del salón')).toBeTruthy();
    expect(screen.getByText('Edit service')).toBeTruthy();
    expect(screen.getByText('Save changes')).toBeTruthy();
    expect(screen.queryByText(/An admin will review/)).toBeNull();
    expect(screen.getAllByLabelText('Photo, long press to remove')).toHaveLength(2);
  });

  it('guarda los cambios sin volver a subir las fotos que ya estaban', async () => {
    const navigation = await renderScreen('s1');
    await screen.findByDisplayValue('Pintar pared');

    await fireEvent.changeText(screen.getByDisplayValue('Pintar pared'), 'Pintar dos paredes');
    await fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(mockedApi.uploadServicePhoto).not.toHaveBeenCalled();
    expect(mockedApi.createService).not.toHaveBeenCalled();
    expect(mockedApi.updateService).toHaveBeenCalledWith('s1', {
      title: 'Pintar dos paredes',
      category: 'painting',
      description: 'Del salón',
      durationLabel: '—',
      photos: ['https://storage/vieja-1.jpg', 'https://storage/vieja-2.jpg'],
      priceCents: null,
    });
  });

  it('mientras está pendiente se le puede poner o cambiar el precio', async () => {
    const navigation = await renderScreen('s1');
    await screen.findByDisplayValue('Pintar pared');

    await fireEvent.press(screen.getByText('Paid'));
    await fireEvent.changeText(screen.getByLabelText('Price'), '55');
    await fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(mockedApi.updateService.mock.calls[0][1].priceCents).toBe(5500);
  });

  it('publicado ya no deja tocar el precio, y al guardar no lo envía', async () => {
    mockedApi.getService.mockResolvedValue({ ...existente, status: 'approved', priceCents: 3000 } as never);
    const navigation = await renderScreen('s1');

    expect(await screen.findByDisplayValue('30')).toBeTruthy();
    expect(screen.getByLabelText('Price').props.editable).toBe(false);
    expect(screen.getByText(/can't change once the request is published/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(mockedApi.updateService.mock.calls[0][1]).not.toHaveProperty('priceCents');
  });

  it('sube solo las fotos nuevas y borra de Storage las que se quitaron', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'nueva.jpg' }] });
    await renderScreen('s1');
    await screen.findByDisplayValue('Pintar pared');

    await fireEvent(screen.getAllByLabelText('Photo, long press to remove')[0], 'longPress');
    await anadirFoto('Take photo');
    await fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(mockedApi.updateService).toHaveBeenCalled());
    expect(mockedApi.uploadServicePhoto).toHaveBeenCalledWith('nueva.jpg');
    expect(mockedApi.updateService.mock.calls[0][1].photos).toEqual(['https://storage/vieja-2.jpg', 'https://storage/nueva.jpg']);
    expect(mockedApi.deleteServicePhoto).toHaveBeenCalledWith('https://storage/vieja-1.jpg');
  });

  it('si no se puede guardar, avisa y borra las fotos nuevas que llegó a subir', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.updateService.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' }));
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'nueva.jpg' }] });
    await renderScreen('s1');
    await screen.findByDisplayValue('Pintar pared');
    await anadirFoto('Take photo');
    const alerta2 = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(alerta2).toHaveBeenCalledWith("Couldn't save your changes", "You don't have permission to do this."));
    expect(mockedApi.deleteServicePhoto).toHaveBeenCalledWith('https://storage/nueva.jpg');
    expect(mockedApi.deleteServicePhoto).not.toHaveBeenCalledWith('https://storage/vieja-1.jpg');
    alerta.mockRestore();
    alerta2.mockRestore();
  });

  it('avisa si no puede cargar el servicio', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.getService.mockRejectedValueOnce(new Error('offline'));
    await renderScreen('s1');

    await waitFor(() => expect(alerta).toHaveBeenCalledWith("Couldn't load the service", expect.any(String)));
    alerta.mockRestore();
  });
});
