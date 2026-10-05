import Constants from 'expo-constants';
import { api } from '../firebase/data';
import { isExpoGo } from '../auth/environment';

/**
 * Avisos push (functions/avisos.js los manda por el servicio de Expo).
 *
 * expo-notifications es nativo: en Expo Go no hay push, y una app de
 * desarrollo compilada antes de añadirlo no lo trae. En esos casos se
 * cargaría con error, así que se carga con cuidado y, sin él, la app
 * funciona igual pero sin avisos.
 */
type Notificaciones = typeof import('expo-notifications');
let N: Notificaciones | null = null;
if (!isExpoGo) {
  try {
    N = require('expo-notifications') as Notificaciones;
    // Con la app abierta también se enseñan, como banner.
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    N = null;
  }
}

/** A qué pantalla lleva un aviso: lo manda el servidor en data. */
export type Destino = { pantalla?: string; serviceId?: string };

let tokenActual: string | null = null;
let ultimoTocado: string | null = null;

export const avisosDisponibles = () => N !== null;

/**
 * Pide permiso (solo la primera vez sale el aviso de iOS) y apunta este
 * dispositivo para recibir avisos en el idioma de la app. Devuelve el token,
 * o null si no hay permiso o no se puede (simulador, sin red, sin módulo).
 */
export async function activarAvisos(idioma: string): Promise<string | null> {
  if (!N) return null;
  try {
    let { status } = await N.getPermissionsAsync();
    if (status !== 'granted') status = (await N.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await N.getExpoPushTokenAsync({ projectId });
    await api.guardarDispositivo(data, idioma);
    tokenActual = data;
    return data;
  } catch {
    return null;
  }
}

/** Al cerrar sesión: este dispositivo deja de recibir los avisos de esa cuenta. */
export async function olvidarEsteDispositivo(): Promise<void> {
  if (!tokenActual) return;
  const token = tokenActual;
  tokenActual = null;
  await api.olvidarDispositivo(token).catch(() => undefined);
}

/**
 * Llama a ir() cuando se toca un aviso, también el que abrió la app.
 * Devuelve cómo dejar de escuchar.
 */
export function alTocarAviso(ir: (destino: Destino) => void): () => void {
  if (!N) return () => {};
  const abrir = (respuesta: import('expo-notifications').NotificationResponse | null) => {
    if (!respuesta) return;
    const { identifier, content } = respuesta.notification.request;
    if (identifier === ultimoTocado) return;
    ultimoTocado = identifier;
    ir((content.data ?? {}) as Destino);
  };
  N.getLastNotificationResponseAsync()
    .then(abrir)
    .catch(() => undefined);
  const suscripcion = N.addNotificationResponseReceivedListener(abrir);
  return () => suscripcion.remove();
}
