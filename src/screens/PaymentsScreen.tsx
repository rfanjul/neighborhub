import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { BackIcon } from '../icons';
import PagoFila from '../components/PagoFila';
import { api, type PagoMovimiento } from '../firebase/data';
import { pagoErrorMessage } from '../firebase/errors';
import { t } from '../i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'Payments'>;

/** Todos mis pagos y cobros; tocar uno abre su servicio. */
export default function PaymentsScreen({ navigation }: Props) {
  const [pagos, setPagos] = useState<PagoMovimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    api
      .misPagos()
      .then(setPagos)
      .catch((e) => setError(pagoErrorMessage(e)));
  }, []);
  useFocusEffect(cargar);
  // Al volver de pagar en Stripe, el estado ya habrá cambiado.
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') cargar();
    });
    return () => suscripcion?.remove();
  }, [cargar]);

  const abrir = (p: PagoMovimiento) =>
    p.rol === 'pagado'
      ? navigation.navigate('ServiceOffers', { serviceId: p.serviceId })
      : navigation.navigate('ServiceDetail', { serviceId: p.serviceId });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('comun.atras')}>
          <BackIcon size={18} />
        </Pressable>
        <Text style={styles.titulo}>{t('pagos.titulo')}</Text>
      </View>
      {error ? (
        <Text style={styles.vacio}>{error}</Text>
      ) : !pagos ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : (
        <FlatList
          data={pagos}
          keyExtractor={(p) => `${p.rol}-${p.serviceId}`}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={<Text style={styles.vacio}>{t('pagos.vacio')}</Text>}
          renderItem={({ item }) => <PagoFila pago={item} onPress={() => abrir(item)} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  lista: { padding: 20, gap: 10 },
  vacio: { marginTop: 40, marginHorizontal: 20, textAlign: 'center', fontFamily: fonts.body, fontSize: 16, color: colors.muted },
});
