import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { BackIcon } from '../icons';
import Degradado from './Degradado';
import LogoMark from './LogoMark';

/**
 * Cabecera con foto a sangre para las pantallas sin sesión: la foto se
 * oscurece hacia abajo para que el título blanco se lea, con el logo y,
 * si se pasa onBack, un botón para volver.
 */
export default function FotoCabecera({
  foto,
  titulo,
  subtitulo,
  onBack,
  alto = 300,
}: {
  foto: string;
  titulo: string;
  subtitulo: string;
  onBack?: () => void;
  alto?: number;
}) {
  const margenes = useSafeAreaInsets();
  return (
    <ImageBackground
      source={{ uri: foto }}
      style={[styles.foto, { height: alto + margenes.top }]}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
    >
      <Degradado
        id="cabecera"
        paradas={[
          { en: 0, color: '#1E1712', opacidad: 0.45 },
          { en: 0.4, color: '#1E1712', opacidad: 0.1 },
          { en: 1, color: '#1E1712', opacidad: 0.85 },
        ]}
      />
      <View style={[styles.arriba, { marginTop: margenes.top + 8 }]}>
        {onBack ? (
          <Pressable style={styles.volver} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
            <BackIcon size={18} />
          </Pressable>
        ) : (
          <View />
        )}
        <LogoMark size={48} />
      </View>
      <View style={styles.textos}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.subtitulo}>{subtitulo}</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  foto: { width: '100%', backgroundColor: colors.accentDark, justifyContent: 'space-between' },
  arriba: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  volver: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { paddingHorizontal: 24, paddingBottom: 44, gap: 6 },
  titulo: { fontFamily: fonts.display, fontSize: 36, lineHeight: 44, color: colors.white },
  subtitulo: { fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 24, color: 'rgba(255,255,255,0.92)' },
});
