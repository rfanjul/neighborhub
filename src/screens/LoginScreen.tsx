import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { authErrorMessage } from '../auth/errors';
import { Button, ErrorText, Input } from '../components/ui';
import PantallaConFoto from '../components/PantallaConFoto';
import { fotosBienvenida } from '../data/fotosBienvenida';
import { t } from '../i18n';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

/** Cuenta del modo demo (npm run demo:app), que solo existe en el emulador local. */
function cuentaDemo() {
  const email = process.env.EXPO_PUBLIC_DEMO_EMAIL;
  const password = process.env.EXPO_PUBLIC_DEMO_PASSWORD;
  return email && password ? { email, password } : null;
}

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const entrar = async (conEmail: string, conPassword: string) => {
    setError(null);
    setLoading(true);
    try {
      await login(conEmail, conPassword);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!email.trim() || !password) {
      setError(t('entrar.faltanDatos'));
      return;
    }
    await entrar(email, password);
  };

  const demo = cuentaDemo();

  return (
    <PantallaConFoto
      foto={fotosBienvenida.entrar}
      titulo={t('entrar.titulo')}
      subtitulo={t('entrar.subtitulo')}
      onBack={() => navigation.goBack()}
    >
      <Input placeholder={t('entrar.email')} keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} />
      <Input placeholder={t('entrar.contrasena')} secureTextEntry textContentType="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      <ErrorText message={error} />
      <Button title={t('entrar.boton')} onPress={submit} loading={loading} />
      <Button title={t('entrar.olvidada')} variant="link" onPress={() => navigation.navigate('ForgotPassword', { email })} />
      <Button title={t('entrar.sinCuenta')} variant="link" onPress={() => navigation.replace('Register')} />
      {demo && <Button title={t('entrar.demo')} variant="secondary" onPress={() => entrar(demo.email, demo.password)} />}
    </PantallaConFoto>
  );
}
