import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import { CloseIcon, StarIcon } from '../icons';
import PillButton from '../components/PillButton';
import Avatar from '../components/Avatar';
import { api } from '../firebase/data';
import { dataErrorMessage } from '../firebase/errors';

type Props = NativeStackScreenProps<RootStackParamList, 'RateHelper'>;

const etiquetas = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/**
 * Dar por hecha la ayuda: de 1 a 5 estrellas y un comentario opcional para
 * quien ayudó. Al enviarlo el servicio queda completado y valorado.
 */
export default function RateHelperScreen({ navigation, route }: Props) {
  const { serviceId } = route.params;
  const [titulo, setTitulo] = useState('');
  const [ayudante, setAyudante] = useState<{ name: string; photoURL: string | null } | null>(null);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api
      .getService(serviceId)
      .then(async (s) => {
        setTitulo(s.title);
        const nombre = s.helperName ?? 'your helper';
        setAyudante({ name: nombre, photoURL: null });
        if (s.helperId) {
          const perfil = await api.getUserProfile(s.helperId).catch(() => null);
          if (perfil) setAyudante({ name: perfil.name, photoURL: perfil.photoURL });
        }
      })
      .catch(() => setTitulo(''));
  }, [serviceId]);

  const enviar = async () => {
    if (!nota) {
      Alert.alert('Choose a rating', 'Tap the stars to rate from 1 to 5.');
      return;
    }
    setEnviando(true);
    try {
      await api.rateHelper(serviceId, nota, comentario);
      navigation.goBack();
    } catch (e) {
      Alert.alert("Couldn't save your rating", dataErrorMessage(e));
    } finally {
      setEnviando(false);
    }
  };

  const nombre = ayudante?.name ?? '';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rate the help</Text>
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
          {ayudante && (
            <View style={styles.persona}>
              <Avatar name={ayudante.name} photoURL={ayudante.photoURL} size={64} />
              <Text style={styles.pregunta}>How did {nombre} help you?</Text>
              {titulo ? <Text style={styles.servicio}>{titulo}</Text> : null}
            </View>
          )}

          <View style={styles.estrellas}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setNota(n)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={n === 1 ? '1 star' : `${n} stars`}
                accessibilityState={{ selected: n <= nota }}
              >
                <StarIcon size={40} color={colors.amber} filled={n <= nota} />
              </Pressable>
            ))}
          </View>
          <Text style={styles.etiqueta}>{nota ? etiquetas[nota] : 'Tap to rate'}</Text>

          <Text style={styles.label}>Comment (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder={`Tell others what it was like to get help from ${nombre || 'them'}.`}
            placeholderTextColor={colors.mutedLight}
            value={comentario}
            onChangeText={setComentario}
            multiline
            maxLength={500}
          />
          <Text style={styles.contador}>{comentario.length}/500</Text>
        </View>

        <View style={styles.footer}>
          <PillButton
            label={enviando ? 'Saving…' : 'Complete and rate'}
            onPress={enviar}
            disabled={enviando}
            icon={enviando ? <ActivityIndicator color={colors.white} size="small" /> : undefined}
          />
          <Text style={styles.hint}>The service will be marked as completed. Ratings can't be changed later.</Text>
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
  persona: { alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 8 },
  pregunta: { fontFamily: fonts.displaySemiBold, fontSize: 18, color: colors.ink, textAlign: 'center' },
  servicio: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center' },
  estrellas: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 4 },
  etiqueta: { textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.muted, marginBottom: 12 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.muted },
  input: {
    minHeight: 110,
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
