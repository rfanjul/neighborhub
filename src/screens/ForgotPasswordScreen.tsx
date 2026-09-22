import React, { useState } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { authErrorMessage } from '../auth/errors';
import { Button, ErrorText, Input, Screen, styles } from '../components/ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      setError('Escribe tu email.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Recuperar contraseña</Text>
      {sent ? (
        <>
          <Text style={styles.subtitle}>Te hemos enviado un email a {email.trim()} con un enlace para cambiar la contraseña.</Text>
          <Button title="Volver" onPress={() => navigation.goBack()} />
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>Te enviaremos un enlace para crear una contraseña nueva.</Text>
          <Input placeholder="Email" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} onSubmitEditing={submit} />
          <ErrorText message={error} />
          <Button title="Enviar enlace" onPress={submit} loading={loading} />
          <Button title="Cancelar" variant="link" onPress={() => navigation.goBack()} />
        </>
      )}
    </Screen>
  );
}
