import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import WelcomeScreen from '../WelcomeScreen';
import { useAuth } from '../../auth/AuthContext';
import { authValue, navigationProps } from '../../test-utils/renderWithAuth';

let mockIsExpoGo = false;

jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../auth/environment', () => ({
  get isExpoGo() {
    return mockIsExpoGo;
  },
}));
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

async function renderWelcome(overrides = {}) {
  const value = authValue(overrides);
  mockedUseAuth.mockReturnValue(value);
  const nav = navigationProps<'Welcome'>();
  await render(<WelcomeScreen navigation={nav.navigation} route={nav.route} />);
  return { value, nav };
}

const appleButton = () => screen.getByRole('button', { name: 'Mit Apple anmelden' });
const googleButton = () => screen.getByRole('button', { name: 'Continuar con Google' });

describe('WelcomeScreen en el development build', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsExpoGo = false;
  });

  it('ofrece los tres métodos de acceso', async () => {
    await renderWelcome();

    expect(appleButton()).toBeTruthy();
    expect(googleButton()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar con email' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear una cuenta' })).toBeTruthy();
  });

  it('explica de qué va la app y sus tres pasos', async () => {
    await renderWelcome();

    expect(screen.getByText(/acumulan créditos/)).toBeTruthy();
    expect(screen.getByText('Ofrece ayuda')).toBeTruthy();
    expect(screen.getByText('Gana créditos')).toBeTruthy();
    expect(screen.getByText('Recibe ayuda')).toBeTruthy();
  });

  it('entra con Google', async () => {
    const { value } = await renderWelcome();

    await fireEvent.press(googleButton());

    await waitFor(() => expect(value.loginWithGoogle).toHaveBeenCalled());
  });

  it('entra con Apple', async () => {
    const { value } = await renderWelcome();

    await fireEvent.press(appleButton());

    await waitFor(() => expect(value.loginWithApple).toHaveBeenCalled());
  });

  it('muestra el error si Google falla', async () => {
    await renderWelcome({ loginWithGoogle: jest.fn().mockRejectedValue(new Error('play services')) });

    await fireEvent.press(googleButton());

    expect(await screen.findByText('play services')).toBeTruthy();
  });

  it('muestra el error si Apple falla', async () => {
    await renderWelcome({ loginWithApple: jest.fn().mockRejectedValue(new Error('error 1000')) });

    await fireEvent.press(appleButton());

    expect(await screen.findByText('error 1000')).toBeTruthy();
  });

  it('no deja error en pantalla si el usuario solo cancela', async () => {
    await renderWelcome({ loginWithGoogle: jest.fn().mockResolvedValue(false) });

    await fireEvent.press(googleButton());

    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar con email' })).toBeTruthy());
    expect(screen.queryByText(/error/i)).toBeNull();
  });

  it('desactiva el resto de botones mientras se resuelve un acceso', async () => {
    let resolveLogin: (value: boolean) => void = () => {};
    await renderWelcome({
      loginWithGoogle: jest.fn(() => new Promise<boolean>((resolve) => (resolveLogin = resolve))),
    });

    // Sin await: la promesa del press no se resuelve hasta que resolveLogin
    // se llame, y el objetivo es mirar la pantalla justo en ese intervalo.
    const pressing = fireEvent.press(googleButton());

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Entrar con email' }).props.accessibilityState.disabled).toBe(true)
    );

    await act(async () => {
      resolveLogin(true);
      await pressing;
    });
  });

  it('navega a login y a registro', async () => {
    const { nav } = await renderWelcome();

    await fireEvent.press(screen.getByRole('button', { name: 'Entrar con email' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Crear una cuenta' }));

    expect(nav.spies.navigate).toHaveBeenCalledWith('Login');
    expect(nav.spies.navigate).toHaveBeenCalledWith('Register');
  });
});

describe('WelcomeScreen en Expo Go', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsExpoGo = true;
  });

  it('esconde Apple y Google, que necesitan el development build', async () => {
    await renderWelcome();

    expect(screen.queryByRole('button', { name: 'Mit Apple anmelden' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continuar con Google' })).toBeNull();
  });

  it('explica por qué solo está el email', async () => {
    await renderWelcome();

    expect(screen.getByText(/Estás en Expo Go/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar con email' })).toBeTruthy();
  });
});
