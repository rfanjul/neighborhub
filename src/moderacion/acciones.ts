import { Alert } from 'react-native';
import { api, type MotivoDenuncia, type TipoDenuncia } from '../firebase/data';
import { dataErrorMessage } from '../firebase/errors';
import { t } from '../i18n';

const MOTIVOS: MotivoDenuncia[] = ['spam', 'inapropiado', 'acoso', 'otro'];

/**
 * Denunciar dentro de la app: se elige el motivo y queda en reports/ para
 * que el equipo lo revise (en menos de 24 horas, como dicen los términos).
 */
export function denunciar(tipo: TipoDenuncia, objetoId: string) {
  Alert.alert(t('moderacion.denunciarTitulo'), t('moderacion.denunciarTexto'), [
    ...MOTIVOS.map((motivo) => ({
      text: t(`moderacion.motivos.${motivo}`),
      onPress: async () => {
        try {
          await api.denunciar(tipo, objetoId, motivo);
          Alert.alert(t('moderacion.graciasTitulo'), t('moderacion.graciasTexto'));
        } catch (e) {
          Alert.alert(t('moderacion.errorDenuncia'), dataErrorMessage(e));
        }
      },
    })),
    { text: t('comun.cancelar'), style: 'cancel' },
  ]);
}

/** Bloquear con confirmación; alBloquear se llama cuando ya está hecho. */
export function confirmarBloqueo(nombre: string, uid: string, alBloquear?: () => void) {
  Alert.alert(t('moderacion.bloquearTitulo', { nombre }), t('moderacion.bloquearTexto'), [
    { text: t('comun.cancelar'), style: 'cancel' },
    {
      text: t('moderacion.bloquear'),
      style: 'destructive',
      onPress: async () => {
        try {
          await api.bloquear(uid);
          alBloquear?.();
          Alert.alert(t('moderacion.bloqueadoTitulo', { nombre }), t('moderacion.bloqueadoTexto'));
        } catch (e) {
          Alert.alert(t('moderacion.errorBloqueo'), dataErrorMessage(e));
        }
      },
    },
  ]);
}

export async function desbloquear(uid: string, alDesbloquear?: () => void) {
  try {
    await api.desbloquear(uid);
    alDesbloquear?.();
  } catch (e) {
    Alert.alert(t('moderacion.errorBloqueo'), dataErrorMessage(e));
  }
}
