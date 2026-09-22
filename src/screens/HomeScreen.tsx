import React from 'react';
import { Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Button, Screen, styles } from '../components/ui';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const provider = user?.providerData[0]?.providerId ?? 'password';

  return (
    <Screen>
      <Text style={styles.title}>Hola{user?.displayName ? `, ${user.displayName}` : ''}</Text>
      <Text style={styles.subtitle}>Has entrado correctamente.</Text>
      <Text>Email: {user?.email ?? '—'}</Text>
      <Text>Método: {provider}</Text>
      <Text>UID: {user?.uid}</Text>
      <Button title="Cerrar sesión" variant="secondary" onPress={logout} />
    </Screen>
  );
}
