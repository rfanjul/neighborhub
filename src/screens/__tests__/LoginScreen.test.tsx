import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import { useAuth } from '../../auth/AuthContext';
import { authValue, navigationProps } from '../../test-utils/renderWithAuth';
import { firebaseError } from '../../test-utils/firebaseError';

jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

async function renderLogin(overrides = {}) {
  const value = authValue(overrides);
  mockedUseAuth.mockReturnValue(value);
  const nav = navigationProps<'Login'>();
  await render(<LoginScreen navigation={nav.navigation} route={nav.route} />);
  return { value, nav };
}

async function fillAndSubmit(email: string, password: string) {
  await fireEvent.changeText(screen.getByPlaceholderText('Email'), email);
  await fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('entra con el email y la contraseña escritos', async () => {
    const { value } = await renderLogin();

    await fillAndSubmit('ana@example.com', 'secreto123');

    await waitFor(() => expect(value.login).toHaveBeenCalledWith('ana@example.com', 'secreto123'));
  });

  it('no llama a Firebase si falta algún campo', async () => {
    const { value } = await renderLogin();

    await fireEvent.changeText(screen.getByPlaceholderText('Email'), 'ana@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Escribe tu email y tu contraseña.')).toBeTruthy();
    expect(value.login).not.toHaveBeenCalled();
  });

  it('trata un email de solo espacios como vacío', async () => {
    const { value } = await renderLogin();

    await fillAndSubmit('   ', 'secreto123');

    expect(await screen.findByText('Escribe tu email y tu contraseña.')).toBeTruthy();
    expect(value.login).not.toHaveBeenCalled();
  });

  it('muestra el error traducido cuando las credenciales no valen', async () => {
    await renderLogin({ login: jest.fn().mockRejectedValue(firebaseError('auth/invalid-credential')) });

    await fillAndSubmit('ana@example.com', 'mala');

    expect(await screen.findByText('Email o contraseña incorrectos.')).toBeTruthy();
  });

  it('deja reintentar tras un fallo', async () => {
    const login = jest
      .fn()
      .mockRejectedValueOnce(firebaseError('auth/network-request-failed'))
      .mockResolvedValueOnce(undefined);
    await renderLogin({ login });

    await fillAndSubmit('ana@example.com', 'secreto123');
    expect(await screen.findByText('Sin conexión. Revisa tu red.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(login).toHaveBeenCalledTimes(2));
  });

  it('lleva a recuperar contraseña arrastrando el email escrito', async () => {
    const { nav } = await renderLogin();

    await fireEvent.changeText(screen.getByPlaceholderText('Email'), 'ana@example.com');
    await fireEvent.press(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));

    expect(nav.spies.navigate).toHaveBeenCalledWith('ForgotPassword', { email: 'ana@example.com' });
  });

  it('lleva al registro', async () => {
    const { nav } = await renderLogin();

    await fireEvent.press(screen.getByRole('button', { name: 'No tengo cuenta' }));

    expect(nav.spies.replace).toHaveBeenCalledWith('Register');
  });

  it('oculta la contraseña', async () => {
    await renderLogin();

    expect(screen.getByPlaceholderText('Contraseña').props.secureTextEntry).toBe(true);
  });
});
