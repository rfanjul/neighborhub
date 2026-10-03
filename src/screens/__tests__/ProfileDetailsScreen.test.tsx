import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ProfileDetailsScreen from '../ProfileDetailsScreen';
import { api } from '../../firebase/data';
import { useAuth } from '../../auth/AuthContext';
import { authValue } from '../../test-utils/renderWithAuth';

jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedApi = api as jest.Mocked<typeof api>;

/** Un perfil con todo lo obligatorio bien puesto. */
const completo = { name: 'Ruben', dateOfBirth: '08/07/1979', city: 'Zürich', postalCode: '8048', languages: 'English' };

async function renderDatos(overrides = {}, params?: { motivo?: 'publicar' | 'ofrecer' }) {
  const auth = authValue(overrides);
  (useAuth as jest.Mock).mockReturnValue(auth);
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(<ProfileDetailsScreen navigation={navigation as never} route={{ key: 'k', name: 'ProfileDetails', params } as never} />);
  return { auth, navigation };
}

beforeEach(() => jest.clearAllMocks());

describe('ProfileDetailsScreen', () => {
  it('precarga el nombre del acceso si aún no hay perfil', async () => {
    await renderDatos({ user: { displayName: 'Ruben Fanjul' } as never, profile: null });

    expect(screen.getByDisplayValue('Ruben Fanjul')).toBeTruthy();
  });

  it('precarga lo que ya está guardado en Firestore', async () => {
    await renderDatos({
      profile: { name: 'Ruben', city: 'Zurich', postalCode: '8048', bio: 'Hola', dateOfBirth: '08/07/1979', languages: 'German, Spanish' } as never,
    });

    expect(screen.getByDisplayValue('Zurich')).toBeTruthy();
    expect(screen.getByDisplayValue('8048')).toBeTruthy();
    expect(screen.getByDisplayValue('Hola')).toBeTruthy();
    // La fecha de nacimiento viene de los datos privados (privado/{uid}).
    expect(screen.getByDisplayValue('08/07/1979')).toBeTruthy();
    expect(screen.getByLabelText('Spanish').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('English').props.accessibilityState.checked).toBe(false);
  });

  it('los idiomas se marcan y desmarcan, sin inventarse entradas', async () => {
    await renderDatos({ profile: { ...completo, languages: 'English' } as never });

    await fireEvent.press(screen.getByLabelText('French'));
    await fireEvent.press(screen.getByLabelText('English'));
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockedApi.updateMe).toHaveBeenCalledWith(expect.objectContaining({ languages: 'French' })));
  });

  it('guarda, refresca el perfil y vuelve atrás', async () => {
    const { auth, navigation } = await renderDatos({ profile: completo as never });

    await fireEvent.changeText(screen.getByPlaceholderText('Zürich'), '  Zurich ');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(mockedApi.updateMe).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ruben', city: 'Zurich', dateOfBirth: '08/07/1979', postalCode: '8048', onboardingCompleted: true })
    );
    expect(auth.refreshProfile).toHaveBeenCalled();
  });

  it('guarda la fecha de nacimiento escrita', async () => {
    await renderDatos({ profile: { ...completo, dateOfBirth: null } as never });

    // Solo cifras: las barras se ponen solas.
    await fireEvent.changeText(screen.getByPlaceholderText('DD / MM / YYYY'), '08071979');
    expect(screen.getByDisplayValue('08/07/1979')).toBeTruthy();
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockedApi.updateMe).toHaveBeenCalledWith(expect.objectContaining({ dateOfBirth: '08/07/1979' })));
  });

  it('avisa si no se puede guardar y no se va de la pantalla', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.updateMe.mockRejectedValueOnce(new Error('sin conexión'));
    const { navigation } = await renderDatos({ profile: completo as never });

    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(alerta).toHaveBeenCalledWith("Couldn't save your profile", 'sin conexión'));
    expect(navigation.goBack).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('todo es obligatorio: sin fecha, ciudad ni código postal no guarda y dice qué falta', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { navigation } = await renderDatos({ profile: { name: 'Ruben', languages: 'English' } as never });

    await fireEvent.press(screen.getByText('Save'));

    expect(alerta).toHaveBeenCalledWith('Check your details', expect.stringMatching(/marked in red/));
    expect(screen.getByText('Use a real date: DD/MM/YYYY.')).toBeTruthy();
    expect(screen.getByText('Write your city (letters only).')).toBeTruthy();
    expect(screen.getByText('A Swiss postal code has 4 digits.')).toBeTruthy();
    expect(mockedApi.updateMe).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it.each([
    ['una fecha que no existe', { dateOfBirth: '31/02/1990' }, 'Use a real date: DD/MM/YYYY.'],
    ['menos de 16 años', { dateOfBirth: '01/01/2020' }, 'You need to be at least 16 to use Neighborhub.'],
    ['un nombre con cifras', { name: 'R2D2' }, 'Write your name (letters only).'],
    ['una ciudad con cifras', { city: '8048' }, 'Write your city (letters only).'],
    ['un código postal de 3 cifras', { postalCode: '804' }, 'A Swiss postal code has 4 digits.'],
  ])('no guarda %s', async (_caso, cambio, mensaje) => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderDatos({ profile: { ...completo, ...cambio } as never });

    await fireEvent.press(screen.getByText('Save'));

    expect(screen.getByText(mensaje)).toBeTruthy();
    expect(mockedApi.updateMe).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('sin ningún idioma marcado no guarda', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderDatos({ profile: completo as never });

    await fireEvent.press(screen.getByLabelText('English'));
    await fireEvent.press(screen.getByText('Save'));

    expect(screen.getByText('Choose at least one language.')).toBeTruthy();
    expect(mockedApi.updateMe).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('el error se quita al corregirlo', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderDatos({ profile: { ...completo, postalCode: '' } as never });

    await fireEvent.press(screen.getByText('Save'));
    expect(screen.getByText('A Swiss postal code has 4 digits.')).toBeTruthy();
    // Las letras no entran en el código postal.
    await fireEvent.changeText(screen.getByPlaceholderText('8004'), '80a48');
    expect(screen.getByDisplayValue('8048')).toBeTruthy();
    expect(screen.queryByText('A Swiss postal code has 4 digits.')).toBeNull();
    alerta.mockRestore();
  });

  it('si viene de publicar u ofrecer, explica por qué hay que completarlo', async () => {
    await renderDatos({ profile: { name: 'Ruben' } as never }, { motivo: 'publicar' });

    expect(screen.getByText(/To post a request we need your name, date of birth, city, postal code and languages/)).toBeTruthy();
  });

  it('cancelar vuelve sin guardar', async () => {
    const { navigation } = await renderDatos({ profile: { name: 'Ruben' } as never });

    await fireEvent.press(screen.getByText('Cancel'));

    expect(navigation.goBack).toHaveBeenCalled();
    expect(mockedApi.updateMe).not.toHaveBeenCalled();
  });
});
