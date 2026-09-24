import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme';
import Chip from '../components/Chip';
import type { ServiceRequest } from '../data/mock';
import { api, type Application } from '../firebase/data';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'ActivityTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Segmento = 'services' | 'offers';

/** Etiqueta y colores del estado de un servicio propio. */
const estadoServicio: Record<string, { texto: string; fondo: string; color: string }> = {
  pending: { texto: 'Pending review', fondo: colors.amberTint, color: colors.amber },
  approved: { texto: 'Open for offers', fondo: colors.greenTint, color: colors.green },
  accepted: { texto: 'In progress', fondo: colors.blueTint, color: colors.blue },
  in_progress: { texto: 'In progress', fondo: colors.blueTint, color: colors.blue },
  completed: { texto: 'Completed', fondo: colors.greenTint, color: colors.green },
  rated: { texto: 'Completed', fondo: colors.greenTint, color: colors.green },
};

const estadoOferta: Record<Application['status'], { texto: string; fondo: string; color: string }> = {
  pending: { texto: 'Waiting', fondo: colors.amberTint, color: colors.amber },
  selected: { texto: 'Selected', fondo: colors.greenTint, color: colors.green },
  rejected: { texto: 'Not selected', fondo: colors.border, color: colors.muted },
};

export default function ActivityScreen({ navigation, route }: Props) {
  const [segmento, setSegmento] = useState<Segmento>(route.params?.segmento ?? 'services');
  const [servicios, setServicios] = useState<ServiceRequest[]>([]);
  const [ofertas, setOfertas] = useState<Application[]>([]);
  const [cargando, setCargando] = useState(false);
  // Cada lista falla por separado: que no carguen las ofertas no debe dejar
  // vacíos también los servicios.
  const [errores, setErrores] = useState<{ services: boolean; offers: boolean }>({ services: false, offers: false });

  // Al llegar desde "Send offer" se abre directamente en "My offers".
  useEffect(() => {
    if (route.params?.segmento) setSegmento(route.params.segmento);
  }, [route.params?.segmento]);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [misServicios, misOfertas] = await Promise.allSettled([api.listMyServices(), api.listMyApplications()]);
    if (misServicios.status === 'fulfilled') setServicios(misServicios.value);
    if (misOfertas.status === 'fulfilled') setOfertas(misOfertas.value);
    setErrores({ services: misServicios.status === 'rejected', offers: misOfertas.status === 'rejected' });
    setCargando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const error = errores[segmento];
  const vacio =
    segmento === 'services'
      ? "You haven't published any service yet. Tap + to ask for help."
      : "You haven't made any offer yet. Find a service on the wall and offer to help.";

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.titulo}>Activity</Text>
      <View style={styles.segmentos} accessibilityRole="tablist">
        {(['services', 'offers'] as const).map((s) => (
          <Pressable
            key={s}
            style={[styles.segmento, segmento === s && styles.segmentoActivo]}
            onPress={() => setSegmento(s)}
            accessibilityRole="tab"
            accessibilityState={{ selected: segmento === s }}
          >
            <Text style={[styles.segmentoTexto, segmento === s && styles.segmentoTextoActivo]}>
              {s === 'services' ? 'My services' : 'My offers'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && (
        <Text style={styles.error}>
          {segmento === 'services' ? "Couldn't load your services." : "Couldn't load your offers."} Pull down to retry.
        </Text>
      )}

      {segmento === 'services' ? (
        <FlatList
          data={servicios}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={colors.accent} />}
          ListEmptyComponent={!cargando && !error ? <Text style={styles.vacio}>{vacio}</Text> : null}
          renderItem={({ item }) => {
            const estado = estadoServicio[item.status] ?? estadoServicio.pending;
            return (
              <Pressable
                style={styles.tarjeta}
                onPress={() => navigation.navigate('ServiceOffers', { serviceId: item.id })}
                accessibilityRole="button"
              >
                <Text style={styles.tarjetaTitulo} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.fila}>
                  <Chip label={estado.texto} background={estado.fondo} color={estado.color} />
                  {item.helperName && <Text style={styles.meta}>with {item.helperName}</Text>}
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          data={ofertas}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={colors.accent} />}
          ListEmptyComponent={!cargando && !error ? <Text style={styles.vacio}>{vacio}</Text> : null}
          renderItem={({ item }) => {
            const estado = estadoOferta[item.status];
            return (
              <View style={styles.tarjeta}>
                <Text style={styles.tarjetaTitulo} numberOfLines={2}>
                  {item.serviceTitle}
                </Text>
                {item.comment ? (
                  <Text style={styles.comentario} numberOfLines={3}>
                    “{item.comment}”
                  </Text>
                ) : null}
                <View style={styles.fila}>
                  <Chip label={estado.texto} background={estado.fondo} color={estado.color} />
                  {item.status === 'selected' && (
                    <Pressable
                      style={styles.botonChat}
                      onPress={() => navigation.navigate('Chat', { serviceId: item.serviceId })}
                      accessibilityRole="button"
                    >
                      <Text style={styles.botonChatTexto}>Open chat</Text>
                    </Pressable>
                  )}
                </View>
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
  titulo: { marginTop: 8, marginHorizontal: 20, fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  segmentos: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 4,
    borderRadius: 22,
    backgroundColor: colors.card,
  },
  segmento: { flex: 1, paddingVertical: 9, borderRadius: 18, alignItems: 'center' },
  segmentoActivo: { backgroundColor: colors.accent },
  segmentoTexto: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  segmentoTextoActivo: { color: colors.white },
  error: { marginHorizontal: 20, marginTop: 10, fontFamily: fonts.body, fontSize: 12, color: colors.accentDark },
  lista: { padding: 20, gap: 12 },
  vacio: { marginTop: 40, textAlign: 'center', fontFamily: fonts.body, fontSize: 14, color: colors.muted, lineHeight: 20 },
  tarjeta: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, gap: 10, ...shadow },
  tarjetaTitulo: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  comentario: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 18 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  botonChat: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.accent },
  botonChatTexto: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.white },
});
