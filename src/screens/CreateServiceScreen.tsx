import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import { CloseIcon, PlusIcon } from '../icons';
import PillButton from '../components/PillButton';
import { api } from '../firebase/data';
import type { ServiceCategory } from '../data/mock';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateService'>;

const categories: { label: string; value: ServiceCategory }[] = [
  { label: 'Moving', value: 'moving' },
  { label: 'Painting', value: 'painting' },
  { label: 'Dog walking', value: 'dog' },
  { label: 'Groceries', value: 'groceries' },
  { label: 'Other', value: 'other' },
];

export default function CreateServiceScreen({ navigation }: Props) {
  const [category, setCategory] = useState<ServiceCategory>('moving');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [radius, setRadius] = useState(55);
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const anadirFoto = (desde: 'camara' | 'galeria') => async () => {
    const permiso =
      desde === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(
        'Permission needed',
        desde === 'camara' ? 'Allow camera access to take a photo.' : 'Allow photo access to pick a picture.'
      );
      return;
    }
    const opciones: ImagePicker.ImagePickerOptions = { quality: 0.7, allowsEditing: true };
    const resultado =
      desde === 'camara'
        ? await ImagePicker.launchCameraAsync(opciones)
        : await ImagePicker.launchImageLibraryAsync({ ...opciones, mediaTypes: ['images'] });
    if (!resultado.canceled && resultado.assets[0]) {
      setPhotos((previas) => [...previas, resultado.assets[0].uri]);
    }
  };

  const elegirOrigenFoto = () => {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take photo', onPress: anadirFoto('camara') },
      { text: 'Choose from library', onPress: anadirFoto('galeria') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Add a title', 'Give your service a short title first.');
      return;
    }
    setSubmitting(true);
    try {
      // Las fotos se suben antes: el documento guarda ya sus URLs.
      const subidas = await Promise.all(photos.map((uri) => api.uploadServicePhoto(uri)));
      await api.createService({
        title: title.trim(),
        category,
        description: description.trim(),
        credits: 0,
        photos: subidas,
        durationLabel: duration.trim() || '—',
        availableLabel: 'Flexible',
        locationLabel: '0 km away',
        travelRadiusKm: Math.round(radius / 11),
      });
      navigation.goBack();
    } catch (e: any) {
      // Mostrar el motivo real ayuda a distinguir un fallo de red de uno de permisos.
      Alert.alert("Couldn't submit your service", e?.message ?? 'Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New service</Text>
        <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
          <CloseIcon size={14} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Need help moving a wardrobe"
            placeholderTextColor={colors.mutedLight}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Category</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {categories.map((c) => (
              <Pressable
                key={c.value}
                style={[styles.categoryChip, category === c.value && styles.categoryChipActive]}
                onPress={() => setCategory(c.value)}
              >
                <Text style={[styles.categoryLabel, category === c.value && styles.categoryLabelActive]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe what you need help with..."
            placeholderTextColor={colors.mutedLight}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Photos</Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {photos.map((uri) => (
              <Pressable
                key={uri}
                onLongPress={() => setPhotos((previas) => previas.filter((p) => p !== uri))}
                accessibilityRole="button"
                accessibilityLabel="Photo, long press to remove"
              >
                <Image source={{ uri }} style={styles.photo} />
              </Pressable>
            ))}
            <Pressable
              style={styles.addPhoto}
              onPress={elegirOrigenFoto}
              accessibilityRole="button"
              accessibilityLabel="Add a photo"
            >
              <PlusIcon size={20} color={colors.mutedLight} />
            </Pressable>
          </View>
          {photos.length > 0 && <Text style={styles.photoHint}>Long press a photo to remove it.</Text>}
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Duration</Text>
          <TextInput
            style={styles.input}
            placeholder="2 hours"
            placeholderTextColor={colors.mutedLight}
            value={duration}
            onChangeText={setDuration}
          />
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.label}>Travel radius</Text>
            <Text style={styles.radiusValue}>Up to {Math.round(radius / 11)} km</Text>
          </View>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${radius}%` }]} />
            <View style={[styles.sliderThumb, { left: `${radius}%` }]} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PillButton
          label={submitting ? 'Submitting…' : 'Submit for review'}
          onPress={handleSubmit}
          icon={submitting ? <ActivityIndicator color={colors.white} size="small" /> : undefined}
        />
        <Text style={styles.footerHint}>An admin will review it before it becomes visible.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundAlt },
  photo: { width: 96, height: 96, borderRadius: radii.sm },
  photoHint: { fontFamily: fonts.body, fontSize: 11, color: colors.mutedLight },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  closeButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  form: { paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
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
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  categoryChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  categoryLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  categoryLabelActive: { fontFamily: fonts.bodySemiBold, color: colors.white },
  addPhoto: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusValue: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.accentDark },
  sliderTrack: { height: 5, borderRadius: 3, backgroundColor: colors.border, justifyContent: 'center' },
  sliderFill: { height: 5, borderRadius: 3, backgroundColor: colors.accent, position: 'absolute', left: 0 },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.accent,
    marginLeft: -8,
  },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  footerHint: { marginTop: 10, fontFamily: fonts.body, fontSize: 11.5, textAlign: 'center', color: colors.mutedLight },
});
