import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import { BackIcon } from '../icons';
import Chip from '../components/Chip';
import Avatar from '../components/Avatar';
import { useUbicacion } from '../geo/useUbicacion';
import { distanciaKm, formatearDistancia } from '../geo/distancia';
import PillButton from '../components/PillButton';
import { mockServices, type ServiceRequest } from '../data/mock';
import { api, type Application } from '../firebase/data';
import { useAuth } from '../auth/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceDetail'>;

const categoryLabel: Record<string, string> = {
  painting: 'Painting',
  dog: 'Dog walking',
  groceries: 'Groceries',
  moving: 'Moving',
  other: 'Other',
};

type Accion = {
  label: string;
  /** Pantalla a la que lleva el botón; sin destino el botón va desactivado. */
  destino?: 'Apply' | 'ServiceOffers' | 'Chat' | 'CreateService';
  nota?: string;
};

/**
 * Qué puede hacer quien mira el servicio: ofrecerse solo si está aprobado y
 * no es suyo; quien lo publicó gestiona las ofertas; quien fue elegido abre
 * el chat.
 */
export function accionPrincipal(service: ServiceRequest, uid: string | null, miOferta: Application | null): Accion {
  if (uid && service.requesterId === uid) {
    // Pendiente de revisión aún no puede recibir ofertas: lo útil es editarlo.
    if (service.status === 'pending') {
      return { label: 'Edit service', destino: 'CreateService', nota: 'Offers open once an admin approves it.' };
    }
    return { label: 'View offers', destino: 'ServiceOffers' };
  }
  if (uid && service.helperId === uid) return { label: 'Open chat', destino: 'Chat' };
  if (miOferta?.status === 'pending') return { label: 'Offer sent', nota: 'Waiting for the owner to choose.' };
  if (miOferta?.status === 'rejected') return { label: 'Offer not selected', nota: 'The owner chose another neighbor.' };
  if (service.status === 'approved') return { label: 'Apply to help', destino: 'Apply' };
  if (service.status === 'pending') return { label: 'Waiting for review', nota: 'Offers open once an admin approves it.' };
  return { label: 'No longer taking offers' };
}

const statusColor: Record<string, { fondo: string; color: string }> = {
  pending: { fondo: colors.amberTint, color: colors.amber },
  approved: { fondo: colors.greenTint, color: colors.green },
  accepted: { fondo: colors.blueTint, color: colors.blue },
  in_progress: { fondo: colors.blueTint, color: colors.blue },
  completed: { fondo: colors.greenTint, color: colors.green },
  rated: { fondo: colors.greenTint, color: colors.green },
};

/** "★ 4.8 (12) · replies in ~2h", sin valores vacíos. */
export function resumenAutor(r: ServiceRequest['requester']): string {
  const partes = [r.rating > 0 ? `★ ${r.rating}${r.ratingCount > 0 ? ` (${r.ratingCount})` : ''}` : 'No ratings yet'];
  if (r.responseLabel && r.responseLabel !== '—') partes.push(`replies in ${r.responseLabel}`);
  return partes.join(' · ');
}

const statusLabel: Record<string, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
  rated: 'Rated',
};

export default function ServiceDetailScreen({ route, navigation }: Props) {
  const fallback = mockServices.find((s) => s.id === route.params.serviceId) ?? mockServices[0];
  const [service, setService] = useState<ServiceRequest>(fallback);
  const [miOferta, setMiOferta] = useState<Application | null>(null);
  const { user } = useAuth();
  const [foto, setFoto] = useState(0);
  const anchoPantalla = Dimensions.get('window').width;
  const insets = useSafeAreaInsets();

  const serviceId = route.params.serviceId;

  // Al volver de hacer una oferta hay que releer su estado.
  useFocusEffect(
    useCallback(() => {
      api.getService(serviceId).then(setService).catch(() => {
        // Backend not reachable — keep showing the local mock version.
      });
      api
        .listMyApplications()
        .then((ofertas) => setMiOferta(ofertas.find((o) => o.serviceId === serviceId) ?? null))
        .catch(() => setMiOferta(null));
    }, [serviceId])
  );

  const accion = accionPrincipal(service, user?.uid ?? null, miOferta);
  const ubicacion = useUbicacion();
  const distancia =
    service.coords && ubicacion
      ? `${formatearDistancia(distanciaKm(ubicacion, service.coords))} away`
      : service.distanceKm > 0
        ? `${service.distanceKm} km away`
        : null;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <View style={styles.photo}>
        {service.photos.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => setFoto(Math.round(e.nativeEvent.contentOffset.x / anchoPantalla))}
            scrollEventThrottle={16}
          >
            {service.photos.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={{ width: anchoPantalla, height: 260 }}
                resizeMode="cover"
                accessibilityLabel={`Foto de ${service.title}`}
              />
            ))}
          </ScrollView>
        )}
        <Pressable
          style={[styles.backButton, { top: insets.top + 12 }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <BackIcon size={18} />
        </Pressable>
        {service.photos.length > 1 && (
          <View style={styles.dots}>
            {service.photos.map((uri, i) => (
              <View key={uri} style={[styles.dot, i === foto && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={categoryLabel[service.category]} background={colors.accentTint} color={colors.accentDark} />
          <Chip
            label={statusLabel[service.status]}
            background={(statusColor[service.status] ?? statusColor.pending).fondo}
            color={(statusColor[service.status] ?? statusColor.pending).color}
          />
        </View>

        <Text style={styles.title}>{service.title}</Text>

        <View style={styles.requesterCard}>
          <Avatar name={service.requester.name} photoURL={service.requester.photoURL} size={44} color={service.requester.avatarColor} />
          <View style={{ flex: 1 }}>
            <Text style={styles.requesterName}>{service.requester.name}</Text>
            <Text style={styles.requesterMeta}>{resumenAutor(service.requester)}</Text>
          </View>
        </View>

        <Text style={styles.description}>{service.description}</Text>

        <View style={styles.infoList}>
          {service.durationLabel && service.durationLabel !== '—' ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Duration</Text>
              <Text style={styles.infoValue}>{service.durationLabel}</Text>
            </View>
          ) : null}
          {service.credits > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Credits requested</Text>
              <Text style={[styles.infoValue, { color: colors.accentDark }]}>{service.credits} cr</Text>
            </View>
          )}
          {distancia ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{distancia}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Available</Text>
            <Text style={styles.infoValue}>{service.availableLabel}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PillButton
          label={accion.label}
          disabled={!accion.destino}
          onPress={() => {
            if (accion.destino) navigation.navigate(accion.destino, { serviceId: service.id });
          }}
        />
        {accion.nota && <Text style={styles.nota}>{accion.nota}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundAlt },
  photo: { height: 260, backgroundColor: '#E4DDD3' },
  backButton: {
    position: 'absolute',
    top: 52,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { position: 'absolute', bottom: 14, left: 0, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 16, backgroundColor: colors.white },
  body: { padding: 20, gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.ink },
  requesterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: radii.md,
  },
  requesterName: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.ink },
  requesterMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
  description: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.muted },
  infoList: { gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontFamily: fonts.body, fontSize: 13.5, color: colors.muted },
  infoValue: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.ink },
  footer: { padding: 20, paddingTop: 8 },
  nota: { marginTop: 8, textAlign: 'center', fontFamily: fonts.body, fontSize: 12, color: colors.muted },
});
