import React, { useState } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { authErrorMessage } from '../auth/errors';
import { Button, ErrorText, Input, Screen, styles } from '../components/ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Escribe tu email y una contraseña.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register(name, email, password);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Crear cuenta</Text>
      <Input placeholder="Nombre" autoCapitalize="words" textContentType="name" value={name} onChangeText={setName} />
      <Input placeholder="Email" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} />
      <Input placeholder="Contraseña (mínimo 6 caracteres)" secureTextEntry textContentType="newPassword" value={password} onChangeText={setPassword} />
      <Input placeholder="Repite la contraseña" secureTextEntry textContentType="newPassword" value={confirm} onChangeText={setConfirm} onSubmitEditing={submit} />
      <ErrorText message={error} />
      <Button title="Crear cuenta" onPress={submit} loading={loading} />
      <Button title="Ya tengo cuenta" variant="link" onPress={() => navigation.replace('Login')} />
    </Screen>
  );
}
