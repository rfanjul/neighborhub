import React, { useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { isExpoGo } from '../auth/environment';
import { authErrorMessage } from '../auth/errors';
import { Button, ErrorText, Screen, styles } from '../components/ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const { loginWithApple, loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

  const run = async (which: 'apple' | 'google', fn: () => Promise<boolean>) => {
    setError(null);
    setBusy(which);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Image
        source={require('../../assets/splash-icon.png')}
        style={{ width: 72, height: 72, marginBottom: 12 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.title}>Neighborhub</Text>
      <Text style={styles.subtitle}>Entra con Apple, Google o tu email.</Text>

      {isExpoGo && (
        <Text style={styles.subtitle}>
          Estás en Expo Go: Apple y Google necesitan el development build. Aquí solo funciona el email.
        </Text>
      )}

      {Platform.OS === 'ios' && !isExpoGo && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={10}
          style={{ height: 48 }}
          onPress={() => run('apple', loginWithApple)}
        />
      )}
      {!isExpoGo && (
        <>
          <Button
            title="Continuar con Google"
            variant="secondary"
            loading={busy === 'google'}
            disabled={busy !== null}
            onPress={() => run('google', loginWithGoogle)}
          />
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={{ color: '#6B6B6B' }}>o</Text>
            <View style={styles.dividerLine} />
          </View>
        </>
      )}

      <Button title="Entrar con email" onPress={() => navigation.navigate('Login')} disabled={busy !== null} />
      <Button title="Crear una cuenta" variant="link" onPress={() => navigation.navigate('Register')} />

      <ErrorText message={error} />
    </Screen>
  );
}
