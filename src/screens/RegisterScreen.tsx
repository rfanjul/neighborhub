import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { authErrorMessage } from '../auth/errors';
import { Button, ErrorText, Input } from '../components/ui';
import PantallaConFoto from '../components/PantallaConFoto';
import { fotosBienvenida } from '../data/fotosBienvenida';
import { t } from '../i18n';
import AvisoLegal from '../components/AvisoLegal';

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
      setError(t('registro.faltanDatos'));
      return;
    }
    if (password !== confirm) {
      setError(t('registro.noCoinciden'));
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
    <PantallaConFoto
      foto={fotosBienvenida.registro}
      titulo={t('registro.titulo')}
      subtitulo={t('registro.subtitulo')}
      onBack={() => navigation.goBack()}
    >
      <Input placeholder={t('registro.nombre')} autoCapitalize="words" textContentType="name" value={name} onChangeText={setName} />
      <Input placeholder={t('registro.email')} keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} />
      <Input placeholder={t('registro.contrasena')} secureTextEntry textContentType="newPassword" value={password} onChangeText={setPassword} />
      <Input placeholder={t('registro.repetir')} secureTextEntry textContentType="newPassword" value={confirm} onChangeText={setConfirm} onSubmitEditing={submit} />
      <ErrorText message={error} />
      <Button title={t('registro.boton')} onPress={submit} loading={loading} />
      <Button title={t('registro.yaTengo')} variant="link" onPress={() => navigation.replace('Login')} />
      <AvisoLegal />
    </PantallaConFoto>
  );
}
