import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  name: string;
  photoURL: string | null;
  size?: number;
  color?: string;
};

/** Foto de perfil; sin foto, la inicial sobre un círculo de color. */
export default function Avatar({ name, photoURL, size = 40, color = colors.accentTint }: Props) {
  const forma = { width: size, height: size, borderRadius: size / 2 };
  if (photoURL) {
    return <Image source={{ uri: photoURL }} style={[forma, styles.foto]} accessibilityLabel={`Foto de ${name}`} />;
  }
  return (
    <View style={[forma, styles.inicial, { backgroundColor: color }]} accessibilityLabel={name}>
      <Text style={[styles.letra, { fontSize: size * 0.42 }]}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  foto: { backgroundColor: colors.border },
  inicial: { alignItems: 'center', justifyContent: 'center' },
  letra: { fontFamily: fonts.bodySemiBold, color: colors.accentDark },
});
