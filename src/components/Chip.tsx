import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { fonts } from '../theme';

type Props = {
  label: string;
  background: string;
  color: string;
  style?: ViewStyle;
};

export default function Chip({ label, background, color, style }: Props) {
  return (
    <View style={[styles.chip, { backgroundColor: background }, style]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
  },
});
