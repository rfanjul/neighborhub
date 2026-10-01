import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import RootNavigator, { irAlAviso } from '../RootNavigator';
import * as Notifications from 'expo-notifications';
import { api } from '../../firebase/data';
import { useAuth } from '../../auth/AuthContext';
import { authValue } from '../../test-utils/renderWithAuth';
import { cambiarIdioma } from '../../i18n';

jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../auth/environment', () => ({ isExpoGo: false }));
jest.mock('expo-apple-authentication', () => {
  const { Pressable, Text } = require('react-native');
  return {
    AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel="Mit Apple anmelden" onPress={onPress}>
        <Text>Mit Apple anmelden</Text>
      </Pressable>
    ),
    AppleAuthenticationButtonType: { SIGN_IN: 0 },
    AppleAuthenticationButtonStyle: { BLACK: 0 },
  };
});

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const signedInUser = {
  uid: 'uid-1',
  email: 'ana@example.com',
  displayName: 'Ana',
  providerData: [{ providerId: 'password' }],
};

/** Perfil de Firestore con el wizard ya completado. */
const perfilCompleto = { id: 'uid-1', name: 'Ana', onboardingCompleted: true, credits: 12 };

async function renderNavigator(overrides = {}) {
  mockedUseAuth.mockReturnValue(authValue(overrides));
  return render(<RootNavigator />);
}

describe('RootNavigator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enseña el splash mientras Firebase restaura la sesión', async () => {
    await renderNavigator({ initializing: true });

    expect(screen.getByLabelText('Loading')).toBeTruthy();
    expect(screen.queryByText('Neighborhub')).toBeNull();
  });

  it('sin sesión arranca en la pantalla de acceso', async () => {
    await renderNavigator({ initializing: false, user: null });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in with email' })).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Sign in with email' })).toBeTruthy();
  });

  it('con sesión y perfil completo entra directo a la app', async () => {
    await renderNavigator({
      initializing: false,
      user: signedInUser as never,
      profile: perfilCompleto as never,
    });

    await waitFor(() => expect(screen.getByText('Home')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Sign in with email' })).toBeNull();
  });

  it('entra al muro aunque el perfil esté a medias: editarlo ya no es obligatorio', async () => {
    await renderNavigator({
      initializing: false,
      user: signedInUser as never,
      profile: { ...perfilCompleto, onboardingCompleted: false } as never,
    });

    await waitFor(() => expect(screen.getByText('Home')).toBeTruthy());
    expect(screen.queryByText('Your details')).toBeNull();
  });

  it('entra al muro incluso sin documento de perfil en Firestore', async () => {
    await renderNavigator({ initializing: false, user: signedInUser as never, profile: null });

    await waitFor(() => expect(screen.getByText('Home')).toBeTruthy());
  });

  it('al cerrar sesión vuelve a la pantalla de acceso', async () => {
    const view = await renderNavigator({
      initializing: false,
      user: signedInUser as never,
      profile: perfilCompleto as never,
    });
    await waitFor(() => expect(screen.getByText('Home')).toBeTruthy());

    mockedUseAuth.mockReturnValue(authValue({ initializing: false, user: null, profile: null }));
    await view.rerender(<RootNavigator />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in with email' })).toBeTruthy());
    expect(screen.queryByText('Home')).toBeNull();
  });

  it('al cambiar de idioma lo repinta todo en el nuevo, en la misma pantalla', async () => {
    await renderNavigator({ initializing: false, user: null });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in with email' })).toBeTruthy());

    await act(async () => cambiarIdioma('de', { guardar: false }));

    expect(await screen.findByRole('button', { name: 'Mit E-Mail anmelden' })).toBeTruthy();
    await act(async () => cambiarIdioma('en', { guardar: false }));
  });
});

describe('avisos push', () => {
  const N = Notifications as jest.Mocked<typeof Notifications>;
  beforeEach(() => jest.clearAllMocks());

  it('sin sesión no pide permiso ni apunta nada', async () => {
    await renderNavigator({ initializing: false, user: null });

    expect(N.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('con sesión apunta el dispositivo con el idioma de la app', async () => {
    await renderNavigator({ initializing: false, user: signedInUser as never, profile: perfilCompleto as never });

    await waitFor(() => expect(api.guardarDispositivo).toHaveBeenCalledWith('ExponentPushToken[test]', 'en'));
  });

  it('un aviso tocado abre su pantalla', async () => {
    await renderNavigator({ initializing: false, user: signedInUser as never, profile: perfilCompleto as never });
    await screen.findAllByText(/Need help nearby/);

    await act(async () => {
      expect(irAlAviso({ pantalla: 'Payments' })).toBe(true);
    });
    expect(await screen.findByText('No payments yet. Paid requests you pay for or help with will show up here.')).toBeTruthy();

    await act(async () => {
      irAlAviso({});
    });
    expect(await screen.findByLabelText('Settings')).toBeTruthy();
  });

  it('si la navegación aún no está, no hace nada', () => {
    expect(irAlAviso({ pantalla: 'Payments' })).toBe(false);
  });
});
