import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme';
import Chip from '../components/Chip';
import CategoryIcon from '../components/CategoryIcon';
import type { ServiceRequest } from '../data/mock';
import { api, type Application } from '../firebase/data';
import { t, type Clave } from '../i18n';
import { usePagosActivos } from '../config/remota';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'ActivityTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Segmento = 'services' | 'offers';

/** Etiqueta y colores del estado de un servicio propio. */
const estadoServicio: Record<string, { texto: Clave; fondo: string; color: string }> = {
  pending: { texto: 'estados.pending', fondo: colors.amberTint, color: colors.amberDark },
  approved: { texto: 'actividad.abierto', fondo: colors.greenTint, color: colors.green },
  accepted: { texto: 'actividad.enCurso', fondo: colors.blueTint, color: colors.blue },
  in_progress: { texto: 'actividad.enCurso', fondo: colors.blueTint, color: colors.blue },
  completed: { texto: 'actividad.completado', fondo: colors.greenTint, color: colors.green },
  rated: { texto: 'actividad.completado', fondo: colors.greenTint, color: colors.green },
  cancelled: { texto: 'actividad.cancelado', fondo: colors.border, color: colors.muted },
};
const sinPagar = { texto: 'actividad.sinPagar' as Clave, fondo: colors.accentTint, color: colors.accentDark };

const estadoOferta: Record<Application['status'], { texto: Clave; fondo: string; color: string }> = {
  pending: { texto: 'actividad.esperando', fondo: colors.amberTint, color: colors.amberDark },
  selected: { texto: 'actividad.elegida', fondo: colors.greenTint, color: colors.green },
  rejected: { texto: 'actividad.noElegida', fondo: colors.border, color: colors.muted },
};

export default function ActivityScreen({ navigation, route }: Props) {
  const [segmento, setSegmento] = useState<Segmento>(route.params?.segmento ?? 'services');
  const pagos = usePagosActivos();
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
      ? t('actividad.vacioServicios')
      : t('actividad.vacioOfertas');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.titulo}>{t('actividad.titulo')}</Text>
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
              {s === 'services' ? t('actividad.misServicios') : t('actividad.misOfertas')}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && (
        <Text style={styles.error}>
          {segmento === 'services' ? t('actividad.errorServicios') : t('actividad.errorOfertas')} {t('actividad.reintentar')}
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
            // Con precio y sin pagar (pagos encendidos): falta pagarlo para revisarlo o elegir.
            const faltaPago =
              pagos && item.priceCents != null && !item.pago && (item.status === 'pending' || item.status === 'approved');
            const estado = faltaPago ? sinPagar : (estadoServicio[item.status] ?? estadoServicio.pending);
            return (
              <Pressable
                style={[styles.tarjeta, styles.conMiniatura]}
                onPress={() => navigation.navigate('ServiceOffers', { serviceId: item.id })}
                accessibilityRole="button"
              >
                {/* Como una lista de anuncios: la foto a la izquierda, o su categoría. */}
                {item.photos[0] ? (
                  <Image source={{ uri: item.photos[0] }} style={styles.miniatura} accessibilityLabel={t('comun.fotoDe', { nombre: item.title })} />
                ) : (
                  <CategoryIcon category={item.category} size={72} />
                )}
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={styles.tarjetaTitulo} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={{ alignItems: 'flex-start', gap: 6 }}>
                    <Chip label={t(estado.texto)} background={estado.fondo} color={estado.color} />
                    {item.helperName && <Text style={styles.meta}>{t('actividad.con', { nombre: item.helperName })}</Text>}
                  </View>
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
                  <Chip label={t(estado.texto)} background={estado.fondo} color={estado.color} />
                  {item.status === 'selected' && (
                    <Pressable
                      style={styles.botonChat}
                      onPress={() => navigation.navigate('Chat', { serviceId: item.serviceId })}
                      accessibilityRole="button"
                    >
                      <Text style={styles.botonChatTexto}>{t('comun.abrirChat')}</Text>
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
  titulo: { marginTop: 8, marginHorizontal: 20, fontFamily: fonts.display, fontSize: 30, lineHeight: 38, color: colors.ink },
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
  segmentoTexto: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  segmentoTextoActivo: { color: colors.white },
  error: { marginHorizontal: 20, marginTop: 10, fontFamily: fonts.body, fontSize: 14, color: colors.accentDark },
  lista: { padding: 20, gap: 12 },
  vacio: { marginTop: 40, textAlign: 'center', fontFamily: fonts.body, fontSize: 16, color: colors.muted, lineHeight: 23 },
  tarjeta: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, gap: 10, ...shadow },
  conMiniatura: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  miniatura: { width: 72, height: 72, borderRadius: radii.sm, backgroundColor: colors.accentTint },
  tarjetaTitulo: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: colors.ink },
  comentario: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, lineHeight: 21 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  botonChat: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.accent },
  botonChatTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.white },
});
