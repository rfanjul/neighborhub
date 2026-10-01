import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme';
import PillButton from './PillButton';
import { api } from '../firebase/data';
import { pagoErrorMessage } from '../firebase/errors';
import { t } from '../i18n';

type Props = {
  activos: boolean;
  /** Se llama con el estado nuevo al volver de Stripe. */
  onCambio: (activos: boolean) => void;
};

/**
 * Cobros con Stripe para quien ayuda en servicios con precio: el formulario
 * de Stripe (identidad e IBAN) se abre en Safari y, al volver a la app, se
 * pregunta a Stripe si ya está listo.
 */
export default function CobrosTarjeta({ activos, onCambio }: Props) {
  const [abriendo, setAbriendo] = useState(false);
  const esperandoStripe = useRef(false);
  const cambio = useRef(onCambio);
  cambio.current = onCambio;

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active' || !esperandoStripe.current) return;
      esperandoStripe.current = false;
      api
        .estadoCobros()
        .then((r) => cambio.current(r.activos))
        .catch(() => {});
    });
    return () => suscripcion?.remove();
  }, []);

  const activar = async () => {
    setAbriendo(true);
    try {
      const url = await api.activarCobros();
      esperandoStripe.current = true;
      await Linking.openURL(url);
    } catch (e) {
      esperandoStripe.current = false;
      Alert.alert(t('pagos.errorActivar'), pagoErrorMessage(e));
    } finally {
      setAbriendo(false);
    }
  };

  if (activos) {
    return (
      <View style={[styles.tarjeta, styles.activa]} testID="cobros-activos">
        <Text style={[styles.titulo, { color: colors.green }]}>✓ {t('pagos.cobrosActivos')}</Text>
        <Text style={styles.texto}>{t('pagos.cobrosActivosTexto')}</Text>
      </View>
    );
  }
  return (
    <View style={styles.tarjeta}>
      <Text style={styles.titulo}>{t('pagos.activarTitulo')}</Text>
      <Text style={styles.texto}>{t('pagos.activarTexto')}</Text>
      <PillButton label={abriendo ? t('pagos.abriendo') : t('pagos.activar')} onPress={activar} disabled={abriendo} />
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { gap: 8, padding: 16, borderRadius: radii.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  activa: { backgroundColor: colors.greenTint, borderColor: colors.greenTint },
  titulo: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink },
  texto: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted },
});
