import React, { useState } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { authErrorMessage } from '../auth/errors';
import { Button, ErrorText, Input, Screen, styles } from '../components/ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Escribe tu email y tu contraseña.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Entrar</Text>
      <Input placeholder="Email" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} />
      <Input placeholder="Contraseña" secureTextEntry textContentType="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      <ErrorText message={error} />
      <Button title="Entrar" onPress={submit} loading={loading} />
      <Button title="¿Olvidaste tu contraseña?" variant="link" onPress={() => navigation.navigate('ForgotPassword', { email })} />
      <Button title="No tengo cuenta" variant="link" onPress={() => navigation.replace('Register')} />
    </Screen>
  );
}
