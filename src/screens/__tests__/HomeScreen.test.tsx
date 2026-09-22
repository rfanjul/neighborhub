import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HomeScreen from '../HomeScreen';
import { useAuth } from '../../auth/AuthContext';
import { authValue } from '../../test-utils/renderWithAuth';

jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

async function renderHome(user: object | null, overrides = {}) {
  const value = authValue({ user: user as never, ...overrides });
  mockedUseAuth.mockReturnValue(value);
  await render(<HomeScreen />);
  return { value };
}

const emailUser = {
  uid: 'uid-1',
  email: 'ana@example.com',
  displayName: 'Ana',
  providerData: [{ providerId: 'password' }],
};

describe('HomeScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saluda por el nombre y muestra los datos de la cuenta', async () => {
    await renderHome(emailUser);

    expect(screen.getByText('Hola, Ana')).toBeTruthy();
    expect(screen.getByText('Email: ana@example.com')).toBeTruthy();
    expect(screen.getByText('UID: uid-1')).toBeTruthy();
  });

  it('indica con qué método se entró', async () => {
    await renderHome({ ...emailUser, providerData: [{ providerId: 'apple.com' }] });

    expect(screen.getByText('Método: apple.com')).toBeTruthy();
  });

  it('saluda sin nombre cuando el proveedor no lo dio', async () => {
    await renderHome({ ...emailUser, displayName: null });

    expect(screen.getByText('Hola')).toBeTruthy();
  });

  it('marca el email como desconocido si no hay', async () => {
    await renderHome({ ...emailUser, email: null });

    expect(screen.getByText('Email: —')).toBeTruthy();
  });

  it('cierra la sesión', async () => {
    const { value } = await renderHome(emailUser);

    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(value.logout).toHaveBeenCalled());
  });
});
