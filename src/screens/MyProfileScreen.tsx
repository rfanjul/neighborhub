import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme';
import { SettingsIcon } from '../icons';
import { currentUser as mockCurrentUser } from '../data/mock';
import { api } from '../firebase/data';
import { useAuth } from '../auth/AuthContext';
import PhotoCaptureModal from '../components/PhotoCaptureModal';
import { insignias } from '../components/insignias';
import { cambiarIdioma, decimal, idiomaActual, idiomas, nivelTexto, t } from '../i18n';
import { abrirEnlace, enlaces } from '../config/enlaces';
import { authErrorMessage } from '../auth/errors';

export default function MyProfileScreen() {
  const { logout, user, deleteAccount, provider } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentUser, setCurrentUser] = useState(mockCurrentUser);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  // Servicios completados en los que he ayudado: la cifra de "Services" y
  // la base de las insignias. Se calcula, no se guarda en el perfil.
  const [ayudas, setAyudas] = useState(0);

  const handleSettingsPress = () => {
    Alert.alert(t('miPerfil.cuenta'), undefined, [
      { text: t('comun.cancelar'), style: 'cancel' },
      { text: t('miPerfil.editarDatos'), onPress: () => navigation.navigate('ProfileDetails') },
      { text: t('idioma.titulo'), onPress: elegirIdioma },
      { text: t('cuenta.legal'), onPress: ayudaYLegal },
      { text: t('miPerfil.salir'), onPress: () => logout() },
      { text: t('cuenta.borrar'), style: 'destructive', onPress: confirmarBorrado },
    ]);
  };

  const ayudaYLegal = () => {
    Alert.alert(t('cuenta.legal'), undefined, [
      { text: t('cuenta.ayuda'), onPress: () => abrirEnlace(enlaces.soporte()) },
      { text: t('cuenta.privacidad'), onPress: () => abrirEnlace(enlaces.privacidad()) },
      { text: t('cuenta.terminos'), onPress: () => abrirEnlace(enlaces.terminos()) },
      { text: t('comun.cancelar'), style: 'cancel' },
    ]);
  };

  /** Borrar la cuenta: aviso, confirmar identidad y borrar. */
  const confirmarBorrado = () => {
    Alert.alert(t('cuenta.borrarTitulo'), t('cuenta.borrarTexto'), [
      { text: t('comun.cancelar'), style: 'cancel' },
      {
        text: t('cuenta.borrarBoton'),
        style: 'destructive',
        onPress: () => {
          if (provider === 'password') {
            // Con email hace falta la contraseña; con Apple o Google, su propio diálogo.
            Alert.prompt(
              t('cuenta.confirmarTitulo'),
              t('cuenta.confirmarTexto'),
              [
                { text: t('comun.cancelar'), style: 'cancel' },
                { text: t('cuenta.borrarBoton'), style: 'destructive', onPress: (clave?: string) => borrar(clave ?? '') },
              ],
              'secure-text'
            );
          } else {
            borrar();
          }
        },
      },
    ]);
  };

  const borrar = async (password?: string) => {
    try {
      if (await deleteAccount(password)) Alert.alert(t('cuenta.borrada'));
    } catch (e) {
      Alert.alert(t('cuenta.errorBorrar'), authErrorMessage(e));
    }
  };

  const elegirIdioma = () => {
    Alert.alert(t('idioma.elegir'), undefined, [
      ...idiomas.map(({ codigo, nombre }) => ({
        text: codigo === idiomaActual() ? `✓ ${nombre}` : nombre,
        onPress: () => cambiarIdioma(codigo),
      })),
      { text: t('comun.cancelar'), style: 'cancel' as const },
    ]);
  };

  const verMisAyudas = () => {
    if (user) navigation.navigate('NeighborList', { userId: user.uid, lista: 'helps', nombre: currentUser.name });
  };

  const handleCaptured = async (uri: string) => {
    const updated = await api.uploadMyPhoto(uri);
    setPhotoURL(updated.photoURL);
    setPhotoVersion((v) => v + 1);
  };

  useFocusEffect(
    useCallback(() => {
      api
        .countCompletedHelps()
        .then(setAyudas)
        .catch(() => setAyudas(0));
      api
        .getMe()
        .then((me) => {
          setPhotoURL(me.photoURL);
          setCurrentUser({
            name: me.name,
            level: me.level,
            levelLabel: me.levelLabel,
            credits: me.credits,
            servicesCompleted: me.servicesCompleted,
            rating: me.rating,
            responseLabel: me.responseLabel,
            bio: me.bio ?? mockCurrentUser.bio,
          });
        })
        .catch(() => setCurrentUser(mockCurrentUser));
    }, [])
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('miPerfil.titulo')}</Text>
        <Pressable
          style={styles.settingsButton}
          onPress={handleSettingsPress}
          accessibilityRole="button"
          accessibilityLabel={t('miPerfil.ajustes')}
        >
          <SettingsIcon size={15} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.identity}>
          <Pressable onPress={() => setShowCamera(true)} accessibilityRole="button" accessibilityLabel={t('miPerfil.cambiarFoto')}>
            {photoURL ? (
              <Image source={{ uri: `${photoURL}${photoURL.includes('?') ? '&' : '?'}v=${photoVersion}` }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar} />
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditBadgeText}>{t('miPerfil.editar')}</Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <Text style={styles.name}>{currentUser.name}</Text>
            <View style={styles.verifiedDot} />
          </View>
          <View style={styles.levelChip}>
            <Text style={styles.levelLabel}>
              {t('miPerfil.nivel', { nivel: currentUser.level, etiqueta: nivelTexto(currentUser.level, currentUser.levelLabel) })}
            </Text>
          </View>
        </View>

        {/* Ayudas y valoración llevan a la lista de ayudas con sus reseñas, como en el perfil de otro vecino. */}
        <View style={styles.statsCard}>
          <Pressable
            style={[styles.statItem, styles.statBorder]}
            onPress={verMisAyudas}
            accessibilityRole="button"
            accessibilityLabel={t('miPerfil.verAyudas')}
          >
            <Text style={styles.statValue}>{ayudas}</Text>
            <Text style={styles.statLink}>{t('miPerfil.ayudas')}</Text>
          </Pressable>
          <Pressable
            style={[styles.statItem, styles.statBorder]}
            onPress={verMisAyudas}
            accessibilityRole="button"
            accessibilityLabel={t('miPerfil.verResenas')}
          >
            <Text style={styles.statValue}>{decimal(currentUser.rating)} ★</Text>
            <Text style={styles.statLink}>{t('miPerfil.resenas')}</Text>
          </Pressable>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{currentUser.responseLabel}</Text>
            <Text style={styles.statLabel}>{t('miPerfil.respuesta')}</Text>
          </View>
        </View>

        <View style={styles.creditsCard}>
          <View>
            <Text style={styles.creditsCaption}>{t('miPerfil.creditos')}</Text>
            <Text style={styles.creditsValue}>{currentUser.credits}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('miPerfil.insignias')}</Text>
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

        <Text style={styles.bio}>{currentUser.bio}</Text>
      </ScrollView>

      <PhotoCaptureModal visible={showCamera} onClose={() => setShowCamera(false)} onCaptured={handleCaptured} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: { paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  settingsButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  identity: { alignItems: 'center', paddingTop: 16 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accentTint, borderWidth: 3, borderColor: colors.card },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.ink,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: colors.backgroundAlt,
  },
  avatarEditBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.white },
  name: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26, color: colors.ink },
  verifiedDot: { width: 15, height: 15, borderRadius: 8, backgroundColor: colors.blue },
  levelChip: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.accentTint },
  levelLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.accentDark },
  statsCard: { marginHorizontal: 20, marginTop: 20, flexDirection: 'row', backgroundColor: colors.card, borderRadius: radii.md, paddingVertical: 14, ...shadow },
  statItem: { flex: 1, alignItems: 'center' },
  statBorder: { borderRightWidth: 1, borderRightColor: colors.border },
  statValue: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: colors.ink },
  statLink: { marginTop: 2, fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.accentDark },
  statLabel: { marginTop: 2, fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  creditsCard: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditsCaption: { fontFamily: fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  creditsValue: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.white },
  section: { marginHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.muted },
  badgesRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeItem: { width: 72, alignItems: 'center', gap: 6 },
  badgeIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeRequisito: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: 'center' },
  badgeLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: 'center' },
  bio: { marginHorizontal: 20, marginTop: 20, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.muted },
});
