import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import WelcomeScreen, { AVANCE_MS, diapositivas } from '../WelcomeScreen';
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

  it('explica de qué va la app y, paso a paso, cómo pedir, ofrecerse, elegir y valorar', async () => {
    await renderWelcome();

    expect(screen.getByText(/acumulan créditos/)).toBeTruthy();
    expect(screen.getAllByLabelText('Neighborhub').length).toBeGreaterThan(0);
    for (const paso of ['1 · Pide ayuda', '2 · Ofrécete', '3 · Elige', '4 · Valora']) {
      expect(screen.getByText(paso)).toBeTruthy();
    }
    expect(screen.getByText(/Apply to help/)).toBeTruthy();
    expect(screen.getByText(/se abre el chat/)).toBeTruthy();
    expect(screen.getByText(/de 1 a 5 estrellas/)).toBeTruthy();
  });

  it('cada paso lleva su foto', async () => {
    await renderWelcome();

    const conFoto = diapositivas.filter((d) => 'foto' in d);
    expect(conFoto).toHaveLength(4);
    conFoto.forEach((d) => expect((d as { foto: string }).foto).toMatch(/^https:\/\/images\.unsplash\.com\//));
  });

  describe('carrusel', () => {
    const activo = () =>
      screen.getAllByLabelText(/^Diapositiva \d de 5$/).findIndex((p) => p.props.accessibilityState?.selected);

    it('empieza por la marca y los puntos llevan a cada diapositiva', async () => {
      await renderWelcome();
      expect(activo()).toBe(0);

      await fireEvent.press(screen.getByLabelText('Diapositiva 3 de 5'));

      expect(activo()).toBe(2);
    });

    it('al deslizar marca la diapositiva en la que se queda', async () => {
      await renderWelcome();

      await fireEvent(screen.getByTestId('carrusel'), 'momentumScrollEnd', {
        nativeEvent: { contentOffset: { x: 750 * 4, y: 0 } },
      });

      expect(activo()).toBe(4);
    });

    it('pasa solo, vuelve al principio tras la última y se para un rato si se toca', async () => {
      jest.useFakeTimers();
      try {
        await renderWelcome();

        await act(async () => jest.advanceTimersByTime(AVANCE_MS));
        expect(activo()).toBe(1);

        await act(async () => jest.advanceTimersByTime(AVANCE_MS * 4));
        expect(activo()).toBe(0);

        await fireEvent(screen.getByTestId('carrusel'), 'scrollBeginDrag');
        await act(async () => jest.advanceTimersByTime(AVANCE_MS));
        expect(activo()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });
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
