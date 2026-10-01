import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import FotoCabecera from './FotoCabecera';

/**
 * Pantalla de formulario sin sesión (entrar, crear cuenta): foto arriba con
 * el título y, debajo, el formulario en una hoja que la solapa un poco.
 */
export default function PantallaConFoto({
  foto,
  titulo,
  subtitulo,
  onBack,
  children,
}: {
  foto: string;
  titulo: string;
  subtitulo: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const margenes = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: margenes.bottom + 16 }}
      >
        <FotoCabecera foto={foto} titulo={titulo} subtitulo={subtitulo} onBack={onBack} />
        <View style={styles.hoja}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  hoja: {
    flexGrow: 1,
    marginTop: -24,
    paddingTop: 24,
    paddingHorizontal: 20,
    gap: 12,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.background,
  },
});
