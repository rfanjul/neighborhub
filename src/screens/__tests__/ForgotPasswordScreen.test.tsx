import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ForgotPasswordScreen from '../ForgotPasswordScreen';
import { useAuth } from '../../auth/AuthContext';
import { authValue, navigationProps } from '../../test-utils/renderWithAuth';
import { firebaseError } from '../../test-utils/firebaseError';

jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

async function renderForgot(overrides = {}, params?: { email?: string }) {
  const value = authValue(overrides);
  mockedUseAuth.mockReturnValue(value);
  const nav = navigationProps<'ForgotPassword'>(params);
  await render(<ForgotPasswordScreen navigation={nav.navigation} route={nav.route} />);
  return { value, nav };
}

const send = () => fireEvent.press(screen.getByRole('button', { name: 'Enviar enlace' }));

describe('ForgotPasswordScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reutiliza el email que venía del login', async () => {
    await renderForgot({}, { email: 'ana@example.com' });

    expect(screen.getByPlaceholderText('Email').props.value).toBe('ana@example.com');
  });

  it('arranca vacío si no se pasó email', async () => {
    await renderForgot({}, undefined);

    expect(screen.getByPlaceholderText('Email').props.value).toBe('');
  });

  it('envía el enlace y confirma a qué dirección', async () => {
    const { value } = await renderForgot({}, { email: ' ana@example.com ' });

    await send();

    await waitFor(() => expect(value.resetPassword).toHaveBeenCalledWith(' ana@example.com '));
    expect(await screen.findByText(/ana@example.com/)).toBeTruthy();
  });

  it('esconde el formulario una vez enviado', async () => {
    await renderForgot({}, { email: 'ana@example.com' });

    await send();

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Enviar enlace' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
  });

  it('exige un email', async () => {
    const { value } = await renderForgot();

    await send();

    expect(await screen.findByText('Escribe tu email.')).toBeTruthy();
    expect(value.resetPassword).not.toHaveBeenCalled();
  });

  it('traduce un email desconocido y deja el formulario abierto', async () => {
    await renderForgot({ resetPassword: jest.fn().mockRejectedValue(firebaseError('auth/user-not-found')) }, {
      email: 'nadie@example.com',
    });

    await send();

    expect(await screen.findByText('Email o contraseña incorrectos.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeTruthy();
  });

  it('vuelve atrás al cancelar', async () => {
    const { nav } = await renderForgot();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(nav.spies.goBack).toHaveBeenCalled();
  });
});
