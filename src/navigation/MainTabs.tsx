import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, MainTabParamList } from './types';
import { colors } from '../theme';
import { HomeIcon, MapIcon, ChatIcon, ProfileIcon, PlusIcon } from '../icons';
import WallScreen from '../screens/WallScreen';
import MapScreen from '../screens/MapScreen';
import ActivityScreen from '../screens/ActivityScreen';
import MyProfileScreen from '../screens/MyProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

function EmptyScreen() {
  return <View />;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

export default function MainTabs({ navigation }: Props) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedLight,
        tabBarStyle: { height: 78, paddingBottom: 14, paddingTop: 10, backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={WallScreen}
        options={{ title: 'Home', tabBarIcon: ({ color }) => <HomeIcon color={color} /> }}
      />
      <Tab.Screen
        name="MapTab"
        component={MapScreen}
        options={{ title: 'Map', tabBarIcon: ({ color }) => <MapIcon color={color} /> }}
      />
      <Tab.Screen
        name="CreateTab"
        component={EmptyScreen}
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View style={styles.fab}>
              <PlusIcon size={22} color={colors.white} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('CreateService');
          },
        }}
      />
      <Tab.Screen
        name="ActivityTab"
        component={ActivityScreen}
        options={{ title: 'Activity', tabBarIcon: ({ color }) => <ChatIcon color={color} /> }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={MyProfileScreen}
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <ProfileIcon color={color} /> }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    shadowColor: colors.accentDark,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
