import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import PillButton from '../components/PillButton';
import { useAuth } from '../auth/AuthContext';
import { api } from '../firebase/data';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileDetails'>;

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
  const { user, profile, refreshProfile, logout } = useAuth();
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
      Alert.alert("Couldn't save your profile", e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Tell us about you</Text>
        <Pressable onPress={() => logout()}>
          <Text style={styles.logoutLink}>Log out</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Field label="Full name" placeholder="Anna Weber" value={name} onChangeText={setName} />
        <Field label="Date of birth" placeholder="MM / DD / YYYY" value={dob} onChangeText={setDob} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 2, gap: 6 }}>
            <Text style={styles.label}>City</Text>
            <TextInput style={styles.input} placeholder="Berlin" placeholderTextColor={colors.mutedLight} value={city} onChangeText={setCity} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.label}>Postal code</Text>
            <TextInput style={styles.input} placeholder="10115" placeholderTextColor={colors.mutedLight} value={postalCode} onChangeText={setPostalCode} />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Languages you speak</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {languages.map((lang) => (
              <View key={lang} style={styles.langChip}>
                <Text style={styles.langChipLabel}>{lang}</Text>
              </View>
            ))}
            <Pressable
              style={styles.addChip}
              onPress={() => setLanguages((prev) => [...prev, `Language ${prev.length + 1}`])}
            >
              <Text style={styles.addChipLabel}>+ Add</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>About you</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Tell your neighbors a bit about yourself..."
            placeholderTextColor={colors.mutedLight}
            value={bio}
            onChangeText={setBio}
            multiline
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PillButton
          label={submitting ? 'Saving…' : 'Save'}
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
  title: { marginTop: 8, fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  logoutLink: { marginTop: 10, fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.accentDark },
  form: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20, gap: 16 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.muted },
  input: {
    height: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  textarea: { height: 72, paddingTop: 12, textAlignVertical: 'top' },
  langChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.accent },
  langChipLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.white },
  addChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  addChipLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 },
});
