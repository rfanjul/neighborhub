import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * true cuando la app corre dentro de Expo Go. Ahí no existen los módulos
 * nativos de Google Sign-In ni el entitlement de Apple, así que solo está
 * disponible email + contraseña.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
