import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { colors, fonts, radii, shadow } from '../theme';
import CategoryIcon from './CategoryIcon';
import Avatar from './Avatar';
import type { ServiceRequest } from '../data/mock';
import { distanciaKm, formatearDistancia, type Coordenadas } from '../geo/distancia';

/** Distancia real si hay coordenadas y ubicación; si no, la guardada; si tampoco, nada. */
function textoDistancia(service: ServiceRequest, ubicacion?: Coordenadas | null): string | null {
  if (service.coords && ubicacion) return `${formatearDistancia(distanciaKm(ubicacion, service.coords))} away`;
  if (service.distanceKm > 0) return `${service.distanceKm} km away`;
  return null;
}

export default function ServiceCard({
  service,
  onPress,
  ubicacion,
}: {
  service: ServiceRequest;
  onPress?: () => void;
  /** Posición del usuario, para calcular la distancia real. */
  ubicacion?: Coordenadas | null;
}) {
  const distancia = textoDistancia(service, ubicacion);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {service.photos.length > 0 && (
        <Image
          source={{ uri: service.photos[0] }}
          style={styles.cover}
          resizeMode="cover"
          accessibilityLabel={`Foto de ${service.title}`}
        />
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <CategoryIcon category={service.category} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>
            {service.title}
          </Text>
          <Text style={styles.meta}>
            {[distancia, service.postedLabel].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Avatar name={service.requester.name} photoURL={service.requester.photoURL} size={22} color={service.requester.avatarColor} />
          <Text style={styles.requester}>{service.requester.name}</Text>
        </View>
        {service.status === 'pending' && (
          <View style={styles.pendingChip}>
            <Text style={styles.pendingLabel}>Pending review</Text>
          </View>
        )}
        {/* Quien publica ya no fija créditos: sin cifra no se enseña "0 cr". */}
        {service.credits > 0 && (
          <View style={styles.creditsChip}>
            <Text style={styles.creditsLabel}>{service.credits} cr</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, ...shadow },
  cover: { width: '100%', height: 132, borderRadius: radii.sm, marginBottom: 12, backgroundColor: colors.accentTint },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  meta: { marginTop: 6, fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  footer: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  requester: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  pendingChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.amberTint },
  pendingLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.amber },
  creditsChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.accentTint },
  creditsLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.accentDark },
});
