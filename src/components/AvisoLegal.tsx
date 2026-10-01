import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { t } from '../i18n';
import { abrirEnlace, enlaces } from '../config/enlaces';

/** «Al continuar aceptas…» con enlaces a los términos y la privacidad. */
export default function AvisoLegal() {
  return (
    <View style={styles.caja}>
      <Text style={styles.texto}>{t('legal.aceptas')}</Text>
      <View style={styles.enlaces}>
        <Pressable onPress={() => abrirEnlace(enlaces.terminos())} accessibilityRole="link" hitSlop={6}>
          <Text style={styles.enlace}>{t('cuenta.terminos')}</Text>
        </Pressable>
        <Text style={styles.texto}>·</Text>
        <Pressable onPress={() => abrirEnlace(enlaces.privacidad())} accessibilityRole="link" hitSlop={6}>
          <Text style={styles.enlace}>{t('cuenta.privacidad')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { alignItems: 'center', gap: 4 },
  texto: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center' },
  enlaces: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  enlace: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.accentDark, textDecorationLine: 'underline' },
});
