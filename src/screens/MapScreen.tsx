import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import CategoryIcon from '../components/CategoryIcon';
import type { ServiceRequest } from '../data/mock';
import { api } from '../firebase/data';
import { distanciaKm, formatearDistancia, type Coordenadas } from '../geo/distancia';
import { useUbicacion } from '../geo/useUbicacion';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'MapTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

type ConCoordenadas = ServiceRequest & { coords: Coordenadas };

const radios = [1, 5, 10];

// Si no hay ubicación ni servicios, el mapa arranca en Zúrich.
const regionPorDefecto = { latitude: 47.3769, longitude: 8.5417 };

// El SDK de Google Maps solo se incluye en el binario si app.config.ts
// recibe una API key; sin él, pedir PROVIDER_GOOGLE haría caer la app, así
// que hasta entonces se usa el mapa nativo de iOS.
const usarGoogleMaps = Boolean(Constants.expoConfig?.extra?.googleMapsEnabled);

export default function MapScreen({ navigation }: Props) {
  const ubicacion = useUbicacion();
  const [servicios, setServicios] = useState<ConCoordenadas[]>([]);
  const [radioKm, setRadioKm] = useState(5);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api
        .listServices()
        .then((lista) => {
          setServicios(lista.filter((s): s is ConCoordenadas => s.coords !== null));
          setError(false);
        })
        .catch(() => setError(true));
    }, [])
  );

  // Sin ubicación no se puede filtrar por distancia: se enseñan todos.
  const visibles = useMemo(
    () => (ubicacion ? servicios.filter((s) => distanciaKm(ubicacion, s.coords) <= radioKm) : servicios),
    [servicios, ubicacion, radioKm]
  );

  const seleccionado = visibles.find((s) => s.id === seleccionadoId) ?? null;
  const centro = ubicacion ?? servicios[0]?.coords ?? regionPorDefecto;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={usarGoogleMaps ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ ...centro, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        showsUserLocation
        onPress={() => setSeleccionadoId(null)}
        testID="mapa"
      >
        {visibles.map((s) => (
          <Marker
            key={s.id}
            coordinate={s.coords}
            title={s.title}
            pinColor={s.id === seleccionadoId ? colors.accentDark : colors.accent}
            onPress={(e) => {
              e.stopPropagation?.();
              setSeleccionadoId(s.id);
            }}
            testID={`marcador-${s.id}`}
          />
        ))}
      </MapView>

      <View style={styles.filterRow}>
        {radios.map((km) => (
          <Pressable
            key={km}
            style={[styles.filterChip, radioKm === km && styles.filterChipActive]}
            onPress={() => setRadioKm(km)}
            accessibilityRole="radio"
            accessibilityState={{ selected: radioKm === km }}
          >
            <Text style={[styles.filterLabel, radioKm === km && styles.filterLabelActive]}>{km} km</Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>Couldn't load services. Pull the wall to retry.</Text>
        </View>
      ) : visibles.length === 0 ? (
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>
            {servicios.length === 0 ? 'No services with a location yet.' : `No services within ${radioKm} km.`}
          </Text>
        </View>
      ) : null}

      {seleccionado && (
        <Pressable
          style={styles.previewCard}
          onPress={() => navigation.navigate('ServiceDetail', { serviceId: seleccionado.id })}
          accessibilityRole="button"
        >
          <CategoryIcon category={seleccionado.category} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {seleccionado.title}
            </Text>
            <Text style={styles.previewMeta}>
              {ubicacion ? `${formatearDistancia(distanciaKm(ubicacion, seleccionado.coords))} away · ` : ''}
              {seleccionado.requester.name}
            </Text>
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  filterRow: { marginTop: 12, marginLeft: 20, flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.card },
  filterChipActive: { backgroundColor: colors.accent },
  filterLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  filterLabelActive: { color: colors.white },
  aviso: {
    marginTop: 10,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    alignSelf: 'flex-start',
  },
  avisoTexto: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  previewCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  previewMeta: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, color: colors.muted },
});
