import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, fonts, radii } from '../theme';
import { CloseIcon } from '../icons';
import PillButton from './PillButton';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Receives the local file:// uri of the capture; should upload it. */
  onCaptured: (uri: string) => Promise<void>;
};

export default function PhotoCaptureModal({ visible, onClose, onCaptured }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [saving, setSaving] = useState(false);

  const handleCapture = async () => {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      setSaving(true);
      await onCaptured(photo.uri);
      onClose();
    } catch (e: any) {
      Alert.alert("Couldn't update your photo", e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <CloseIcon size={14} />
          </Pressable>
          <Text style={styles.title}>Update photo</Text>
          <View style={{ width: 30 }} />
        </View>

        <View style={styles.cameraBox}>
          {permission?.granted ? (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.cameraPlaceholder]} />
          )}
          <View style={styles.faceGuide} pointerEvents="none" />
        </View>

        <View style={styles.footer}>
          {!permission?.granted ? (
            <PillButton label="Allow camera access" onPress={requestPermission} style={{ width: '100%' }} />
          ) : (
            <Pressable
              style={styles.shutter}
              onPress={handleCapture}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              {saving && <ActivityIndicator color={colors.white} />}
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </Modal>
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
  closeButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.displaySemiBold, fontSize: 16, color: colors.ink },
  cameraBox: {
    margin: 24,
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.black,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraPlaceholder: { backgroundColor: '#2A2119' },
  faceGuide: { width: 190, height: 230, borderRadius: 110, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.6)', borderStyle: 'dashed' },
  footer: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: colors.white, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
