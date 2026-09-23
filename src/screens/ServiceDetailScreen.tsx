import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import { BackIcon } from '../icons';
import Chip from '../components/Chip';
import PillButton from '../components/PillButton';
import { mockServices, type ServiceRequest } from '../data/mock';
import { api } from '../firebase/data';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceDetail'>;

const categoryLabel: Record<string, string> = {
  painting: 'Painting',
  dog: 'Dog walking',
  groceries: 'Groceries',
  moving: 'Moving',
  other: 'Other',
};

const statusLabel: Record<string, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
  rated: 'Rated',
};

export default function ServiceDetailScreen({ route, navigation }: Props) {
  const fallback = mockServices.find((s) => s.id === route.params.serviceId) ?? mockServices[0];
  const [service, setService] = useState<ServiceRequest>(fallback);
  const [accepting, setAccepting] = useState(false);
  const [foto, setFoto] = useState(0);
  const anchoPantalla = Dimensions.get('window').width;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    api.getService(route.params.serviceId).then(setService).catch(() => {
      // Backend not reachable — keep showing the local mock version.
    });
  }, [route.params.serviceId]);

  const handleApply = async () => {
    setAccepting(true);
    try {
      const updated = await api.acceptService(service.id);
      setService(updated);
    } catch {
      // Backend not reachable — proceed with the demo flow anyway.
    } finally {
      setAccepting(false);
      navigation.navigate('Main', { screen: 'ChatTab' });
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <View style={styles.photo}>
        {service.photos.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => setFoto(Math.round(e.nativeEvent.contentOffset.x / anchoPantalla))}
            scrollEventThrottle={16}
          >
            {service.photos.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={{ width: anchoPantalla, height: 260 }}
                resizeMode="cover"
                accessibilityLabel={`Foto de ${service.title}`}
              />
            ))}
          </ScrollView>
        )}
        <Pressable
          style={[styles.backButton, { top: insets.top + 12 }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <BackIcon size={18} />
        </Pressable>
        {service.photos.length > 1 && (
          <View style={styles.dots}>
            {service.photos.map((uri, i) => (
              <View key={uri} style={[styles.dot, i === foto && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={categoryLabel[service.category]} background={colors.accentTint} color={colors.accentDark} />
          <Chip label={statusLabel[service.status]} background={colors.greenTint} color={colors.green} />
        </View>

        <Text style={styles.title}>{service.title}</Text>

        <View style={styles.requesterCard}>
          <View style={[styles.avatar, { backgroundColor: service.requester.avatarColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.requesterName}>{service.requester.name}</Text>
            <Text style={styles.requesterMeta}>
              ★ {service.requester.rating} ({service.requester.ratingCount}) · replies in {service.requester.responseLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.description}>{service.description}</Text>

        <View style={styles.infoList}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Duration</Text>
            <Text style={styles.infoValue}>{service.durationLabel}</Text>
          </View>
          {service.credits > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Credits requested</Text>
              <Text style={[styles.infoValue, { color: colors.accentDark }]}>{service.credits} cr</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{service.distanceKm} km away</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Available</Text>
            <Text style={styles.infoValue}>{service.availableLabel}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PillButton
          label="Apply to help"
          onPress={handleApply}
          icon={accepting ? <ActivityIndicator color={colors.white} size="small" /> : undefined}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundAlt },
  photo: { height: 260, backgroundColor: '#E4DDD3' },
  backButton: {
    position: 'absolute',
    top: 52,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { position: 'absolute', bottom: 14, left: 0, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 16, backgroundColor: colors.white },
  body: { padding: 20, gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.ink },
  requesterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: radii.md,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  requesterName: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.ink },
  requesterMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
  description: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.muted },
  infoList: { gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontFamily: fonts.body, fontSize: 13.5, color: colors.muted },
  infoValue: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.ink },
  footer: { padding: 20, paddingTop: 8 },
});
