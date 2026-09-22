import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, fonts, radii } from '../theme';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'dark' | 'outline';
  icon?: React.ReactNode;
  style?: ViewStyle;
};

export default function PillButton({ label, onPress, variant = 'primary', icon, style }: Props) {
  const isPrimary = variant === 'primary';
  const isDark = variant === 'dark';
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        isPrimary && { backgroundColor: colors.accent },
        isDark && { backgroundColor: colors.black },
        variant === 'outline' && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.label,
          { color: variant === 'outline' ? colors.ink : colors.white },
          icon ? { marginLeft: 8 } : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
  },
});
