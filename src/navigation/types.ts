import type { NavigatorScreenParams } from '@react-navigation/native';

/** Pantallas antes de tener sesión. */
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
};

/** Pestañas de la app una vez dentro. */
export type MainTabParamList = {
  HomeTab: undefined;
  MapTab: undefined;
  CreateTab: undefined;
  ChatTab: undefined;
  ProfileTab: undefined;
};

/** Pantallas con sesión iniciada: wizard de perfil, pestañas y modales. */
export type RootStackParamList = {
  ProfileDetails: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  ServiceDetail: { serviceId: string };
  CreateService: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
