import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { colors, fonts, radii, shadow } from '../theme';
import CategoryIcon from './CategoryIcon';
import type { ServiceRequest } from '../data/mock';

export default function ServiceCard({ service, onPress }: { service: ServiceRequest; onPress?: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {service.photos.length > 0 && (
        <Image
          source={{ uri: service.photos[0] }}
          style={styles.cover}
          resizeMode="cover"
          accessibilityLabel={`Foto de ${service.title}`}
        />
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <CategoryIcon category={service.category} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>
            {service.title}
          </Text>
          <Text style={styles.meta}>
            {service.distanceKm} km away · {service.postedLabel}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.avatar, { backgroundColor: service.requester.avatarColor }]} />
          <Text style={styles.requester}>{service.requester.name}</Text>
        </View>
        {/* Quien publica ya no fija créditos: sin cifra no se enseña "0 cr". */}
        {service.credits > 0 && (
          <View style={styles.creditsChip}>
            <Text style={styles.creditsLabel}>{service.credits} cr</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, ...shadow },
  cover: { width: '100%', height: 132, borderRadius: radii.sm, marginBottom: 12, backgroundColor: colors.accentTint },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  meta: { marginTop: 6, fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  footer: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 20, height: 20, borderRadius: 10 },
  requester: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  creditsChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.accentTint },
  creditsLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.accentDark },
});
