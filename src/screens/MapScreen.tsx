import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import { SearchIcon } from '../icons';
import CategoryIcon from '../components/CategoryIcon';
import { mockServices } from '../data/mock';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'MapTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

const radiusOptions = ['1 km', '5 km', '10 km'];

const pins = [
  { top: 190, left: 60, color: colors.accent, size: 34 },
  { top: 270, left: 210, color: colors.green, size: 34 },
  { top: 210, left: 260, color: colors.accentDark, size: 44, selected: true },
  { top: 370, left: 120, color: colors.blue, size: 34 },
];

export default function MapScreen({ navigation }: Props) {
  const [radius, setRadius] = useState('5 km');
  const selected = mockServices[1];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.mapBackground}>
        <View style={styles.mapBand} />
        <View style={[styles.road, { top: 260, left: 0, width: '100%', height: 10 }]} />
        <View style={[styles.road, { top: 0, left: 120, width: 10, height: '100%' }]} />
        <View style={[styles.roadThin, { top: 380, left: 0, width: '100%', height: 7 }]} />
        <View style={[styles.roadThin, { top: 0, left: 250, width: 7, height: '100%' }]} />

        {pins.map((pin, i) => (
          <View
            key={i}
            style={[
              styles.pin,
              {
                top: pin.top,
                left: pin.left,
                width: pin.size,
                height: pin.size,
                backgroundColor: pin.color,
                borderWidth: pin.selected ? 3 : 0,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.searchBar}>
        <SearchIcon size={16} />
        <Text style={styles.searchPlaceholder}>Search this area...</Text>
      </View>

      <View style={styles.filterRow}>
        {radiusOptions.map((option) => (
          <Pressable
            key={option}
            style={[styles.filterChip, radius === option && styles.filterChipActive]}
            onPress={() => setRadius(option)}
          >
            <Text style={[styles.filterLabel, radius === option && styles.filterLabelActive]}>{option}</Text>
          </Pressable>
        ))}
        <View style={styles.filterChip}>
          <Text style={styles.filterLabel}>Category</Text>
        </View>
      </View>

      <Pressable
        style={styles.previewCard}
        onPress={() => navigation.navigate('ServiceDetail', { serviceId: selected.id })}
      >
        <CategoryIcon category={selected.category} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={styles.previewTitle} numberOfLines={1}>
            {selected.title}
          </Text>
          <Text style={styles.previewMeta}>
            {selected.distanceKm} km away · {selected.credits} cr
          </Text>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EAF1E9' },
  mapBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  mapBand: { position: 'absolute', top: 120, left: 0, width: '100%', height: 260, backgroundColor: '#DCEADA', opacity: 0.7 },
  road: { position: 'absolute', backgroundColor: colors.white },
  roadThin: { position: 'absolute', backgroundColor: colors.white, opacity: 0.8 },
  pin: { position: 'absolute', borderRadius: 12, borderColor: colors.white, transform: [{ rotate: '45deg' }] },
  searchBar: {
    marginTop: 52,
    marginHorizontal: 20,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  searchPlaceholder: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedLight },
  filterRow: { marginTop: 10, marginLeft: 20, flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.card },
  filterChipActive: { backgroundColor: colors.accent },
  filterLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  filterLabelActive: { color: colors.white },
  previewCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  previewMeta: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, color: colors.muted },
});
