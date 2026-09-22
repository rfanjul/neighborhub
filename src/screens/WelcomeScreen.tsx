import React, { useState } from 'react';
import { Image, Platform, ScrollView, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { isExpoGo } from '../auth/environment';
import { authErrorMessage } from '../auth/errors';
import { Button, ErrorText, Screen, colors, styles } from '../components/ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const pasos = [
  { titulo: 'Ofrece ayuda', detalle: 'Pintar una pared, pasear un perro, hacer la compra…' },
  { titulo: 'Gana créditos', detalle: 'Cada servicio que prestas suma saldo a tu cuenta.' },
  { titulo: 'Recibe ayuda', detalle: 'Gasta esos créditos cuando quien necesite ayuda seas tú.' },
];

function ComoFunciona() {
  return (
    <View style={styles.steps}>
      {pasos.map((paso, i) => (
        <View key={paso.titulo} style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>{paso.titulo}</Text>
            <Text style={styles.stepDetail}>{paso.detalle}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

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
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <Image
        source={require('../../assets/splash-icon.png')}
        style={{ width: 72, height: 72, marginBottom: 12 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.title}>Neighborhub</Text>
      <Text style={styles.subtitle}>
        La plataforma donde los vecinos se ayudan entre sí y, en lugar de pagarse en dinero, acumulan créditos.
      </Text>

      <ComoFunciona />

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
      </ScrollView>
    </Screen>
  );
}
