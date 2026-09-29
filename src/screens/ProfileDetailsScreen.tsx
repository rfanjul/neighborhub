import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import PillButton from '../components/PillButton';
import { useAuth } from '../auth/AuthContext';
import { api } from '../firebase/data';
import { idiomasTexto, t } from '../i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileDetails'>;

/** Idiomas que se pueden marcar; el lanzamiento es en inglés y alemán. */
const idiomasDisponibles = ['English', 'German', 'Spanish', 'French', 'Italian', 'Portuguese'];

function Field({ label, placeholder, value, onChangeText }: { label: string; placeholder: string; value: string; onChangeText: (t: string) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedLight}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

export default function ProfileDetailsScreen({ navigation }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  // Lo que ya sabemos del acceso (nombre de Apple/Google o del registro)
  // sirve de punto de partida; el resto viene del documento de Firestore.
  const [name, setName] = useState(profile?.name || user?.displayName || '');
  const [dob, setDob] = useState(profile?.dateOfBirth ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [postalCode, setPostalCode] = useState(profile?.postalCode ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [languages, setLanguages] = useState(
    profile?.languages ? profile.languages.split(',').map((l) => l.trim()).filter(Boolean) : ['English', 'German']
  );
  const [submitting, setSubmitting] = useState(false);

  const alternarIdioma = (idioma: string) =>
    setLanguages((previos) => (previos.includes(idioma) ? previos.filter((i) => i !== idioma) : [...previos, idioma]));

  const handleContinue = async () => {
    setSubmitting(true);
    try {
      await api.updateMe({
        name: name.trim() || undefined,
        dateOfBirth: dob.trim() || undefined,
        city: city.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        bio: bio.trim() || undefined,
        languages: languages.join(', '),
        onboardingCompleted: true,
      });
      await refreshProfile();
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(t('datos.error'), e?.message ?? t('comun.errorInesperado'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('datos.titulo')}</Text>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.logoutLink}>{t('comun.cancelar')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Field label={t('datos.nombre')} placeholder="Anna Weber" value={name} onChangeText={setName} />
        <Field label={t('datos.nacimiento')} placeholder={t('datos.nacimientoEjemplo')} value={dob} onChangeText={setDob} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 2, gap: 6 }}>
            <Text style={styles.label}>{t('datos.ciudad')}</Text>
            <TextInput style={styles.input} placeholder="Zürich" placeholderTextColor={colors.mutedLight} value={city} onChangeText={setCity} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.label}>{t('datos.codigoPostal')}</Text>
            <TextInput style={styles.input} placeholder="8004" placeholderTextColor={colors.mutedLight} value={postalCode} onChangeText={setPostalCode} />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>{t('datos.idiomas')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {idiomasDisponibles.map((idioma) => {
              const marcado = languages.includes(idioma);
              return (
                <Pressable
                  key={idioma}
                  style={marcado ? styles.langChip : styles.addChip}
                  onPress={() => alternarIdioma(idioma)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcado }}
                  accessibilityLabel={idiomasTexto(idioma)}
                >
                  <Text style={marcado ? styles.langChipLabel : styles.addChipLabel}>{idiomasTexto(idioma)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>{t('datos.sobreTi')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder={t('datos.sobreTiEjemplo')}
            placeholderTextColor={colors.mutedLight}
            value={bio}
            onChangeText={setBio}
            multiline
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PillButton
          label={submitting ? t('comun.guardando') : t('comun.guardar')}
          onPress={handleContinue}
          icon={submitting ? <ActivityIndicator color={colors.white} size="small" /> : undefined}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: { paddingHorizontal: 24, paddingTop: 8 },
  title: { marginTop: 8, fontFamily: fonts.display, fontSize: 28, lineHeight: 35, color: colors.ink },
  logoutLink: { marginTop: 10, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.accentDark },
  form: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20, gap: 16 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.muted },
  input: {
    height: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  textarea: { height: 72, paddingTop: 12, textAlignVertical: 'top' },
  langChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.accent },
  langChipLabel: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.white },
  addChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  addChipLabel: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 },
});
