import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import type { AppStackParamList, AuthStackParamList } from './types';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HomeScreen from '../screens/HomeScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

export default function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) {
    // Splash mientras Firebase restaura la sesión de AsyncStorage.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" accessibilityRole="progressbar" accessibilityLabel="Cargando" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <AppStack.Navigator screenOptions={{ headerShown: false }}>
          <AppStack.Screen name="Home" component={HomeScreen} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: true, title: '' }} />
          <AuthStack.Screen name="Register" component={RegisterScreen} options={{ headerShown: true, title: '' }} />
          <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: true, title: '' }} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
