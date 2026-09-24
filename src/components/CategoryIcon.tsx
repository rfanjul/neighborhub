import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../theme';
import { PaintIcon, PawIcon, BagIcon, HeartHandsIcon } from '../icons';
import type { ServiceCategory } from '../data/mock';

const map: Record<ServiceCategory, { icon: React.ReactNode; bg: string }> = {
  painting: { icon: <PaintIcon size={18} />, bg: colors.accentTint },
  dog: { icon: <PawIcon size={18} />, bg: colors.greenTint },
  groceries: { icon: <BagIcon size={18} />, bg: colors.amberTint },
  moving: { icon: <PaintIcon size={18} />, bg: colors.accentTint },
  other: { icon: <HeartHandsIcon size={18} />, bg: colors.blueTint },
};

export default function CategoryIcon({ category, size = 38 }: { category: ServiceCategory; size?: number }) {
  const entry = map[category];
  return (
    <View style={[styles.box, { width: size, height: size, backgroundColor: entry.bg }]}>{entry.icon}</View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
});
