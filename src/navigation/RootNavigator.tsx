import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';
import type { AuthStackParamList, RootStackParamList } from './types';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ProfileDetailsScreen from '../screens/ProfileDetailsScreen';
import ProfilePhotoScreen from '../screens/ProfilePhotoScreen';
import ServiceDetailScreen from '../screens/ServiceDetailScreen';
import CreateServiceScreen from '../screens/CreateServiceScreen';
import MainTabs from './MainTabs';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) {
    // Splash mientras Firebase restaura la sesión de AsyncStorage.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} accessibilityRole="progressbar" accessibilityLabel="Cargando" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: true, title: '' }} />
          <AuthStack.Screen name="Register" component={RegisterScreen} options={{ headerShown: true, title: '' }} />
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
          <AppStack.Screen name="ProfilePhoto" component={ProfilePhotoScreen} />
        </AppStack.Navigator>
      )}
    </NavigationContainer>
  );
}
