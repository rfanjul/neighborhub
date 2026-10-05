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
import { decimal, t } from '../i18n';
import { comision, formatearPrecio, totalAPagar } from '../pagos/precio';
import { usePagosActivos } from '../config/remota';
import { confirmarBloqueo, denunciar } from '../moderacion/acciones';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceDetail'>;

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
      return { label: t('detalle.editar'), destino: 'CreateService', nota: t('detalle.enRevisionNota') };
    }
    return { label: t('detalle.verOfertas'), destino: 'ServiceOffers' };
  }
  if (uid && service.helperId === uid) return { label: t('comun.abrirChat'), destino: 'Chat' };
  if (miOferta?.status === 'pending') return { label: t('detalle.ofertaEnviada'), nota: t('detalle.ofertaEnviadaNota') };
  if (miOferta?.status === 'rejected') return { label: t('detalle.noElegida'), nota: t('detalle.noElegidaNota') };
  if (service.status === 'approved') return { label: t('detalle.ofrecerse'), destino: 'Apply' };
  if (service.status === 'pending') return { label: t('detalle.enRevision'), nota: t('detalle.enRevisionNota') };
  return { label: t('detalle.cerrado') };
}

const statusColor: Record<string, { fondo: string; color: string }> = {
  pending: { fondo: colors.amberTint, color: colors.amberDark },
  approved: { fondo: colors.greenTint, color: colors.green },
  accepted: { fondo: colors.blueTint, color: colors.blue },
  in_progress: { fondo: colors.blueTint, color: colors.blue },
  completed: { fondo: colors.greenTint, color: colors.green },
  rated: { fondo: colors.greenTint, color: colors.green },
  cancelled: { fondo: colors.border, color: colors.muted },
};

/** "★ 4.8 (12) · replies in ~2h", sin valores vacíos. */
export function resumenAutor(r: ServiceRequest['requester']): string {
  const partes = [
    r.rating > 0 ? `★ ${decimal(r.rating)}${r.ratingCount > 0 ? ` (${r.ratingCount})` : ''}` : t('comun.sinValoraciones'),
  ];
  if (r.responseLabel && r.responseLabel !== '—') partes.push(t('detalle.responde', { tiempo: r.responseLabel }));
  return partes.join(' · ');
}

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
      api
        .getService(serviceId)
        .then(setService)
        .catch(() => {
          // Backend not reachable — keep showing the local mock version.
        });
      api
        .listMyApplications()
        .then((ofertas) => setMiOferta(ofertas.find((o) => o.serviceId === serviceId) ?? null))
        .catch(() => setMiOferta(null));
    }, [serviceId]),
  );

  const accion = accionPrincipal(service, user?.uid ?? null, miOferta);
  const verAutor = !!service.requesterId && service.requesterId !== user?.uid;
  const pagos = usePagosActivos();
  const ubicacion = useUbicacion();
  const distancia =
    service.coords && ubicacion
      ? t('comun.aDistancia', { distancia: formatearDistancia(distanciaKm(ubicacion, service.coords)) })
      : service.distanceKm > 0
        ? t('comun.aDistancia', { distancia: `${service.distanceKm} km` })
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
                accessibilityLabel={t('comun.fotoDe', { nombre: service.title })}
              />
            ))}
          </ScrollView>
        )}
        <Pressable
          style={[styles.backButton, { top: insets.top + 12 }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('comun.atras')}
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
          <Chip label={t(`categorias.${service.category}`)} background={colors.accentTint} color={colors.accentDark} />
          <Chip
            label={t(`estados.${service.status}`)}
            background={(statusColor[service.status] ?? statusColor.pending).fondo}
            color={(statusColor[service.status] ?? statusColor.pending).color}
          />
        </View>

        <Text style={styles.title}>{service.title}</Text>

        {/* El autor lleva a su perfil, salvo que sea uno mismo. */}
        <Pressable
          style={styles.requesterCard}
          disabled={!verAutor}
          onPress={() => service.requesterId && navigation.navigate('NeighborProfile', { userId: service.requesterId })}
          accessibilityRole={verAutor ? 'button' : undefined}
          accessibilityLabel={verAutor ? t('comun.verPerfil', { nombre: service.requester.name }) : undefined}
        >
          <Avatar
            name={service.requester.name}
            photoURL={service.requester.photoURL}
            size={44}
            color={service.requester.avatarColor}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.requesterName}>{service.requester.name}</Text>
            <Text style={styles.requesterMeta}>{resumenAutor(service.requester)}</Text>
          </View>
          {verAutor && <Text style={styles.chevron}>›</Text>}
        </Pressable>
        {verAutor && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
            <Pressable onPress={() => denunciar('service', service.id)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.reportar}>🚩 {t('cuenta.reportarServicio')}</Text>
            </Pressable>
            <Pressable
              onPress={() => confirmarBloqueo(service.requester.name, service.requesterId!, () => navigation.goBack())}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.reportar}>🚫 {t('moderacion.bloquearA', { nombre: service.requester.name })}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.description}>{service.description}</Text>

        <View style={styles.infoList}>
          {service.durationLabel && service.durationLabel !== '—' ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('detalle.duracion')}</Text>
              <Text style={styles.infoValue}>{service.durationLabel}</Text>
            </View>
          ) : null}
          {pagos && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('detalle.precio')}</Text>
                <Text style={[styles.infoValue, { color: service.priceCents == null ? colors.green : colors.accentDark }]}>
                  {service.priceCents == null ? t('comun.gratis') : formatearPrecio(service.priceCents, { exacto: true })}
                </Text>
              </View>
              {/* Quien lo pide ve lo que pagará; quien ayuda, que se lleva el precio entero. */}
              {service.priceCents != null && (
                <Text style={styles.notaPrecio}>
                  {verAutor
                    ? t('detalle.recibesEntero')
                    : t('detalle.pagarasTotal', {
                        total: formatearPrecio(totalAPagar(service.priceCents), { exacto: true }),
                        gestion: formatearPrecio(comision(service.priceCents), { exacto: true }),
                      })}
                </Text>
              )}
            </>
          )}
          {distancia ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('detalle.ubicacion')}</Text>
              <Text style={styles.infoValue}>{distancia}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('detalle.disponible')}</Text>
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
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 31, color: colors.ink },
  requesterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: radii.md,
  },
  requesterName: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  chevron: { fontFamily: fonts.bodySemiBold, fontSize: 28, color: colors.mutedLight },
  reportar: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, textDecorationLine: 'underline' },
  requesterMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  description: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25, color: colors.muted },
  infoList: { gap: 10 },
  notaPrecio: { marginTop: -4, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontFamily: fonts.body, fontSize: 16, color: colors.muted },
  infoValue: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  footer: { padding: 20, paddingTop: 8 },
  nota: { marginTop: 8, textAlign: 'center', fontFamily: fonts.body, fontSize: 14, color: colors.muted },
});
