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
  const [esperandoPago, setEsperandoPago] = useState(false);
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
  useEffect(() => {
    if (servicio && servicio.status !== 'approved') {
      pagando.current = false;
      setEsperandoPago(false);
    }
  }, [servicio]);

  /** Con precio: se paga en Stripe y el servidor acepta el servicio al confirmarse. */
  const pagarYElegir = (oferta: Application, precio: number) => {
    const exacto = { exacto: true };
    const total = formatearPrecio(totalAPagar(precio), exacto);
    Alert.alert(
      t('pagos.confirmarTitulo', { nombre: oferta.applicantName }),
      t('pagos.confirmarTexto', {
        total,
        precio: formatearPrecio(precio, exacto),
        gestion: formatearPrecio(comision(precio), exacto),
        nombre: oferta.applicantName,
      }),
      [
        { text: t('comun.cancelar'), style: 'cancel' },
        {
          text: t('pagos.pagar', { total }),
          onPress: async () => {
            setOcupado(true);
            try {
              const url = await api.pagarOferta(serviceId, oferta.applicantId);
              pagando.current = true;
              setEsperandoPago(true);
              await Linking.openURL(url);
            } catch (e) {
              Alert.alert(t('pagos.errorPagar'), pagoErrorMessage(e));
            } finally {
              setOcupado(false);
            }
          },
        },
      ]
    );
  };

  const elegir = (oferta: Application) => {
    if (pagos && servicio?.priceCents != null) {
      pagarYElegir(oferta, servicio.priceCents);
      return;
    }
    Alert.alert(t('ofertas.elegirTitulo', { nombre: oferta.applicantName }), t('ofertas.elegirTexto'), [
      { text: t('comun.cancelar'), style: 'cancel' },
      {
        text: t('ofertas.elegir'),
        onPress: async () => {
          setOcupado(true);
          try {
            await api.selectApplicant(serviceId, oferta.id);
            await cargar();
          } catch (e) {
            Alert.alert(t('ofertas.errorElegir'), dataErrorMessage(e));
          } finally {
            setOcupado(false);
          }
        },
      },
    ]);
  };

  // Completar es valorar: la pantalla de valoración deja el servicio cerrado.
  const valorar = () => navigation.navigate('RateHelper', { serviceId });

  const abierto = servicio?.status === 'approved';
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

      {servicio?.status === 'pending' && (
        <Text style={styles.aviso}>{t('ofertas.enRevision')}</Text>
      )}
      {esperandoPago && abierto && <Text style={styles.aviso}>{t('pagos.esperando')}</Text>}

      {(enCurso || terminado) && servicio?.helperName && (
        <View style={styles.elegido}>
          <Text style={styles.elegidoTexto}>
            {terminado
              ? t('ofertas.completadoCon', { nombre: servicio.helperName })
              : t('ofertas.teAyuda', { nombre: servicio.helperName })}
          </Text>
          {servicio.pago && (
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
            {abierto && pagos && servicio?.priceCents != null && !item.applicant?.cobrosActivos ? (
              // Sin cobros activos no se le puede pagar: primero tiene que activarlos.
              <Text style={styles.estado}>{t('pagos.sinCobrosOferta')}</Text>
            ) : abierto ? (
              <PillButton
                label={pagos && servicio?.priceCents != null ? t('pagos.pagar', { total: formatearPrecio(totalAPagar(servicio.priceCents), { exacto: true }) }) : t('ofertas.elegir')}
                onPress={() => elegir(item)}
                disabled={ocupado}
              />
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
});
