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
  ActivityTab: { segmento?: 'services' | 'offers' } | undefined;
  ProfileTab: undefined;
};

/** Pantallas con sesión iniciada: wizard de perfil, pestañas y modales. */
export type RootStackParamList = {
  /** motivo: se abrió porque falta completar el perfil para publicar u ofrecer ayuda. */
  ProfileDetails: { motivo?: 'publicar' | 'ofrecer' } | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  ServiceDetail: { serviceId: string };
  /** Hacer una oferta sobre un servicio, con comentario. */
  Apply: { serviceId: string };
  /** Ofertas recibidas en un servicio propio: elegir, chatear, completar. */
  ServiceOffers: { serviceId: string };
  /** Dar por hecha la ayuda valorando a quien ayudó (1 a 5 y comentario). */
  RateHelper: { serviceId: string };
  /** Perfil público de otro vecino. */
  NeighborProfile: { userId: string };
  /** Sus ayudas (con las reseñas) o sus servicios abiertos. */
  NeighborList: { userId: string; lista: 'helps' | 'services'; nombre: string };
  Chat: { serviceId: string };
  /** Todos mis pagos y cobros con su estado. */
  Payments: undefined;
  /** Vecinos bloqueados (Perfil → ajustes), para desbloquearlos. */
  Blocked: undefined;
  /** Sin serviceId crea uno nuevo; con él, edita ese servicio. */
  CreateService: { serviceId?: string } | undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
