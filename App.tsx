import React, { useCallback } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts as useBaloo2Fonts, Baloo2_600SemiBold, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';
import {
  useFonts as useWorkSansFonts,
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
} from '@expo-google-fonts/work-sans';
import { AuthProvider } from './src/auth/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme';

// El splash se mantiene hasta que estén las fuentes, para que la app no
// aparezca un instante con la tipografía del sistema.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [balooLoaded] = useBaloo2Fonts({ Baloo2_600SemiBold, Baloo2_700Bold });
  const [workSansLoaded] = useWorkSansFonts({ WorkSans_400Regular, WorkSans_500Medium, WorkSans_600SemiBold });
  const fontsLoaded = balooLoaded && workSansLoaded;

  const onLayout = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayout}>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="dark" />
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}
