import { useSyncExternalStore } from 'react';
import { doc, getDoc } from '@firebase/firestore';
import { db } from '../firebase';

/**
 * Configuración que se cambia sin publicar otra versión: config/app en
 * Firestore (la escribe la administración desde /admin).
 *
 * pagosActivos: con false (o sin leer aún) la app no enseña precios ni
 * pagos y todo funciona como favores gratis; las reglas y las Functions
 * hacen lo mismo. Así una versión con pagos puede pasar la revisión de Apple
 * con los pagos apagados hasta tener Stripe en real.
 */
let pagos = false;
const oyentes = new Set<() => void>();

export async function cargarConfig(): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'config', 'app'));
    const activos = snap.exists() && snap.data().pagosActivos === true;
    if (activos !== pagos) {
      pagos = activos;
      oyentes.forEach((avisar) => avisar());
    }
  } catch {
    // Sin poder leerla, se queda como estaba (por defecto, sin pagos).
  }
}

export const pagosActivos = () => pagos;

/** Para componentes: se vuelve a pintar si cambia al cargar la configuración. */
export function usePagosActivos(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      oyentes.add(avisar);
      return () => oyentes.delete(avisar);
    },
    () => pagos
  );
}
