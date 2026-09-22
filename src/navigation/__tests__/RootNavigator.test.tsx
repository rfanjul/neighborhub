import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import RootNavigator from '../RootNavigator';
import { useAuth } from '../../auth/AuthContext';
import { authValue } from '../../test-utils/renderWithAuth';

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

async function renderNavigator(overrides = {}) {
  mockedUseAuth.mockReturnValue(authValue(overrides));
  return render(<RootNavigator />);
}

describe('RootNavigator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enseña el splash mientras Firebase restaura la sesión', async () => {
    await renderNavigator({ initializing: true });

    expect(screen.getByLabelText('Cargando')).toBeTruthy();
    expect(screen.queryByText('Login Demo')).toBeNull();
  });

  it('sin sesión arranca en la pantalla de acceso', async () => {
    await renderNavigator({ initializing: false, user: null });

    await waitFor(() => expect(screen.getByText('Login Demo')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Entrar con email' })).toBeTruthy();
  });

  it('con sesión entra directo a Home, sin pasar por el login', async () => {
    await renderNavigator({ initializing: false, user: signedInUser as never });

    await waitFor(() => expect(screen.getByText('Hola, Ana')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Entrar con email' })).toBeNull();
  });

  it('al cerrar sesión vuelve a la pantalla de acceso', async () => {
    const view = await renderNavigator({ initializing: false, user: signedInUser as never });
    await waitFor(() => expect(screen.getByText('Hola, Ana')).toBeTruthy());

    mockedUseAuth.mockReturnValue(authValue({ initializing: false, user: null }));
    await view.rerender(<RootNavigator />);

    await waitFor(() => expect(screen.getByText('Login Demo')).toBeTruthy());
    expect(screen.queryByText('Hola, Ana')).toBeNull();
  });
});
