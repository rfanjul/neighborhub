import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { cambiarIdioma, idiomas, t, useIdioma } from '../i18n';

/**
 * EN · DE · ES para cambiar el idioma de la app. `sobreFoto` es la versión
 * translúcida para ponerla encima de una imagen.
 */
export default function SelectorIdioma({ sobreFoto = false }: { sobreFoto?: boolean }) {
  const actual = useIdioma();
  return (
    <View
      style={[styles.caja, sobreFoto ? styles.cajaFoto : styles.cajaClara]}
      accessibilityRole="tablist"
      accessibilityLabel={t('idioma.elegir')}
    >
      {idiomas.map(({ codigo, nombre }) => {
        const activo = codigo === actual;
        return (
          <Pressable
            key={codigo}
            onPress={() => cambiarIdioma(codigo)}
            style={[styles.opcion, activo && (sobreFoto ? styles.activoFoto : styles.activoClaro)]}
            accessibilityRole="tab"
            accessibilityLabel={nombre}
            accessibilityState={{ selected: activo }}
            hitSlop={4}
          >
            <Text
              style={[
                styles.texto,
                { color: sobreFoto ? colors.white : colors.ink },
                activo && { color: sobreFoto ? colors.accentDark : colors.white },
              ]}
            >
              {codigo.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { flexDirection: 'row', padding: 3, borderRadius: 18, gap: 2 },
  cajaFoto: { backgroundColor: 'rgba(30,23,18,0.35)' },
  cajaClara: { backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  opcion: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 15 },
  activoFoto: { backgroundColor: colors.white },
  activoClaro: { backgroundColor: colors.accent },
  texto: { fontFamily: fonts.bodySemiBold, fontSize: 13, letterSpacing: 0.5 },
});
