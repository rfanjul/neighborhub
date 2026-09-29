import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme';
import { BackIcon } from '../icons';
import Avatar from '../components/Avatar';
import Stars from '../components/Stars';
import ServiceCard from '../components/ServiceCard';
import type { ServiceRequest } from '../data/mock';
import { api, type Review } from '../firebase/data';
import { dataErrorMessage } from '../firebase/errors';
import { mesYAno } from '../utils/fecha';

type Props = NativeStackScreenProps<RootStackParamList, 'NeighborList'>;

/** Las ayudas de un vecino (cada una con su reseña) o sus servicios abiertos. */
export default function NeighborListScreen({ navigation, route }: Props) {
  const { userId, lista, nombre } = route.params;
  const [resenas, setResenas] = useState<Review[] | null>(null);
  const [servicios, setServicios] = useState<ServiceRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setError(null);
      const carga =
        lista === 'helps'
          ? api.listReviewsFor(userId).then(setResenas)
          : api.listServicesBy(userId).then(setServicios);
      carga.catch((e) => setError(dataErrorMessage(e)));
    }, [userId, lista])
  );

  const titulo = lista === 'helps' ? `${nombre}'s helps` : `${nombre}'s services`;
  const elementos = lista === 'helps' ? resenas : servicios;
  const cuenta = elementos?.length ?? 0;
  const subtitulo =
    lista === 'helps'
      ? `${cuenta} ${cuenta === 1 ? 'help' : 'helps'}, with the neighbor's review`
      : `${cuenta} open ${cuenta === 1 ? 'service' : 'services'}`;

  let contenido: React.ReactNode;
  if (error) {
    contenido = <Text style={styles.vacio}>{error}</Text>;
  } else if (!elementos) {
    contenido = <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;
  } else if (lista === 'helps') {
    contenido = (
      <FlatList
        data={resenas}
        keyExtractor={(r) => r.serviceId}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.vacio}>{nombre} hasn't completed any helps yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.tarjeta}>
            <Text style={styles.servicio}>{item.serviceTitle || 'Help'}</Text>
            <View style={styles.fila}>
              <Stars value={item.rating} size={14} />
              {item.createdAt > 0 && <Text style={styles.meta}>{mesYAno(item.createdAt)}</Text>}
            </View>
            {item.comment ? <Text style={styles.comentario}>“{item.comment}”</Text> : null}
            <View style={styles.fila}>
              <Avatar name={item.reviewerName} photoURL={item.reviewerPhotoURL} size={24} />
              <Text style={styles.meta}>by {item.reviewerName}</Text>
            </View>
          </View>
        )}
      />
    );
  } else {
    contenido = (
      <FlatList
        data={servicios}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.vacio}>{nombre} has no open services right now.</Text>}
        renderItem={({ item }) => (
          <ServiceCard service={item} onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id })} />
        )}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon size={18} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo} numberOfLines={1}>
            {titulo}
          </Text>
          {elementos && !error ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
        </View>
      </View>
      {contenido}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  subtitulo: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  lista: { padding: 20, gap: 12 },
  vacio: { marginTop: 40, marginHorizontal: 20, textAlign: 'center', fontFamily: fonts.body, fontSize: 16, color: colors.muted },
  tarjeta: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, gap: 8, ...shadow },
  servicio: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  comentario: { fontFamily: fonts.body, fontSize: 15, color: colors.ink, lineHeight: 22 },
});
