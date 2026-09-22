import React from 'react';
import { render } from '@testing-library/react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';

type AuthValue = ReturnType<typeof import('../auth/AuthContext').useAuth>;

/** Valor de useAuth con todo mockeado; cada test sobrescribe lo que necesita. */
export function authValue(overrides: Partial<AuthValue> = {}): AuthValue {
  return {
    user: null,
    initializing: false,
    register: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue(undefined),
    resetPassword: jest.fn().mockResolvedValue(undefined),
    loginWithGoogle: jest.fn().mockResolvedValue(true),
    loginWithApple: jest.fn().mockResolvedValue(true),
    logout: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as AuthValue;
}

/** Props de navegación mínimas para renderizar una pantalla suelta. */
export function navigationProps<T extends keyof AuthStackParamList>(params?: AuthStackParamList[T]) {
  const navigation = {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
  };
  return {
    navigation: navigation as unknown as NativeStackScreenProps<AuthStackParamList, T>['navigation'],
    route: { key: 'k', name: 'screen', params } as unknown as NativeStackScreenProps<AuthStackParamList, T>['route'],
    spies: navigation,
  };
}

export function renderScreen(ui: React.ReactElement) {
  return render(ui);
}
