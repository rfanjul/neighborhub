import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

// Paleta de marca: crema de fondo, tinta cálida para el texto y terracota
// como color de acción. Es la misma del icono.
export const colors = {
  background: '#FBF3EA',
  card: '#FFFFFF',
  text: '#33261F',
  muted: '#6B5B52',
  border: '#E4DDD3',
  primary: '#DD6B3E',
  primaryDark: '#B4472A',
  danger: '#B3261E',
};

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'link';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled }: ButtonProps) {
  const isLink = variant === 'link';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        isLink && styles.buttonLink,
        (pressed || disabled || loading) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.text} />
      ) : (
        <Text style={[styles.buttonText, variant === 'primary' && { color: '#fff' }, isLink && styles.linkText]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24, paddingTop: 56, gap: 12 },
  title: { fontSize: 32, fontWeight: '700', color: colors.text, marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: colors.muted, marginBottom: 16 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  buttonLink: { height: 40 },
  buttonText: { fontSize: 16, fontWeight: '500', color: colors.text },
  linkText: { fontWeight: '400', textDecorationLine: 'underline' },
  error: { color: colors.danger, fontSize: 14 },
  hero: { alignItems: 'center', marginBottom: 20 },
  heroMark: { width: 198, height: 198, marginBottom: 4 },
  centered: { textAlign: 'center' },
  steps: { gap: 14, marginBottom: 8 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  stepTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  stepDetail: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
});
