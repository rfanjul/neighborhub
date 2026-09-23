import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme';
import { SettingsIcon, CoinIcon, BadgeStarIcon, BadgeVeteranIcon, BadgeExemplaryIcon } from '../icons';
import { currentUser as mockCurrentUser } from '../data/mock';
import { api } from '../firebase/data';
import { useAuth } from '../auth/AuthContext';
import PhotoCaptureModal from '../components/PhotoCaptureModal';

export default function MyProfileScreen() {
  const { logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentUser, setCurrentUser] = useState(mockCurrentUser);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [showCamera, setShowCamera] = useState(false);

  const handleSettingsPress = () => {
    Alert.alert('Account', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit my details', onPress: () => navigation.navigate('ProfileDetails') },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleCaptured = async (uri: string) => {
    const updated = await api.uploadMyPhoto(uri);
    setPhotoURL(updated.photoURL);
    setPhotoVersion((v) => v + 1);
  };

  useFocusEffect(
    useCallback(() => {
      api
        .getMe()
        .then((me) => {
          setPhotoURL(me.photoURL);
          setCurrentUser({
            name: me.name,
            level: me.level,
            levelLabel: me.levelLabel,
            credits: me.credits,
            servicesCompleted: me.servicesCompleted,
            rating: me.rating,
            responseLabel: me.responseLabel,
            bio: me.bio ?? mockCurrentUser.bio,
          });
        })
        .catch(() => setCurrentUser(mockCurrentUser));
    }, [])
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable
          style={styles.settingsButton}
          onPress={handleSettingsPress}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <SettingsIcon size={15} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.identity}>
          <Pressable onPress={() => setShowCamera(true)} accessibilityRole="button" accessibilityLabel="Change photo">
            {photoURL ? (
              <Image source={{ uri: `${photoURL}${photoURL.includes('?') ? '&' : '?'}v=${photoVersion}` }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar} />
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditBadgeText}>Edit</Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <Text style={styles.name}>{currentUser.name}</Text>
            <View style={styles.verifiedDot} />
          </View>
          <View style={styles.levelChip}>
            <Text style={styles.levelLabel}>
              Level {currentUser.level} · {currentUser.levelLabel}
            </Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={[styles.statItem, styles.statBorder]}>
            <Text style={styles.statValue}>{currentUser.servicesCompleted}</Text>
            <Text style={styles.statLabel}>Services</Text>
          </View>
          <View style={[styles.statItem, styles.statBorder]}>
            <Text style={styles.statValue}>{currentUser.rating} ★</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{currentUser.responseLabel}</Text>
            <Text style={styles.statLabel}>Response</Text>
          </View>
        </View>

        <View style={styles.creditsCard}>
          <View>
            <Text style={styles.creditsCaption}>Your credits</Text>
            <Text style={styles.creditsValue}>{currentUser.credits}</Text>
          </View>
          <Pressable style={styles.addCreditsButton}>
            <Text style={styles.addCreditsLabel}>+ Add credits</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges</Text>
          <View style={styles.badgesRow}>
            <View style={styles.badgeItem}>
              <View style={[styles.badgeIcon, { backgroundColor: colors.amberTint }]}>
                <BadgeStarIcon size={22} />
              </View>
              <Text style={styles.badgeLabel}>10 ayudas</Text>
            </View>
            <View style={styles.badgeItem}>
              <View style={[styles.badgeIcon, { backgroundColor: colors.blueTint }]}>
                <BadgeVeteranIcon size={22} />
              </View>
              <Text style={styles.badgeLabel}>Veterano</Text>
            </View>
            <View style={styles.badgeItem}>
              <View style={[styles.badgeIcon, { backgroundColor: colors.greenTint }]}>
                <BadgeExemplaryIcon size={22} />
              </View>
              <Text style={styles.badgeLabel}>Ejemplar</Text>
            </View>
          </View>
        </View>

        <Text style={styles.bio}>{currentUser.bio}</Text>
      </ScrollView>

      <PhotoCaptureModal visible={showCamera} onClose={() => setShowCamera(false)} onCaptured={handleCaptured} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: { paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  settingsButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  identity: { alignItems: 'center', paddingTop: 16 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accentTint, borderWidth: 3, borderColor: colors.card },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.ink,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: colors.backgroundAlt,
  },
  avatarEditBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 9, color: colors.white },
  name: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  verifiedDot: { width: 15, height: 15, borderRadius: 8, backgroundColor: colors.blue },
  levelChip: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.accentTint },
  levelLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.accentDark },
  statsCard: { marginHorizontal: 20, marginTop: 20, flexDirection: 'row', backgroundColor: colors.card, borderRadius: radii.md, paddingVertical: 14, ...shadow },
  statItem: { flex: 1, alignItems: 'center' },
  statBorder: { borderRightWidth: 1, borderRightColor: colors.border },
  statValue: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  statLabel: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  creditsCard: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditsCaption: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  creditsValue: { fontFamily: fonts.display, fontSize: 22, color: colors.white },
  addCreditsButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)' },
  addCreditsLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.white },
  section: { marginHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.muted },
  badgesRow: { marginTop: 10, flexDirection: 'row', gap: 16 },
  badgeItem: { alignItems: 'center', gap: 6 },
  badgeIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.muted, textAlign: 'center' },
  bio: { marginHorizontal: 20, marginTop: 20, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.muted },
});
