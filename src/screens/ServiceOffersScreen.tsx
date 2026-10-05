import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator, AppState, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme';
import { BackIcon } from '../icons';
import PillButton from '../components/PillButton';
import Avatar from '../components/Avatar';
import Stars from '../components/Stars';
import type { ServiceRequest } from '../data/mock';
import { api, type Application, type ApiUserProfile, type Review } from '../firebase/data';
import { dataErrorMessage, pagoErrorMessage } from '../firebase/errors';
import { comision, formatearPrecio, totalAPagar } from '../pagos/precio';
import { usePagosActivos } from '../config/remota';
import { insignias } from '../components/insignias';
import { decimal, idiomasTexto, nivelTexto, t, tp } from '../i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceOffers'>;

/**
 * Quién es quien oferta: foto, valoración, ayudas, insignias, idiomas y bio.
 * La cabecera lleva a su perfil completo.
 */
function Ofertante({
  nombre,
  perfil,
  onVerPerfil,
}: {
  nombre: string;
  perfil: ApiUserProfile | null | undefined;
  onVerPerfil: () => void;
}) {
  if (!perfil) {
    return (
      <Pressable style={styles.fila} onPress={onVerPerfil} accessibilityRole="button" accessibilityLabel={t('comun.verPerfil', { nombre })}>
        <Avatar name={nombre} photoURL={null} size={48} />
        <Text style={[styles.nombre, { flex: 1 }]}>{nombre}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    );
  }
  const ayudas = perfil.servicesCompleted;
  const logradas = insignias(ayudas).filter((i) => i.clave !== 'ayudas' && i.conseguida);
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        style={styles.fila}
        onPress={onVerPerfil}
        accessibilityRole="button"
        accessibilityLabel={t('comun.verPerfil', { nombre: perfil.name })}
      >
        <Avatar name={perfil.name} photoURL={perfil.photoURL} size={48} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.filaNombre}>
            <Text style={styles.nombre}>{perfil.name}</Text>
            {perfil.identityVerified && <Text style={styles.verificado}>{t('comun.verificado')}</Text>}
          </View>
          {perfil.rating > 0 ? (
            <View style={styles.filaNombre}>
              <Stars value={perfil.rating} size={13} />
              <Text style={styles.meta}>
                {decimal(perfil.rating)}
                {perfil.ratingCount > 0 ? ` · ${tp('comun.valoraciones', perfil.ratingCount)}` : ''}
              </Text>
            </View>
          ) : (
            <Text style={styles.meta}>{t('comun.sinValoraciones')}</Text>
          )}
          <Text style={styles.meta}>
            {tp('comun.ayudas', ayudas)} · {nivelTexto(perfil.level, perfil.levelLabel)}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {logradas.length > 0 && (
        <View style={styles.insignias}>
          {logradas.map((i) => (
            <Text key={i.clave} style={[styles.insignia, { backgroundColor: i.fondo }]}>
              {i.titulo}
            </Text>
          ))}
        </View>
      )}
      {perfil.languages ? <Text style={styles.meta}>{t('comun.habla', { idiomas: idiomasTexto(perfil.languages) })}</Text> : null}
      {perfil.bio ? <Text style={styles.bio}>{perfil.bio}</Text> : null}
    </View>
  );
}

/**
 * Ofertas recibidas en un servicio propio. Mientras está abierto se elige
 * una (solo una); después, se habla con esa persona y, al terminar, se le
 * valora, que es lo que da el servicio por completado.
 */
export default function ServiceOffersScreen({ navigation, route }: Props) {
  const { serviceId } = route.params;
  const [servicio, setServicio] = useState<ServiceRequest | null>(null);
  const [ofertas, setOfertas] = useState<Application[]>([]);
  const [resena, setResena] = useState<Review | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const pagos = usePagosActivos();
  const pagando = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([api.getService(serviceId), api.listApplicationsForService(serviceId)]);
      setServicio(s);
      setOfertas(o);
      setResena(s.status === 'rated' ? await api.getReview(serviceId).catch(() => null) : null);
    } catch (e) {
      Alert.alert(t('ofertas.errorCargar'), dataErrorMessage(e));
    }
  }, [serviceId]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  // Al volver de Stripe Checkout, el servicio ya estará aceptado (lo hace el servidor).
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && pagando.current) cargar();
    });
    return () => suscripcion?.remove();
  }, [cargar]);

  /** El cobro se devolvió y hay que volver a pagar: el enlace lo da misPagos (solo a quien pidió). */
  const volverAPagar = async () => {
    setOcupado(true);
    try {
      const url = (await api.misPagos()).find((p) => p.serviceId === serviceId && p.urlPago)?.urlPago;
      if (!url) {
        Alert.alert(t('pagos.errorPagar'), t('pagos.enlaceCaducado'));
        return;
      }
      pagando.current = true;
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(t('pagos.errorPagar'), pagoErrorMessage(e));
    } finally {
      setOcupado(false);
    }
  };

  /** Con precio: se paga al crearlo (o, si se creó sin pagar, antes de elegir). */
  const pagarServicio = async () => {
    setOcupado(true);
    try {
      const url = await api.pagarServicio(serviceId);
      pagando.current = true;
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(t('pagos.errorPagar'), pagoErrorMessage(e));
    } finally {
      setOcupado(false);
    }
  };

  /** Antes de elegir a nadie se puede cancelar; si estaba pagado, se devuelve todo. */
  const cancelar = () => {
    const total = servicio?.pago ? formatearPrecio(servicio.pago.total, { exacto: true }) : null;
    Alert.alert(t('cancelar.titulo'), total ? t('cancelar.textoPagado', { total }) : t('cancelar.texto'), [
      { text: t('cancelar.volver'), style: 'cancel' },
      {
        text: t('cancelar.confirmar'),
        style: 'destructive',
        onPress: async () => {
          setOcupado(true);
          try {
            const { reembolsado } = await api.cancelarServicio(serviceId);
            Alert.alert(
              reembolsado ? t('cancelar.reembolso', { total: formatearPrecio(reembolsado, { exacto: true }) }) : t('cancelar.hecho')
            );
            await cargar();
          } catch (e) {
            Alert.alert(t('cancelar.error'), pagoErrorMessage(e));
          } finally {
            setOcupado(false);
          }
        },
      },
    ]);
  };

  const elegir = (oferta: Application) => {
    const pagadoYa = servicio?.pago?.estado === 'retenido';
    Alert.alert(
      t('ofertas.elegirTitulo', { nombre: oferta.applicantName }),
      pagadoYa && servicio?.priceCents != null
        ? t('ofertas.elegirPagadoTexto', { nombre: oferta.applicantName, precio: formatearPrecio(servicio.priceCents, { exacto: true }) })
        : t('ofertas.elegirTexto'),
      [
        { text: t('comun.cancelar'), style: 'cancel' },
        {
          text: t('ofertas.elegir'),
          onPress: async () => {
            setOcupado(true);
            try {
              // Pagado: elige el servidor (apunta a quién se le pagará). Gratis: la app.
              if (pagadoYa) await api.elegirOfertaPagada(serviceId, oferta.applicantId);
              else await api.selectApplicant(serviceId, oferta.id);
              await cargar();
            } catch (e) {
              Alert.alert(t('ofertas.errorElegir'), pagadoYa ? pagoErrorMessage(e) : dataErrorMessage(e));
            } finally {
              setOcupado(false);
            }
          },
        },
      ]
    );
  };

  // Completar es valorar: la pantalla de valoración deja el servicio cerrado.
  const valorar = () => navigation.navigate('RateHelper', { serviceId });

  const abierto = servicio?.status === 'approved';
  const sinElegir = servicio?.status === 'pending' || servicio?.status === 'approved';
  const conPrecio = servicio?.priceCents != null;
  // Con los pagos encendidos, uno con precio se paga antes de revisarlo o de elegir.
  const faltaPagar = pagos && conPrecio && sinElegir && !servicio?.pago;
  const retenidoSinElegir = sinElegir && servicio?.pago?.estado === 'retenido';
  const exacto = { exacto: true };
  const enCurso = servicio?.status === 'accepted' || servicio?.status === 'in_progress';
  const terminado = servicio?.status === 'completed' || servicio?.status === 'rated';
  // Quien ayudó ya lo marcó como hecho, pero falta mi valoración.
  const porValorar = servicio?.status === 'completed';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('comun.atras')}
        >
          <BackIcon size={18} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo} numberOfLines={2}>
            {servicio?.title ?? ''}
          </Text>
          <Text style={styles.subtitulo}>
            {tp('comun.ofertas', ofertas.length)}
          </Text>
        </View>
        {/* Se puede editar mientras no se haya elegido a nadie. */}
        {(servicio?.status === 'pending' || servicio?.status === 'approved') && (
          <Pressable
            style={styles.editar}
            onPress={() => navigation.navigate('CreateService', { serviceId })}
            accessibilityRole="button"
          >
            <Text style={styles.editarTexto}>{t('ofertas.editar')}</Text>
          </Pressable>
        )}
      </View>

      {servicio?.status === 'pending' && !faltaPagar && (
        <Text style={styles.aviso}>{t('ofertas.enRevision')}</Text>
      )}
      {faltaPagar && servicio?.priceCents != null && (
        <View style={styles.elegido}>
          <Text style={[styles.pagoTexto, { color: colors.ink }]}>
            {t(servicio.status === 'pending' ? 'pagos.pagarParaPublicar' : 'pagos.pagarParaElegir', {
              total: formatearPrecio(totalAPagar(servicio.priceCents), exacto),
              precio: formatearPrecio(servicio.priceCents, exacto),
              gestion: formatearPrecio(comision(servicio.priceCents), exacto),
            })}
          </Text>
          <PillButton
            label={t('pagos.pagarAhora', { total: formatearPrecio(totalAPagar(servicio.priceCents), exacto) })}
            onPress={pagarServicio}
            disabled={ocupado}
          />
        </View>
      )}
      {retenidoSinElegir && servicio?.pago && (
        <Text style={[styles.aviso, { backgroundColor: colors.greenTint }]}>
          {t('pagos.retenidoAlCrear', {
            total: formatearPrecio(servicio.pago.total, exacto),
            precio: formatearPrecio(servicio.pago.precio, exacto),
          })}
        </Text>
      )}
      {servicio?.status === 'cancelled' && (
        <Text style={styles.aviso}>
          {servicio.pago?.estado === 'reembolsado'
            ? t('cancelar.canceladoReembolso', { total: formatearPrecio(servicio.pago.total, exacto) })
            : t('cancelar.cancelado')}
        </Text>
      )}

      {(enCurso || terminado) && servicio?.helperName && (
        <View style={styles.elegido}>
          <Text style={styles.elegidoTexto}>
            {terminado
              ? t('ofertas.completadoCon', { nombre: servicio.helperName })
              : t('ofertas.teAyuda', { nombre: servicio.helperName })}
          </Text>
          {servicio.pago?.porPagar && servicio.pago.estado !== 'pagado' ? (
            <View style={{ gap: 10 }}>
              <Text style={[styles.pagoTexto, { color: colors.accentDark }]}>
                {t('pagos.porPagarTexto', {
                  total: formatearPrecio(servicio.pago.total, { exacto: true }),
                  nombre: servicio.helperName,
                })}
              </Text>
              <PillButton
                label={t('pagos.pagarAhora', { total: formatearPrecio(servicio.pago.total, { exacto: true }) })}
                onPress={volverAPagar}
                disabled={ocupado}
              />
            </View>
          ) : servicio.pago && (
            <Text style={styles.pagoTexto}>
              {servicio.pago.estado === 'pagado'
                ? t('pagos.pagado', { precio: formatearPrecio(servicio.pago.precio, { exacto: true }), nombre: servicio.helperName })
                : servicio.pago.estado === 'reembolsado'
                  ? t('pagos.reembolsado', { total: formatearPrecio(servicio.pago.total, { exacto: true }) })
                  : servicio.pago.estado === 'error'
                    ? t('pagos.problema')
                    : t('pagos.retenido', {
                    total: formatearPrecio(servicio.pago.total, { exacto: true }),
                    precio: formatearPrecio(servicio.pago.precio, { exacto: true }),
                    nombre: servicio.helperName,
                  })}
            </Text>
          )}
          {resena && (
            <View style={{ gap: 4 }}>
              <View style={styles.filaNombre}>
                <Text style={styles.meta}>{t('ofertas.tuValoracion')}</Text>
                <Stars value={resena.rating} size={14} />
              </View>
              {resena.comment ? <Text style={styles.comentario}>“{resena.comment}”</Text> : null}
            </View>
          )}
          {/* Uno debajo del otro: en alemán, o con nombres largos, no caben en una fila. */}
          <View style={{ gap: 10 }}>
            <PillButton label={t('comun.abrirChat')} onPress={() => navigation.navigate('Chat', { serviceId })} />
            {(enCurso || porValorar) && (
              <PillButton
                label={enCurso ? t('ofertas.marcarHecho') : t('ofertas.valorarA', { nombre: servicio.helperName })}
                variant="outline"
                onPress={valorar}
                disabled={ocupado}
              />
            )}
          </View>
        </View>
      )}

      <FlatList
        data={ofertas}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          servicio && abierto ? <Text style={styles.vacio}>{t('ofertas.vacio')}</Text> : null
        }
        renderItem={({ item }) => (
          <View style={[styles.tarjeta, item.status === 'rejected' && { opacity: 0.55 }]}>
            <Ofertante
              nombre={item.applicantName}
              perfil={item.applicant}
              onVerPerfil={() => navigation.navigate('NeighborProfile', { userId: item.applicantId })}
            />
            {item.comment ? (
              <View style={styles.oferta}>
                <Text style={styles.etiquetaOferta}>{t('ofertas.suOferta')}</Text>
                <Text style={styles.comentario}>“{item.comment}”</Text>
              </View>
            ) : null}
            {abierto && (retenidoSinElegir || (pagos && conPrecio)) && !item.applicant?.cobrosActivos ? (
              // Sin cobros activos no se le puede pagar: primero tiene que activarlos.
              <Text style={styles.estado}>{t('pagos.sinCobrosOferta')}</Text>
            ) : abierto && faltaPagar ? null : abierto ? (
              <PillButton label={t('ofertas.elegir')} onPress={() => elegir(item)} disabled={ocupado} />
            ) : (
              <Text style={[styles.estado, item.status === 'selected' && { color: colors.green }]}>
                {item.status === 'selected'
                  ? t('ofertas.elegida')
                  : item.status === 'rejected'
                    ? t('ofertas.noElegida')
                    : t('ofertas.esperando')}
              </Text>
            )}
          </View>
        )}
      />
      {sinElegir && (
        <Pressable style={styles.cancelar} onPress={cancelar} disabled={ocupado} accessibilityRole="button">
          <Text style={styles.cancelarTexto}>{t('cancelar.boton')}</Text>
        </Pressable>
      )}
      {ocupado && <ActivityIndicator style={styles.cargando} color={colors.accent} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pagoTexto: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.green },
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  editar: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.card },
  editarTexto: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.accentDark },
  subtitulo: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  aviso: {
    margin: 20,
    marginBottom: 0,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.amberTint,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  elegido: { margin: 20, marginBottom: 0, padding: 16, borderRadius: radii.lg, backgroundColor: colors.card, gap: 12, ...shadow },
  elegidoTexto: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  lista: { padding: 20, gap: 12 },
  vacio: { marginTop: 30, textAlign: 'center', fontFamily: fonts.body, fontSize: 16, color: colors.muted },
  tarjeta: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, gap: 10, ...shadow },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filaNombre: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  nombre: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink },
  verificado: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.green },
  chevron: { fontFamily: fonts.bodySemiBold, fontSize: 28, color: colors.mutedLight },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  insignias: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  insignia: {
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.ink,
  },
  bio: { fontFamily: fonts.body, fontSize: 15, color: colors.ink, lineHeight: 22 },
  oferta: { gap: 4, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  etiquetaOferta: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.mutedLight, textTransform: 'uppercase' },
  comentario: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, lineHeight: 21 },
  estado: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.muted },
  cargando: { position: 'absolute', top: '50%', alignSelf: 'center' },
  cancelar: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  cancelarTexto: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.accentDark },
});
