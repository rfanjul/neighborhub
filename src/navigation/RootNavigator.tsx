import React, { useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, type NavigationState } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';
import type { AuthStackParamList, RootStackParamList } from './types';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ProfileDetailsScreen from '../screens/ProfileDetailsScreen';
import ServiceDetailScreen from '../screens/ServiceDetailScreen';
import CreateServiceScreen from '../screens/CreateServiceScreen';
import ApplyScreen from '../screens/ApplyScreen';
import ServiceOffersScreen from '../screens/ServiceOffersScreen';
import RateHelperScreen from '../screens/RateHelperScreen';
import NeighborProfileScreen from '../screens/NeighborProfileScreen';
import NeighborListScreen from '../screens/NeighborListScreen';
import ChatScreen from '../screens/ChatScreen';
import MainTabs from './MainTabs';
import { t, useIdioma } from '../i18n';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, initializing } = useAuth();
  // Al cambiar de idioma se vuelve a montar la navegación para que todo se
  // pinte en el nuevo, pero en la misma pantalla en la que estaba.
  const idioma = useIdioma();
  const estado = useRef<NavigationState | undefined>(undefined);

  if (initializing) {
    // Splash mientras Firebase restaura la sesión de AsyncStorage.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} accessibilityRole="progressbar" accessibilityLabel={t('comun.cargando')} />
      </View>
    );
  }

  return (
    <NavigationContainer key={idioma} initialState={estado.current} onStateChange={(s) => (estado.current = s)}>
      {!user ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
          {/* Entrar y crear cuenta llevan su propia cabecera con foto y botón de volver. */}
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
          <AuthStack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ headerShown: true, title: '' }}
          />
        </AuthStack.Navigator>
      ) : (
        <AppStack.Navigator screenOptions={{ headerShown: false }}>
          <AppStack.Screen name="Main" component={MainTabs} />
          <AppStack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
          <AppStack.Screen name="Apply" component={ApplyScreen} options={{ presentation: 'modal' }} />
          <AppStack.Screen name="ServiceOffers" component={ServiceOffersScreen} />
          <AppStack.Screen name="RateHelper" component={RateHelperScreen} options={{ presentation: 'modal' }} />
          <AppStack.Screen name="NeighborProfile" component={NeighborProfileScreen} />
          <AppStack.Screen name="NeighborList" component={NeighborListScreen} />
          <AppStack.Screen name="Chat" component={ChatScreen} />
          <AppStack.Screen
            name="CreateService"
            component={CreateServiceScreen}
            options={{ presentation: 'modal' }}
          />
          {/* Los datos del perfil se editan desde Profile, ya no son un paso
              obligatorio antes de ver el muro. */}
          <AppStack.Screen
            name="ProfileDetails"
            component={ProfileDetailsScreen}
            options={{ presentation: 'modal' }}
          />
        </AppStack.Navigator>
      )}
    </NavigationContainer>
  );
}
