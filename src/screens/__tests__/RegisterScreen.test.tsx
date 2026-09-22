import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../RegisterScreen';
import { useAuth } from '../../auth/AuthContext';
import { authValue, navigationProps } from '../../test-utils/renderWithAuth';
import { firebaseError } from '../../test-utils/firebaseError';

jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

async function renderRegister(overrides = {}) {
  const value = authValue(overrides);
  mockedUseAuth.mockReturnValue(value);
  const nav = navigationProps<'Register'>();
  await render(<RegisterScreen navigation={nav.navigation} route={nav.route} />);
  return { value, nav };
}

async function fill({ name = 'Ana', email = 'ana@example.com', password = 'secreto123', confirm = 'secreto123' } = {}) {
  await fireEvent.changeText(screen.getByPlaceholderText('Nombre'), name);
  await fireEvent.changeText(screen.getByPlaceholderText('Email'), email);
  await fireEvent.changeText(screen.getByPlaceholderText('Contraseña (mínimo 6 caracteres)'), password);
  await fireEvent.changeText(screen.getByPlaceholderText('Repite la contraseña'), confirm);
}

const submit = () => fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));

describe('RegisterScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crea la cuenta con los datos del formulario', async () => {
    const { value } = await renderRegister();

    await fill();
    await submit();

    await waitFor(() => expect(value.register).toHaveBeenCalledWith('Ana', 'ana@example.com', 'secreto123'));
  });

  it('exige email y contraseña', async () => {
    const { value } = await renderRegister();

    await fill({ email: '', password: '', confirm: '' });
    await submit();

    expect(await screen.findByText('Escribe tu email y una contraseña.')).toBeTruthy();
    expect(value.register).not.toHaveBeenCalled();
  });

  it('avisa si las contraseñas no coinciden, antes de llamar a Firebase', async () => {
    const { value } = await renderRegister();

    await fill({ confirm: 'otra-cosa' });
    await submit();

    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeTruthy();
    expect(value.register).not.toHaveBeenCalled();
  });

  it('permite registrarse sin nombre', async () => {
    const { value } = await renderRegister();

    await fill({ name: '' });
    await submit();

    await waitFor(() => expect(value.register).toHaveBeenCalledWith('', 'ana@example.com', 'secreto123'));
  });

  it('traduce el email ya registrado', async () => {
    await renderRegister({ register: jest.fn().mockRejectedValue(firebaseError('auth/email-already-in-use')) });

    await fill();
    await submit();

    expect(await screen.findByText('Ya existe una cuenta con ese email.')).toBeTruthy();
  });

  it('traduce una contraseña demasiado corta', async () => {
    await renderRegister({ register: jest.fn().mockRejectedValue(firebaseError('auth/weak-password')) });

    await fill({ password: '123', confirm: '123' });
    await submit();

    expect(await screen.findByText('La contraseña debe tener al menos 6 caracteres.')).toBeTruthy();
  });

  it('lleva al login', async () => {
    const { nav } = await renderRegister();

    await fireEvent.press(screen.getByRole('button', { name: 'Ya tengo cuenta' }));

    expect(nav.spies.replace).toHaveBeenCalledWith('Login');
  });

  it('oculta las dos contraseñas', async () => {
    await renderRegister();

    expect(screen.getByPlaceholderText('Contraseña (mínimo 6 caracteres)').props.secureTextEntry).toBe(true);
    expect(screen.getByPlaceholderText('Repite la contraseña').props.secureTextEntry).toBe(true);
  });
});
