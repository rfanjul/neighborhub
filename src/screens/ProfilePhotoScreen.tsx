import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import PillButton from '../components/PillButton';
import { api } from '../firebase/data';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfilePhoto'>;

export default function ProfilePhotoScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleCapture = async () => {
    if (!permission?.granted) {
      // Camera view mounts on the next render once permission is granted —
      // wait for onCameraReady before letting the user tap the shutter again.
      await requestPermission();
      return;
    }
    // takePictureAsync can throw or hang if called before the native camera
    // reports it's actually ready, which happens right as this screen mounts.
    if (!cameraRef.current || !cameraReady) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      setPhotoUri(photo.uri);
    } catch (e: any) {
      Alert.alert("Couldn't take the photo", e?.message ?? 'Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleContinue = async () => {
    if (!photoUri) return;
    setUploading(true);
    try {
      await api.uploadMyPhoto(photoUri);
      navigation.navigate('ProfileDetails');
    } catch (e: any) {
      Alert.alert(
        "Couldn't save your photo",
        e?.message ?? 'Check your connection and try again, or skip for now.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.step}>Step 1 of 2</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '50%' }]} />
        </View>
        <Text style={styles.title}>Take your photo</Text>
        <Text style={styles.subtitle}>
          We only use photos taken live with your camera — this keeps every neighbor's profile real.
        </Text>
      </View>

      <View style={styles.cameraBox}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} />
        ) : permission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="front"
            onCameraReady={() => setCameraReady(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.cameraPlaceholder]} />
        )}
        {!photoUri && <View style={styles.faceGuide} pointerEvents="none" />}
      </View>

      <View style={styles.footer}>
        {!photoUri ? (
          <>
            <Pressable
              style={[styles.shutter, permission?.granted && !cameraReady && styles.shutterDisabled]}
              onPress={handleCapture}
              disabled={capturing || (permission?.granted && !cameraReady)}
            >
              {capturing && <ActivityIndicator color={colors.white} />}
            </Pressable>
            <Text style={styles.hint}>
              {!permission?.granted
                ? 'Tap to allow camera access'
                : !cameraReady
                  ? 'Warming up the camera…'
                  : 'Tap to capture'}
            </Text>
          </>
        ) : (
          <>
            <Pressable onPress={() => setPhotoUri(null)}>
              <Text style={styles.retakeLink}>Retake photo</Text>
            </Pressable>
            <PillButton
              label={uploading ? 'Saving…' : 'Continue'}
              onPress={handleContinue}
              style={{ width: '100%', marginTop: 8 }}
              icon={uploading ? <ActivityIndicator color={colors.white} size="small" /> : undefined}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: { paddingHorizontal: 24, paddingTop: 8 },
  step: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.mutedLight },
  progressTrack: { marginTop: 8, height: 5, borderRadius: 3, backgroundColor: colors.border },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: colors.accent },
  title: { marginTop: 22, fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  subtitle: { marginTop: 8, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  cameraBox: {
    margin: 24,
    height: 380,
    borderRadius: radii.lg,
    backgroundColor: colors.black,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraPlaceholder: { backgroundColor: '#2A2119' },
  faceGuide: { width: 190, height: 230, borderRadius: 110, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.6)', borderStyle: 'dashed' },
  footer: { flex: 1, alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingBottom: 16 },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: colors.white, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  shutterDisabled: { opacity: 0.4 },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedLight },
  retakeLink: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.accentDark },
});
