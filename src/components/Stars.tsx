import React from 'react';
import { View } from 'react-native';
import { StarIcon } from '../icons';
import { colors } from '../theme';

/** Cinco estrellas de solo lectura, rellenas hasta la nota (redondeada). */
export default function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const llenas = Math.round(value);
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} size={size} color={colors.amber} filled={n <= llenas} />
      ))}
    </View>
  );
}
