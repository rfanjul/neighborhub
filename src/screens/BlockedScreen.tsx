import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import { BackIcon } from '../icons';
import Avatar from '../components/Avatar';
import { api, type ApiUserProfile } from '../firebase/data';
import { dataErrorMessage } from '../firebase/errors';
import { desbloquear } from '../moderacion/acciones';
import { t } from '../i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'Blocked'>;
type Bloqueado = { uid: string; perfil: ApiUserProfile | null };

/** Vecinos bloqueados, con la opción de desbloquearlos (Perfil → ajustes). */
export default function BlockedScreen({ navigation }: Props) {
  const [lista, setLista] = useState<Bloqueado[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    api
      .misBloqueos()
      .then((uids) =>
        Promise.all(uids.map(async (uid) => ({ uid, perfil: await api.getUserProfile(uid).catch(() => null) })))
      )
      .then(setLista)
      .catch((e) => setError(dataErrorMessage(e)));
  }, []);
  useFocusEffect(cargar);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('comun.atras')}>
          <BackIcon size={18} />
        </Pressable>
        <Text style={styles.titulo}>{t('moderacion.bloqueadosTitulo')}</Text>
      </View>
      {error ? (
        <Text style={styles.vacio}>{error}</Text>
      ) : !lista ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(b) => b.uid}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={<Text style={styles.vacio}>{t('moderacion.bloqueadosVacio')}</Text>}
          renderItem={({ item }) => {
            const nombre = item.perfil?.name || t('moderacion.vecino');
            return (
              <View style={styles.fila}>
                <Avatar name={nombre} photoURL={item.perfil?.photoURL ?? null} size={40} />
                <Text style={styles.nombre} numberOfLines={1}>
                  {nombre}
                </Text>
                <Pressable
                  style={styles.boton}
                  onPress={() => desbloquear(item.uid, cargar)}
                  accessibilityRole="button"
                  accessibilityLabel={t('moderacion.desbloquearA', { nombre })}
                >
                  <Text style={styles.botonTexto}>{t('moderacion.desbloquear')}</Text>
                </Pressable>
              </View>
            );
          }}
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
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.md, backgroundColor: colors.card },
  nombre: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  boton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  botonTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.accentDark },
});
