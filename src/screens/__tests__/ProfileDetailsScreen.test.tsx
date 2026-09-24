import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ProfileDetailsScreen from '../ProfileDetailsScreen';
import { api } from '../../firebase/data';
import { useAuth } from '../../auth/AuthContext';
import { authValue } from '../../test-utils/renderWithAuth';

jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedApi = api as jest.Mocked<typeof api>;

async function renderDatos(overrides = {}) {
  const auth = authValue(overrides);
  (useAuth as jest.Mock).mockReturnValue(auth);
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(<ProfileDetailsScreen navigation={navigation as never} route={{ key: 'k', name: 'ProfileDetails' } as never} />);
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
    expect(screen.getByLabelText('Spanish').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('English').props.accessibilityState.checked).toBe(false);
  });

  it('los idiomas se marcan y desmarcan, sin inventarse entradas', async () => {
    await renderDatos({ profile: { name: 'Ruben', languages: 'English' } as never });

    await fireEvent.press(screen.getByLabelText('French'));
    await fireEvent.press(screen.getByLabelText('English'));
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockedApi.updateMe).toHaveBeenCalledWith(expect.objectContaining({ languages: 'French' })));
  });

  it('guarda, refresca el perfil y vuelve atrás', async () => {
    const { auth, navigation } = await renderDatos({ profile: { name: 'Ruben' } as never });

    await fireEvent.changeText(screen.getByPlaceholderText('Berlin'), '  Zurich ');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(mockedApi.updateMe).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ruben', city: 'Zurich' }));
    expect(auth.refreshProfile).toHaveBeenCalled();
  });

  it('avisa si no se puede guardar y no se va de la pantalla', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.updateMe.mockRejectedValueOnce(new Error('sin conexión'));
    const { navigation } = await renderDatos({ profile: { name: 'Ruben' } as never });

    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(alerta).toHaveBeenCalledWith("Couldn't save your profile", 'sin conexión'));
    expect(navigation.goBack).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('cancelar vuelve sin guardar', async () => {
    const { navigation } = await renderDatos({ profile: { name: 'Ruben' } as never });

    await fireEvent.press(screen.getByText('Cancel'));

    expect(navigation.goBack).toHaveBeenCalled();
    expect(mockedApi.updateMe).not.toHaveBeenCalled();
  });
});
