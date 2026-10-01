import React, { useState } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { authErrorMessage } from '../auth/errors';
import { Button, ErrorText, Input, Screen, styles } from '../components/ui';
import { t } from '../i18n';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      setError(t('recuperar.faltaEmail'));
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
      <Text style={styles.title}>{t('recuperar.titulo')}</Text>
      {sent ? (
        <>
          <Text style={styles.subtitle}>{t('recuperar.enviado', { email: email.trim() })}</Text>
          <Button title={t('recuperar.volver')} onPress={() => navigation.goBack()} />
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>{t('recuperar.explicacion')}</Text>
          <Input placeholder={t('recuperar.email')} keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} onSubmitEditing={submit} />
          <ErrorText message={error} />
          <Button title={t('recuperar.boton')} onPress={submit} loading={loading} />
          <Button title={t('recuperar.cancelar')} variant="link" onPress={() => navigation.goBack()} />
        </>
      )}
    </Screen>
  );
}
