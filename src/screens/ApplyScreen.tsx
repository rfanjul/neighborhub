import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import { CloseIcon } from '../icons';
import PillButton from '../components/PillButton';
import { api } from '../firebase/data';
import { dataErrorMessage } from '../firebase/errors';

type Props = NativeStackScreenProps<RootStackParamList, 'Apply'>;

/** Hacer una oferta sobre un servicio: un comentario para quien lo publicó. */
export default function ApplyScreen({ navigation, route }: Props) {
  const { serviceId } = route.params;
  const [titulo, setTitulo] = useState('');
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api
      .getService(serviceId)
      .then((s) => setTitulo(s.title))
      .catch(() => setTitulo(''));
  }, [serviceId]);

  const enviar = async () => {
    if (!comentario.trim()) {
      Alert.alert('Add a comment', 'Tell them a little about how you can help.');
      return;
    }
    setEnviando(true);
    try {
      await api.applyToService(serviceId, comentario);
      // La oferta aparece en "My offers" hasta que quien publica elija.
      navigation.navigate('Main', { screen: 'ActivityTab', params: { segmento: 'offers' } });
    } catch (e) {
      Alert.alert("Couldn't send your offer", dataErrorMessage(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Make an offer</Text>
          <Pressable
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <CloseIcon size={14} />
          </Pressable>
        </View>

        <View style={styles.body}>
          {titulo ? <Text style={styles.servicio}>{titulo}</Text> : null}
          <Text style={styles.label}>Your comment</Text>
          <TextInput
            style={styles.input}
            placeholder="When could you help, and what do you bring? e.g. I have a ladder and I'm free on Saturday."
            placeholderTextColor={colors.mutedLight}
            value={comentario}
            onChangeText={setComentario}
            multiline
            maxLength={500}
            autoFocus
          />
          <Text style={styles.contador}>{comentario.length}/500</Text>
        </View>

        <View style={styles.footer}>
          <PillButton
            label={enviando ? 'Sending…' : 'Send offer'}
            onPress={enviar}
            disabled={enviando}
            icon={enviando ? <ActivityIndicator color={colors.white} size="small" /> : undefined}
          />
          <Text style={styles.hint}>Several neighbors can offer; the owner picks one.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: 20, gap: 8 },
  servicio: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink, marginBottom: 8 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.muted },
  input: {
    minHeight: 140,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  contador: { alignSelf: 'flex-end', fontFamily: fonts.body, fontSize: 11, color: colors.mutedLight },
  footer: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  hint: { textAlign: 'center', fontFamily: fonts.body, fontSize: 12, color: colors.muted },
});
