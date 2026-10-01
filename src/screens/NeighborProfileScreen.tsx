import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme';
import { BackIcon } from '../icons';
import Avatar from '../components/Avatar';
import Stars from '../components/Stars';
import { insignias } from '../components/insignias';
import { api, type ApiUserProfile } from '../firebase/data';
import { mesYAno } from '../utils/fecha';
import { decimal, idiomasTexto, nivelTexto, t, tp } from '../i18n';
import { abrirEnlace, enlaces } from '../config/enlaces';

type Props = NativeStackScreenProps<RootStackParamList, 'NeighborProfile'>;

/**
 * Perfil público de otro vecino: quién es, cómo le valoran y, con enlace,
 * sus ayudas (con las reseñas) y sus servicios abiertos.
 */
export default function NeighborProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const [perfil, setPerfil] = useState<ApiUserProfile | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [servicios, setServicios] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .getUserProfile(userId)
        .then((p) => {
          setPerfil(p);
          setNoEncontrado(!p);
        })
        .catch(() => setNoEncontrado(true));
      api
        .listServicesBy(userId)
        .then((s) => setServicios(s.length))
        .catch(() => setServicios(0));
    }, [userId])
  );

  const verLista = (lista: 'helps' | 'services') =>
    navigation.navigate('NeighborList', { userId, lista, nombre: perfil?.name ?? '' });

  const cabecera = (
    <View style={styles.header}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('comun.atras')}>
        <BackIcon size={18} />
      </Pressable>
      <Text style={styles.headerTitle}>{t('vecino.titulo')}</Text>
    </View>
  );

  if (!perfil) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {cabecera}
        {noEncontrado ? (
          <Text style={styles.vacio}>{t('vecino.noEncontrado')}</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
        )}
      </SafeAreaView>
    );
  }

  const ayudas = perfil.servicesCompleted;
  const ubicacion = [perfil.postalCode, perfil.city].filter(Boolean).join(' ');
  // Lo que se enseña cuando un dato no está: nunca un hueco.
  const sinDato = t('vecino.sinDato');
  const datos: Array<[string, string]> = [
    [t('vecino.idiomas'), idiomasTexto(perfil.languages) || sinDato],
    [t('vecino.ubicacion'), ubicacion || sinDato],
    [
      t('vecino.responde'),
      perfil.responseLabel && perfil.responseLabel !== '—' ? perfil.responseLabel : t('vecino.sinDatos'),
    ],
    [t('vecino.miembro'), perfil.memberSince ? mesYAno(perfil.memberSince) : sinDato],
    [t('vecino.identidad'), perfil.identityVerified ? t('vecino.verificada') : t('vecino.noVerificada')],
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {cabecera}
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.identity}>
          <Avatar name={perfil.name} photoURL={perfil.photoURL} size={84} />
          <View style={styles.nombreFila}>
            <Text style={styles.name}>{perfil.name}</Text>
            {perfil.identityVerified && <Text style={styles.verificado}>{t('comun.verificado')}</Text>}
          </View>
          <View style={styles.levelChip}>
            <Text style={styles.levelLabel}>{nivelTexto(perfil.level, perfil.levelLabel)}</Text>
          </View>
          <View style={styles.valoracion}>
            <Stars value={perfil.rating} size={15} />
            <Text style={styles.valoracionTexto}>
              {perfil.rating > 0 ? decimal(perfil.rating) : t('comun.sinValoraciones')}
              {perfil.ratingCount > 0 ? ` · ${tp('comun.valoraciones', perfil.ratingCount)}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <Pressable
            style={[styles.statItem, styles.statBorder]}
            onPress={() => verLista('helps')}
            accessibilityRole="button"
            accessibilityLabel={t('vecino.verAyudas', { nombre: perfil.name })}
          >
            <Text style={styles.statValue}>{ayudas}</Text>
            <Text style={styles.statLink}>{t('vecino.ayudas')}</Text>
          </Pressable>
          <Pressable
            style={[styles.statItem, styles.statBorder]}
            onPress={() => verLista('services')}
            accessibilityRole="button"
            accessibilityLabel={t('vecino.verServicios', { nombre: perfil.name })}
          >
            <Text style={styles.statValue}>{servicios ?? '…'}</Text>
            <Text style={styles.statLink}>{t('vecino.servicios')}</Text>
          </Pressable>
          <Pressable
            style={styles.statItem}
            onPress={() => verLista('helps')}
            accessibilityRole="button"
            accessibilityLabel={t('vecino.verResenas', { nombre: perfil.name })}
          >
            <Text style={styles.statValue}>{perfil.rating > 0 ? `${decimal(perfil.rating)} ★` : t('vecino.nuevo')}</Text>
            <Text style={styles.statLink}>{t('vecino.resenas')}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('vecino.sobre')}</Text>
          <Text style={styles.bio}>{perfil.bio || t('vecino.sinBio', { nombre: perfil.name })}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('vecino.detalles')}</Text>
          <View style={styles.datos}>
            {datos.map(([etiqueta, valor], i) => (
              <View key={etiqueta} style={[styles.dato, i > 0 && styles.datoBorde]}>
                <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
                <Text style={styles.datoValor}>{valor}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('vecino.insignias')}</Text>
          <View style={styles.badgesRow}>
            {insignias(ayudas).map((b) => (
              <View
                key={b.clave}
                style={[styles.badgeItem, !b.conseguida && { opacity: 0.35 }]}
                accessibilityLabel={b.conseguida ? b.titulo : t('insignias.bloqueada', { titulo: b.titulo, requisito: b.requisito })}
              >
                <View style={[styles.badgeIcon, { backgroundColor: b.fondo }]}>{b.icono}</View>
                <Text style={styles.badgeLabel}>{b.titulo}</Text>
                {!b.conseguida && <Text style={styles.badgeRequisito}>{b.requisito}</Text>}
              </View>
            ))}
          </View>
        </View>
        <Pressable
          style={styles.section}
          onPress={() => abrirEnlace(enlaces.contacto('reportar', `user:${userId}`))}
          accessibilityRole="link"
        >
          <Text style={styles.reportar}>🚩 {t('cuenta.reportarUsuario')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  vacio: { marginTop: 40, textAlign: 'center', fontFamily: fonts.body, fontSize: 16, color: colors.muted },
  identity: { alignItems: 'center', paddingTop: 16, gap: 6 },
  nombreFila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  name: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  verificado: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.green },
  levelChip: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.accentTint },
  levelLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.accentDark },
  valoracion: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valoracionTexto: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  statsCard: {
    marginHorizontal: 20,
    marginTop: 20,
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: 14,
    ...shadow,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statBorder: { borderRightWidth: 1, borderRightColor: colors.border },
  statValue: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26, color: colors.ink },
  statLink: { marginTop: 2, fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.accentDark },
  section: { marginHorizontal: 20, marginTop: 22 },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.muted, marginBottom: 8 },
  bio: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink },
  datos: { backgroundColor: colors.card, borderRadius: radii.md, paddingHorizontal: 16, ...shadow },
  dato: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, gap: 12 },
  datoBorde: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  datoEtiqueta: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  datoValor: { flexShrink: 1, textAlign: 'right', fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeItem: { width: 72, alignItems: 'center', gap: 6 },
  badgeIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeRequisito: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: 'center' },
  badgeLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: 'center' },
  reportar: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, textDecorationLine: 'underline' },
});
