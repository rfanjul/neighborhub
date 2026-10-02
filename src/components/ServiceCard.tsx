import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { colors, fonts, radii, shadow } from '../theme';
import CategoryIcon from './CategoryIcon';
import Avatar from './Avatar';
import type { ServiceRequest } from '../data/mock';
import { distanciaKm, formatearDistancia, type Coordenadas } from '../geo/distancia';
import { t } from '../i18n';
import { formatearPrecio } from '../pagos/precio';
import { usePagosActivos } from '../config/remota';

/** Distancia real si hay coordenadas y ubicación; si no, la guardada; si tampoco, nada. */
function textoDistancia(service: ServiceRequest, ubicacion?: Coordenadas | null): string | null {
  if (service.coords && ubicacion) {
    return t('comun.aDistancia', { distancia: formatearDistancia(distanciaKm(ubicacion, service.coords)) });
  }
  if (service.distanceKm > 0) return t('comun.aDistancia', { distancia: `${service.distanceKm} km` });
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
  const pagos = usePagosActivos();
  const distancia = textoDistancia(service, ubicacion);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {/* Como en un marketplace: la foto manda y ocupa todo el ancho. */}
      {service.photos.length > 0 && (
        <Image
          source={{ uri: service.photos[0] }}
          style={styles.cover}
          resizeMode="cover"
          accessibilityLabel={t('comun.fotoDe', { nombre: service.title })}
        />
      )}
      <View style={styles.cuerpo}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <CategoryIcon category={service.category} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {service.title}
            </Text>
            <Text style={styles.meta}>{[distancia, service.postedLabel].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Avatar
              name={service.requester.name}
              photoURL={service.requester.photoURL}
              size={28}
              color={service.requester.avatarColor}
            />
            <Text style={styles.requester}>{service.requester.name}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {service.status === 'pending' && (
              <View style={styles.pendingChip}>
                <Text style={styles.pendingLabel}>{t('estados.pending')}</Text>
              </View>
            )}
            {/* Con los pagos apagados (config/app) no se habla de precios. */}
            {pagos &&
              (service.priceCents == null ? (
                <View style={[styles.precioChip, styles.gratisChip]}>
                  <Text style={[styles.precioLabel, styles.gratisLabel]}>{t('comun.gratis')}</Text>
                </View>
              ) : (
                <View style={styles.precioChip}>
                  <Text style={styles.precioLabel}>{formatearPrecio(service.priceCents)}</Text>
                </View>
              ))}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Borde fino en vez de sombra marcada, y la foto recortada por la tarjeta.
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow,
    shadowOpacity: 0.05,
  },
  cover: { width: '100%', height: 190, backgroundColor: colors.accentTint },
  cuerpo: { padding: 16 },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
  },
  meta: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.muted,
  },
  footer: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requester: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  pendingChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.amberTint,
  },
  pendingLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.amberDark,
  },
  precioChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.accentTint,
  },
  precioLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.accentDark,
  },
  gratisChip: { backgroundColor: colors.greenTint },
  gratisLabel: { color: colors.green },
});
