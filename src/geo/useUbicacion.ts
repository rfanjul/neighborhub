import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordenadas } from './distancia';

/**
 * Posición actual del usuario, o null si no ha dado permiso o el GPS no
 * responde. Sin ubicación la app sigue funcionando: solo no hay distancias.
 */
export function useUbicacion(): Coordenadas | null {
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) return;
        const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (activo) setUbicacion({ latitude: coords.latitude, longitude: coords.longitude });
      } catch {
        // Sin GPS: se queda en null.
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  return ubicacion;
}
